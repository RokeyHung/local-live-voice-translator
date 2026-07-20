"""REST: health."""

from __future__ import annotations

import platform

from fastapi import APIRouter

from llvt_ai_service import __version__
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.schemas import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        version=__version__,
        offlineReady=get_settings().offline_ready,
        platform=f"{platform.system()} {platform.machine()}",
    )
