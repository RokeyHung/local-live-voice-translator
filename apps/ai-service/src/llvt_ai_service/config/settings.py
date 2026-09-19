"""Cấu hình runtime của AI service. Service chỉ bind localhost."""

from __future__ import annotations

import os
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

    # Đè từng ngưỡng endpointing của preset đang chạy, ví dụ để dò tham số lúc đo:
    #   LLVT_VAD_OVERRIDES='{"max_speech_ms": 4000, "soft_max_ms": 2000}'
    # Khoá phải trùng tên trường của config.presets.VadTuning; khoá lạ bị bỏ qua kèm
    # cảnh báo trong log (xem application/model_manager.py).
    vad_overrides: dict[str, float] = {}

    # Dưới ngưỡng này thì coi câu ASR là rác và bỏ hẳn (không dịch, không đọc, không
    # ghi lịch sử). Whisper hay "sáng tác" trên đoạn chỉ có tiếng ồn — biên bản GVHD
    # 19/08 mục 4.1. Đặt 0 để tắt hoàn toàn bộ lọc.
    asr_min_confidence: float = 0.35

    # Rút ngắn ngữ cảnh encoder của whisper.cpp (mặc định 1500 ≈ 30 s). Đoạn VAD chỉ
    # vài giây nên phần lớn cửa sổ là padding — đặt ~768 nhanh hơn rõ rệt nhưng ĐỔI
    # LẠI ĐỘ CHÍNH XÁC, nên mặc định 0 (tắt). Là một điểm đo cho bảng độ trễ ↔ chất
    # lượng mà GVHD yêu cầu; đừng bật khi chưa có số WER tương ứng.
    asr_audio_ctx: int = 0

    # Đổi runtime ASR mà không đổi preset, ví dụ để so whisper.cpp với MLX trên cùng
    # một mức chất lượng: LLVT_ASR_ADAPTER=mlx_whisper. Rỗng = dùng adapter của preset.
    # Model tương ứng lấy từ `PresetConfig.asr_alternatives` nên vẫn đúng mức đã chọn.
    asr_adapter: str = ""

    # Lựa chọn model của preset `custom` (màn Quản lý model → ô "Tự chọn"). Trống =
    # lấy theo Balanced. Lưu vào ~/.llvt/settings.json qua PUT /api/config.
    custom_asr_adapter: str = ""
    custom_asr_model: str = ""
    custom_mt_model: str = ""

    # Thiết bị tính toán (màn Thiết bị âm thanh → "Cấu hình thực thi"): "auto", "cpu",
    # hoặc tên một GPU đúng như ggml báo (vd "NVIDIA GeForce RTX 4060 Laptop GPU").
    # Lưu theo TÊN chứ không theo số thứ tự: thứ tự ggml liệt kê đổi được khi cắm màn
    # hình rời hay cập nhật driver, tên thì không. Trống = auto.
    compute_device: str = ""

    # --- Tách người nói (diarization) — chỉ dùng cho màn Nhập tệp ---------------
    #
    # Mặc định TẮT vì hai lẽ: model pyannote là repo *gated* (lần tải đầu cần access
    # token của HuggingFace, xem `hf_token` bên dưới), và gói pyannote.audio là phần
    # cài thêm (`uv sync --extra diarization`). Bật lên thì mỗi tệp nhập vào sẽ được
    # chạy thêm một lượt gom cụm giọng trước khi nhận dạng chữ.
    diarization_enabled: bool = False
    diarization_adapter: str = "pyannote"
    diarization_model: str = "pyannote/speaker-diarization-community-1"

    # Chặn trên/dưới số người nói. Để trống thì model tự quyết; đặt khi đã biết trước
    # (họp hai người) vì gom cụm đúng số người cho kết quả ổn hơn hẳn.
    diarization_min_speakers: int | None = None
    diarization_max_speakers: int | None = None

    # Access token HuggingFace, CHỈ dùng cho lần tải model gated đầu tiên; tải xong
    # thì service chạy offline như thường.
    #
    # Đặt được bằng ba đường, ưu tiên giảm dần: `LLVT_HF_TOKEN` → ô nhập ở màn Cài đặt
    # (lưu vào ~/.llvt/settings.json, quyền 0600) → biến `HF_TOKEN` chuẩn của
    # huggingface_hub mà người dùng có thể đã export sẵn (xem `effective_hf_token`).
    #
    # KHÔNG bao giờ trả nguyên văn ra REST hay ghi vào log — chỉ có cờ "đã có token"
    # và một đoạn che (`hf_token_hint`).
    hf_token: str = ""

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
    settings = get_settings()
    publish_hf_token(settings)
    return settings


# --- Token HuggingFace ------------------------------------------------------
#
# Giá trị `HF_TOKEN` có sẵn trong môi trường lúc service khởi động, TRƯỚC khi mình
# đụng vào. Giữ lại để lúc người dùng xoá token trong app thì trả môi trường về đúng
# như cũ, chứ không xoá nhầm token họ tự export.
_INHERITED_HF_TOKEN = os.environ.get("HF_TOKEN")

#: Nguồn của token đang có hiệu lực — giao diện dùng để biết có sửa được không.
HF_SOURCE_ENV = "env"  # LLVT_HF_TOKEN: người chạy service quyết định, app không đổi
HF_SOURCE_SAVED = "saved"  # ô nhập trong app, nằm ở ~/.llvt/settings.json
HF_SOURCE_INHERITED = "inherited"  # biến HF_TOKEN chuẩn, có sẵn trong môi trường
HF_SOURCE_NONE = "none"


def hf_token_source(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if settings.hf_token:
        return HF_SOURCE_ENV if runtime_config.env_overrides("hf_token") else HF_SOURCE_SAVED
    return HF_SOURCE_INHERITED if _INHERITED_HF_TOKEN else HF_SOURCE_NONE


def effective_hf_token(settings: Settings | None = None) -> str:
    """Token thật sự sẽ được dùng, kể cả khi nó đến từ `HF_TOKEN` có sẵn."""
    settings = settings or get_settings()
    return settings.hf_token or _INHERITED_HF_TOKEN or ""


def mask_token(token: str) -> str:
    """`hf_abcd…wxyz` — đủ để người dùng nhận ra token nào, không đủ để dùng lại."""
    if not token:
        return ""
    if len(token) <= 10:
        return "•" * len(token)
    return f"{token[:6]}…{token[-4:]}"


def publish_hf_token(settings: Settings | None = None) -> None:
    """Đưa token vào biến `HF_TOKEN` để MỌI thư viện HuggingFace nhìn thấy.

    NLLB đi qua transformers, MLX qua `snapshot_download`, diarization qua
    pyannote — ba đường khác nhau nhưng cùng gọi `huggingface_hub.get_token()`, và
    hàm đó đọc `os.environ` **tại thời điểm gọi**. Nên đặt một biến ở đây là đủ cho
    cả ba, thay vì phải luồn tham số `token=` qua từng adapter.

    Không có token đã lưu thì trả biến về đúng giá trị lúc service khởi động.
    """
    settings = settings or get_settings()
    if settings.hf_token:
        os.environ["HF_TOKEN"] = settings.hf_token
    elif _INHERITED_HF_TOKEN is not None:
        os.environ["HF_TOKEN"] = _INHERITED_HF_TOKEN
    else:
        os.environ.pop("HF_TOKEN", None)


settings = get_settings()
publish_hf_token(settings)
