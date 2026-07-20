"""Quản lý vòng đời phiên và điều khiển pipeline theo từng kết nối."""

from __future__ import annotations

import time
from typing import Awaitable, Callable

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.application.pipeline import TranslationPipeline
from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import AudioSource, PipelineState
from llvt_ai_service.domain.models import AudioChunk, Session, SessionConfig
from llvt_ai_service.ports.repository import SessionRepository

Emit = Callable[[ev.PipelineEvent], Awaitable[None]]


class SessionController:
    """Điều phối một phiên cho một kết nối WebSocket."""

    def __init__(self, model_manager: ModelManager, repository: SessionRepository, emit: Emit):
        self._mm = model_manager
        self._repo = repository
        self._emit = emit
        self._session: Session | None = None
        self._incoming: TranslationPipeline | None = None
        self._outgoing: TranslationPipeline | None = None
        self._executor = SerialExecutor()

    async def start(self, config: SessionConfig) -> None:
        self._session = Session(config=config)
        await self._repo.save_session(self._session)

        providers = self._mm.providers
        if config.incoming is not None:
            self._incoming = TranslationPipeline(
                providers,
                config.incoming,
                AudioSource.system,
                self._emit,
                synthesize=False,
                executor=self._executor,
            )
        if config.outgoing is not None:
            self._outgoing = TranslationPipeline(
                providers,
                config.outgoing,
                AudioSource.microphone,
                self._emit,
                synthesize=True,
                executor=self._executor,
            )
        await self._emit(ev.StateChanged(PipelineState.listening))

    async def on_ptt(self, pressed: bool) -> None:
        state = PipelineState.speech_detected if pressed else PipelineState.listening
        await self._emit(ev.StateChanged(state))

    async def on_audio(self, chunk: AudioChunk) -> None:
        pipeline = self._incoming if chunk.source == AudioSource.system else self._outgoing
        if pipeline is not None:
            await pipeline.feed(chunk)

    async def stop(self) -> None:
        if self._session is not None:
            self._session.ended_at_ms = int(time.time() * 1000)
        self._incoming = None
        self._outgoing = None
        await self._emit(ev.StateChanged(PipelineState.stopped))


class SessionService:
    """Factory tạo controller; giữ tham chiếu dùng chung (model manager, repo)."""

    def __init__(self, model_manager: ModelManager, repository: SessionRepository):
        self._mm = model_manager
        self._repo = repository

    def new_controller(self, emit: Emit) -> SessionController:
        return SessionController(self._mm, self._repo, emit)
