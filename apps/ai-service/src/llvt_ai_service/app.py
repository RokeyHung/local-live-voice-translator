"""FastAPI app factory + lifespan (composition root cho DI)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from llvt_ai_service import __version__
from llvt_ai_service.adapters.persistence.sqlite import SqliteSessionRepository
from llvt_ai_service.api import config as config_api
from llvt_ai_service.api import diagnostics, health, sessions
from llvt_ai_service.api.docs import mount_docs
from llvt_ai_service.api.openapi_meta import DESCRIPTION, TAGS_METADATA
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.history import HistoryPolicy
from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.application.session_service import SessionService
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.ws import session as ws_session

logger = logging.getLogger("llvt")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    store = SqliteSessionRepository(settings.db_path)
    # Chính sách bật/tắt lưu bọc ngoài adapter; phần còn lại chỉ thấy một repository.
    repository = HistoryPolicy(store, enabled=settings.history_enabled)
    model_manager = ModelManager()
    if settings.preload_models:
        await model_manager.load_preset(settings.default_preset)
    else:
        # Không nạp vội: khởi động service phải nhanh và không được tự ý tải vài GB.
        model_manager.select_preset(settings.default_preset)
    session_service = SessionService(model_manager, repository)

    app.state.container = Container(
        settings=settings,
        repository=repository,
        model_manager=model_manager,
        session_service=session_service,
    )
    logger.info(
        "AI service ready (preset=%s, model=%s, history=%s, db=%s)",
        settings.default_preset.value,
        "đã nạp" if model_manager.loaded else "chưa nạp (nạp khi cần)",
        "on" if settings.history_enabled else "off",
        settings.db_path,
    )
    try:
        yield
    finally:
        await model_manager.unload()
        store.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    app = FastAPI(
        title="LLVT Local AI Service",
        version=__version__,
        description=DESCRIPTION,
        openapi_tags=TAGS_METADATA,
        lifespan=lifespan,
        # /docs được thay bằng bản dùng asset cục bộ (xem api/docs.py); ReDoc nạp
        # từ CDN nên tắt hẳn — service phải mở được tài liệu khi không có mạng.
        docs_url=None,
        redoc_url=None,
        license_info={"name": "MIT"},
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(config_api.router)
    app.include_router(sessions.router)
    app.include_router(diagnostics.router)
    app.include_router(ws_session.router)
    mount_docs(app)
    return app


app = create_app()
