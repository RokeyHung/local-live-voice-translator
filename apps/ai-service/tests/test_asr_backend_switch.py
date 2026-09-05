"""Đổi runtime ASR bằng ``LLVT_ASR_ADAPTER`` mà vẫn giữ nguyên mức của preset.

Đây là điểm dễ sai nhất của việc có nhiều backend: mỗi runtime gọi tên model theo
kiểu riêng, nên đổi adapter mà quên tra sang cột tương ứng thì service sẽ lặng lẽ
chạy một model khác hẳn mức chất lượng người dùng chọn.
"""

from __future__ import annotations

import pytest

from llvt_ai_service.application.model_manager import (
    ASR_REGISTRY,
    asr_adapter_name,
    asr_model,
)
from llvt_ai_service.config.presets import PRESETS, get_preset_config
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Preset


@pytest.fixture
def balanced():
    return get_preset_config(Preset.balanced)


def test_mlx_backend_is_registered():
    assert "mlx_whisper" in ASR_REGISTRY


def test_without_the_override_the_preset_decides(balanced):
    assert asr_adapter_name(balanced) == "whisper_cpp"


def test_override_switches_the_adapter(monkeypatch, balanced):
    monkeypatch.setenv("LLVT_ASR_ADAPTER", "mlx_whisper")
    get_settings.cache_clear()
    assert asr_adapter_name(balanced) == "mlx_whisper"


def test_unknown_override_falls_back_to_the_preset(monkeypatch, balanced):
    # Gõ sai tên adapter không được làm service chết lúc khởi động — nó chỉ cảnh báo
    # trong log rồi dùng tiếp adapter của preset.
    monkeypatch.setenv("LLVT_ASR_ADAPTER", "khong-co-that")
    get_settings.cache_clear()
    assert asr_adapter_name(balanced) == "whisper_cpp"


def test_switching_adapter_keeps_the_quality_tier(balanced):
    assert asr_model(balanced, "whisper_cpp") == "whisper-large-v3-turbo-q5"
    assert asr_model(balanced, "mlx_whisper") == "mlx-whisper-large-v3-turbo-q8"


def test_every_preset_has_an_mlx_equivalent():
    # Thiếu một preset thì người dùng đổi sang MLX sẽ rơi về model của whisper.cpp,
    # mà tên đó MLX không hiểu — hỏng lúc nạp chứ không phải lúc cấu hình.
    for preset in PRESETS:
        cfg = get_preset_config(preset)
        assert "mlx_whisper" in cfg.asr_alternatives, preset


def test_all_mlx_alternatives_are_names_the_adapter_knows():
    from llvt_ai_service.adapters.asr.mlx_whisper import MODEL_MAP

    for preset in PRESETS:
        name = get_preset_config(preset).asr_alternatives["mlx_whisper"]
        assert name in MODEL_MAP, (preset, name)


def test_unknown_adapter_keeps_the_preset_model_instead_of_guessing(balanced):
    assert asr_model(balanced, "faster_whisper") == balanced.asr_model
