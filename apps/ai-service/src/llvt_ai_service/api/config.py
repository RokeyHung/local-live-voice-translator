"""REST: đọc/đổi preset, thư mục lưu model và model đã tải."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.installed_models import purge, scan
from llvt_ai_service.application.load_progress import progress
from llvt_ai_service.application.model_manager import ModelLoadError
from llvt_ai_service.config import runtime_config
from llvt_ai_service.config.settings import get_settings, reload_settings
from llvt_ai_service.domain.enums import Preset
from llvt_ai_service.schemas import (
    ConfigResponse,
    ConfigUpdate,
    DeletedModels,
    InstalledModelSchema,
    LoadProgressResponse,
    StageInfoSchema,
)

logger = logging.getLogger("llvt.api.config")

router = APIRouter(prefix="/api", tags=["config"])


def _describe(container: Container, preset: Preset) -> ConfigResponse:
    settings = get_settings()
    return ConfigResponse(
        preset=preset,
        availablePresets=list(Preset),
        stages=[
            StageInfoSchema(
                stage=s.stage, adapter=s.adapter, model=s.model, accel=s.accel, loaded=s.loaded
            )
            for s in container.model_manager.stages()
        ],
        modelsDir=str(settings.models_dir),
        modelsDirEditable=not runtime_config.env_overrides("models_dir"),
        historyDbPath=str(settings.db_path),
        historyEnabled=container.repository.enabled,
    )


@router.get(
    "/config",
    response_model=ConfigResponse,
    summary="Preset đang dùng + trạng thái từng khâu",
    description=(
        "`stages` được dựng từ chính provider đang nạp trong bộ nhớ: model thật, "
        "thiết bị tính toán thật (Metal/mps/CPU) và đã nạp hay chưa. Giao diện đọc "
        "trực tiếp từ đây thay vì giữ một bảng cấu hình chép tay."
    ),
)
def get_config(container: Container = Depends(get_container)) -> ConfigResponse:
    current = container.model_manager.preset or get_settings().default_preset
    return _describe(container, current)


async def _apply_models_dir(container: Container, raw: str) -> None:
    """Đổi thư mục lưu model: kiểm tra ghi được → lưu lại → giải phóng model đang nạp."""
    if runtime_config.env_overrides("models_dir"):
        raise HTTPException(
            status_code=409,
            detail="Thư mục model đang do biến môi trường LLVT_MODELS_DIR quyết định.",
        )
    target = Path(raw).expanduser()
    if not target.is_absolute():
        raise HTTPException(status_code=400, detail="Cần đường dẫn tuyệt đối.")
    try:
        target.mkdir(parents=True, exist_ok=True)
        probe = target / ".llvt-write-test"
        probe.touch()
        probe.unlink()
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"Không ghi được vào thư mục: {exc}") from exc

    if target == get_settings().models_dir:
        return
    runtime_config.save(models_dir=str(target))
    reload_settings()
    # Provider đang nạp trỏ vào thư mục cũ nên không còn đúng nữa. Giải phóng thay vì
    # nạp lại ngay: thư mục mới thường rỗng, nạp lại sẽ kéo vài GB ngay trong request.
    # Phiên kế tiếp (hoặc nút nạp model) sẽ tự nạp từ chỗ mới.
    await container.model_manager.unload()
    logger.info("Đổi thư mục model sang %s; đã giải phóng provider", target)


@router.put(
    "/config",
    response_model=ConfigResponse,
    summary="Đổi preset / thư mục model / bật tắt lưu lịch sử",
    description=(
        "Đổi preset sẽ giải phóng bộ provider hiện tại rồi nạp preset mới — có thể mất "
        "vài giây và sẽ tải model nếu máy chưa có. Gửi lại đúng preset đang chạy thì "
        "không nạp lại gì cả, nên có thể dùng để chỉ đổi `historyEnabled` hoặc "
        "`modelsDir`.\n\n"
        "`modelsDir` được lưu vào `~/.llvt/settings.json` nên còn nguyên ở lần mở sau. "
        "Model **đã tải không được di chuyển** — thư mục mới rỗng thì lần nạp kế tiếp sẽ "
        "tải lại. Đổi xong, model đang nằm trong RAM được giải phóng và sẽ nạp lại từ "
        "chỗ mới khi bắt đầu phiên. Trả 409 nếu `LLVT_MODELS_DIR` đang được đặt."
    ),
)
async def update_config(
    body: ConfigUpdate, container: Container = Depends(get_container)
) -> ConfigResponse:
    if body.historyEnabled is not None:
        container.repository.enabled = body.historyEnabled
    if body.modelsDir is not None:
        await _apply_models_dir(container, body.modelsDir)
    current = container.model_manager.preset
    if body.preset != current:
        await container.model_manager.load_preset(body.preset)
    return _describe(container, body.preset)


@router.get(
    "/models",
    response_model=list[InstalledModelSchema],
    summary="Model đã tải trên đĩa",
    description=(
        "Quét thư mục model thật (`whisper-cpp/*.bin`, cache HuggingFace của NLLB, "
        "thư mục voice của sherpa-onnx) và trả dung lượng thật của từng cái."
    ),
)
def installed_models() -> list[InstalledModelSchema]:
    return [
        InstalledModelSchema(name=m.name, stage=m.stage, path=m.path, sizeBytes=m.size_bytes)
        for m in scan(get_settings().models_dir)
    ]


@router.post(
    "/models/load",
    response_model=ConfigResponse,
    summary="Nạp model vào bộ nhớ",
    description=(
        "Nạp model của preset đang chọn. Service **không** nạp lúc khởi động, nên đây là "
        "nút bấm tương ứng với 'Khởi động model' ở màn Quản lý model.\n\n"
        "Lệnh này **chặn cho tới khi nạp xong** — lần đầu còn phải tải model về nên có "
        "thể mất vài phút; những lần sau chỉ vài chục giây. Gọi lại khi model đã nạp thì "
        "không làm gì, trừ khi `reload=true` (nạp lại từ đầu)."
    ),
)
async def load_models(
    reload: bool = False, container: Container = Depends(get_container)
) -> ConfigResponse:
    manager = container.model_manager
    preset = manager.preset or get_settings().default_preset
    try:
        if reload:
            await manager.load_preset(preset)
        else:
            await manager.ensure_loaded()
    except ModelLoadError as exc:
        # Hầu hết trường hợp là mất mạng giữa lúc tải model, hoặc hết chỗ trên đĩa —
        # lỗi của môi trường chứ không phải của request, nên 503 chứ không phải 500.
        raise HTTPException(
            status_code=503,
            detail=(
                f"Không nạp được model cho khâu {exc.stage}. Lần đầu cần mạng để tải model — "
                f"kiểm tra kết nối rồi bấm lại. Chi tiết: {exc.cause}"
            ),
        ) from exc
    return _describe(container, preset)


@router.get(
    "/models/progress",
    response_model=LoadProgressResponse,
    summary="Tiến trình nạp model",
    description=(
        "Trả tiến trình của lượt nạp **đang chạy** — hỏi song song trong lúc "
        "`POST /api/models/load` còn đang chặn (giao diện hỏi lại mỗi ~0,7 giây).\n\n"
        "`doneBytes` là số byte **đo được** trên đĩa, không phải ước lượng. Model nào "
        "không biết dung lượng thì `totalBytes`/`percent` là `null` — giao diện hiện số "
        "MB đã tải thay vì một phần trăm không có thật. `estimated: true` nghĩa là tổng "
        "chỉ xấp xỉ."
    ),
)
def models_progress() -> LoadProgressResponse:
    return LoadProgressResponse(**progress.snapshot())


@router.post(
    "/models/unload",
    response_model=ConfigResponse,
    summary="Giải phóng model khỏi bộ nhớ",
    description="Trả RAM lại cho máy; phiên kế tiếp sẽ tự nạp lại.",
)
async def unload_models(container: Container = Depends(get_container)) -> ConfigResponse:
    await container.model_manager.unload()
    return _describe(container, container.model_manager.preset or get_settings().default_preset)


@router.delete(
    "/models",
    response_model=DeletedModels,
    summary="Xoá model đã tải",
    description=(
        "Xoá các thư mục model do app tạo ra trong `modelsDir` (`whisper-cpp`, `nllb`, "
        "`sherpa-tts`, `kokoro-ja`) — **không** đụng tới thứ khác nằm cùng thư mục. "
        "Model đang nạp trong RAM được giải phóng trước khi xoá. Sau lệnh này máy phải "
        "tải lại model khi bắt đầu phiên, nên chỉ dùng khi cần lấy lại dung lượng đĩa."
    ),
)
async def delete_models(container: Container = Depends(get_container)) -> DeletedModels:
    # Giải phóng trước: file đang mở thì Windows không cho xoá.
    await container.model_manager.unload()
    removed, freed = purge(get_settings().models_dir)
    logger.info("Đã xoá model: %s (giải phóng %.1f MB)", removed or "không có", freed / 1e6)
    return DeletedModels(removed=removed, freedBytes=freed)
