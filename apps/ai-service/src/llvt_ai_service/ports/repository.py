"""Port: lưu trữ phiên và utterance (lịch sử)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from llvt_ai_service.domain.models import Session, Utterance


class SessionRepository(ABC):
    @abstractmethod
    async def save_session(self, session: Session) -> None:
        """Thêm mới hoặc cập nhật (upsert) một phiên."""

    @abstractmethod
    async def save_utterance(self, utterance: Utterance) -> None:
        """Thêm mới hoặc cập nhật (upsert) một câu của phiên."""

    @abstractmethod
    async def get_session(self, session_id: str) -> Session | None: ...

    @abstractmethod
    async def list_sessions(self, query: str | None = None) -> list[Session]:
        """Phiên mới nhất trước. ``query`` lọc theo tên phiên hoặc nội dung câu."""

    @abstractmethod
    async def get_utterances(self, session_id: str) -> list[Utterance]: ...

    @abstractmethod
    async def count_utterances(self, session_id: str) -> int: ...

    @abstractmethod
    async def delete_session(self, session_id: str) -> None: ...

    @abstractmethod
    async def delete_all_sessions(self) -> None: ...
