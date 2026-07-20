"""Port: Voice Activity Detection."""

from __future__ import annotations

from abc import abstractmethod

from llvt_ai_service.domain.models import VadSegment
from llvt_ai_service.ports.base import Provider


class VoiceActivityDetector(Provider):
    @abstractmethod
    def reset(self) -> None:
        """Xóa trạng thái nội bộ khi bắt đầu utterance mới."""

    @abstractmethod
    async def accept(self, pcm: bytes, sample_rate: int = 16000) -> list[VadSegment]:
        """Nhận một frame PCM, trả về các đoạn giọng nói đã hoàn chỉnh (nếu có)."""
