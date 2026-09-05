"""Wire protocol WebSocket: envelope + chuyển đổi domain event ↔ JSON.

Bản mirror TypeScript: apps/desktop/src/renderer/src/api/protocol.ts
"""

from __future__ import annotations

import base64
import time
from typing import Any

from pydantic import BaseModel, Field

from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import AudioSource, Language, SessionMode
from llvt_ai_service.domain.models import AudioChunk, LanguagePair, SessionConfig


class WsMessage(BaseModel):
    """Envelope chung cho mọi message WebSocket."""

    type: str
    ts: int = Field(default_factory=lambda: int(time.time() * 1000))
    payload: dict[str, Any] = Field(default_factory=dict)


def envelope(type_: str, **payload: Any) -> dict[str, Any]:
    return WsMessage(type=type_, payload=payload).model_dump()


def event_to_wire(event: ev.PipelineEvent) -> dict[str, Any]:
    """Chuyển domain event → message gửi cho client."""
    if isinstance(event, ev.StateChanged):
        return envelope(
            "state",
            state=event.state.value,
            utteranceId=event.utterance_id,
            sessionId=event.session_id,
        )
    if isinstance(event, ev.AsrPartial):
        return envelope(
            "asr.partial",
            utteranceId=event.utterance_id,
            language=event.language.value,
            text=event.text,
        )
    if isinstance(event, ev.AsrFinal):
        return envelope(
            "asr.final",
            utteranceId=event.utterance_id,
            language=event.language.value,
            text=event.text,
            confidence=event.confidence,
            processingMs=event.processing_ms,
        )
    if isinstance(event, ev.MtResult):
        return envelope(
            "mt.result",
            utteranceId=event.utterance_id,
            sourceText=event.source_text,
            translatedText=event.translated_text,
            processingMs=event.processing_ms,
        )
    if isinstance(event, ev.TtsAudio):
        return envelope(
            "tts.audio",
            utteranceId=event.utterance_id,
            pcm=base64.b64encode(event.pcm).decode(),
            sampleRate=event.sample_rate,
            durationMs=event.duration_ms,
        )
    if isinstance(event, ev.Metrics):
        return envelope("metrics", asrMs=event.asr_ms, mtMs=event.mt_ms, ttsMs=event.tts_ms)
    if isinstance(event, ev.PipelineError):
        return envelope(
            "error", code=event.code, message=event.message, utteranceId=event.utterance_id
        )
    raise ValueError(f"Unknown event type: {type(event).__name__}")


def parse_session_config(payload: dict[str, Any]) -> SessionConfig:
    """Dựng SessionConfig từ payload của message session.start."""

    def pair(src_key: str, tgt_key: str) -> LanguagePair | None:
        src, tgt = payload.get(src_key), payload.get(tgt_key)
        if src is None or tgt is None:
            return None
        return LanguagePair(Language(src), Language(tgt))

    from llvt_ai_service.domain.enums import Preset

    return SessionConfig(
        mode=SessionMode(payload.get("mode", "two_way")),
        incoming=pair("incomingSource", "incomingTarget"),
        outgoing=pair("outgoingSource", "outgoingTarget"),
        preset=Preset(payload.get("preset", "balanced")),
        review_before_speaking=bool(payload.get("reviewBeforeSpeaking", False)),
    )


def parse_review_action(payload: dict[str, Any]) -> tuple[str, str | None]:
    """`(utteranceId, text)` của control.confirm / control.discard.

    `text` là bản người dùng đã sửa; None khi client không gửi (đọc nguyên bản dịch
    máy). Cắt độ dài để một client hỏng không đẩy được cả quyển sách vào TTS.
    """
    utterance_id = str(payload.get("utteranceId", "")).strip()
    raw = payload.get("text")
    text = raw[:2000] if isinstance(raw, str) else None
    return utterance_id, text


def parse_session_title(payload: dict[str, Any]) -> str:
    """Tên phiên do client đặt (hiển thị ở lịch sử). Cắt bớt để không phình DB."""
    title = payload.get("title")
    return title.strip()[:120] if isinstance(title, str) else ""


# Chỉ hai nguồn này chảy qua WebSocket. `AudioSource.file` là của luồng nhập tệp
# (REST) — lọt vào đây thì SessionController sẽ tưởng là mic và đem đi tổng hợp giọng.
LIVE_SOURCES = frozenset({AudioSource.microphone, AudioSource.system})


def parse_audio_chunk(session_id: str, payload: dict[str, Any]) -> AudioChunk:
    source = AudioSource(payload.get("source", "microphone"))
    if source not in LIVE_SOURCES:
        raise ValueError(f"audio.chunk chỉ nhận microphone|system, nhận {source.value}")
    return AudioChunk(
        session_id=session_id,
        source=source,
        pcm=base64.b64decode(payload["pcm"]) if payload.get("pcm") else b"",
        seq=int(payload.get("seq", 0)),
        sample_rate=int(payload.get("sampleRate", 16000)),
    )
