"""Port: lưu trữ phiên và utterance (lịch sử)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from llvt_ai_service.domain.models import Session, Utterance


class SessionRepository(ABC):
    @abstractmethod
    async def save_session(self, session: Session) -> None: ...

    @abstractmethod
    async def save_utterance(self, utterance: Utterance) -> None: ...

    @abstractmethod
    async def list_sessions(self) -> list[Session]: ...

    @abstractmethod
    async def get_utterances(self, session_id: str) -> list[Utterance]: ...

    @abstractmethod
    async def delete_session(self, session_id: str) -> None: ...
