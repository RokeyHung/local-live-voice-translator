"""FastAPI app cho Local AI Service. Chỉ phục vụ trên 127.0.0.1."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from llvt_ai_service import __version__
from llvt_ai_service.api import health
from llvt_ai_service.config import settings
from llvt_ai_service.ws import session

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="LLVT Local AI Service", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(session.router)
