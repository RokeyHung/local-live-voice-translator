"""Cấu hình runtime của AI service. Service chỉ bind localhost."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

from llvt_ai_service.config import runtime_config
from llvt_ai_service.domain.enums import Preset


class _SavedSettingsSource(PydanticBaseSettingsSource):
    """Nguồn cấu hình đọc từ ``~/.llvt/settings.json`` (thứ người dùng đổi trong app)."""

    def get_field_value(
        self, field: Any, field_name: str
    ) -> tuple[Any, str, bool]:  # pragma: no cover - API bắt buộc
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        return runtime_config.load()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LLVT_", env_file=".env", extra="ignore")

    # Chỉ lắng nghe trên loopback, không mở ra LAN/Internet.
    host: str = "127.0.0.1"
    port: int = 8756

    # Nguồn gốc được phép cho REST/WS (Electron dev server + app đóng gói).
    allowed_origins: list[str] = ["http://localhost:5173", "app://.", "file://"]

    # Preset mặc định khi khởi động.
    default_preset: Preset = Preset.balanced

    # Nạp model ngay khi service khởi động. Mặc định TẮT: nạp mất hàng chục giây và
    # lần đầu còn tải vài GB, trong khi người dùng có thể chỉ muốn mở app xem cấu
    # hình. Model được nạp khi bấm "Khởi động model" hoặc khi bắt đầu phiên.
    preload_models: bool = False

    # Thư mục chứa model đã tải (whisper.cpp gguf, NLLB, sherpa-onnx voices).
    models_dir: Path = Path.home() / ".llvt" / "models"

    # File SQLite giữ lịch sử phiên (chỉ văn bản, không có audio).
    db_path: Path = Path.home() / ".llvt" / "history.db"

    # SPEC 14.4: người dùng tắt được việc lưu lịch sử. Tắt thì chỉ ngừng GHI —
    # dữ liệu cũ vẫn xem và xoá được.
    history_enabled: bool = True

    # Sau khi model đã cài, service hoạt động offline.
    offline_ready: bool = True

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # File JSON đứng SAU env/.env: người chạy service đặt biến môi trường thì
        # giao diện không ghi đè được (xem config/runtime_config.py).
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            _SavedSettingsSource(settings_cls),
            file_secret_settings,
        )


@lru_cache
def get_settings() -> Settings:
    """Singleton settings (cache) dùng cho DI."""
    return Settings()


def reload_settings() -> Settings:
    """Đọc lại settings sau khi ghi ``~/.llvt/settings.json``."""
    get_settings.cache_clear()
    return get_settings()


settings = get_settings()
