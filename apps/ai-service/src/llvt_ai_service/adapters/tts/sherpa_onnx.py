"""Adapter TTS: sherpa-onnx (runtime mặc định).

TODO (Tuần 5): nạp voice model theo ngôn ngữ (vits-piper..., supertonic-3-ja),
tổng hợp PCM và trả về cho Audio Output Router.
"""

from __future__ import annotations

import logging

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TtsResult
from llvt_ai_service.ports.tts import TextToSpeechProvider

logger = logging.getLogger("llvt.adapters.tts.sherpa_onnx")

# Voice mặc định theo ngôn ngữ (xem SPEC 02 §8.2).
DEFAULT_VOICE: dict[Language, str] = {
    Language.vi: "vits-piper-vi_VN-vais1000-medium",
    Language.en: "vits-piper-en_US-lessac-medium",
    Language.ja: "supertonic-3-ja",
    Language.zh: "vits-piper-zh_CN-xiao_ya-medium",
}


class SherpaOnnxTts(TextToSpeechProvider):
    name = "sherpa_onnx"

    async def load(self) -> None:
        logger.info("SherpaOnnxTts.load() — stub (Tuần 5)")

    async def unload(self) -> None:
        logger.info("SherpaOnnxTts.unload() — stub")

    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        raise NotImplementedError("sherpa-onnx sẽ được tích hợp ở Tuần 5")
