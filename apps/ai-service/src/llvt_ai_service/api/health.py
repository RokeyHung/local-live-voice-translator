"""REST: health."""

from __future__ import annotations

import platform

from fastapi import APIRouter

from llvt_ai_service import __version__
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.schemas import HealthResponse

router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Kiểm tra service",
    description=(
        "Trả về phiên bản, nền tảng và cờ `offlineReady`. Ứng dụng desktop gọi "
        "endpoint này định kỳ để hiện chấm trạng thái ở thanh bên."
    ),
)
def health() -> HealthResponse:
    return HealthResponse(
        version=__version__,
        offlineReady=get_settings().offline_ready,
        platform=f"{platform.system()} {platform.machine()}",
    )
