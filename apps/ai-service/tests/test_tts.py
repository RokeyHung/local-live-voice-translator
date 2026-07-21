"""Test SherpaOnnxTts adapter (Tuần 5).

- Logic adapter (nạp lười, cache voice, PCM16, speed, rỗng, voice override) test bằng
  engine + downloader giả để xác định, không tải model thật.
- Một test tích hợp opt-in tổng hợp giọng thật (Piper en/vi); chỉ chạy khi đặt
  ``LLVT_RUN_TTS_INTEGRATION=1`` để không tải voice model trong CI.
"""

from __future__ import annotations

import asyncio
import os
import wave
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from llvt_ai_service.adapters.tts.sherpa_onnx import DEFAULT_VOICE, SherpaOnnxTts
from llvt_ai_service.domain.enums import Language


class FakeAudio:
    def __init__(self, samples: np.ndarray, sample_rate: int) -> None:
        self.samples = samples
        self.sample_rate = sample_rate


class RecordingEngine:
    sample_rate = 16000

    def __init__(self, seconds: float = 0.5) -> None:
        self._n = int(self.sample_rate * seconds)
        self.calls: list[dict[str, Any]] = []

    def generate(self, text: str, sid: int = 0, speed: float = 1.0) -> FakeAudio:
        self.calls.append({"text": text, "sid": sid, "speed": speed})
        # Nửa biên độ để kiểm tra chuyển đổi float32 -> int16.
        return FakeAudio(np.full(self._n, 0.5, dtype=np.float32), self.sample_rate)


def _make_tts(engine: RecordingEngine | None = None):
    """Adapter với downloader + engine_loader tiêm sẵn (không mạng)."""
    eng = engine or RecordingEngine()
    downloads: list[str] = []

    def downloader(voice: str, models_dir: Path) -> Path:
        downloads.append(voice)
        return models_dir / voice

    tts = SherpaOnnxTts(
        models_dir="/tmp/x",
        engine_loader=lambda _model_dir: eng,
        downloader=downloader,
    )
    return tts, eng, downloads


def test_synthesize_converts_float32_to_pcm16():
    tts, eng, _ = _make_tts(RecordingEngine(seconds=0.5))
    asyncio.run(tts.load())
    out = asyncio.run(tts.synthesize("xin chào", Language.vi))
    assert eng.calls[0]["text"] == "xin chào"
    samples = np.frombuffer(out.pcm, dtype=np.int16)
    assert len(samples) == 8000  # 0.5s * 16000
    assert np.all(samples == int(0.5 * 32767))
    assert out.sample_rate == 16000
    assert out.duration_ms == 500
    assert out.processing_ms is not None and out.processing_ms >= 0


def test_default_voice_selected_per_language():
    tts, _, downloads = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize("hello", Language.en))
    assert downloads == [DEFAULT_VOICE[Language.en]]


def test_voice_override_used():
    tts, _, downloads = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize("hello", Language.en, voice="my-custom-voice"))
    assert downloads == ["my-custom-voice"]


def test_speed_forwarded_to_engine():
    tts, eng, _ = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize("hello", Language.en, speed=1.25))
    assert eng.calls[0]["speed"] == 1.25


def test_engine_cached_and_downloaded_once():
    tts, eng, downloads = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize("một", Language.vi))
    asyncio.run(tts.synthesize("hai", Language.vi))
    assert downloads == [DEFAULT_VOICE[Language.vi]]  # chỉ tải một lần
    assert len(eng.calls) == 2


def test_empty_text_skips_engine():
    tts, eng, downloads = _make_tts()
    asyncio.run(tts.load())
    out = asyncio.run(tts.synthesize("   \n ", Language.en))
    assert eng.calls == [] and downloads == []
    assert out.pcm == b"" and out.duration_ms == 0


def test_unload_clears_engines():
    tts, _, downloads = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize("hello", Language.en))
    asyncio.run(tts.unload())
    asyncio.run(tts.synthesize("hello", Language.en))
    assert downloads == [DEFAULT_VOICE[Language.en]] * 2  # tải lại sau unload


@pytest.mark.skipif(
    os.environ.get("LLVT_RUN_TTS_INTEGRATION") != "1",
    reason="Đặt LLVT_RUN_TTS_INTEGRATION=1 để tải + chạy voice sherpa-onnx thật",
)
def test_real_piper_synthesizes_en_vi(tmp_path: Path):
    """Tích hợp thật: tải voice Piper en/vi, tổng hợp và ghi WAV để nghe thử."""
    from llvt_ai_service.adapters.tts.sherpa_onnx import _default_engine_loader, _download_voice

    tts = SherpaOnnxTts(
        models_dir="/tmp/llvt-tts-it",
        engine_loader=_default_engine_loader,
        downloader=_download_voice,
    )
    asyncio.run(tts.load())
    samples = {
        Language.en: "Hello, the meeting starts at nine in the morning.",
        Language.vi: "Xin chào, cuộc họp bắt đầu lúc chín giờ sáng.",
    }
    for lang, text in samples.items():
        out = asyncio.run(tts.synthesize(text, lang))
        assert out.pcm and out.sample_rate > 0 and out.duration_ms > 0
        wav_path = tmp_path / f"tts_{lang.value}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(out.sample_rate)
            w.writeframes(out.pcm)
        print(f"[{lang.value}] {out.duration_ms}ms @ {out.sample_rate}Hz -> {wav_path}")
