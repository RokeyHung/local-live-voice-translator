"""Adapter TTS: sherpa-onnx (runtime mặc định) — Tuần 5.

Tổng hợp giọng nói offline bằng ``sherpa-onnx`` (ONNX Runtime). Mỗi ngôn ngữ đích
dùng một voice model VITS (Piper). Voice model KHÔNG nằm trên HF mà là tarball trong
GitHub releases của k2-fsa → adapter tự tải + giải nén lần đầu vào ``models_dir``.

Nạp **lười theo ngôn ngữ**: chỉ tải/khởi tạo voice khi thật sự cần synthesize cho
ngôn ngữ đó (tránh tải cả 4 voice khi chỉ dùng 1–2). Một ``SerialExecutor`` nội bộ
đẩy tải + generate (blocking) sang worker thread và tuần tự hóa.

Đầu ra: PCM signed 16-bit, mono, sample rate theo model. Định tuyến ra loa/mic ảo
(BlackHole/VB-CABLE) là việc phía desktop (tuần tích hợp sau).
"""

from __future__ import annotations

import logging
import tarfile
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TtsResult
from llvt_ai_service.ports.tts import TextToSpeechProvider

logger = logging.getLogger("llvt.adapters.tts.sherpa_onnx")

# Voice mặc định theo ngôn ngữ (xem SPEC 02 §8.2).
DEFAULT_VOICE: dict[Language, str] = {
    Language.vi: "vits-piper-vi_VN-vais1000-medium",
    Language.en: "vits-piper-en_US-lessac-medium",
    Language.ja: "supertonic-3-ja",
    Language.zh: "vits-piper-zh_CN-xiao_ya-medium",
}

# Tarball voice model của sherpa-onnx (GitHub releases, tag tts-models).
VOICE_URL_BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/"


class TtsEngine(Protocol):
    """Giao diện tối thiểu của sherpa_onnx.OfflineTts (cho phép tiêm bản giả)."""

    sample_rate: int

    def generate(self, text: str, sid: int = ..., speed: float = ...) -> Any: ...


# loader: model_dir -> TtsEngine ; downloader: (voice, models_dir) -> model_dir.
EngineLoader = Callable[[Path], TtsEngine]
VoiceDownloader = Callable[[str, Path], Path]


def _download_voice(voice: str, models_dir: Path) -> Path:
    """Tải + giải nén voice model nếu chưa có; trả thư mục model."""
    dest = models_dir / voice
    if dest.is_dir():
        return dest
    models_dir.mkdir(parents=True, exist_ok=True)
    url = f"{VOICE_URL_BASE}{voice}.tar.bz2"
    tmp = models_dir / f"{voice}.tar.bz2.tmp"
    logger.info("Tải voice model %s từ %s", voice, url)
    urllib.request.urlretrieve(url, tmp)  # noqa: S310 (URL cố định, https k2-fsa)
    try:
        with tarfile.open(tmp, "r:bz2") as tar:
            tar.extractall(models_dir, filter="data")  # chống path traversal
    finally:
        tmp.unlink(missing_ok=True)
    if not dest.is_dir():
        raise RuntimeError(f"Giải nén {voice} không tạo thư mục {dest}")
    return dest


def _default_engine_loader(model_dir: Path) -> TtsEngine:
    import sherpa_onnx

    onnx = _find_onnx(model_dir)
    data_dir = model_dir / "espeak-ng-data"
    lexicon = model_dir / "lexicon.txt"
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=str(onnx),
        tokens=str(model_dir / "tokens.txt"),
        data_dir=str(data_dir) if data_dir.is_dir() else "",
        lexicon=str(lexicon) if lexicon.is_file() else "",
    )
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=2, provider="cpu"),
        max_num_sentences=1,
    )
    return sherpa_onnx.OfflineTts(config)


def _find_onnx(model_dir: Path) -> Path:
    files = sorted(model_dir.glob("*.onnx"))
    if not files:
        raise RuntimeError(f"Không tìm thấy file .onnx trong {model_dir}")
    return files[0]


class SherpaOnnxTts(TextToSpeechProvider):
    name = "sherpa_onnx"

    def __init__(
        self,
        models_dir: str | None = None,
        voices: dict[Language, str] | None = None,
        engine_loader: EngineLoader | None = None,
        downloader: VoiceDownloader | None = None,
    ) -> None:
        self._models_dir = Path(models_dir) if models_dir else Path.home() / ".llvt" / "tts"
        self._voices = voices or DEFAULT_VOICE
        self._engine_loader = engine_loader or _default_engine_loader
        self._downloader = downloader or _download_voice
        self._engines: dict[str, TtsEngine] = {}  # keyed theo tên voice
        self._exec = SerialExecutor()

    async def load(self) -> None:
        # Nạp lười: voice chỉ được tải khi synthesize lần đầu cho ngôn ngữ đó.
        logger.info("SherpaOnnxTts sẵn sàng (nạp voice theo nhu cầu)")

    async def unload(self) -> None:
        self._engines.clear()

    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        normalized = text.strip()
        if not normalized:
            return TtsResult(pcm=b"", sample_rate=0, duration_ms=0, processing_ms=0)

        voice_name = voice or self._voices[language]
        started = time.perf_counter()
        pcm, sample_rate = await self._exec.run(
            self._synthesize_blocking, normalized, voice_name, speed
        )
        processing_ms = int((time.perf_counter() - started) * 1000)

        duration_ms = int(1000 * (len(pcm) // 2) / sample_rate) if sample_rate else 0
        return TtsResult(
            pcm=pcm,
            sample_rate=sample_rate,
            duration_ms=duration_ms,
            processing_ms=processing_ms,
        )

    def _synthesize_blocking(self, text: str, voice_name: str, speed: float) -> tuple[bytes, int]:
        engine = self._ensure_engine(voice_name)
        audio = engine.generate(text, sid=0, speed=speed)
        samples = np.asarray(audio.samples, dtype=np.float32)
        pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()
        return pcm, int(audio.sample_rate)

    def _ensure_engine(self, voice_name: str) -> TtsEngine:
        engine = self._engines.get(voice_name)
        if engine is None:
            model_dir = self._downloader(voice_name, self._models_dir)
            engine = self._engine_loader(model_dir)
            self._engines[voice_name] = engine
            logger.info("Nạp voice %s xong", voice_name)
        return engine
