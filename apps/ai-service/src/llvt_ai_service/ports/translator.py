"""Port: Machine Translation."""

from __future__ import annotations

from abc import abstractmethod

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TranslationResult
from llvt_ai_service.ports.base import Provider


class TranslationProvider(Provider):
    @abstractmethod
    async def translate(self, text: str, source: Language, target: Language) -> TranslationResult:
        """Dịch một câu/đoạn ngắn giữa hai ngôn ngữ."""
