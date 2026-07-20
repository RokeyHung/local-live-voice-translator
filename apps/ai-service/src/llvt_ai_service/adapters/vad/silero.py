"""Adapter VAD: Silero (mặc định).

TODO (Tuần 2): tích hợp Silero VAD (onnxruntime) — nạp model, chạy phát hiện
giọng nói trên frame PCM 16 kHz và cắt utterance.
"""

from __future__ import annotations

import logging

from llvt_ai_service.domain.models import VadSegment
from llvt_ai_service.ports.vad import VoiceActivityDetector

logger = logging.getLogger("llvt.adapters.vad.silero")


class SileroVad(VoiceActivityDetector):
    name = "silero"

    async def load(self) -> None:
        logger.info("SileroVad.load() — stub (Tuần 2)")

    async def unload(self) -> None:
        logger.info("SileroVad.unload() — stub")

    def reset(self) -> None:
        pass

    async def accept(self, pcm: bytes, sample_rate: int = 16000) -> list[VadSegment]:
        raise NotImplementedError("Silero VAD sẽ được tích hợp ở Tuần 2")
