"""REST: lịch sử phiên."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.schemas import SessionSummary

router = APIRouter(prefix="/api", tags=["sessions"])


@router.get(
    "/sessions",
    response_model=list[SessionSummary],
    summary="Danh sách phiên đã mở",
    description="Chỉ có mốc thời gian; nội dung câu dịch do ứng dụng desktop lưu cục bộ.",
)
async def list_sessions(container: Container = Depends(get_container)) -> list[SessionSummary]:
    sessions = await container.repository.list_sessions()
    return [
        SessionSummary(id=s.id, startedAtMs=s.started_at_ms, endedAtMs=s.ended_at_ms)
        for s in sessions
    ]


@router.delete(
    "/sessions/{session_id}",
    status_code=204,
    summary="Xoá một phiên",
)
async def delete_session(session_id: str, container: Container = Depends(get_container)) -> None:
    await container.repository.delete_session(session_id)
