"""Mô hình nghiệp vụ (dataclass thuần)."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field

from llvt_ai_service.domain.enums import (
    AudioSource,
    Language,
    Preset,
    SessionMode,
    UtteranceStatus,
)


def _uuid() -> str:
    return str(uuid.uuid4())


def _now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class LanguagePair:
    source: Language
    target: Language


@dataclass
class SessionConfig:
    mode: SessionMode
    incoming: LanguagePair | None = None  # remote -> user (Listen)
    outgoing: LanguagePair | None = None  # user -> remote (Speak)
    preset: Preset = Preset.balanced
    # SPEC 7.10 "Review before speaking": dừng lại cho người dùng sửa bản dịch trước
    # khi tổng hợp giọng. Chỉ áp cho chiều **outgoing** — câu của phía bên kia thì
    # không có gì để sửa, mình đâu phải người nói ra nó.
    review_before_speaking: bool = False


@dataclass
class Session:
    id: str = field(default_factory=_uuid)
    config: SessionConfig | None = None
    started_at_ms: int = field(default_factory=_now_ms)
    ended_at_ms: int | None = None
    # Tên do người dùng đặt (client gửi kèm session.start, đổi được sau).
    title: str = ""


@dataclass
class AudioChunk:
    session_id: str
    source: AudioSource
    pcm: bytes
    seq: int
    sample_rate: int = 16000


@dataclass
class VadSegment:
    """Một đoạn giọng nói hoàn chỉnh do VAD cắt ra."""

    pcm: bytes
    started_at_ms: int
    ended_at_ms: int
    sample_rate: int = 16000
    # True khi đoạn bị cắt vì chạm trần độ dài chứ không phải vì người nói dừng lại —
    # tức là câu VẪN đang tiếp diễn. Dùng để không phạt nhầm ASR/MT khi đánh giá và
    # để lịch sử biết một câu dài đã bị chia làm mấy mảnh.
    forced: bool = False


@dataclass
class SpeakerTurn:
    """Một lượt nói liên tục của MỘT người, do khâu diarization cắt ra.

    ``speaker`` là nhãn do model đặt (``SPEAKER_00``, ``SPEAKER_01``…) — nó chỉ có
    nghĩa *trong phạm vi một lần chạy*, không phải danh tính thật của ai cả.
    """

    speaker: str
    started_at_ms: int
    ended_at_ms: int


@dataclass
class AsrTranscript:
    text: str
    language: Language
    confidence: float | None = None
    processing_ms: int | None = None


@dataclass
class TranslationResult:
    source_text: str
    translated_text: str
    source_language: Language
    target_language: Language
    processing_ms: int | None = None


@dataclass
class TtsResult:
    pcm: bytes
    sample_rate: int
    duration_ms: int
    processing_ms: int | None = None


@dataclass
class Utterance:
    """Đơn vị xử lý xuyên suốt Audio → ASR → MT → TTS → Output."""

    session_id: str
    source: AudioSource
    source_language: Language
    target_language: Language
    id: str = field(default_factory=_uuid)
    source_text: str | None = None
    translated_text: str | None = None
    started_at_ms: int = field(default_factory=_now_ms)
    ended_at_ms: int | None = None
    asr_ms: int | None = None
    mt_ms: int | None = None
    tts_ms: int | None = None
    status: UtteranceStatus = UtteranceStatus.success
    # Mã lỗi khi status=failed (không chứa nội dung hội thoại).
    error: str | None = None
    # Nhãn người nói khi bật diarization (chỉ có ở đường nhập tệp; None = không biết).
    speaker: str | None = None
