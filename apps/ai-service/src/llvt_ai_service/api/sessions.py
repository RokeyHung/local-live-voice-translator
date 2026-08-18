"""REST: lịch sử phiên (đọc, đổi tên, xoá). Dữ liệu nằm trong SQLite trên máy."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.domain.models import Session, Utterance
from llvt_ai_service.schemas import (
    SessionDetail,
    SessionSummary,
    SessionUpdate,
    UtteranceSchema,
)

router = APIRouter(prefix="/api", tags=["sessions"])


def _summary(session: Session, count: int) -> SessionSummary:
    config = session.config
    return SessionSummary(
        id=session.id,
        title=session.title,
        startedAtMs=session.started_at_ms,
        endedAtMs=session.ended_at_ms,
        mode=config.mode if config else None,
        preset=config.preset if config else None,
        utteranceCount=count,
    )


def _utterance(utterance: Utterance) -> UtteranceSchema:
    return UtteranceSchema(
        id=utterance.id,
        source=utterance.source,
        sourceLanguage=utterance.source_language,
        targetLanguage=utterance.target_language,
        sourceText=utterance.source_text,
        translatedText=utterance.translated_text,
        asrMs=utterance.asr_ms,
        mtMs=utterance.mt_ms,
        ttsMs=utterance.tts_ms,
        status=utterance.status,
        error=utterance.error,
        startedAtMs=utterance.started_at_ms,
        endedAtMs=utterance.ended_at_ms,
    )


@router.get(
    "/sessions",
    response_model=list[SessionSummary],
    summary="Danh sách phiên đã lưu",
    description=(
        "Phiên mới nhất trước, kèm số câu đã lưu. `q` lọc theo tên phiên hoặc nội "
        "dung câu (gốc và bản dịch). Phiên có `endedAtMs` rỗng là phiên đang chạy — "
        "hoặc phiên bị bỏ dở vì app tắt đột ngột."
    ),
)
async def list_sessions(
    q: str | None = Query(default=None, description="Từ khoá tìm trong tên phiên và nội dung câu"),
    container: Container = Depends(get_container),
) -> list[SessionSummary]:
    sessions = await container.repository.list_sessions(q)
    return [_summary(s, await container.repository.count_utterances(s.id)) for s in sessions]


@router.get(
    "/sessions/{session_id}",
    response_model=SessionDetail,
    summary="Bản ghi song ngữ của một phiên",
    description="Gồm câu gốc, câu dịch, thời gian xử lý từng khâu và trạng thái từng câu.",
)
async def get_session(
    session_id: str, container: Container = Depends(get_container)
) -> SessionDetail:
    session = await container.repository.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Không có phiên này")
    utterances = await container.repository.get_utterances(session_id)
    return SessionDetail(
        **_summary(session, len(utterances)).model_dump(),
        utterances=[_utterance(u) for u in utterances],
    )


@router.patch(
    "/sessions/{session_id}",
    response_model=SessionSummary,
    summary="Đổi tên hoặc đóng một phiên",
    description=(
        "`title` đổi tên phiên. `close` dùng cho phiên bị bỏ dở khi app tắt giữa "
        "phiên: mốc kết thúc lấy theo câu cuối cùng đã lưu."
    ),
)
async def update_session(
    session_id: str, body: SessionUpdate, container: Container = Depends(get_container)
) -> SessionSummary:
    session = await container.repository.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Không có phiên này")
    if body.title is not None:
        session.title = body.title.strip()[:120]
    utterances = await container.repository.get_utterances(session_id)
    if body.close and session.ended_at_ms is None:
        last = utterances[-1] if utterances else None
        session.ended_at_ms = (
            (last.ended_at_ms or last.started_at_ms) if last else session.started_at_ms
        )
    # Sửa dữ liệu đã có, không phải ghi mới → đi thẳng vào store, bỏ qua policy.
    await container.repository.inner.save_session(session)
    return _summary(session, len(utterances))


@router.delete(
    "/sessions",
    status_code=204,
    summary="Xoá toàn bộ lịch sử",
    description="SPEC 14.4: người dùng phải xoá được toàn bộ dữ liệu phiên.",
)
async def delete_all_sessions(container: Container = Depends(get_container)) -> None:
    await container.repository.delete_all_sessions()


@router.delete(
    "/sessions/{session_id}",
    status_code=204,
    summary="Xoá một phiên",
)
async def delete_session(session_id: str, container: Container = Depends(get_container)) -> None:
    await container.repository.delete_session(session_id)
