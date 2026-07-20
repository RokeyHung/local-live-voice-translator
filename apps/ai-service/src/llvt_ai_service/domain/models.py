"""Mô hình nghiệp vụ (dataclass thuần)."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field

from llvt_ai_service.domain.enums import AudioSource, Language, Preset, SessionMode


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


@dataclass
class Session:
    id: str = field(default_factory=_uuid)
    config: SessionConfig | None = None
    started_at_ms: int = field(default_factory=_now_ms)
    ended_at_ms: int | None = None


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
