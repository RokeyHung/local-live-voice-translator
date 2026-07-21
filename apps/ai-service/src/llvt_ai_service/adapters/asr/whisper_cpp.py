"""Adapter ASR: whisper.cpp (runtime mặc định cho cả Windows và macOS) — Tuần 3.

Dùng gói ``pywhispercpp`` (nhúng whisper.cpp, có wheel dựng sẵn kèm Metal trên
Apple Silicon). Model GGML tự tải lần đầu từ HF ``ggerganov/whisper.cpp`` vào
``models_dir``. Chỉ chạy task ``transcribe`` (``translate=False``) để lấy văn bản
theo đúng ngôn ngữ nguồn — việc dịch là của module MT (Tuần 4).

whisper.cpp context KHÔNG thread-safe: một ``SerialExecutor`` nội bộ đẩy lời gọi
blocking sang worker thread và tuần tự hóa bằng lock, nên nhiều pipeline
(mic/system) dùng chung một model instance vẫn an toàn.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.whisper_cpp")

SAMPLE_RATE = 16000

# Tên model logic trong preset -> id GGML mà pywhispercpp hiểu (dựng tên file
# ggml-<id>.bin). Xem constants.AVAILABLE_MODELS của pywhispercpp.
MODEL_MAP: dict[str, str] = {
    "whisper-small-q5": "small-q5_1",
    "whisper-large-v3-turbo-q5": "large-v3-turbo-q5_0",
    "whisper-large-v3-turbo-q8": "large-v3-turbo-q8_0",
}


class WhisperModel(Protocol):
    """Giao diện tối thiểu của pywhispercpp.model.Model (cho phép tiêm bản giả)."""

    def transcribe(self, media: np.ndarray, **params: Any) -> list[Any]: ...


# loader: (model_id, models_dir) -> WhisperModel. Blocking (tải + nạp model).
ModelLoader = Callable[[str, str | None], WhisperModel]


def _default_loader(model_id: str, models_dir: str | None) -> WhisperModel:
    from pywhispercpp.model import Model

    # redirect logs để không làm nhiễu log của service; greedy (mặc định) cho low-latency.
    return Model(model_id, models_dir=models_dir, redirect_whispercpp_logs_to=None)


class WhisperCppAsr(SpeechToTextProvider):
    name = "whisper_cpp"

    def __init__(
        self,
        model: str,
        models_dir: str | None = None,
        loader: ModelLoader | None = None,
    ) -> None:
        self._model_name = model
        self._model_id = MODEL_MAP.get(model, model)
        self._models_dir = models_dir
        self._loader = loader or _default_loader
        self._model: WhisperModel | None = None
        self._exec = SerialExecutor()

    async def load(self) -> None:
        logger.info("WhisperCppAsr.load(model=%s -> %s)", self._model_name, self._model_id)
        # Tải/nạp model là blocking (I/O + CPU) -> chạy ngoài event loop.
        self._model = await asyncio.to_thread(self._loader, self._model_id, self._models_dir)
        logger.info("WhisperCppAsr loaded (models_dir=%s)", self._models_dir)

    async def unload(self) -> None:
        self._model = None

    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        if sample_rate != SAMPLE_RATE:
            raise ValueError(
                f"WhisperCppAsr cần PCM {SAMPLE_RATE} Hz (đã resample ở khâu thu), nhận {sample_rate}"
            )
        if self._model is None:
            raise RuntimeError("WhisperCppAsr chưa load() — không thể transcribe()")

        # PCM signed 16-bit -> float32 chuẩn hóa [-1, 1] (whisper.cpp yêu cầu).
        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

        started = time.perf_counter()
        segments = await self._exec.run(self._decode, audio, language)
        processing_ms = int((time.perf_counter() - started) * 1000)

        text = "".join(seg.text for seg in segments).strip()
        confidence = _mean_probability(segments)
        return AsrTranscript(
            text=text,
            language=language,
            confidence=confidence,
            processing_ms=processing_ms,
        )

    def _decode(self, audio: np.ndarray, language: Language) -> list[Any]:
        assert self._model is not None
        return self._model.transcribe(
            audio,
            language=language.value,  # 'vi'/'en'/'ja'/'zh' khớp mã whisper
            translate=False,  # task=transcribe, KHÔNG dịch
            print_progress=False,
            print_realtime=False,
            extract_probability=True,  # để tính confidence
        )


def _mean_probability(segments: list[Any]) -> float | None:
    probs = [
        float(seg.probability)
        for seg in segments
        if getattr(seg, "probability", None) is not None
        and not np.isnan(getattr(seg, "probability"))
    ]
    if not probs:
        return None
    return sum(probs) / len(probs)
