"""Adapter ASR faster-whisper (CTranslate2) — dùng model giả, không tải gì.

Backend thứ ba, cùng port với hai backend kia. Cái cần kiểm là phần adapter TỰ viết:
ánh xạ tên model, chọn thiết bị + kiểu tính toán, tham số giải mã, và việc duyệt hết
generator ngay trong worker thread.
"""

from __future__ import annotations

import asyncio
import math

import numpy as np
import pytest

from llvt_ai_service.adapters.asr.faster_whisper import (
    DECODE_PARAMS,
    MODEL_MAP,
    FasterWhisperAsr,
    _compute_type,
    _mean_probability,
)
from llvt_ai_service.domain.enums import Language

SR = 16000


class FakeSegment:
    def __init__(self, text: str, avg_logprob: float | None = None) -> None:
        self.text = text
        self.avg_logprob = avg_logprob


class FakeFasterWhisper:
    """Bản giả của faster_whisper.WhisperModel: trả (generator, info) như thật."""

    def __init__(self, segments: list[FakeSegment] | None = None) -> None:
        self._segments = segments if segments is not None else [FakeSegment(" xin chào")]
        self.calls: list[dict] = []

    def transcribe(self, audio: np.ndarray, **params: object) -> tuple[object, object]:
        self.calls.append({"audio": audio, "params": params})
        # Trả generator đúng như thư viện thật — adapter phải tự duyệt hết.
        return (seg for seg in self._segments), object()


def _asr(
    segments: list[FakeSegment] | None = None, **kwargs: object
) -> tuple[FasterWhisperAsr, FakeFasterWhisper]:
    model = FakeFasterWhisper(segments)
    asr = FasterWhisperAsr(
        "Systran/faster-whisper-small",
        models_dir=None,
        loader=lambda _repo, _dir, _device: model,
        device="cpu",
        **kwargs,  # type: ignore[arg-type]
    )
    asyncio.run(asr.load())
    return asr, model


# --- tên model ------------------------------------------------------------


def test_logical_names_map_to_ctranslate2_repos():
    assert MODEL_MAP["Systran/faster-whisper-large-v3"] == "Systran/faster-whisper-large-v3"


def test_unknown_names_pass_through_so_any_repo_still_works():
    asr = FasterWhisperAsr("my-org/my-ct2-model")
    assert asr.runtime_info()["model"] == "my-org/my-ct2-model"


def test_no_english_only_variants_in_the_catalog():
    # Ứng dụng luôn phải nhận cả vi/ja/zh; model English-only sẽ trả rác cho ba thứ đó.
    for name in MODEL_MAP:
        assert not name.endswith(".en"), name


# --- thiết bị -------------------------------------------------------------


def test_compute_type_pairs_int8_with_cpu_and_float16_with_cuda():
    assert _compute_type("cpu") == "int8"
    assert _compute_type("cuda") == "float16"


def test_runtime_info_reports_the_compute_type_too():
    # Cùng một GPU nhưng float16 và int8 cho hai con số tốc độ khác hẳn — thiếu nó thì
    # bảng đo không đọc được.
    asr, _ = _asr()
    assert asr.runtime_info() == {
        "model": "Systran/faster-whisper-small",
        "backend": "faster-whisper",
        "accel": "cpu (int8)",
    }


# --- vòng đời -------------------------------------------------------------


def test_transcribe_before_load_is_an_error_not_an_empty_result():
    asr = FasterWhisperAsr("Systran/faster-whisper-small")
    with pytest.raises(RuntimeError, match="chưa load"):
        asyncio.run(asr.transcribe(b"\x00\x00", Language.vi))


def test_rejects_audio_that_is_not_16khz():
    asr, _ = _asr()
    with pytest.raises(ValueError, match="16000 Hz"):
        asyncio.run(asr.transcribe(b"\x00\x00", Language.vi, sample_rate=48000))


def test_unload_can_be_repeated():
    asr, _ = _asr()
    asyncio.run(asr.unload())
    assert not asr.loaded
    asyncio.run(asr.unload())


# --- giải mã --------------------------------------------------------------


def test_decoding_policy_matches_the_other_two_backends():
    # So ba runtime chỉ có nghĩa khi chính sách giải mã giống nhau.
    assert DECODE_PARAMS["condition_on_previous_text"] is False
    assert DECODE_PARAMS["temperature"] == (0.0,), "phải tắt fallback nhiệt độ"
    assert DECODE_PARAMS["task"] == "transcribe"


def test_its_own_vad_stays_off():
    # Đoạn vào đây đã do Silero cắt; cắt lần nữa là bỏ mất phần đệm đầu/cuối câu.
    assert DECODE_PARAMS["vad_filter"] is False


def test_passes_language_and_normalises_pcm_to_float():
    asr, model = _asr()
    pcm = np.array([-32768, 0, 32767], dtype=np.int16).tobytes()
    asyncio.run(asr.transcribe(pcm, Language.zh))

    call = model.calls[0]
    assert call["params"]["language"] == "zh"
    np.testing.assert_allclose(call["audio"], [-1.0, 0.0, 32767 / 32768], atol=1e-6)


def test_generator_is_drained_so_decoding_happens_off_the_event_loop():
    # Thư viện trả generator; trả nó ra ngoài thì phần nặng lại chạy trên event loop.
    asr, _ = _asr([FakeSegment(" xin"), FakeSegment(" chào")])
    result = asyncio.run(asr.transcribe(b"\x00\x00" * SR, Language.vi))
    assert result.text == "xin chào"


def test_low_confidence_output_is_dropped_by_the_shared_filter():
    asr, _ = _asr([FakeSegment(" cảm ơn đã xem", -3.0)], min_confidence=0.35)
    result = asyncio.run(asr.transcribe(b"\x00\x00" * SR, Language.vi))
    assert result.text == ""


# --- độ tin cậy -----------------------------------------------------------


def test_confidence_is_the_exponential_of_avg_logprob():
    assert _mean_probability([FakeSegment("x", -0.5)]) == pytest.approx(math.exp(-0.5))


def test_confidence_is_none_when_the_backend_reports_nothing_usable():
    assert _mean_probability([]) is None
    assert _mean_probability([FakeSegment("x")]) is None
    assert _mean_probability([FakeSegment("x", float("nan"))]) is None
