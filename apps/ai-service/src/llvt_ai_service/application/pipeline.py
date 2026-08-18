"""TranslationPipeline: điều phối một chiều dịch cho một utterance.

Luồng: VAD (cắt utterance) → ASR → MT → (TTS nếu là chiều outgoing) → phát events.
Pipeline chỉ gọi qua PORT nên đổi adapter không ảnh hưởng logic ở đây.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Awaitable, Callable, Iterator

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.application.model_manager import ProviderSet
from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import AudioSource, PipelineState, UtteranceStatus
from llvt_ai_service.domain.models import AudioChunk, LanguagePair, Utterance, VadSegment
from llvt_ai_service.ports.repository import SessionRepository

logger = logging.getLogger("llvt.pipeline")

Emit = Callable[[ev.PipelineEvent], Awaitable[None]]


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
        executor: SerialExecutor | None = None,
        repository: SessionRepository | None = None,
    ) -> None:
        self._p = providers
        self._dir = direction
        self._source = source_type
        self._emit = emit
        self._synthesize = synthesize
        self._session_id = session_id
        self._executor = executor or SerialExecutor()
        self._repo = repository
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

            if self._synthesize:
                await self._emit(ev.StateChanged(PipelineState.synthesizing, utt.id))
                with _elapsed() as tts_timer:
                    tts = await self._p.tts.synthesize(result.translated_text, self._dir.target)
                utt.tts_ms = tts_timer.ms
                await self._emit(ev.TtsAudio(utt.id, tts.pcm, tts.sample_rate, tts.duration_ms))

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
