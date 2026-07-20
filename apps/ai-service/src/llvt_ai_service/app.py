"""FastAPI app factory + lifespan (composition root cho DI)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from llvt_ai_service import __version__
from llvt_ai_service.adapters.persistence.memory import InMemorySessionRepository
from llvt_ai_service.api import config as config_api
from llvt_ai_service.api import health, sessions
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.application.session_service import SessionService
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.ws import session as ws_session

logger = logging.getLogger("llvt")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    repository = InMemorySessionRepository()
    model_manager = ModelManager()
    await model_manager.load_preset(settings.default_preset)
    session_service = SessionService(model_manager, repository)

    app.state.container = Container(
        settings=settings,
        repository=repository,
        model_manager=model_manager,
        session_service=session_service,
    )
    logger.info("AI service ready (preset=%s)", settings.default_preset.value)
    try:
        yield
    finally:
        await model_manager.unload()


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    app = FastAPI(title="LLVT Local AI Service", version=__version__, lifespan=lifespan)
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
    app.include_router(ws_session.router)
    return app


app = create_app()
