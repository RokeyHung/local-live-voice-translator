"""Adapter TTS tiếng Nhật: Kokoro-82M (ONNX) + G2P misaki/OpenJTalk.

**Vì sao cần adapter riêng thay vì thêm một voice vào sherpa-onnx.** Bản phát hành
`tts-models` của k2-fsa không có model VITS tiếng Nhật nào, còn Kokoro thì sherpa-onnx
chỉ cài phần xử lý văn bản cho tiếng Anh và tiếng Trung ("It is a multi-lingual model,
but we only add English and Chinese support for it"). Đo thực tế: đưa
「こんにちは、今日はプロジェクトの会議です。」 qua sherpa-onnx với giọng Nhật jf_alpha
cho ra 18,5 giây audio mà ASR nghe lại thành 「日本語の字幕を作成しています。」 — sai
hoàn toàn, vì metadata của model ghi `voice = en-us` nên chữ Nhật bị phiên âm bằng
espeak tiếng Anh.

Chỗ thiếu là **G2P**, không phải model: cùng trọng số Kokoro đó, nếu chuyển chữ sang
âm vị bằng OpenJTalk (qua `misaki.ja`) rồi mới đưa vào ONNX thì đọc đúng. Adapter này
làm đúng hai bước đó và chỉ phục vụ tiếng Nhật; vi/en/zh vẫn do sherpa-onnx lo.

Tải model lười (chỉ khi thật sự tổng hợp tiếng Nhật lần đầu) vì bộ file ~120 MB.
"""

from __future__ import annotations

import logging
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TtsResult
from llvt_ai_service.ports.tts import TextToSpeechProvider

logger = logging.getLogger("llvt.adapters.tts.kokoro_ja")

# Dùng bản fp32 (326 MB) chứ KHÔNG dùng int8 (92 MB): đo trên máy dev (Apple
# Silicon, cùng câu, ONNX Runtime CPU) thì int8 chạy 1497 ms còn fp32 chỉ 706 ms —
# ARM không có kernel int8 tối ưu nên "nhẹ hơn" lại hoá chậm gấp đôi. Máy x86 có
# AVX-VNNI thì ngược lại, nên tên file để đổi được qua tham số `model_file`.
MODEL_URL_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL_FILE = "kokoro-v1.0.onnx"
MODEL_FILE_INT8 = "kokoro-v1.0.int8.onnx"
VOICES_FILE = "voices-v1.0.bin"
MODEL_DIR_NAME = "kokoro-ja"

# Kokoro v1.0 có 5 giọng Nhật: jf_alpha, jf_gongitsune, jf_nezumi, jf_tebukuro (nữ),
# jm_kumo (nam). jf_alpha là giọng nữ trung tính, dùng làm mặc định.
DEFAULT_JA_VOICE = "jf_alpha"


class KokoroEngine(Protocol):
    """Giao diện tối thiểu của kokoro_onnx.Kokoro (cho phép tiêm bản giả trong test)."""

    def create(
        self, text: str, voice: str, speed: float = ..., is_phonemes: bool = ...
    ) -> tuple[Any, int]: ...


class Phonemizer(Protocol):
    """G2P tiếng Nhật: câu chữ Nhật → chuỗi âm vị của Kokoro."""

    def __call__(self, text: str) -> tuple[str, Any]: ...


EngineLoader = Callable[[Path, str], KokoroEngine]
PhonemizerLoader = Callable[[], Phonemizer]
ModelDownloader = Callable[[Path, str], Path]


def _download_model(models_dir: Path, model_file: str = MODEL_FILE) -> Path:
    """Tải model + bộ giọng nếu chưa có; trả thư mục chứa chúng."""
    dest = models_dir / MODEL_DIR_NAME
    dest.mkdir(parents=True, exist_ok=True)
    for name in (model_file, VOICES_FILE):
        target = dest / name
        if target.is_file():
            continue
        url = f"{MODEL_URL_BASE}{name}"
        tmp = target.with_suffix(target.suffix + ".tmp")
        logger.info("Tải %s từ %s", name, url)
        urllib.request.urlretrieve(url, tmp)  # noqa: S310 (URL cố định, https GitHub)
        tmp.replace(target)
    return dest


