"""TranslationPipeline: điều phối một chiều dịch cho một utterance.

Luồng: VAD (cắt utterance) → ASR → MT → (TTS nếu là chiều outgoing) → phát events.
Pipeline chỉ gọi qua PORT nên đổi adapter không ảnh hưởng logic ở đây.
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.application.model_manager import ProviderSet
from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import AudioSource, PipelineState
from llvt_ai_service.domain.models import AudioChunk, LanguagePair, Utterance, VadSegment

logger = logging.getLogger("llvt.pipeline")

Emit = Callable[[ev.PipelineEvent], Awaitable[None]]


class TranslationPipeline:
    def __init__(
        self,
        providers: ProviderSet,
        direction: LanguagePair,
        source_type: AudioSource,
        emit: Emit,
        *,
        synthesize: bool,
        executor: SerialExecutor | None = None,
    ) -> None:
        self._p = providers
        self._dir = direction
        self._source = source_type
        self._emit = emit
        self._synthesize = synthesize
        self._executor = executor or SerialExecutor()

    async def feed(self, chunk: AudioChunk) -> None:
        """Đẩy một frame audio; xử lý các utterance mà VAD cắt ra."""
        try:
            segments = await self._p.vad.accept(chunk.pcm, chunk.sample_rate)
        except NotImplementedError as exc:
            await self._emit(ev.PipelineError(code="not_implemented", message=str(exc)))
            return
        for segment in segments:
            await self._process(segment, chunk.session_id)

    async def _process(self, segment: VadSegment, session_id: str) -> None:
        utt = Utterance(
            session_id=session_id,
            source=self._source,
            source_language=self._dir.source,
            target_language=self._dir.target,
        )
        try:
            await self._emit(ev.StateChanged(PipelineState.recognizing, utt.id))
            transcript = await self._p.asr.transcribe(segment.pcm, self._dir.source)
            await self._emit(
                ev.AsrFinal(utt.id, transcript.language, transcript.text, transcript.confidence)
            )

            await self._emit(ev.StateChanged(PipelineState.translating, utt.id))
            result = await self._p.mt.translate(transcript.text, self._dir.source, self._dir.target)
            await self._emit(ev.MtResult(utt.id, result.source_text, result.translated_text))

            if self._synthesize:
                await self._emit(ev.StateChanged(PipelineState.synthesizing, utt.id))
                tts = await self._p.tts.synthesize(result.translated_text, self._dir.target)
                await self._emit(ev.TtsAudio(utt.id, tts.pcm, tts.sample_rate, tts.duration_ms))

            await self._emit(ev.StateChanged(PipelineState.completed, utt.id))
        except NotImplementedError as exc:
            await self._emit(
                ev.PipelineError(code="not_implemented", message=str(exc), utterance_id=utt.id)
            )
