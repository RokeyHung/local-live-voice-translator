"""Fixtures dùng chung cho test suite.

Quan trọng: ``app`` nạp preset mặc định trong lifespan → gọi ``load()`` của các
provider, mà thật thì sẽ TẢI model (GGML hàng trăm MB cho ASR, ~2.4GB cho NLLB) từ
HF. Các fixture autouse dưới đây thay loader thật bằng bản giả để mọi test dựa trên
``TestClient`` chạy nhanh, offline và xác định. Test tích hợp model thật là opt-in
(xem test_asr.py / test_mt.py).
"""

from __future__ import annotations

import os
from typing import Any

import numpy as np
import pytest


@pytest.fixture(autouse=True)
def _tmp_user_data(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Any:
    """Mỗi test có thư mục dữ liệu riêng trong tmp_path.

    Nếu không, lifespan sẽ mở đúng file lịch sử thật của máy (``~/.llvt/history.db``)
    và các test đổi thư mục model sẽ ghi đè ``~/.llvt/settings.json`` của người dùng.
    """
    from llvt_ai_service.config import runtime_config
    from llvt_ai_service.config.settings import get_settings

    monkeypatch.setenv("LLVT_DB_PATH", str(tmp_path / "history.db"))
    monkeypatch.setattr(runtime_config, "CONFIG_PATH", tmp_path / "settings.json")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class FakeSegment:
    def __init__(self, text: str, probability: float = 0.9) -> None:
        self.text = text
        self.probability = probability


class FakeWhisperModel:
    """Bản giả của pywhispercpp.model.Model: ghi lại tham số, trả transcript cố định."""

    def __init__(self, text: str = " xin chào") -> None:
        self._text = text
        self.calls: list[dict[str, Any]] = []

    def transcribe(self, media: np.ndarray, **params: Any) -> list[FakeSegment]:
        self.calls.append({"media": media, "params": params})
        return [FakeSegment(self._text)]


class FakeNllbBackend:
    """Bản giả backend NLLB: ghi lại lời gọi, trả text có tiền tố mã đích."""

    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def translate(self, text: str, src_code: str, tgt_code: str) -> str:
        self.calls.append({"text": text, "src": src_code, "tgt": tgt_code})
        return f"[{tgt_code}] {text}"


@pytest.fixture(autouse=True)
def _fake_asr_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    """Chặn tải model thật khi lifespan nạp preset mặc định."""
    from llvt_ai_service.adapters.asr import whisper_cpp

    monkeypatch.setattr(
        whisper_cpp,
        "_default_loader",
        lambda _model_id, _models_dir, device="auto": FakeWhisperModel(),
    )


@pytest.fixture(autouse=True)
def _fake_mt_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    """Chặn tải NLLB thật khi lifespan nạp preset mặc định."""
    from llvt_ai_service.adapters.mt import nllb

    monkeypatch.setattr(nllb, "_default_loader", lambda _repo, _dir, _device: FakeNllbBackend())


class FakeGeneratedAudio:
    def __init__(self, samples: np.ndarray, sample_rate: int) -> None:
        self.samples = samples
        self.sample_rate = sample_rate


class FakeTtsEngine:
    """Bản giả của sherpa_onnx.OfflineTts: trả tín hiệu ngắn, ghi lại lời gọi."""

    sample_rate = 22050

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def generate(self, text: str, sid: int = 0, speed: float = 1.0) -> FakeGeneratedAudio:
        self.calls.append({"text": text, "sid": sid, "speed": speed})
        samples = np.zeros(int(self.sample_rate * 0.1), dtype=np.float32)  # 100ms im lặng
        return FakeGeneratedAudio(samples, self.sample_rate)


@pytest.fixture(autouse=True)
def _fake_tts_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """Chặn tải + khởi tạo voice sherpa-onnx thật (nạp lười khi pipeline synthesize).

    Bỏ qua khi chạy test tích hợp thật (LLVT_RUN_TTS_INTEGRATION=1) để dùng hàm thật.
    """
    if os.environ.get("LLVT_RUN_TTS_INTEGRATION") == "1":
        return
    from llvt_ai_service.adapters.tts import sherpa_onnx

    monkeypatch.setattr(sherpa_onnx, "_download_voice", lambda _voice, _dir: _dir)
    monkeypatch.setattr(sherpa_onnx, "_default_engine_loader", lambda _model_dir: FakeTtsEngine())
