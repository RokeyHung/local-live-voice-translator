"""Adapter ASR trên MLX (adapters/asr/mlx_whisper.py) — dùng model giả.

Không tải model thật: bản nhỏ nhất cũng ~78 MB và chỉ chạy trên Apple Silicon, nên
test suite không được phụ thuộc vào đó. Cái cần kiểm ở đây là phần adapter TỰ viết:
ánh xạ tên model, tham số giải mã, cách quy đổi độ tin cậy, và việc bộ lọc câu ma
được dùng chung với whisper.cpp.
"""

from __future__ import annotations

import asyncio
import math

import numpy as np
import pytest

from llvt_ai_service.adapters.asr.mlx_whisper import (
    DECODE_PARAMS,
    MODEL_MAP,
    MlxWhisperAsr,
    _mean_probability,
)
from llvt_ai_service.domain.enums import Language

SR = 16000


class FakeMlxModel:
    """Bản giả của model mlx-audio: ghi lại tham số, trả segment dựng sẵn."""

    def __init__(self, segments: list[dict] | None = None) -> None:
        self.segments = segments if segments is not None else [{"text": " xin chào"}]
        self.calls: list[dict] = []

    def generate(self, audio: np.ndarray, **params: object) -> object:
        self.calls.append({"audio": audio, "params": params})
        return type("STTOutput", (), {"segments": self.segments})()


def _asr(
    segments: list[dict] | None = None, **kwargs: object
) -> tuple[MlxWhisperAsr, FakeMlxModel]:
    model = FakeMlxModel(segments)
    asr = MlxWhisperAsr(
        "mlx-community/whisper-small-asr-8bit",
        models_dir=None,
        loader=lambda _repo, _dir: model,
        **kwargs,  # type: ignore[arg-type]
    )
    asyncio.run(asr.load())
    return asr, model


# --- tên model ------------------------------------------------------------


def test_logical_names_map_to_mlx_community_repos():
    assert MODEL_MAP["mlx-community/whisper-large-v3-turbo-asr-8bit"] == (
        "mlx-community/whisper-large-v3-turbo-asr-8bit"
    )


def test_unknown_names_pass_through_so_any_repo_still_works():
    asr = MlxWhisperAsr("mlx-community/whisper-tiny-asr-4bit")
    assert asr.runtime_info()["model"] == "mlx-community/whisper-tiny-asr-4bit"


def test_every_mapped_repo_uses_the_asr_naming_scheme():
    # Bản `whisper-*-mlx` cũ thiếu file processor của HuggingFace nên mlx-audio không
    # nạp được — bảng ánh xạ phải toàn dạng `-asr-`.
    for repo in MODEL_MAP.values():
        assert "-asr-" in repo, repo


# --- vòng đời -------------------------------------------------------------


def test_reports_metal_and_the_repo_after_loading():
    asr, _ = _asr()
    info = asr.runtime_info()
    assert asr.loaded
    assert info == {
        "model": "mlx-community/whisper-small-asr-8bit",
        "backend": "mlx-audio",
        "accel": "Metal",
    }


def test_unload_releases_the_model_and_can_be_repeated():
    asr, _ = _asr()
    asyncio.run(asr.unload())
    assert not asr.loaded
    asyncio.run(asr.unload())  # gọi lại không được nổ


def test_transcribe_before_load_is_an_error_not_an_empty_result():
    asr = MlxWhisperAsr("mlx-community/whisper-small-asr-8bit")
    with pytest.raises(RuntimeError, match="chưa load"):
        asyncio.run(asr.transcribe(b"\x00\x00", Language.vi))


def test_rejects_audio_that_is_not_16khz():
    asr, _ = _asr()
    with pytest.raises(ValueError, match="16000 Hz"):
        asyncio.run(asr.transcribe(b"\x00\x00", Language.vi, sample_rate=48000))


# --- giải mã --------------------------------------------------------------


def test_decoding_matches_the_whisper_cpp_policy():
    # Hai runtime chỉ so được với nhau nếu chính sách giải mã giống nhau: không mang
    # ngữ cảnh sang câu sau, và tắt fallback nhiệt độ.
    assert DECODE_PARAMS["condition_on_previous_text"] is False
    assert DECODE_PARAMS["temperature"] == 0.0
    assert DECODE_PARAMS["task"] == "transcribe"


def test_passes_the_language_and_normalises_pcm_to_float():
    asr, model = _asr()
    pcm = np.array([-32768, 0, 32767], dtype=np.int16).tobytes()
    asyncio.run(asr.transcribe(pcm, Language.ja))

    call = model.calls[0]
    assert call["params"]["language"] == "ja"
    assert call["params"]["temperature"] == 0.0
    np.testing.assert_allclose(call["audio"], [-1.0, 0.0, 32767 / 32768], atol=1e-6)


def test_joins_segment_texts_and_strips_non_speech_markers():
    asr, _ = _asr([{"text": " [Music]"}, {"text": " xin"}, {"text": " chào"}])
    result = asyncio.run(asr.transcribe(b"\x00\x00" * SR, Language.vi))
    assert result.text == "xin chào"


def test_low_confidence_output_is_dropped_by_the_shared_hallucination_filter():
    # exp(-3) ≈ 0.05, dưới ngưỡng 0.35 → coi là câu ma, bỏ hẳn như bên whisper.cpp.
    asr, _ = _asr([{"text": " cảm ơn đã xem", "avg_logprob": -3.0}], min_confidence=0.35)
    result = asyncio.run(asr.transcribe(b"\x00\x00" * SR, Language.vi))
    assert result.text == ""
    assert result.confidence is not None and result.confidence < 0.35


# --- độ tin cậy -----------------------------------------------------------


def test_confidence_is_the_exponential_of_avg_logprob():
    assert _mean_probability([{"avg_logprob": -0.5}]) == pytest.approx(math.exp(-0.5))


def test_confidence_averages_across_segments():
    value = _mean_probability([{"avg_logprob": 0.0}, {"avg_logprob": math.log(0.5)}])
    assert value == pytest.approx(0.75)


def test_confidence_is_none_when_the_backend_reports_nothing_usable():
    assert _mean_probability([]) is None
    assert _mean_probability([{"text": "x"}]) is None
    assert _mean_probability([{"avg_logprob": float("nan")}]) is None
    assert _mean_probability([{"avg_logprob": float("-inf")}]) is None
