"""REST: nhập một tệp âm thanh có sẵn và chuyển thành văn bản (màn "Nhập tệp")."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.model_manager import ModelLoadError
from llvt_ai_service.application.transcribe import (
    AudioDecodeError,
    decode_pcm16,
    progress,
    transcribe_audio,
)
from llvt_ai_service.domain.enums import Language, Preset, SessionMode
from llvt_ai_service.domain.models import LanguagePair, Session, SessionConfig
from llvt_ai_service.schemas import (
    TranscribeProgressResponse,
    TranscriptionResponse,
    TranscriptSegmentSchema,
)

logger = logging.getLogger("llvt.api.transcribe")

router = APIRouter(prefix="/api", tags=["transcribe"])

# Trần dung lượng một lần gửi. Starlette đọc cả body vào RAM, nên phải có chặn trên;
# 400 MB PCM 16 kHz mono ≈ 3,5 giờ audio — dài hơn mọi cuộc họp trong phạm vi đồ án.
MAX_BODY_BYTES = 400 * 1024 * 1024


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    summary="Chuyển một tệp âm thanh thành văn bản",
    description=(
        "Chạy `VAD → ASR → (MT)` trên cả tệp và trả về từng đoạn kèm mốc thời gian "
        "tính từ đầu tệp. **Không** tổng hợp giọng: kết quả là văn bản.\n\n"
        "Body là **PCM signed 16-bit, mono, 16 kHz** (định dạng nội bộ của pipeline) "
        "hoặc một tệp **WAV PCM 16-bit** — WAV nhiều kênh/khác tần số sẽ được trộn về "
        "mono và resample. Ứng dụng desktop tự giải mã MP3/M4A/FLAC/OGG/WebM bằng bộ "
        "giải mã sẵn có của Chromium rồi gửi lên PCM, nên service không cần ffmpeg.\n\n"
        "Bỏ trống `target` thì chỉ nhận dạng chữ, không dịch. `save=true` ghi kết quả "
        "thành một phiên trong lịch sử (bỏ qua nếu người dùng đã tắt lưu lịch sử).\n\n"
        "Lệnh **chặn tới khi xong** — hỏi `GET /api/transcribe/progress` song song để "
        "biết đang chạy tới đâu. Mỗi lần chỉ xử lý được một tệp (409 nếu đang bận)."
    ),
)
async def transcribe_file(
    request: Request,
    source: Language = Query(description="Ngôn ngữ nói trong tệp"),
    target: Language | None = Query(default=None, description="Dịch sang; bỏ trống = không dịch"),
    name: str = Query(default="", description="Tên tệp — hiển thị và đặt tên phiên lịch sử"),
    save: bool = Query(default=True, description="Lưu kết quả thành một phiên trong lịch sử"),
    container: Container = Depends(get_container),
) -> TranscriptionResponse:
    if progress.active:
        raise HTTPException(status_code=409, detail="Đang xử lý một tệp khác, thử lại sau.")

    # Dịch sang chính ngôn ngữ nguồn thì không phải là dịch — coi như không có `target`,
    # để phần trả về không hứa một bản dịch mà nó sẽ không bao giờ điền.
    if target == source:
        target = None

    # Giữ chỗ ngay: nạp model nằm trước lúc chạy và có thể mất vài phút, mà trong quãng
    # đó người dùng vẫn phải huỷ được (và tệp thứ hai vẫn phải bị từ chối bằng 409).
    progress.reserve(name)
    try:
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="Tệp quá lớn (tối đa ~3,5 giờ âm thanh).")
        try:
            pcm = decode_pcm16(body)
        except AudioDecodeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # Model có thể chưa nạp (service không nạp lúc khởi động) → nạp trước khi chạy.
        try:
            providers = await container.model_manager.ensure_loaded()
        except ModelLoadError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Không nạp được model cho khâu {exc.stage}. Lần đầu cần mạng để tải model — "
                    f"kiểm tra kết nối rồi thử lại. Chi tiết: {exc.cause}"
                ),
            ) from exc
    except BaseException:
        # Hỏng/huỷ trước khi vào vòng chạy: phải nhả chỗ, không thì mọi lần nhập tệp
        # sau đều bị 409 cho tới khi khởi động lại service.
        progress.release()
        raise

    session: Session | None = None
    session_id = ""
    started_at_ms = int(time.time() * 1000)
    if save and container.repository.enabled:
        session = Session(
            title=(name.strip() or "Tệp nhập")[:120],
            started_at_ms=started_at_ms,
            config=SessionConfig(
                # Nhập tệp là nghe một chiều: nguồn ngoài → ngôn ngữ của người dùng.
                mode=SessionMode.listen,
                incoming=LanguagePair(source=source, target=target or source),
                preset=container.model_manager.preset or Preset.balanced,
            ),
        )
        await container.repository.save_session(session)
        session_id = session.id

    async def should_stop() -> bool:
        # Hai lý do dừng: người dùng bấm Huỷ, hoặc client bỏ đi (đóng app giữa chừng).
        # uvicorn KHÔNG tự huỷ handler khi kết nối đứt, nên phải tự hỏi.
        return progress.cancel_requested or await request.is_disconnected()

    try:
        result = await transcribe_audio(
            providers,
            pcm,
            source,
            target,
            repository=container.repository if session_id else None,
            session_id=session_id,
            session_started_at_ms=started_at_ms,
            file_name=name,
            should_stop=should_stop,
        )
    finally:
        if session is not None:
            # Đóng phiên kể cả khi lượt chạy bị huỷ giữa chừng: những câu đã chạy xong
            # vẫn nằm trong lịch sử, và phiên còn `ended_at_ms` rỗng thì giao diện hiểu
            # nhầm là app tắt đột ngột giữa phiên.
            session.ended_at_ms = int(time.time() * 1000)
            await container.repository.save_session(session)

    logger.info(
        "Nhập tệp %r: %d đoạn / %.1f s audio trong %.1f s%s",
        name or "(không tên)",
        len(result.segments),
        result.audio_ms / 1000,
        result.processing_ms / 1000,
        " (dừng giữa chừng)" if result.cancelled else "",
    )
    return TranscriptionResponse(
        source=result.source,
        target=result.target,
        audioMs=result.audio_ms,
        processingMs=result.processing_ms,
        sessionId=result.session_id,
        cancelled=result.cancelled,
        segments=[
            TranscriptSegmentSchema(
                startedAtMs=s.started_at_ms,
                endedAtMs=s.ended_at_ms,
                text=s.text,
                translatedText=s.translated_text,
                asrMs=s.asr_ms,
                mtMs=s.mt_ms,
            )
            for s in result.segments
        ],
    )


@router.post(
    "/transcribe/cancel",
    status_code=204,
    summary="Dừng tệp đang xử lý",
    description=(
        "Xin dừng lượt đang chạy. Vòng xử lý dừng ở ranh giới khúc kế tiếp (vài giây), "
        "rồi `POST /api/transcribe` **trả về bình thường** với `cancelled: true` và "
        "những đoạn đã chạy xong — phần đã dịch không bị vứt đi, và những câu đã ghi "
        "vào lịch sử vẫn ở đó.\n\n"
        "Không có gì đang chạy thì lệnh này không làm gì cả (không phải lỗi)."
    ),
)
def cancel_transcribe() -> None:
    progress.request_cancel()


@router.get(
    "/transcribe/progress",
    response_model=TranscribeProgressResponse,
    summary="Tiến trình của tệp đang xử lý",
    description=(
        "Hỏi song song trong lúc `POST /api/transcribe` còn đang chặn (giao diện hỏi "
        "lại mỗi ~0,7 giây).\n\n"
        "`percent` tính theo **vị trí trong tệp đã chạy xong**, không phải theo thời "
        "gian ước lượng — nên nó luôn là số thật, chỉ chạy tới đâu báo tới đó."
    ),
)
def transcribe_progress() -> TranscribeProgressResponse:
    return TranscribeProgressResponse(**progress.snapshot())
