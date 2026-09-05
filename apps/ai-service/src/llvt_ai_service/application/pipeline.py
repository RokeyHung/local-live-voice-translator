"""TranslationPipeline: điều phối một chiều dịch cho một utterance.

Luồng: VAD (cắt utterance) → ASR → MT → (TTS nếu là chiều outgoing) → phát events.
Pipeline chỉ gọi qua PORT nên đổi adapter không ảnh hưởng logic ở đây.

Bật ``review`` (SPEC 7.10) thì luồng **dừng lại sau MT**: câu được giữ ở trạng thái
``WaitingForConfirmation`` cho tới khi client gửi ``confirm()`` (kèm bản đã sửa) hoặc
``discard()``. Tổng hợp giọng chỉ chạy ở bước confirm, nên cái phát ra micro ảo đúng
là cái người dùng đã duyệt chứ không phải bản máy dịch thẳng.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Awaitable, Callable, Iterator

from llvt_ai_service.application.model_manager import ProviderSet
from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import AudioSource, PipelineState, UtteranceStatus
from llvt_ai_service.domain.models import AudioChunk, LanguagePair, Utterance, VadSegment
from llvt_ai_service.ports.repository import SessionRepository

logger = logging.getLogger("llvt.pipeline")

Emit = Callable[[ev.PipelineEvent], Awaitable[None]]

# Trần số câu được treo chờ duyệt cùng lúc. Người dùng bỏ đi giữa chừng trong chế độ
# tự động thì hàng đợi này phình mãi; giữ câu MỚI NHẤT và bỏ câu cũ nhất, vì trong
# hội thoại thì câu vừa nói mới là câu người ta còn muốn gửi.
MAX_PENDING = 32


class _Elapsed:
    """Bộ đếm thời gian một khâu; `.ms` đọc được sau khi thoát khối with."""

    ms: int = 0


@contextmanager
def _elapsed() -> Iterator[_Elapsed]:
    marker = _Elapsed()
    started = time.perf_counter()
    try:
        yield marker
    finally:
        marker.ms = int((time.perf_counter() - started) * 1000)


class TranslationPipeline:
    def __init__(
        self,
        providers: ProviderSet,
        direction: LanguagePair,
        source_type: AudioSource,
        emit: Emit,
        *,
        synthesize: bool,
        session_id: str = "",
        repository: SessionRepository | None = None,
        review: bool = False,
    ) -> None:
        self._p = providers
        self._dir = direction
        self._source = source_type
        self._emit = emit
        self._synthesize = synthesize
        self._session_id = session_id
        self._repo = repository
        # Duyệt trước khi đọc chỉ có nghĩa ở chiều có tổng hợp giọng: chiều nghe
        # remote không phát ra đâu cả nên chẳng có gì để duyệt.
        self._review = review and synthesize
        # Câu đang chờ người dùng bấm gửi, theo id. Bình thường nhiều nhất một câu
        # (Push-to-talk nói xong mới tới câu sau), nhưng chế độ tự động thì có thể
        # dồn lại nếu người dùng bỏ đi — xem MAX_PENDING.
        self._pending: dict[str, Utterance] = {}
        # Đếm số câu bị cắt cứng vì người nói không dừng lại: tần suất cao nghĩa
        # là max_speech_ms đang quá ngắn cho cách nói của người dùng.
        self._forced_cuts = 0
        # Mỗi pipeline có stream VAD riêng (state độc lập cho nguồn audio của mình).
        self._vad = providers.vad.open_stream()

    async def feed(self, chunk: AudioChunk) -> None:
        """Đẩy một frame audio; xử lý các utterance mà VAD cắt ra."""
        try:
            segments = self._vad.accept(chunk.pcm, chunk.sample_rate)
        except ValueError as exc:
            await self._emit(ev.PipelineError(code="bad_audio", message=str(exc)))
            return
        for segment in segments:
            await self._process(segment)

    async def flush(self) -> None:
        """Chốt đoạn giọng nói đang dở (khi nhả PTT) và xử lý nốt."""
        for segment in self._vad.flush():
            await self._process(segment)

    def discard(self) -> None:
        """Bỏ audio đang dở, không xử lý (khi mute)."""
        self._vad.reset()

    async def _process(self, segment: VadSegment) -> None:
        if segment.forced:
            self._forced_cuts += 1
            logger.info(
                "Cắt cứng câu %s (lần thứ %d): người nói chưa dừng sau %d ms",
                self._source.value,
                self._forced_cuts,
                segment.ended_at_ms - segment.started_at_ms,
            )
        utt = Utterance(
            session_id=self._session_id,
            source=self._source,
            source_language=self._dir.source,
            target_language=self._dir.target,
        )
        try:
            await self._emit(ev.StateChanged(PipelineState.recognizing, utt.id))
            with _elapsed() as asr_timer:
                transcript = await self._p.asr.transcribe(segment.pcm, self._dir.source)
            asr_ms = utt.asr_ms = asr_timer.ms
            utt.source_text = transcript.text

            if not transcript.text.strip():
                # VAD cắt trúng đoạn chỉ có tiếng ồn, hoặc ASR sinh câu ma và đã bị
                # adapter lọc bỏ. Dừng ở đây: dịch và đọc một chuỗi rỗng chỉ tốn thêm
                # vài trăm ms cho mỗi khoảng lặng, còn TTS thì phát ra tiếng lạ.
                await self._emit(ev.Metrics(asr_ms=asr_ms))
                await self._emit(ev.StateChanged(PipelineState.completed, utt.id))
                return

            await self._emit(
                ev.AsrFinal(
                    utt.id,
                    transcript.language,
                    transcript.text,
                    transcript.confidence,
                    processing_ms=asr_ms,
                )
            )

            await self._emit(ev.StateChanged(PipelineState.translating, utt.id))
            with _elapsed() as mt_timer:
                result = await self._p.mt.translate(
                    transcript.text, self._dir.source, self._dir.target
                )
            mt_ms = utt.mt_ms = mt_timer.ms
            utt.translated_text = result.translated_text
            await self._emit(
                ev.MtResult(utt.id, result.source_text, result.translated_text, processing_ms=mt_ms)
            )

            if self._review:
                # Dừng ở đây. Câu đã có bản dịch nên client hiện được ô sửa; phần
                # tổng hợp giọng chờ `confirm()`. Vẫn đi qua `finally` bên dưới để
                # ghi vào lịch sử ngay — app tắt lúc đang treo thì câu đã dịch vẫn
                # còn, mất mỗi việc chưa đọc ra.
                await self._park(utt)
                await self._emit(ev.Metrics(asr_ms=asr_ms, mt_ms=mt_ms))
                await self._emit(ev.StateChanged(PipelineState.waiting_confirmation, utt.id))
                return

            if self._synthesize:
                await self._speak(utt, result.translated_text)

            # Thời gian xử lý thật của từng khâu — client dùng để hiển thị độ trễ
            # thay cho ước lượng đo bằng khoảng cách giữa các event.
            await self._emit(ev.Metrics(asr_ms=asr_ms, mt_ms=mt_ms, tts_ms=utt.tts_ms))
            await self._emit(ev.StateChanged(PipelineState.completed, utt.id))
        except NotImplementedError as exc:
            utt.status = UtteranceStatus.failed
            utt.error = "not_implemented"
            await self._emit(
                ev.PipelineError(code="not_implemented", message=str(exc), utterance_id=utt.id)
            )
        except Exception as exc:
            # Câu lỗi vẫn phải vào lịch sử (SPEC 7.11: lưu trạng thái thành công/thất
            # bại); lỗi ngoài dự kiến thì trả tiếp lên transport như trước.
            utt.status = UtteranceStatus.failed
            utt.error = type(exc).__name__
            raise
        finally:
            utt.ended_at_ms = int(time.time() * 1000)
            await self._save(utt)

    # --- duyệt trước khi đọc (SPEC 7.10) --------------------------------------

    @property
    def pending_ids(self) -> list[str]:
        """Các câu đang chờ người dùng duyệt (cũ trước, mới sau)."""
        return list(self._pending)

    async def _park(self, utt: Utterance) -> None:
        """Treo một câu lại chờ duyệt, có chặn trên số lượng."""
        self._pending[utt.id] = utt
        while len(self._pending) > MAX_PENDING:
            stale_id, _ = next(iter(self._pending.items()))
            del self._pending[stale_id]
            logger.info("Bỏ câu chờ duyệt %s: đã quá %d câu treo", stale_id, MAX_PENDING)
            await self._emit(
                ev.PipelineError(
                    code="review_dropped",
                    message="Có quá nhiều câu đang chờ duyệt — câu cũ nhất đã bị bỏ.",
                    utterance_id=stale_id,
                )
            )

    async def _speak(self, utt: Utterance, text: str) -> None:
        """Tổng hợp giọng cho một câu và phát ra event (chỗ duy nhất gọi TTS)."""
        await self._emit(ev.StateChanged(PipelineState.synthesizing, utt.id))
        with _elapsed() as tts_timer:
            tts = await self._p.tts.synthesize(text, self._dir.target)
        utt.tts_ms = tts_timer.ms
        await self._emit(ev.TtsAudio(utt.id, tts.pcm, tts.sample_rate, tts.duration_ms))

    async def confirm(self, utterance_id: str, text: str | None = None) -> bool:
        """Duyệt một câu đang treo: đọc ra micro ảo. Trả False nếu id không còn.

        ``text`` là bản người dùng đã sửa; bỏ trống thì đọc nguyên bản dịch máy.
        Bản đã sửa ghi đè vào lịch sử — cái được gửi đi mới là cái đáng lưu, chứ
        không phải cái máy dịch ra rồi bị sửa.
        """
        utt = self._pending.pop(utterance_id, None)
        if utt is None:
            # Bấm hai lần, hoặc bấm sau khi phiên đã dừng. Không phải lỗi của ai cả.
            return False
        edited = (text or "").strip()
        if edited:
            utt.translated_text = edited
        try:
            await self._speak(utt, utt.translated_text or "")
            await self._emit(ev.Metrics(asr_ms=utt.asr_ms, mt_ms=utt.mt_ms, tts_ms=utt.tts_ms))
            await self._emit(ev.StateChanged(PipelineState.completed, utt.id))
        except Exception as exc:
            utt.status = UtteranceStatus.failed
            utt.error = type(exc).__name__
            raise
        finally:
            utt.ended_at_ms = int(time.time() * 1000)
            await self._save(utt)
        return True

    async def discard_pending(self, utterance_id: str) -> bool:
        """Bỏ một câu đang treo — không đọc ra. Trả False nếu id không còn.

        Tên khác hẳn ``discard()`` ở trên vì việc cũng khác hẳn: cái kia vứt audio
        thô đang thu dở lúc bấm mute, cái này bỏ một câu đã dịch xong.

        Câu vẫn nằm trong lịch sử (đã ghi lúc treo): người dùng quyết định không gửi
        thì đó là một sự việc có thật của cuộc họp, xoá đi thì bản ghi thiếu mất một
        đoạn. Dấu hiệu nhận biết là `tts_ms` rỗng.
        """
        if self._pending.pop(utterance_id, None) is None:
            return False
        await self._emit(ev.StateChanged(PipelineState.completed, utterance_id))
        return True

    def clear_pending(self) -> None:
        """Quên hết câu đang treo (kết thúc phiên)."""
        self._pending.clear()

    async def _save(self, utt: Utterance) -> None:
        """Ghi câu vào lịch sử; lỗi lưu trữ không được làm chết phiên dịch."""
        if self._repo is None or not utt.session_id:
            return
        # VAD cắt cả đoạn chỉ có tiếng ồn → ASR trả rỗng; đừng làm rác lịch sử.
        if utt.status is UtteranceStatus.success and not (utt.source_text or "").strip():
            return
        try:
            await self._repo.save_utterance(utt)
        except Exception:  # noqa: BLE001 — chỉ log mã lỗi, không log nội dung câu
            logger.warning("Không lưu được utterance %s vào lịch sử", utt.id, exc_info=True)
