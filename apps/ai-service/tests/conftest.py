"""Fixtures dùng chung cho test suite.

Quan trọng: ``app`` nạp preset mặc định trong lifespan → gọi ``WhisperCppAsr.load()``,
mà thật thì sẽ TẢI model GGML (hàng trăm MB) từ HF. Fixture autouse dưới đây thay
loader thật bằng ``FakeWhisperModel`` để mọi test dựa trên ``TestClient`` chạy nhanh,
offline và xác định. Test tích hợp model thật là opt-in (xem test_asr.py).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pytest


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


@pytest.fixture(autouse=True)
def _fake_asr_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    """Chặn tải model thật khi lifespan nạp preset mặc định."""
    from llvt_ai_service.adapters.asr import whisper_cpp

    monkeypatch.setattr(
        whisper_cpp, "_default_loader", lambda _model_id, _models_dir: FakeWhisperModel()
    )