def _default_engine_loader(model_dir: Path, model_file: str = MODEL_FILE) -> KokoroEngine:
    from kokoro_onnx import Kokoro

    return Kokoro(str(model_dir / model_file), str(model_dir / VOICES_FILE))


def _default_phonemizer_loader() -> Phonemizer:
    # misaki.ja gọi pyopenjtalk (OpenJTalk + từ điển NAIST) — cùng bộ G2P mà bản
    # Kokoro gốc dùng cho tiếng Nhật, chạy hoàn toàn offline sau khi cài.
    from misaki import ja

    return ja.JAG2P()


class KokoroJaTts(TextToSpeechProvider):
    name = "kokoro_ja"

    def __init__(
        self,
        models_dir: str | None = None,
        voice: str = DEFAULT_JA_VOICE,
        model_file: str = MODEL_FILE,
        engine_loader: EngineLoader | None = None,
        phonemizer_loader: PhonemizerLoader | None = None,
        downloader: ModelDownloader | None = None,
    ) -> None:
        self._models_dir = Path(models_dir) if models_dir else Path.home() / ".llvt" / "tts"
        self._voice = voice
        self._model_file = model_file
        self._engine_loader = engine_loader or _default_engine_loader
        self._phonemizer_loader = phonemizer_loader or _default_phonemizer_loader
        self._downloader = downloader or _download_model
        self._engine: KokoroEngine | None = None
        self._g2p: Phonemizer | None = None
        self._exec = SerialExecutor()

    async def load(self) -> None:
        # Nạp lười: 120 MB model chỉ tải khi phiên có chiều dịch sang tiếng Nhật.
        logger.info("KokoroJaTts sẵn sàng (nạp model khi cần)")

    async def unload(self) -> None:
        self._engine = None
        self._g2p = None

    @property
    def loaded(self) -> bool:
        return True

    def runtime_info(self) -> dict[str, str]:
        model = Path(self._model_file).stem
        return {
            "model": f"{model} ({self._voice})" if self._engine else f"{model} (chưa nạp)",
            "backend": "kokoro-onnx + misaki/OpenJTalk",
            "accel": "CPU",
            "languages": Language.ja.value,
        }

    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        if language is not Language.ja:
            raise NotImplementedError(
                f"KokoroJaTts chỉ tổng hợp tiếng Nhật, không phải '{language.value}'."
            )
        normalized = text.strip()
        if not normalized:
            return TtsResult(pcm=b"", sample_rate=0, duration_ms=0, processing_ms=0)

        started = time.perf_counter()
        pcm, sample_rate = await self._exec.run(
            self._synthesize_blocking, normalized, voice or self._voice, speed
        )
        processing_ms = int((time.perf_counter() - started) * 1000)
        duration_ms = int(1000 * (len(pcm) // 2) / sample_rate) if sample_rate else 0
        return TtsResult(
            pcm=pcm, sample_rate=sample_rate, duration_ms=duration_ms, processing_ms=processing_ms
        )

    def _synthesize_blocking(self, text: str, voice: str, speed: float) -> tuple[bytes, int]:
        engine, g2p = self._ensure_loaded()
        phonemes, _ = g2p(text)
        samples, sample_rate = engine.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
        arr = np.asarray(samples, dtype=np.float32)
        pcm = (np.clip(arr, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()
        return pcm, int(sample_rate)

    def _ensure_loaded(self) -> tuple[KokoroEngine, Phonemizer]:
        if self._engine is None:
            model_dir = self._downloader(self._models_dir, self._model_file)
            self._engine = self._engine_loader(model_dir, self._model_file)
            logger.info("Nạp Kokoro (ja) xong từ %s", model_dir)
        if self._g2p is None:
            self._g2p = self._phonemizer_loader()
        return self._engine, self._g2p
