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
    return ConfigResponse(
        preset=preset,
        availablePresets=list(Preset),
        stages=[
            StageInfoSchema(
                stage=s.stage, adapter=s.adapter, model=s.model, accel=s.accel, loaded=s.loaded
            )
            for s in container.model_manager.stages()
        ],
        modelsDir=str(get_settings().models_dir),
    )


@router.get("/config", response_model=ConfigResponse)
def get_config(container: Container = Depends(get_container)) -> ConfigResponse:
    current = container.model_manager.preset or get_settings().default_preset
    return _describe(container, current)


@router.put("/config", response_model=ConfigResponse)
async def update_config(
    body: ConfigUpdate, container: Container = Depends(get_container)
) -> ConfigResponse:
    await container.model_manager.load_preset(body.preset)
    return _describe(container, body.preset)


@router.get("/models", response_model=list[InstalledModelSchema])
def installed_models() -> list[InstalledModelSchema]:
    """Model đã tải thật trên đĩa, kèm dung lượng thật."""
    return [
        InstalledModelSchema(name=m.name, stage=m.stage, path=m.path, sizeBytes=m.size_bytes)
        for m in scan(get_settings().models_dir)
    ]
