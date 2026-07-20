"""Định nghĩa preset Fast / Balanced / Quality → chọn adapter + model cho từng port.

Đây là nơi duy nhất ánh xạ "preset" sang lựa chọn cụ thể; đổi model không cần
sửa pipeline hay adapter.
"""

from __future__ import annotations

from dataclasses import dataclass

from llvt_ai_service.domain.enums import Preset


@dataclass(frozen=True)
class PresetConfig:
    vad_adapter: str
    asr_adapter: str
    asr_model: str
    mt_adapter: str
    mt_model: str
    tts_adapter: str


PRESETS: dict[Preset, PresetConfig] = {
    Preset.fast: PresetConfig(
        vad_adapter="silero",
        asr_adapter="whisper_cpp",
        asr_model="whisper-small-q5",
        mt_adapter="nllb",
        mt_model="nllb-200-distilled-600M-int8",
        tts_adapter="sherpa_onnx",
    ),
    Preset.balanced: PresetConfig(
        vad_adapter="silero",
        asr_adapter="whisper_cpp",
        asr_model="whisper-large-v3-turbo-q5",
        mt_adapter="nllb",
        mt_model="nllb-200-distilled-600M",
        tts_adapter="sherpa_onnx",
    ),
    Preset.quality: PresetConfig(
        vad_adapter="silero",
        asr_adapter="whisper_cpp",
        asr_model="whisper-large-v3-turbo-q8",
        mt_adapter="nllb",
        mt_model="nllb-200-distilled-600M",
        tts_adapter="sherpa_onnx",
    ),
}


def get_preset_config(preset: Preset) -> PresetConfig:
    return PRESETS[preset]
