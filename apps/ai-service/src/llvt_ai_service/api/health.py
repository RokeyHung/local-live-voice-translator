"""REST endpoints cơ bản (health)."""

from __future__ import annotations

import platform

from fastapi import APIRouter

from llvt_ai_service import __version__
from llvt_ai_service.config import settings
from llvt_ai_service.protocol import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(
        version=__version__,
        offlineReady=settings.offline_ready,
        platform=f"{platform.system()} {platform.machine()}",
    )
