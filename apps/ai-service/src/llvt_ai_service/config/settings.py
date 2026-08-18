"""Cấu hình runtime của AI service. Service chỉ bind localhost."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from llvt_ai_service.domain.enums import Preset


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LLVT_", env_file=".env", extra="ignore")

    # Chỉ lắng nghe trên loopback, không mở ra LAN/Internet.
    host: str = "127.0.0.1"
    port: int = 8756

    # Nguồn gốc được phép cho REST/WS (Electron dev server + app đóng gói).
    allowed_origins: list[str] = ["http://localhost:5173", "app://.", "file://"]

    # Preset mặc định khi khởi động.
    default_preset: Preset = Preset.balanced

    # Thư mục chứa model đã tải (whisper.cpp gguf, NLLB, sherpa-onnx voices).
    models_dir: Path = Path.home() / ".llvt" / "models"

    # File SQLite giữ lịch sử phiên (chỉ văn bản, không có audio).
    db_path: Path = Path.home() / ".llvt" / "history.db"

    # SPEC 14.4: người dùng tắt được việc lưu lịch sử. Tắt thì chỉ ngừng GHI —
    # dữ liệu cũ vẫn xem và xoá được.
    history_enabled: bool = True

    # Sau khi model đã cài, service hoạt động offline.
    offline_ready: bool = True


@lru_cache
def get_settings() -> Settings:
    """Singleton settings (cache) dùng cho DI."""
    return Settings()


settings = get_settings()
