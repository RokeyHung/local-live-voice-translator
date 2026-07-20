"""Local AI service for Local Live Voice Translator."""

from __future__ import annotations

__version__ = "0.1.0"


def main() -> None:
    """Entry point cho `llvt-ai-service`. Chỉ phục vụ trên 127.0.0.1."""
    import uvicorn

    from llvt_ai_service.config import settings

    uvicorn.run(
        "llvt_ai_service.server:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )
