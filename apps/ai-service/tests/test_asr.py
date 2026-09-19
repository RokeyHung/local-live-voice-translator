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

from llvt_ai_service.adapters.asr.whisper_cpp import (
    AUTO,
    CPU_ONLY,
    DEV_CPU,
    DEV_GPU,
    DEV_IGPU,
    MODEL_MAP,
    GgmlDevice,
    WhisperCppAsr,
    gpu_backend_from_log,
    gpu_device_from_log,
    pick_gpu_device,
    resolve_device,
)
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


def test_gpu_backend_read_from_init_log():
    """Backend Vulkan không khai trong system_info(), nên thiết bị lấy từ log lúc nạp."""
    log = (
        "whisper_init_with_params_no_state: use gpu    = 1\n"
        "whisper_backend_init_gpu: using Vulkan0 backend\n"
    )
    assert gpu_backend_from_log(log) == "Vulkan"
    assert gpu_backend_from_log("whisper_backend_init_gpu: using CUDA0 backend") == "CUDA"
    assert gpu_backend_from_log("whisper_backend_init_gpu: using MTL0 backend") == "Metal"
    # Bản build Vulkan trên máy không có card: ggml lùi về CPU.
    assert gpu_backend_from_log("whisper_backend_init_gpu: no GPU found\n") is None
    assert gpu_backend_from_log("") is None


IRIS = GgmlDevice("Vulkan0", "Intel(R) Iris(R) Xe Graphics", DEV_IGPU, 16000)
RTX = GgmlDevice("Vulkan1", "NVIDIA GeForce RTX 4060 Laptop GPU", DEV_GPU, 8000)
CPU = GgmlDevice("CPU", "12th Gen Intel(R) Core(TM) i5-12500H", DEV_CPU)
# Thứ tự ggml thật trên máy dev: GPU tích hợp đứng trước.
HYBRID = [IRIS, RTX, CPU]


def test_gpu_device_name_read_from_init_log():
    assert gpu_device_from_log("whisper_backend_init_gpu: using Vulkan1 backend") == "Vulkan1"
    assert gpu_device_from_log("whisper_backend_init_gpu: no GPU found") is None


def test_discrete_gpu_wins_over_the_integrated_one_listed_first():
    """Laptop hybrid: ggml liệt kê Iris Xe trước RTX 4060, whisper.cpp lấy cái đầu."""
    assert pick_gpu_device(HYBRID) == {"gpu_device": 1}


def test_default_kept_when_the_first_gpu_is_already_discrete():
    assert pick_gpu_device([RTX, IRIS, CPU]) is None
    assert pick_gpu_device([GgmlDevice("MTL0", "Apple M4", DEV_GPU), CPU]) is None


def test_integrated_gpu_only_is_still_used():
    """Iris Xe vẫn nhanh hơn CPU (~9,9 s so với ~17 s), nên không ép về CPU."""
    assert pick_gpu_device([IRIS, CPU]) is None


def test_no_device_list_keeps_whisper_default():
    assert pick_gpu_device([]) is None
    assert pick_gpu_device([CPU]) is None


def test_auto_choice_is_the_discrete_preference():
    assert resolve_device(AUTO, HYBRID) == {"gpu_device": 1}
    assert resolve_device("", HYBRID) == {"gpu_device": 1}


def test_cpu_only_turns_the_gpu_off():
    assert resolve_device(CPU_ONLY, HYBRID) == {"use_gpu": False}
    # Cả khi ggml không liệt kê được gì (macOS, loader lỗi).
    assert resolve_device(CPU_ONLY, []) == {"use_gpu": False}


def test_a_named_gpu_is_used_even_when_auto_would_pick_another():
    """Người dùng chủ động chọn Iris Xe (vd để nhường RTX cho game) thì phải tôn trọng."""
    assert resolve_device(IRIS.description, HYBRID) is None  # nó đứng đầu → mặc định
    assert resolve_device(RTX.description, HYBRID) == {"gpu_device": 1}


def test_a_saved_gpu_that_is_gone_falls_back_to_auto():
    """settings.json mang từ máy khác, hay eGPU đã tháo: đừng làm hỏng lượt nạp."""
    assert resolve_device("AMD Radeon RX 7900", HYBRID) == {"gpu_device": 1}


def test_runtime_info_prefers_the_device_seen_at_load_time():
    model = RecordingModel([])
    model.llvt_gpu_backend = "Vulkan"  # type: ignore[attr-defined]
    asr = WhisperCppAsr("ggml-small-q5_1.bin", loader=lambda _i, _d: model)
    asyncio.run(asr.load())

    assert asr.runtime_info()["accel"] == "Vulkan"


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
