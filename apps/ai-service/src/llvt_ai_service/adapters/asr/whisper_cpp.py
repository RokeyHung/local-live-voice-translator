"""Adapter ASR: whisper.cpp (runtime mặc định cho cả Windows và macOS).

TODO (Tuần 3): gọi whisper.cpp qua binding/CLI, task=transcribe, model lấy theo
preset (Whisper large-v3-turbo Q5...). Chạy blocking trong SerialExecutor.
"""

from __future__ import annotations

import logging

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.whisper_cpp")


class WhisperCppAsr(SpeechToTextProvider):
    name = "whisper_cpp"

    def __init__(self, model: str) -> None:
        self.model = model

    async def load(self) -> None:
        logger.info("WhisperCppAsr.load(model=%s) — stub (Tuần 3)", self.model)

    async def unload(self) -> None:
        logger.info("WhisperCppAsr.unload() — stub")

    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        raise NotImplementedError("whisper.cpp sẽ được tích hợp ở Tuần 3")
