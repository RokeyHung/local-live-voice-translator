"""Adapter lưu trữ: in-memory (mặc định cho dev/skeleton).

TODO (Tuần 6): thay bằng adapter SQLite (SQLAlchemy + Alembic) ở
adapters/persistence/sqlite/. Interface giữ nguyên nên pipeline không đổi.
"""

from __future__ import annotations

from llvt_ai_service.domain.models import Session, Utterance
from llvt_ai_service.ports.repository import SessionRepository


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._utterances: dict[str, list[Utterance]] = {}

    async def save_session(self, session: Session) -> None:
        self._sessions[session.id] = session

    async def save_utterance(self, utterance: Utterance) -> None:
        self._utterances.setdefault(utterance.session_id, []).append(utterance)

    async def list_sessions(self) -> list[Session]:
        return list(self._sessions.values())

    async def get_utterances(self, session_id: str) -> list[Utterance]:
        return list(self._utterances.get(session_id, []))

    async def delete_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        self._utterances.pop(session_id, None)
