"""Port: Voice Activity Detection.

Tách hai khái niệm:
- ``VoiceActivityDetector`` (Provider): nạp/giải phóng model một lần, dùng chung.
- ``VadStream``: state phân đoạn riêng cho MỘT nguồn audio (mic hoặc system).

Mỗi pipeline mở stream riêng nên hai nguồn (và nhiều phiên) không đụng state của nhau.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from llvt_ai_service.domain.models import VadSegment
from llvt_ai_service.ports.base import Provider


class VadStream(ABC):
    """Một luồng phát hiện giọng nói có state (buffer + trạng thái speech)."""

    @abstractmethod
    def accept(self, pcm: bytes, sample_rate: int = 16000) -> list[VadSegment]:
        """Nhận PCM signed 16-bit mono, trả các đoạn giọng nói đã hoàn chỉnh (nếu có)."""

    @abstractmethod
    def reset(self) -> None:
        """Xóa toàn bộ state khi bắt đầu một luồng audio mới."""


class VoiceActivityDetector(Provider):
    @abstractmethod
    def open_stream(self) -> VadStream:
        """Tạo một ``VadStream`` độc lập cho một nguồn audio."""
