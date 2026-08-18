"""Sự kiện pipeline phát ra hướng client (transport-agnostic)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Union

from llvt_ai_service.domain.enums import Language, PipelineState


@dataclass
class StateChanged:
    state: PipelineState
    utterance_id: str | None = None
    # Chỉ có ở mốc bắt đầu/kết thúc phiên: id phiên trong lịch sử.
    session_id: str | None = None


@dataclass
class AsrPartial:
    utterance_id: str
    language: Language
    text: str


@dataclass
class AsrFinal:
    utterance_id: str
    language: Language
    text: str
    confidence: float | None = None
    processing_ms: int | None = None


@dataclass
class MtResult:
    utterance_id: str
    source_text: str
    translated_text: str
    processing_ms: int | None = None


@dataclass
class TtsAudio:
    utterance_id: str
    pcm: bytes
    sample_rate: int
    duration_ms: int


@dataclass
class Metrics:
    asr_ms: int | None = None
    mt_ms: int | None = None
    tts_ms: int | None = None


@dataclass
class PipelineError:
    code: str
    message: str
    utterance_id: str | None = None


PipelineEvent = Union[
    StateChanged,
    AsrPartial,
    AsrFinal,
    MtResult,
    TtsAudio,
    Metrics,
    PipelineError,
]
