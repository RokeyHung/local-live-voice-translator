"""Adapter lưu trữ: in-memory (dùng cho test và khi chạy không cần lưu trên đĩa).

Bản lưu bền là ``adapters/persistence/sqlite.py``; hai adapter cùng một port nên
đổi qua lại chỉ là một dòng ở composition root (``app.py``).
"""

from __future__ import annotations

from dataclasses import replace

from llvt_ai_service.domain.models import Session, Utterance
from llvt_ai_service.ports.repository import SessionRepository


def _matches(session: Session, utterances: list[Utterance], needle: str) -> bool:
    if needle in session.title.lower():
        return True
    return any(
        needle in (u.source_text or "").lower() or needle in (u.translated_text or "").lower()
        for u in utterances
    )


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._utterances: dict[str, list[Utterance]] = {}

    async def save_session(self, session: Session) -> None:
        # Sao chép để caller mutate tiếp cũng không đổi bản đã lưu (giống SQLite).
        self._sessions[session.id] = replace(session)

    async def save_utterance(self, utterance: Utterance) -> None:
        rows = self._utterances.setdefault(utterance.session_id, [])
        for index, existing in enumerate(rows):
            if existing.id == utterance.id:
                rows[index] = replace(utterance)
                return
        rows.append(replace(utterance))

    async def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    async def list_sessions(self, query: str | None = None) -> list[Session]:
        sessions = sorted(self._sessions.values(), key=lambda s: s.started_at_ms, reverse=True)
        needle = (query or "").strip().lower()
        if not needle:
            return sessions
        return [s for s in sessions if _matches(s, self._utterances.get(s.id, []), needle)]

    async def get_utterances(self, session_id: str) -> list[Utterance]:
        return list(self._utterances.get(session_id, []))

    async def count_utterances(self, session_id: str) -> int:
        return len(self._utterances.get(session_id, []))

    async def delete_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        self._utterances.pop(session_id, None)

    async def delete_all_sessions(self) -> None:
        self._sessions.clear()
        self._utterances.clear()
