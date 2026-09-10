"""Adapter TTS: sherpa-onnx (runtime mặc định) — Tuần 5.

Tổng hợp giọng nói offline bằng ``sherpa-onnx`` (ONNX Runtime) cho **vi/en/zh**; mỗi
ngôn ngữ một voice model VITS. Voice model KHÔNG nằm trên HF mà là tarball trong
GitHub releases của k2-fsa → adapter tự tải + giải nén lần đầu vào ``models_dir``.
Tiếng Nhật do ``adapters/tts/kokoro_ja.py`` đảm nhiệm (xem lý do ở đó).

Nạp **lười theo ngôn ngữ**: chỉ tải/khởi tạo voice khi thật sự cần synthesize cho
ngôn ngữ đó (tránh tải cả ba voice khi chỉ dùng một). Một ``SerialExecutor`` nội bộ
đẩy tải + generate (blocking) sang worker thread và tuần tự hóa.

Đầu ra: PCM signed 16-bit, mono, sample rate theo model. Định tuyến ra loa/tai nghe
là việc phía desktop.
"""

from __future__ import annotations

import logging
import os
import shutil
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

# Voice mặc định theo ngôn ngữ (xem SPEC 02 §8.2). Tên phải khớp asset trong
# release `tts-models` của k2-fsa/sherpa-onnx.
#
# Không có tiếng Nhật ở đây: release đó không có model VITS tiếng Nhật, còn Kokoro
# thì sherpa-onnx chỉ cài phần xử lý văn bản cho tiếng Anh và tiếng Trung. Tiếng
# Nhật do `adapters/tts/kokoro_ja.py` lo, ghép vào qua `LanguageRoutedTts`.
#
# Tiếng Trung KHÔNG dùng voice Piper: `vits-piper-zh_CN-xiao_ya-medium` cần g2pW
# (chỉ có trong bản Piper chạy bằng Python, xem MODEL_CARD của nó) nên qua
# sherpa-onnx sẽ sinh ra 0 token và chết ở tầng ONNX. `sherpa-onnx-vits-zh-ll` đi
# kèm từ điển jieba + lexicon nên chạy đúng — đã kiểm chứng bằng ASR nghe lại.
DEFAULT_VOICE: dict[Language, str] = {
    Language.vi: "vits-piper-vi_VN-vais1000-medium",
    Language.en: "vits-piper-en_US-lessac-medium",
    Language.zh: "sherpa-onnx-vits-zh-ll",
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
    """Tải + giải nén voice model nếu chưa có; trả thư mục model.

    Giải nén vào thư mục tạm rồi mới đổi tên sang chỗ thật. Giải nén thẳng vào
    ``models_dir`` thì một lần bị ngắt để lại thư mục voice mới được nửa số file,
    mà bảng "model đã tải" không phân biệt được với bản đủ — nó chỉ thấy có thư mục.
    ``os.replace`` nguyên tử nên thư mục voice hoặc chưa có, hoặc đã đủ.
    """
    dest = models_dir / voice
    if dest.is_dir():
        return dest
    models_dir.mkdir(parents=True, exist_ok=True)
    url = f"{VOICE_URL_BASE}{voice}.tar.bz2"
    tmp = models_dir / f"{voice}.tar.bz2.tmp"
    staging = models_dir / f".incomplete-{voice}"
    logger.info("Tải voice model %s từ %s", voice, url)
    try:
        urllib.request.urlretrieve(url, tmp)  # noqa: S310 (URL cố định, https k2-fsa)
        with tarfile.open(tmp, "r:bz2") as tar:
            tar.extractall(staging, filter="data")  # chống path traversal
        extracted = staging / voice
        if not extracted.is_dir():
            raise RuntimeError(f"Giải nén {voice} không tạo thư mục {extracted}")
        os.replace(extracted, dest)
    finally:
        tmp.unlink(missing_ok=True)
        shutil.rmtree(staging, ignore_errors=True)
    return dest


def _default_engine_loader(model_dir: Path) -> TtsEngine:
    import sherpa_onnx

    onnx = _find_onnx(model_dir)
    data_dir = model_dir / "espeak-ng-data"
    lexicon = model_dir / "lexicon.txt"
    # Voice tiếng Trung tách câu bằng jieba: thiếu `dict_dir` thì tra từ điển không
    # ra chữ nào, sherpa đưa mảng token RỖNG vào ONNX và đổ lỗi ở tầng Conv
    # ("Invalid input shape: {0}") — lỗi không hề nhắc tới từ điển.
    dict_dir = model_dir / "dict"
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=str(onnx),
        tokens=str(model_dir / "tokens.txt"),
        data_dir=str(data_dir) if data_dir.is_dir() else "",
        dict_dir=str(dict_dir) if dict_dir.is_dir() else "",
        lexicon=str(lexicon) if lexicon.is_file() else "",
    )
    # Luật đọc số/ngày/số điện thoại đi kèm voice (chủ yếu cho tiếng Trung); không
    # có thì model đọc "2026" thành từng chữ số.
    rules = [
        str(p)
        for name in ("date.fst", "number.fst", "phone.fst")
        if (p := model_dir / name).is_file()
    ]
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=2, provider="cpu"),
        rule_fsts=",".join(rules),
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

    @property
    def loaded(self) -> bool:
        # Voice nạp lười theo ngôn ngữ nên provider luôn "sẵn sàng"; chi tiết ở runtime_info.
        return True

    def runtime_info(self) -> dict[str, str]:
        return {
            "model": ", ".join(sorted(self._engines)) or "chưa nạp voice nào",
            "backend": "sherpa-onnx",
            "accel": "CPU",
            "languages": ", ".join(sorted(v.value for v in self._voices)),
        }

    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        normalized = text.strip()
        if not normalized:
            return TtsResult(pcm=b"", sample_rate=0, duration_ms=0, processing_ms=0)

        voice_name = voice or self._voices.get(language)
        if voice_name is None:
            # Báo lỗi rõ ràng thay vì tải nhầm một tarball không tồn tại.
            raise NotImplementedError(
                f"Chưa có voice TTS cho ngôn ngữ '{language.value}'. "
                f"Ngôn ngữ hỗ trợ: {', '.join(sorted(v.value for v in self._voices))}."
            )
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
