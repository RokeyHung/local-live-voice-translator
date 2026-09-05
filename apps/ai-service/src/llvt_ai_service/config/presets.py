"""Định nghĩa preset Fast / Balanced / Quality → chọn adapter + model cho từng port.

Đây là nơi duy nhất ánh xạ "preset" sang lựa chọn cụ thể; đổi model không cần
sửa pipeline hay adapter.

Preset không chỉ chọn model mà còn chọn *ngưỡng phân đoạn câu* (``VadTuning``): model
nhỏ giải mã nhanh nên cắt câu ngắn được mà không dồn hàng đợi; model lớn cần đoạn dài
hơn để bù thời gian giải mã. Đây chính là trục "nhanh/nhẹ ↔ chất lượng cao" mà GVHD
đề nghị đưa thành lựa chọn cho người dùng (biên bản 19/08 mục 5).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from llvt_ai_service.domain.enums import Preset


@dataclass(frozen=True)
class VadTuning:
    """Ngưỡng endpointing của VAD — xem ``adapters/vad/silero.py`` để hiểu ý nghĩa.

    Các trường ở đây phải TRÙNG TÊN với ``adapters.vad.silero.VadParams``: dữ liệu
    thuần ở tầng config, còn thuật toán nằm ở adapter (config không import adapter).
    """

    threshold: float = 0.5
    min_silence_ms: int = 320
    soft_silence_ms: int = 140
    speech_pad_ms: int = 120
    min_speech_ms: int = 250
    soft_max_ms: int = 3500
    max_speech_ms: int = 6000
    backoff_ms: int = 400
    carry_ms: int = 100


@dataclass(frozen=True)
class PresetConfig:
    vad_adapter: str
    asr_adapter: str
    asr_model: str
    mt_adapter: str
    mt_model: str
    tts_adapter: str
    vad: VadTuning = field(default_factory=VadTuning)
    # Model TƯƠNG ĐƯƠNG ở các runtime ASR khác, khoá = tên adapter trong ASR_REGISTRY.
    #
    # Preset là một mức "nhanh ↔ chất lượng", không phải một model cụ thể: đổi runtime
    # (``LLVT_ASR_ADAPTER=mlx_whisper``) thì phải giữ nguyên mức đó, chứ không rơi về
    # một model mặc định chẳng liên quan. Bảng này nằm ở config vì nó là *lựa chọn*,
    # còn cách nạp là việc của adapter.
    asr_alternatives: dict[str, str] = field(default_factory=dict)


PRESETS: dict[Preset, PresetConfig] = {
    Preset.fast: PresetConfig(
        vad_adapter="silero",
        asr_adapter="whisper_cpp",
        asr_model="whisper-small-q5",
        mt_adapter="nllb",
        mt_model="nllb-200-distilled-600M-int8",
        tts_adapter="sherpa_onnx",
        # small-q5 giải mã rất nhanh → cắt sớm, ưu tiên độ trễ thấp.
        vad=VadTuning(soft_max_ms=2200, max_speech_ms=4500, min_silence_ms=280),
        asr_alternatives={"mlx_whisper": "mlx-whisper-small-q8"},
    ),
    Preset.balanced: PresetConfig(
        vad_adapter="silero",
        asr_adapter="whisper_cpp",
        asr_model="whisper-large-v3-turbo-q5",
        mt_adapter="nllb",
        mt_model="nllb-200-distilled-600M",
        tts_adapter="sherpa_onnx",
        vad=VadTuning(),
        asr_alternatives={"mlx_whisper": "mlx-whisper-large-v3-turbo-q8"},
    ),
    Preset.quality: PresetConfig(
        vad_adapter="silero",
        asr_adapter="whisper_cpp",
        asr_model="whisper-large-v3-turbo-q8",
        mt_adapter="nllb",
        mt_model="nllb-200-distilled-600M",
        tts_adapter="sherpa_onnx",
        # Đoạn dài hơn cho whisper nhiều ngữ cảnh hơn, đổi lại chờ lâu hơn.
        vad=VadTuning(soft_max_ms=4500, max_speech_ms=8000, min_silence_ms=380),
        asr_alternatives={"mlx_whisper": "mlx-whisper-large-v3-turbo"},
    ),
}


def get_preset_config(preset: Preset) -> PresetConfig:
    return PRESETS[preset]
