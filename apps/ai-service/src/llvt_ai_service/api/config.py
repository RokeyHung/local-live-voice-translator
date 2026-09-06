"""REST: đọc/đổi preset, thư mục lưu model và model đã tải."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from huggingface_hub.errors import GatedRepoError, RepositoryNotFoundError

from llvt_ai_service.adapters.asr.faster_whisper import MODEL_MAP as FW_MODELS
from llvt_ai_service.adapters.asr.mlx_whisper import MODEL_MAP as MLX_MODELS
from llvt_ai_service.adapters.asr.whisper_cpp import MODEL_MAP as WHISPER_MODELS
from llvt_ai_service.adapters.mt.nllb import MODEL_MAP as NLLB_MODELS
from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application import model_download
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.installed_models import (
    NotManagedError,
    file_bytes,
    managed_bytes,
    purge,
    remove_one,
    scan,
)
from llvt_ai_service.application.load_progress import progress
from llvt_ai_service.application.model_manager import (
    ASR_REGISTRY,
    ModelLoadCancelled,
    ModelLoadError,
)
from llvt_ai_service.config import runtime_config
from llvt_ai_service.config.presets import custom_config
from llvt_ai_service.config.settings import (
    effective_hf_token,
    get_settings,
    hf_token_source,
    mask_token,
    reload_settings,
)
from llvt_ai_service.domain.enums import Preset
from llvt_ai_service.schemas import (
    ConfigResponse,
    ConfigUpdate,
    CustomChoiceSchema,
    DeletedModels,
    DownloadedModel,
    DownloadRequest,
    HfVerifyRequest,
    HfVerifyResponse,
    InstalledModelSchema,
    LoadProgressResponse,
    StageInfoSchema,
    StorageItemSchema,
    StorageResponse,
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
        diarizationEnabled=settings.diarization_enabled,
        hfTokenSet=bool(effective_hf_token(settings)),
        hfTokenSource=hf_token_source(settings),
        hfTokenHint=mask_token(effective_hf_token(settings)),
        hfTokenEditable=not runtime_config.env_overrides("hf_token"),
        custom=_custom_choices(settings),
    )


# Model nào chạy được trên runtime nào. Ba runtime dùng ba định dạng khác hẳn nhau —
# GGML là file, MLX và CTranslate2 là repo HF đã chuyển đổi sẵn — nên **không** có
# model nào dùng chung được. Gộp chung một danh sách là mời người dùng chọn một tổ
# hợp không tồn tại, và lỗi chỉ lộ ra ở lúc nạp.
ASR_MODELS_BY_ADAPTER: dict[str, list[str]] = {
    "whisper_cpp": list(WHISPER_MODELS),
    "mlx_whisper": list(MLX_MODELS),
    "faster_whisper": list(FW_MODELS),
}


def _custom_choices(settings) -> CustomChoiceSchema:
    """Bộ tự chọn hiện tại + những lựa chọn service THẬT SỰ chạy được."""
    active = custom_config(
        settings.custom_asr_adapter, settings.custom_asr_model, settings.custom_mt_model
    )
    return CustomChoiceSchema(
        asrAdapter=active.asr_adapter,
        asrModel=active.asr_model,
        mtModel=active.mt_model,
        asrAdapterChoices=list(ASR_REGISTRY),
        asrModelChoices=ASR_MODELS_BY_ADAPTER,
        mtModelChoices=list(NLLB_MODELS),
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


def _apply_hf_token(raw: str) -> None:
    """Lưu (hoặc xoá) access token HuggingFace.

    Chuỗi rỗng = gỡ token đã lưu. Không nạp lại model: token chỉ có tác dụng cho lần
    **tải** model kế tiếp, còn model đang nằm trong RAM thì đã tải xong rồi. Ai vừa
    thêm token để sửa một khâu tải hỏng thì bấm "Nạp lại" ở màn Quản lý model.
    """
    if runtime_config.env_overrides("hf_token"):
        raise HTTPException(
            status_code=409,
            detail="Token đang do biến môi trường LLVT_HF_TOKEN quyết định.",
        )
    token = raw.strip()
    runtime_config.save(hf_token=token)
    # `reload_settings` gọi luôn `publish_hf_token`, nên biến HF_TOKEN được cập nhật
    # ngay và mọi thư viện HuggingFace thấy token mới ở lần tải sau.
    reload_settings()
    # KHÔNG log giá trị token — chỉ log việc đã đổi (SPEC 14: log không chứa bí mật).
    logger.info("Đã %s access token HuggingFace", "lưu" if token else "gỡ")


@router.post(
    "/hf/verify",
    response_model=HfVerifyResponse,
    summary="Kiểm tra access token HuggingFace",
    description=(
        "Hỏi `huggingface.co` xem token có dùng được không và trả về tên tài khoản. "
        "Gửi `token` để thử một token **chưa lưu** (ô nhập vừa dán), bỏ trống để kiểm "
        "tra token đang có hiệu lực.\n\n"
        "Đây là lệnh **duy nhất** chủ động gọi ra Internet, và chỉ khi người dùng bấm. "
        "Có nó vì cách còn lại để biết token sai là chờ hết một lượt tải model vài "
        "phút rồi mới thấy lỗi 401.\n\n"
        "Token sai **không phải lỗi của request**: trả 200 với `ok: false` kèm lý do, "
        "để giao diện hiện được thông báo thay vì phải bắt mã lỗi HTTP."
    ),
)
async def verify_hf_token(body: HfVerifyRequest) -> HfVerifyResponse:
    token = body.token.strip() or effective_hf_token()
    if not token:
        return HfVerifyResponse(ok=False, error="Chưa có token nào để kiểm tra.")

    def _whoami() -> dict[str, Any]:
        from huggingface_hub import whoami

        return whoami(token=token)

    try:
        # Blocking (gọi HTTP) → đẩy ra khỏi event loop.
        identity = await asyncio.to_thread(_whoami)
    except Exception as exc:  # noqa: BLE001 — token sai và mất mạng đều về một cửa
        # str(exc) của huggingface_hub có thể kèm URL nhưng KHÔNG kèm token.
        logger.info("Kiểm tra token HuggingFace thất bại: %s", type(exc).__name__)
        return HfVerifyResponse(ok=False, error=str(exc))
    return HfVerifyResponse(ok=True, user=str(identity.get("name") or ""))


def _apply_custom(body: ConfigUpdate) -> bool:
    """Lưu lựa chọn model tự chọn; trả True nếu có gì đó thật sự đổi."""
    changes = {
        "custom_asr_adapter": body.customAsrAdapter,
        "custom_asr_model": body.customAsrModel,
        "custom_mt_model": body.customMtModel,
    }
    changes = {k: v for k, v in changes.items() if v is not None}
    if not changes:
        return False
    settings = get_settings()
    adapter = changes.get("custom_asr_adapter") or settings.custom_asr_adapter
    adapter = adapter or custom_config().asr_adapter
    if adapter not in ASR_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Không có adapter ASR tên {adapter!r}.")

    # Model phải thuộc ĐÚNG runtime đang chọn. Trước đây chỉ kiểm "có tồn tại ở đâu
    # đó", nên chọn mlx_whisper + một file GGML vẫn lưu được, rồi lúc nạp thì MLX đi
    # hỏi HuggingFace một repo tên `ggml-....bin` và ném 404 — người dùng thấy "chọn
    # model không ăn thua" mà không biết vì sao.
    model = changes.get("custom_asr_model")
    if model and model not in ASR_MODELS_BY_ADAPTER[adapter]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{model!r} không chạy được trên runtime {adapter!r}. "
                f"Ba runtime dùng ba định dạng khác nhau nên không có model dùng chung."
            ),
        )
    # Đổi mỗi runtime mà giữ nguyên model cũ cũng ra tổ hợp hỏng → trả model về mặc
    # định của runtime mới thay vì để nó gãy lúc nạp.
    if changes.get("custom_asr_adapter") and "custom_asr_model" not in changes:
        if settings.custom_asr_model not in ASR_MODELS_BY_ADAPTER[adapter]:
            changes["custom_asr_model"] = ""

    mt = changes.get("custom_mt_model")
    if mt and mt not in NLLB_MODELS:
        raise HTTPException(status_code=400, detail=f"Không có model MT tên {mt!r}.")

    runtime_config.save(**changes)
    reload_settings()
    return True


@router.put(
    "/config",
    response_model=ConfigResponse,
    summary="Đổi preset / thư mục model / bật tắt lưu lịch sử",
    description=(
        "Đổi preset sẽ giải phóng bộ provider hiện tại rồi nạp preset mới — có thể mất "
        "vài giây và sẽ tải model nếu máy chưa có. Gửi lại đúng preset đang chạy thì "
        "không nạp lại gì cả, nên có thể dùng để chỉ đổi `historyEnabled` hoặc "
        "`modelsDir`.\n\n"
        "`hfToken` lưu access token HuggingFace để tải model gated (pyannote); gửi "
        "chuỗi rỗng để gỡ token đã lưu. Token **không bao giờ** được trả về nguyên "
        "văn — xem `hfTokenSet`/`hfTokenHint`. Đổi token không nạp lại model (token "
        "chỉ dùng cho lần *tải* kế tiếp); trả 409 nếu `LLVT_HF_TOKEN` đang được đặt.\n\n"
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
    if body.hfToken is not None:
        _apply_hf_token(body.hfToken)
    if _apply_custom(body) and container.model_manager.preset is Preset.custom:
        # Bộ tự chọn vừa đổi mà model cũ còn trong RAM thì `stages` báo một đằng, bộ
        # nhớ giữ một nẻo. Giải phóng chứ KHÔNG nạp lại — xem ghi chú bên dưới.
        await container.model_manager.unload()
    if body.modelsDir is not None:
        await _apply_models_dir(container, body.modelsDir)
    if body.preset != container.model_manager.preset:
        # Đổi preset chỉ GHI NHẬN lựa chọn, không nạp. Nạp là việc của nút "Khởi động
        # model" (`POST /api/models/load`): trước đây bấm một ô preset là đứng chờ hàng
        # chục giây, lần đầu còn tải vài GB — không ai chờ đợi điều đó khi chỉ đang
        # xem thử các mức. Model đang nạp thuộc preset CŨ nên phải giải phóng, nếu
        # không giao diện sẽ hiện một bộ model không khớp với ô đang sáng.
        await container.model_manager.unload()
        container.model_manager.select_preset(body.preset)
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
    "/models/download",
    response_model=DownloadedModel,
    summary="Tải một model cụ thể về đĩa",
    description=(
        "Tải đúng một model trong danh mục về `modelsDir` mà **không** nạp vào bộ nhớ "
        "và **không** đổi preset đang chạy — dùng để chuẩn bị trước cho lần dùng "
        "offline, hoặc để thử một model khác.\n\n"
        "Tên model là **đường dẫn thật ở thượng nguồn**, đúng chuỗi hiện trong danh "
        "mục ở màn Quản lý model: `ggml-small-q5_1.bin` (file trong "
        "`ggerganov/whisper.cpp`), `mlx-community/whisper-large-v3-asr-fp16`, "
        "`Systran/faster-whisper-small`, `facebook/nllb-200-distilled-600M`, "
        "`vits-piper-vi_VN-vais1000-medium`, `pyannote/...`. Model đã có sẵn thì lệnh "
        "trả về ngay.\n\n"
        "Model **ngoài danh mục** (một repo HuggingFace bất kỳ) cũng tải được, nhưng "
        "phải kèm `kind` để service biết đặt vào thư mục nào và runtime nào sẽ chạy "
        "nó — `org/repo` nhìn từ ngoài thì repo nào cũng như repo nào.\n\n"
        "**Chặn tới khi tải xong** — hàng GB nên có thể mất vài phút. Trả 400 nếu tên "
        "không có trong danh mục, **404** nếu đường dẫn không tồn tại trên "
        "HuggingFace (thường là gõ sai), **403** nếu đó là repo *gated* mà tài khoản "
        "chưa được cấp quyền (token vẫn hợp lệ — phải xin quyền trên web), 503 nếu "
        "tải hỏng vì lý do khác (thường là mất mạng)."
    ),
)
async def download_model(
    body: DownloadRequest, container: Container = Depends(get_container)
) -> DownloadedModel:
    del container  # không đụng tới model đang nạp
    settings = get_settings()
    try:
        stage, _kind = model_download.resolve(body.name, body.kind)
    except model_download.UnknownModelError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        # Tải là I/O mạng blocking → đẩy ra khỏi event loop, nếu không cả service
        # đứng hình (kể cả /health) suốt lúc tải.
        path = await asyncio.to_thread(
            model_download.download, body.name, settings.models_dir, body.kind
        )
    except GatedRepoError as exc:
        # Repo gated: token hợp lệ nhưng tài khoản CHƯA được cấp quyền. Đây là việc
        # người dùng phải làm trên web, không phải sự cố tạm thời — trả 403 chứ không
        # phải 503, vì 503 hàm ý "thử lại sau" và người dùng sẽ bấm lại mãi.
        logger.warning("Model %s là repo gated, tài khoản chưa được cấp quyền", body.name)
        raise HTTPException(
            status_code=403,
            detail=(
                f"{body.name} là repo *gated*: token của bạn hợp lệ nhưng tài khoản "
                f"chưa được cấp quyền. Mở https://huggingface.co/{body.name} , điền "
                "biểu mẫu xin quyền rồi bấm lại — không cần đổi token."
            ),
        ) from exc
    except RepositoryNotFoundError as exc:
        # Phải đứng SAU GatedRepoError: gated là lớp con của not-found, đảo thứ tự thì
        # repo gated cũng rơi vào đây và người dùng được bảo là "gõ sai đường dẫn".
        # Người dùng gõ được đường dẫn tuỳ ý nên gõ sai là kiểu hỏng thường gặp nhất.
        # Đó là lỗi của yêu cầu, không phải của service: 503 sẽ khiến giao diện mời
        # "thử lại sau" cho một cái repo không bao giờ tồn tại.
        raise HTTPException(
            status_code=404,
            detail=(
                f"Không có repo {body.name} trên HuggingFace (hoặc nó là repo riêng "
                "tư mà token hiện tại không đọc được). Kiểm tra lại đường dẫn."
            ),
        ) from exc
    except Exception as exc:  # noqa: BLE001 — mất mạng, hết đĩa: cùng một cửa
        logger.warning("Tải model %s thất bại: %s", body.name, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Không tải được {body.name}: {exc}",
        ) from exc
    return DownloadedModel(name=body.name, stage=stage, path=str(path))


@router.delete(
    "/models/one",
    response_model=DeletedModels,
    summary="Xoá một model đã tải",
    description=(
        "Xoá đúng một model, theo `path` mà `GET /api/models` trả về. Chỉ xoá được "
        "thứ nằm trong thư mục do app tạo **và** thật sự có trong danh sách đã tải — "
        "đường dẫn tuỳ ý bị từ chối bằng 400.\n\n"
        "Model đang nằm trong bộ nhớ vẫn chạy tiếp (nó đã ở RAM); lần nạp sau mới phải "
        "tải lại. Trên Windows, xoá file đang mở sẽ hỏng — giải phóng model trước."
    ),
)
def delete_one_model(path: str) -> DeletedModels:
    try:
        freed = remove_one(get_settings().models_dir, path)
    except NotManagedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=409, detail=f"Không xoá được: {exc}") from exc
    return DeletedModels(removed=[path], freedBytes=freed)


@router.get(
    "/storage",
    response_model=StorageResponse,
    summary="Dung lượng đĩa service đang chiếm",
    description=(
        "Đo THẬT trên đĩa, không ước lượng: `models` là tổng các thư mục do app tạo "
        "trong `modelsDir` (đúng những thư mục `DELETE /api/models` sẽ xoá), `history` "
        "là file SQLite lịch sử kèm `-wal`/`-shm` đi cùng nó.\n\n"
        "`models` nhỉnh hơn tổng của `GET /api/models` một chút vì cache HuggingFace "
        "còn có `refs`/`.locks` nằm ngoài các thư mục model được liệt kê. Service không "
        "có thư mục cache hay file log riêng nào khác."
    ),
)
def storage() -> StorageResponse:
    settings = get_settings()
    items = [
        StorageItemSchema(
            key="models",
            path=str(settings.models_dir),
            sizeBytes=managed_bytes(settings.models_dir),
        ),
        StorageItemSchema(
            key="history",
            path=str(settings.db_path),
            sizeBytes=file_bytes(settings.db_path),
        ),
    ]
    return StorageResponse(items=items, totalBytes=sum(item.sizeBytes for item in items))


@router.post(
    "/models/load",
    response_model=ConfigResponse,
    summary="Nạp model vào bộ nhớ",
    description=(
        "Nạp model của preset đang chọn. Service **không** nạp lúc khởi động, nên đây là "
        "nút bấm tương ứng với 'Khởi động model' ở màn Quản lý model.\n\n"
        "Lệnh này **chặn cho tới khi nạp xong** — lần đầu còn phải tải model về nên có "
        "thể mất vài phút; những lần sau chỉ vài chục giây. Gọi lại khi model đã nạp thì "
        "không làm gì, trừ khi `reload=true` (nạp lại từ đầu).\n\n"
        "Dừng giữa chừng bằng `POST /api/models/load/cancel`; khi đó lệnh này trả **409**."
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
    except ModelLoadCancelled as exc:
        # Người dùng chủ động dừng — không phải lỗi. 409 để giao diện phân biệt được
        # với 503 (mất mạng) và không hiện thông báo lỗi đỏ.
        raise HTTPException(
            status_code=409,
            detail=f"Đã dừng lượt nạp model trước khâu {exc.stage} theo yêu cầu.",
        ) from exc
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


@router.post(
    "/models/load/cancel",
    status_code=204,
    summary="Dừng lượt nạp model đang chạy",
    description=(
        "Xin dừng lượt nạp. Vòng nạp dừng ở **ranh giới khâu kế tiếp**, rồi "
        "`POST /api/models/load` trả 409 và những khâu đã nạp xong được giải phóng "
        "(nạp nửa vời còn tệ hơn không nạp).\n\n"
        "Không dừng được một lượt **tải đang chạy**: huggingface_hub và pywhispercpp "
        "tải trong worker thread, mà thread thì không giết ngang được — khâu đang tải "
        "sẽ tải nốt. Vẫn đáng bấm, vì chỗ tốn nhất thường là khâu SAU (bấm huỷ trước "
        "khi tới NLLB là tiết kiệm ~2,4 GB).\n\n"
        "Không có gì đang nạp thì lệnh này không làm gì cả (không phải lỗi)."
    ),
)
def cancel_load() -> None:
    progress.request_cancel()


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
