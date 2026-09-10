"""Test WhisperCppAsr adapter (Tuần 3).

- Logic adapter (mapping model, chuẩn hóa PCM, tham số transcribe, confidence,
  guard) test bằng model giả để xác định, không tải model thật.
- Một test tích hợp opt-in chạy model whisper.cpp thật (small-q5); chỉ chạy khi
  đặt biến môi trường ``LLVT_RUN_ASR_INTEGRATION=1`` để không tải model trong CI.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import numpy as np
import pytest

from llvt_ai_service.adapters.asr.whisper_cpp import MODEL_MAP, WhisperCppAsr
from llvt_ai_service.domain.enums import Language


class RecordingSegment:
    def __init__(self, text: str, probability: float = float("nan")) -> None:
        self.text = text
        self.probability = probability


class RecordingModel:
    """Model giả ghi lại lời gọi transcribe và trả segment cấu hình sẵn."""

    def __init__(self, segments: list[RecordingSegment]) -> None:
        self._segments = segments
        self.calls: list[dict[str, Any]] = []

    def transcribe(self, media: np.ndarray, **params: Any) -> list[RecordingSegment]:
        self.calls.append({"media": media, "params": params})
        return self._segments


def _make_asr(segments: list[RecordingSegment], model: str = "ggml-small-q5_1.bin"):
    """Dựng adapter với loader tiêm sẵn, trả (adapter, model_giả)."""
    fake = RecordingModel(segments)
    asr = WhisperCppAsr(model, models_dir="/tmp/x", loader=lambda _id, _dir: fake)
    return asr, fake


def test_model_name_maps_to_ggml_id():
    assert MODEL_MAP["ggml-small-q5_1.bin"] == "small-q5_1"
    assert MODEL_MAP["ggml-large-v3-turbo-q5_0.bin"] == "large-v3-turbo-q5_0"
    assert MODEL_MAP["ggml-large-v3-turbo-q8_0.bin"] == "large-v3-turbo-q8_0"
    # Tên lạ giữ nguyên (cho phép truyền thẳng đường dẫn/id GGML).
    asr = WhisperCppAsr("small.en-q5_1", loader=lambda _i, _d: RecordingModel([]))
    assert asr._model_id == "small.en-q5_1"


def test_runtime_info_reports_the_upstream_path_not_the_internal_id():
    """Một model chỉ được có MỘT cái tên (docs/04).

    pywhispercpp nhận `small-q5_1`, nhưng đó là chi tiết bên trong runtime. Danh mục,
    ô chọn model, `POST /api/models/download` và bảng tiến trình đều dùng
    `ggml-small-q5_1.bin`; báo cáo id ở đây là bắt màn Phiên dịch hiện một cái tên
    thứ hai cho đúng model người dùng vừa chọn.
    """
    asr = WhisperCppAsr("ggml-small-q5_1.bin", loader=lambda _i, _d: RecordingModel([]))
    asyncio.run(asr.load())

    assert asr.runtime_info()["model"] == "ggml-small-q5_1.bin"
    assert asr._model_id == "small-q5_1", "vẫn phải gọi runtime bằng id của nó"


def test_loader_receives_mapped_id_and_dir():
    captured: dict[str, Any] = {}

    def loader(model_id: str, models_dir: str | None):
        captured["id"] = model_id
        captured["dir"] = models_dir
        return RecordingModel([])

    asr = WhisperCppAsr("ggml-small-q5_1.bin", models_dir="/models/w", loader=loader)
    asyncio.run(asr.load())
    assert captured == {"id": "small-q5_1", "dir": "/models/w"}


def test_transcribe_joins_and_strips_text():
    asr, _ = _make_asr([RecordingSegment(" xin"), RecordingSegment(" chào ")])
    asyncio.run(asr.load())
    out = asyncio.run(asr.transcribe(b"\x00\x00" * 16, Language.vi))
    assert out.text == "xin chào"
    assert out.language is Language.vi
    assert out.processing_ms is not None and out.processing_ms >= 0


def test_transcribe_passes_transcribe_task_and_language():
    asr, fake = _make_asr([RecordingSegment("hello")])
    asyncio.run(asr.load())
    asyncio.run(asr.transcribe(b"\x00\x00" * 16, Language.en))
    params = fake.calls[0]["params"]
    assert params["language"] == "en"
    assert params["translate"] is False  # task=transcribe, KHÔNG dịch


def test_pcm16_normalized_to_float32():
    asr, fake = _make_asr([RecordingSegment("x")])
    asyncio.run(asr.load())
    pcm = np.array([0, 32767, -32768, 16384], dtype=np.int16).tobytes()
    asyncio.run(asr.transcribe(pcm, Language.vi))
    media = fake.calls[0]["media"]
    assert media.dtype == np.float32
    assert np.isclose(media[0], 0.0)
    assert np.isclose(media[1], 32767 / 32768.0)
    assert np.isclose(media[2], -1.0)
    assert -1.0 <= media.min() and media.max() <= 1.0


def test_confidence_is_mean_probability_ignoring_nan():
    segs = [
        RecordingSegment("a", probability=0.8),
        RecordingSegment("b", probability=0.6),
        RecordingSegment("c", probability=float("nan")),  # bỏ qua
    ]
    asr, _ = _make_asr(segs)
    asyncio.run(asr.load())
    out = asyncio.run(asr.transcribe(b"\x00\x00" * 16, Language.vi))
    assert out.confidence == pytest.approx(0.7)


def test_confidence_none_when_no_probabilities():
    asr, _ = _make_asr([RecordingSegment("a")])  # probability = NaN mặc định
    asyncio.run(asr.load())
    out = asyncio.run(asr.transcribe(b"\x00\x00" * 16, Language.vi))
    assert out.confidence is None


def test_wrong_sample_rate_raises_value_error():
    asr, _ = _make_asr([RecordingSegment("a")])
    asyncio.run(asr.load())
    with pytest.raises(ValueError):
        asyncio.run(asr.transcribe(b"\x00\x00" * 16, Language.vi, sample_rate=8000))


def test_transcribe_before_load_raises_runtime_error():
    asr, _ = _make_asr([RecordingSegment("a")])
    with pytest.raises(RuntimeError):
        asyncio.run(asr.transcribe(b"\x00\x00" * 16, Language.vi))


@pytest.mark.skipif(
    os.environ.get("LLVT_RUN_ASR_INTEGRATION") != "1",
    reason="Đặt LLVT_RUN_ASR_INTEGRATION=1 để tải + chạy model whisper.cpp thật",
)
def test_real_small_model_transcribes_without_error():
    """Tích hợp thật: nạp small-q5 và transcribe một đoạn PCM (tone tổng hợp).

    Không khẳng định nội dung (tone không có lời), chỉ kiểm chứng load + decode
    chạy trọn vẹn qua binding thật và trả AsrTranscript hợp lệ.
    """

    def real_loader(model_id: str, models_dir: str | None):
        from pywhispercpp.model import Model

        return Model(model_id, models_dir=models_dir, redirect_whispercpp_logs_to=None)

    asr = WhisperCppAsr("ggml-small-q5_1.bin", models_dir="/tmp/llvt-asr-it", loader=real_loader)
    asyncio.run(asr.load())
    sr = 16000
    t = np.arange(sr, dtype=np.float32) / sr
    pcm = (0.1 * np.sin(2 * np.pi * 220 * t) * 32767).astype(np.int16).tobytes()
    out = asyncio.run(asr.transcribe(pcm, Language.en))
    assert isinstance(out.text, str)
    assert out.processing_ms is not None
