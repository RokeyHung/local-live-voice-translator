"""Quy ước giao tiếp REST/WebSocket dùng chung với desktop client.

Bản TypeScript tương ứng: apps/desktop/src/renderer/src/api/protocol.ts
Giữ hai file đồng bộ khi thay đổi contract.
"""

from __future__ import annotations

import time
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# ---- REST ----------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    offlineReady: bool
    platform: str


# ---- Trạng thái pipeline (vòng đời utterance) ----------------------------


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


AudioSource = Literal["microphone", "system"]


# ---- WebSocket envelope --------------------------------------------------

# Client -> Service
WsClientType = Literal["session.start", "session.stop", "audio.chunk", "control.ptt"]

# Service -> Client
WsServerType = Literal[
    "state", "asr.partial", "asr.final", "mt.result", "tts.audio", "metrics", "error"
]


class WsMessage(BaseModel):
    """Envelope chung cho mọi message WebSocket."""

    type: str
    ts: int = Field(default_factory=lambda: int(time.time() * 1000))
    payload: dict[str, Any] = Field(default_factory=dict)


def server_message(type_: WsServerType, **payload: Any) -> WsMessage:
    """Tạo nhanh một message hướng Service -> Client."""
    return WsMessage(type=type_, payload=payload)


# ---- Một vài payload có cấu trúc (tham chiếu cho các tuần sau) ------------


class SessionStartPayload(BaseModel):
    mode: Literal["listen", "speak", "two_way"]
    incomingSource: str
    incomingTarget: str
    outgoingSource: str
    outgoingTarget: str
    preset: Literal["fast", "balanced", "quality"] = "balanced"


class AsrResult(BaseModel):
    utteranceId: str
    language: str
    text: str
    isFinal: bool
    confidence: Optional[float] = None
    processingTimeMs: Optional[int] = None
