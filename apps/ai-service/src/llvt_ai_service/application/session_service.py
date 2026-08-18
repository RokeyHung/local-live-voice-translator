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
        # Push-to-talk là chế độ mặc định: mic chỉ được xử lý khi đang GIỮ nút.
        self._ptt_active = False
        self._muted = False

    async def start(self, config: SessionConfig, title: str = "") -> None:
        self._session = Session(config=config, title=title)
        await self._repo.save_session(self._session)
        self._ptt_active = False
        self._muted = False

        # Model có thể đang trống (vừa đổi thư mục model hoặc vừa xoá) → nạp lại.
        providers = await self._mm.ensure_loaded()
        session_id = self._session.id
        if config.incoming is not None:
            self._incoming = TranslationPipeline(
                providers,
                config.incoming,
                AudioSource.system,
                self._emit,
                synthesize=False,
                session_id=session_id,
                executor=self._executor,
                repository=self._repo,
            )
        if config.outgoing is not None:
            self._outgoing = TranslationPipeline(
                providers,
                config.outgoing,
                AudioSource.microphone,
                self._emit,
                synthesize=True,
                session_id=session_id,
                executor=self._executor,
                repository=self._repo,
            )
        # Kèm sessionId để client biết phiên nào trong lịch sử ứng với phiên đang chạy.
        await self._emit(ev.StateChanged(PipelineState.listening, session_id=session_id))

    async def on_ptt(self, pressed: bool) -> None:
        self._ptt_active = pressed
        if pressed:
            await self._emit(ev.StateChanged(PipelineState.speech_detected))
        else:
            # Nhả nút: chốt câu đang nói dở (client đã ngừng gửi audio).
            if self._outgoing is not None:
                await self._outgoing.flush()
            await self._emit(ev.StateChanged(PipelineState.listening))

    async def on_mute(self, muted: bool) -> None:
        self._muted = muted
        # Bật mute giữa chừng: bỏ phần đang nói dở, không phát nốt ra micro ảo.
        if muted and self._outgoing is not None:
            self._outgoing.discard()
        await self._emit(ev.StateChanged(PipelineState.listening))

    async def on_audio(self, chunk: AudioChunk) -> None:
        if chunk.source == AudioSource.system:
            # Chiều incoming (nghe remote) chạy liên tục, không chịu PTT/mute.
            if self._incoming is not None:
                await self._incoming.feed(chunk)
            return
        # Chiều outgoing (mic): chỉ xử lý khi đang giữ PTT và không mute.
        if self._outgoing is not None and self._ptt_active and not self._muted:
            await self._outgoing.feed(chunk)

    async def stop(self) -> None:
        session_id = ""
        if self._session is not None:
            self._session.ended_at_ms = int(time.time() * 1000)
            # Ghi lại để mốc kết thúc vào được lịch sử; phiên còn `ended_at` rỗng ở
            # lần mở app sau nghĩa là app tắt đột ngột giữa phiên.
            await self._repo.save_session(self._session)
            session_id = self._session.id
        self._incoming = None
        self._outgoing = None
        self._ptt_active = False
        await self._emit(ev.StateChanged(PipelineState.stopped, session_id=session_id or None))


class SessionService:
    """Factory tạo controller; giữ tham chiếu dùng chung (model manager, repo)."""

    def __init__(self, model_manager: ModelManager, repository: SessionRepository):
        self._mm = model_manager
        self._repo = repository

    def new_controller(self, emit: Emit) -> SessionController:
        return SessionController(self._mm, self._repo, emit)
