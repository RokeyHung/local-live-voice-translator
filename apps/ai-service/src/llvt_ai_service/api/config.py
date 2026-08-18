"""REST: đọc/đổi preset đang dùng."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.installed_models import scan
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Preset
from llvt_ai_service.schemas import (
    ConfigResponse,
    ConfigUpdate,
    InstalledModelSchema,
    StageInfoSchema,
)

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


@router.put(
    "/config",
    response_model=ConfigResponse,
    summary="Đổi preset / bật tắt lưu lịch sử",
    description=(
        "Đổi preset sẽ giải phóng bộ provider hiện tại rồi nạp preset mới — có thể mất "
        "vài giây và sẽ tải model nếu máy chưa có. Gửi lại đúng preset đang chạy thì "
        "không nạp lại gì cả, nên có thể dùng để chỉ đổi `historyEnabled`. Trả về "
        "trạng thái sau khi áp dụng."
    ),
)
async def update_config(
    body: ConfigUpdate, container: Container = Depends(get_container)
) -> ConfigResponse:
    if body.historyEnabled is not None:
        container.repository.enabled = body.historyEnabled
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
