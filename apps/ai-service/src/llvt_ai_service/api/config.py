"""REST: đọc/đổi preset đang dùng."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Preset
from llvt_ai_service.schemas import ConfigResponse, ConfigUpdate

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config", response_model=ConfigResponse)
def get_config(container: Container = Depends(get_container)) -> ConfigResponse:
    current = container.model_manager.preset or get_settings().default_preset
    return ConfigResponse(preset=current, availablePresets=list(Preset))


@router.put("/config", response_model=ConfigResponse)
async def update_config(
    body: ConfigUpdate, container: Container = Depends(get_container)
) -> ConfigResponse:
    await container.model_manager.load_preset(body.preset)
    return ConfigResponse(preset=body.preset, availablePresets=list(Preset))
