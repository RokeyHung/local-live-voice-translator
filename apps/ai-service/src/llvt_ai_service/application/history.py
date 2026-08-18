"""Chính sách lưu lịch sử: bọc quanh repository để bật/tắt việc GHI.

SPEC 14.4 (quyền riêng tư) cho phép người dùng tắt lưu lịch sử. Chỗ đúng để quyết
định là application, không phải adapter — adapter chỉ biết cách lưu, không biết có
được phép lưu hay không. Lớp này hiện thực chính port ``SessionRepository`` nên
pipeline/API không cần biết chính sách tồn tại.

Khi tắt: các lệnh ghi trở thành no-op, còn đọc/xoá vẫn chạy — dữ liệu cũ vẫn xem và
xoá được cho tới khi người dùng chủ động xoá.
"""

from __future__ import annotations

from llvt_ai_service.domain.models import Session, Utterance
from llvt_ai_service.ports.repository import SessionRepository


class HistoryPolicy(SessionRepository):
    def __init__(self, inner: SessionRepository, enabled: bool = True) -> None:
        self._inner = inner
        self.enabled = enabled

    @property
    def inner(self) -> SessionRepository:
        return self._inner

    async def save_session(self, session: Session) -> None:
        if self.enabled:
            await self._inner.save_session(session)

    async def save_utterance(self, utterance: Utterance) -> None:
        if self.enabled:
            await self._inner.save_utterance(utterance)

    async def get_session(self, session_id: str) -> Session | None:
        return await self._inner.get_session(session_id)

    async def list_sessions(self, query: str | None = None) -> list[Session]:
        return await self._inner.list_sessions(query)

    async def get_utterances(self, session_id: str) -> list[Utterance]:
        return await self._inner.get_utterances(session_id)

    async def count_utterances(self, session_id: str) -> int:
        return await self._inner.count_utterances(session_id)

    async def delete_session(self, session_id: str) -> None:
        await self._inner.delete_session(session_id)

    async def delete_all_sessions(self) -> None:
        await self._inner.delete_all_sessions()
