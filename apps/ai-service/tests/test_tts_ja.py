"""Test TTS tiếng Nhật (Kokoro + G2P OpenJTalk) và định tuyến TTS theo ngôn ngữ.

- Logic adapter + router test bằng engine/G2P giả, không tải 120 MB model.
- Một test tích hợp opt-in tổng hợp tiếng Nhật thật rồi ghi WAV để nghe thử; chỉ chạy
  khi đặt ``LLVT_RUN_TTS_INTEGRATION=1``.
"""

from __future__ import annotations

import asyncio
import os
import wave
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from llvt_ai_service.adapters.tts.kokoro_ja import DEFAULT_JA_VOICE, KokoroJaTts
from llvt_ai_service.application.tts_router import LanguageRoutedTts
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TtsResult
from llvt_ai_service.ports.tts import TextToSpeechProvider

JA_TEXT = "こんにちは、今日はプロジェクトの会議です。"


class RecordingKokoro:
    def __init__(self, seconds: float = 0.5, sample_rate: int = 24000) -> None:
        self.sample_rate = sample_rate
        self._n = int(sample_rate * seconds)
        self.calls: list[dict[str, Any]] = []

    def create(
        self, text: str, voice: str, speed: float = 1.0, is_phonemes: bool = False
    ) -> tuple[np.ndarray, int]:
        self.calls.append(
            {"text": text, "voice": voice, "speed": speed, "is_phonemes": is_phonemes}
        )
        return np.full(self._n, 0.5, dtype=np.float32), self.sample_rate


class RecordingG2P:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def __call__(self, text: str) -> tuple[str, Any]:
        self.calls.append(text)
        return f"phonemes({text})", None


def _make_tts(engine: RecordingKokoro | None = None):
    eng = engine or RecordingKokoro()
    g2p = RecordingG2P()
    downloads: list[Path] = []

    def downloader(models_dir: Path, model_file: str) -> Path:
        downloads.append(models_dir / model_file)
        return models_dir / "kokoro-ja"

    tts = KokoroJaTts(
        models_dir="/tmp/x",
        engine_loader=lambda _dir, _file: eng,
        phonemizer_loader=lambda: g2p,
        downloader=downloader,
    )
    return tts, eng, g2p, downloads


def test_text_goes_through_g2p_before_the_model():
    """Điểm mấu chốt của adapter này: model chỉ nhận âm vị, không nhận chữ Nhật.

    Đưa thẳng chữ Nhật vào Kokoro là đúng lỗi mà sherpa-onnx mắc phải (phiên âm bằng
    espeak tiếng Anh nên đọc sai hoàn toàn).
    """
    tts, eng, g2p, _ = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize(JA_TEXT, Language.ja))

    assert g2p.calls == [JA_TEXT]
    assert eng.calls[0]["text"] == f"phonemes({JA_TEXT})"
    assert eng.calls[0]["is_phonemes"] is True
    assert eng.calls[0]["voice"] == DEFAULT_JA_VOICE


def test_converts_float32_to_pcm16():
    tts, _, _, _ = _make_tts(RecordingKokoro(seconds=0.5, sample_rate=24000))
    asyncio.run(tts.load())
    out = asyncio.run(tts.synthesize(JA_TEXT, Language.ja))
    samples = np.frombuffer(out.pcm, dtype=np.int16)
    assert len(samples) == 12000  # 0.5s * 24000
    assert np.all(samples == int(0.5 * 32767))
    assert out.sample_rate == 24000 and out.duration_ms == 500


def test_rejects_other_languages():
    tts, _, _, _ = _make_tts()
    asyncio.run(tts.load())
    with pytest.raises(NotImplementedError):
        asyncio.run(tts.synthesize("xin chào", Language.vi))


def test_model_downloaded_once_and_cleared_on_unload():
    tts, _, _, downloads = _make_tts()
    asyncio.run(tts.load())
    asyncio.run(tts.synthesize(JA_TEXT, Language.ja))
    asyncio.run(tts.synthesize(JA_TEXT, Language.ja))
    assert len(downloads) == 1
    asyncio.run(tts.unload())
    asyncio.run(tts.synthesize(JA_TEXT, Language.ja))
    assert len(downloads) == 2


def test_empty_text_skips_model():
    tts, eng, g2p, downloads = _make_tts()
    asyncio.run(tts.load())
    out = asyncio.run(tts.synthesize("  \n ", Language.ja))
    assert eng.calls == [] and g2p.calls == [] and downloads == []
    assert out.pcm == b""


class StubTts(TextToSpeechProvider):
    def __init__(self, tag: str) -> None:
        self.tag = tag
        self.languages: list[Language] = []
        self.loaded_calls = 0

    async def load(self) -> None:
        self.loaded_calls += 1

    async def unload(self) -> None:
        pass

    def runtime_info(self) -> dict[str, str]:
        return {"model": self.tag, "backend": self.tag, "languages": "x"}

    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        self.languages.append(language)
        return TtsResult(pcm=b"\x00\x00", sample_rate=16000, duration_ms=1, processing_ms=0)


def test_router_sends_japanese_to_the_override_and_the_rest_to_default():
    default, japanese = StubTts("sherpa"), StubTts("kokoro")
    router = LanguageRoutedTts(default, {Language.ja: japanese})

    asyncio.run(router.load())
    for lang in (Language.vi, Language.en, Language.zh, Language.ja):
        asyncio.run(router.synthesize("x", lang))

    assert default.languages == [Language.vi, Language.en, Language.zh]
    assert japanese.languages == [Language.ja]
    # Cả hai engine đều được nạp (nạp thật sự vẫn lười bên trong từng adapter).
    assert default.loaded_calls == 1 and japanese.loaded_calls == 1
    info = router.runtime_info()
    assert "sherpa" in info["model"] and "kokoro" in info["model"]
    assert "ja" in info["languages"]


@pytest.mark.skipif(
    os.environ.get("LLVT_RUN_TTS_INTEGRATION") != "1",
    reason="Đặt LLVT_RUN_TTS_INTEGRATION=1 để tải + chạy model Kokoro thật",
)
def test_real_kokoro_speaks_japanese(tmp_path: Path):
    """Tích hợp thật: tải Kokoro, tổng hợp một câu tiếng Nhật, ghi WAV để nghe thử."""
    tts = KokoroJaTts(models_dir=str(Path.home() / ".llvt" / "models"))
    asyncio.run(tts.load())
    out = asyncio.run(tts.synthesize(JA_TEXT, Language.ja))

    assert out.pcm and out.sample_rate == 24000
    # Câu này đọc khoảng 2–4 giây; dài hơn nhiều nghĩa là G2P hỏng (xem docstring
    # của adapter: sherpa-onnx cho ra 18,5 giây cho đúng câu này).
    assert 1500 < out.duration_ms < 6000
    samples = np.frombuffer(out.pcm, dtype=np.int16).astype(np.float32) / 32768
    assert float(np.sqrt((samples**2).mean())) > 0.01  # không phải im lặng

    wav_path = tmp_path / "tts_ja.wav"
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(out.sample_rate)
        w.writeframes(out.pcm)
    print(f"[ja] {out.duration_ms}ms @ {out.sample_rate}Hz -> {wav_path}")
