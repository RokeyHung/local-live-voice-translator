"""Enum nghiệp vụ dùng chung."""

from __future__ import annotations

from enum import Enum


class PipelineState(str, Enum):
    idle = "Idle"
    listening = "Listening"
    speech_detected = "SpeechDetected"
    recognizing = "Recognizing"
    translating = "Translating"
    waiting_confirmation = "WaitingForConfirmation"
    synthesizing = "Synthesizing"
    queued = "Queued"
    speaking = "Speaking"
    completed = "Completed"
    error = "Error"
    stopped = "Stopped"


class AudioSource(str, Enum):
    microphone = "microphone"
    system = "system"
    # Tệp âm thanh người dùng nhập vào (màn "Nhập tệp") — không phải audio thu trực
    # tiếp, nên tách riêng thay vì mượn tạm `system`.
    file = "file"


class Language(str, Enum):
    vi = "vi"
    en = "en"
    ja = "ja"
    zh = "zh"


class SessionMode(str, Enum):
    listen = "listen"
    speak = "speak"
    two_way = "two_way"


class Preset(str, Enum):
    fast = "fast"
    balanced = "balanced"
    quality = "quality"


class UtteranceStatus(str, Enum):
    """Kết quả chạy pipeline của một câu (SPEC 7.11 yêu cầu lưu trạng thái)."""

    success = "success"
    failed = "failed"
