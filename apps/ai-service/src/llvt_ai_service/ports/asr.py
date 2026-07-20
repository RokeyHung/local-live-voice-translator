"""Port: Speech-to-Text."""

from __future__ import annotations

from abc import abstractmethod

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.base import Provider


class SpeechToTextProvider(Provider):
    @abstractmethod
    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        """Nhận diện giọng nói (task=transcribe, không dịch)."""
