"""Port: tách người nói (speaker diarization).

Trả lời câu hỏi "đoạn từ giây X đến giây Y là ai nói", KHÔNG trả lời "họ nói gì" —
việc đó là của ``SpeechToTextProvider``. Tách hẳn hai port vì hai bài toán độc lập:
đổi model diarization không được đụng tới ASR, và một bản cài đặt không có
diarization vẫn phải chạy đầy đủ (port này là **tùy chọn** trong ``ProviderSet``).

Vì sao chỉ dùng cho nhập tệp chứ không dùng cho phiên realtime: model diarization
gom cụm giọng trên TOÀN BỘ đoạn âm thanh mới ổn định được danh tính người nói.
Trong phiên trực tiếp, mỗi câu chỉ dài vài giây nên nhãn ``SPEAKER_00`` của câu này
không có liên hệ gì với ``SPEAKER_00`` của câu sau — mà phiên hai chiều thì cũng
không cần: mic là người dùng, system audio là phía bên kia, đã biết sẵn ai nói.
"""

from __future__ import annotations

from abc import abstractmethod

from llvt_ai_service.domain.models import SpeakerTurn
from llvt_ai_service.ports.base import Provider


class SpeakerDiarizer(Provider):
    @abstractmethod
    async def diarize(self, pcm: bytes, sample_rate: int = 16000) -> list[SpeakerTurn]:
        """Chia cả đoạn audio thành các lượt nói, mỗi lượt gắn một nhãn người nói.

        ``pcm`` là PCM signed 16-bit mono — định dạng nội bộ của pipeline. Kết quả
        sắp xếp theo thời gian bắt đầu; các lượt CÓ THỂ chồng lấn nhau (hai người
        nói cùng lúc).
        """
