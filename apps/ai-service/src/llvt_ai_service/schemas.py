"""DTO Pydantic cho REST/WS (tách khỏi domain model thuần)."""

from __future__ import annotations

from pydantic import BaseModel

from llvt_ai_service.domain.enums import Preset


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
