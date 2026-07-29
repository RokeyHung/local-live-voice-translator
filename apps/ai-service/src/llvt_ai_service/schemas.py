"""DTO Pydantic cho REST/WS (tách khỏi domain model thuần)."""

from __future__ import annotations

from pydantic import BaseModel

from llvt_ai_service.domain.enums import Language, Preset


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    offlineReady: bool
    platform: str


class ConfigResponse(BaseModel):
    preset: Preset
    availablePresets: list[Preset]


class ConfigUpdate(BaseModel):
    preset: Preset


class SessionSummary(BaseModel):
    id: str
    startedAtMs: int
    endedAtMs: int | None = None


class BenchmarkRequest(BaseModel):
    source: Language = Language.vi
    target: Language = Language.en


class BenchmarkResponse(BaseModel):
    """Thời gian THỰC TẾ của từng khâu trên máy đang chạy (không đo độ chính xác)."""

    vadMs: int
    asrMs: int
    mtMs: int
    ttsMs: int | None = None  # None khi ngôn ngữ đích chưa có voice
    totalMs: int
    audioMs: int  # độ dài đoạn audio mẫu đưa vào VAD/ASR
    source: Language
    target: Language
    preset: Preset | None = None


class ResourceResponse(BaseModel):
    """Tài nguyên của chính tiến trình AI service (renderer không tự đọc được)."""

    cpuPercent: float
    cpuCount: int
    rssMb: float
    systemTotalMb: float
    systemUsedPercent: float
    threads: int
