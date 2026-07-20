"""Cấu hình runtime của AI service. Service chỉ bind localhost."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LLVT_", env_file=".env", extra="ignore")

    # Chỉ lắng nghe trên loopback, không mở ra LAN/Internet.
    host: str = "127.0.0.1"
    port: int = 8756

    # Nguồn gốc được phép cho REST/WS (Electron dev server + app đóng gói).
    allowed_origins: list[str] = ["http://localhost:5173", "app://.", "file://"]

    # Sau khi model đã cài, service hoạt động offline.
    offline_ready: bool = True


settings = Settings()
