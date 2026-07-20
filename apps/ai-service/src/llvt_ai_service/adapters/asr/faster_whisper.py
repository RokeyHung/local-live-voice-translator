"""Adapter ASR tùy chọn: faster-whisper (CTranslate2, CUDA) cho Windows + NVIDIA.

Minh họa nhiều adapter đứng sau cùng một port; thuộc giai đoạn tối ưu, chưa bắt
buộc trong MVP.
"""

from __future__ import annotations

import logging

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.faster_whisper")


class FasterWhisperAsr(SpeechToTextProvider):
    name = "faster_whisper"

    def __init__(self, model: str) -> None:
        self.model = model

    async def load(self) -> None:
        logger.info("FasterWhisperAsr.load(model=%s) — stub (tối ưu)", self.model)

    async def unload(self) -> None:
        logger.info("FasterWhisperAsr.unload() — stub")

    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        raise NotImplementedError("faster-whisper thuộc giai đoạn tối ưu")
