"""Port: Text-to-Speech."""

from __future__ import annotations

from abc import abstractmethod

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TtsResult
from llvt_ai_service.ports.base import Provider


class TextToSpeechProvider(Provider):
    @abstractmethod
    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        """Tổng hợp giọng nói từ văn bản đã dịch."""
