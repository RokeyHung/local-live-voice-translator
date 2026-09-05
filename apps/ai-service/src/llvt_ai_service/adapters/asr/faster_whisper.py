"""Adapter ASR: faster-whisper (CTranslate2) — backend thứ ba, mạnh nhất trên Windows.

Cùng model Whisper, đường thứ ba: whisper.cpp là C++ + Metal shader tự viết, MLX là
framework của Apple, còn đây là CTranslate2 — engine suy luận Transformer có nhân
CUDA riêng. Trên máy Windows + NVIDIA (một trong hai nền tảng mục tiêu của đồ án) thì
whisper.cpp không có Metal mà cũng không có nhân CUDA được tối ưu bằng, nên đây là
backend đáng đo nhất ở đó.

Gói tùy chọn — ``uv sync --extra ctranslate2``. Không cài thì ``load()`` báo lỗi rõ
ràng và ba backend còn lại vẫn chạy.

Chạy được cả CPU lẫn GPU, tự dò: CUDA → CPU. Cố ý **không** dò MPS: CTranslate2 chưa
có backend Metal, đưa ``mps`` vào chỉ để nó ném lỗi khó hiểu trên máy Mac.

Model là repo CTranslate2 trên HuggingFace (`Systran/faster-whisper-*`), tải vào
``models_dir`` như mọi model khác. Model không thread-safe nên lời gọi đi qua
``SerialExecutor``.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.adapters.asr.hallucination import rejection_reason, strip_non_speech
from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.faster_whisper")

SAMPLE_RATE = 16000

# Tên model logic -> repo CTranslate2 trên HuggingFace. Giữ đúng lối đặt tên của hai
# adapter kia (`fw-whisper-<cỡ>`) để preset và danh mục đọc như nhau.
#
# Không có biến thể `.en` vì lý do đã ghi ở whisper_cpp: ứng dụng luôn phải nhận cả
# vi/ja/zh. Cũng không có `distil-*`: bản distil chỉ hỗ trợ tiếng Anh.
MODEL_MAP: dict[str, str] = {
    "fw-whisper-tiny": "Systran/faster-whisper-tiny",
    "fw-whisper-base": "Systran/faster-whisper-base",
    "fw-whisper-small": "Systran/faster-whisper-small",
    "fw-whisper-medium": "Systran/faster-whisper-medium",
    "fw-whisper-large-v3": "Systran/faster-whisper-large-v3",
    "fw-whisper-large-v3-turbo": "deepdml/faster-whisper-large-v3-turbo-ct2",
}

# Tham số giải mã. Đối xứng với DECODE_PARAMS của hai adapter kia — so ba runtime chỉ
# có nghĩa khi chính sách giải mã giống nhau (xem docstring của whisper_cpp để biết
# từng lựa chọn giải quyết chuyện gì).
#
# `temperature=(0.0,)` là cách faster-whisper tắt fallback nhiệt độ: tham số nhận một
# dãy, đưa đúng một phần tử thì nó không còn nhiệt độ nào để lùi về.
DECODE_PARAMS: dict[str, Any] = {
    "task": "transcribe",  # KHÔNG dịch — việc dịch là của module MT
    "temperature": (0.0,),
    "condition_on_previous_text": False,
    "word_timestamps": False,
    "suppress_blank": True,
    # VAD của riêng faster-whisper: TẮT. Đoạn vào đây đã do Silero cắt sẵn, cắt thêm
    # lần nữa là bỏ mất phần đầu/cuối câu mà khâu VAD đã cố tình chừa (`speech_pad_ms`).
    "vad_filter": False,
}


class FasterWhisperModel(Protocol):
    """Giao diện tối thiểu của faster_whisper.WhisperModel (cho phép tiêm bản giả)."""

    def transcribe(self, audio: np.ndarray, **params: Any) -> tuple[Any, Any]: ...


# loader: (repo_id, models_dir, device) -> FasterWhisperModel. Blocking (tải + nạp).
ModelLoader = Callable[[str, str | None, str | None], FasterWhisperModel]


def _pick_device() -> str:
    """CUDA nếu có, không thì CPU. CTranslate2 chưa có backend Metal nên bỏ qua MPS."""
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:  # pragma: no cover - torch luôn có (silero-vad kéo theo)
        return "cpu"


def _compute_type(device: str) -> str:
    """`float16` trên GPU, `int8` trên CPU.

    Đây là cặp mặc định faster-whisper khuyến nghị và cũng là lý do người ta chọn nó:
    int8 trên CPU nhanh hơn hẳn float32 mà chất lượng gần như không đổi.
    """
    return "float16" if device == "cuda" else "int8"


def _default_loader(repo_id: str, models_dir: str | None, device: str | None) -> FasterWhisperModel:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:  # pragma: no cover - phụ thuộc môi trường
        raise RuntimeError("Chưa cài faster-whisper. Chạy: uv sync --extra ctranslate2") from exc

    target = device or _pick_device()
    return WhisperModel(
        repo_id,
        device=target,
        compute_type=_compute_type(target),
        download_root=models_dir,
    )


class FasterWhisperAsr(SpeechToTextProvider):
    name = "faster_whisper"

    def __init__(
        self,
        model: str,
        models_dir: str | None = None,
        loader: ModelLoader | None = None,
        *,
        device: str | None = None,
        min_confidence: float = 0.0,
    ) -> None:
        self._model_name = model
        self._repo_id = MODEL_MAP.get(model, model)
        self._models_dir = models_dir
        self._device = device
        self._loader = loader or _default_loader
        self._model: FasterWhisperModel | None = None
        self._exec = SerialExecutor()
        self._min_confidence = min_confidence

    async def load(self) -> None:
        logger.info("FasterWhisperAsr.load(model=%s -> %s)", self._model_name, self._repo_id)
        device = self._device or _pick_device()
        self._model = await asyncio.to_thread(self._loader, self._repo_id, self._models_dir, device)
        self._device = device
        logger.info("FasterWhisperAsr loaded (device=%s, models_dir=%s)", device, self._models_dir)

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def runtime_info(self) -> dict[str, str]:
        device = self._device or "—"
        return {
            "model": self._repo_id,
            "backend": "faster-whisper",
            # Ghi kèm kiểu tính toán: cùng một GPU nhưng float16 và int8 cho ra hai
            # con số tốc độ khác hẳn, thiếu nó thì bảng đo không đọc được.
            "accel": f"{device} ({_compute_type(device)})" if device != "—" else "—",
        }

    async def unload(self) -> None:
        self._model = None

    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        if sample_rate != SAMPLE_RATE:
            raise ValueError(
                f"FasterWhisperAsr cần PCM {SAMPLE_RATE} Hz (đã resample ở khâu thu), "
                f"nhận {sample_rate}"
            )
        if self._model is None:
            raise RuntimeError("FasterWhisperAsr chưa load() — không thể transcribe()")

        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

        started = time.perf_counter()
        segments = await self._exec.run(self._decode, audio, language)
        processing_ms = int((time.perf_counter() - started) * 1000)

        text = strip_non_speech("".join(seg.text for seg in segments))
        confidence = _mean_probability(segments)
        reason = rejection_reason(text, confidence, min_confidence=self._min_confidence)
        if reason is not None:
            # Không log nội dung câu (SPEC 14), chỉ log vì sao bỏ.
            logger.info(
                "Bỏ câu ASR: lý do=%s, độ dài=%d, confidence=%s",
                reason,
                len(text),
                f"{confidence:.2f}" if confidence is not None else "—",
            )
            text = ""

        return AsrTranscript(
            text=text,
            language=language,
            confidence=confidence,
            processing_ms=processing_ms,
        )

    def _decode(self, audio: np.ndarray, language: Language) -> list[Any]:
        assert self._model is not None
        # faster-whisper trả (generator, info) — generator mới là chỗ giải mã thật sự
        # chạy, nên phải duyệt hết NGAY TẠI ĐÂY, trong worker thread. Trả generator ra
        # ngoài thì phần nặng lại chạy trên event loop.
        segments, _info = self._model.transcribe(audio, language=language.value, **DECODE_PARAMS)
        return list(segments)


def _mean_probability(segments: list[Any]) -> float | None:
    """Độ tin cậy quy về cùng thang [0, 1] với hai adapter kia.

    faster-whisper báo ``avg_logprob`` (trung bình log xác suất token) giống mlx-audio,
    nên ``exp()`` của nó là trung bình NHÂN — cùng một lưu ý đã ghi ở
    ``mlx_whisper._mean_probability``: khắt khe hơn ``probability`` của whisper.cpp một
    chút ở cùng ngưỡng ``asr_min_confidence``.
    """
    values: list[float] = []
    for seg in segments:
        raw = getattr(seg, "avg_logprob", None)
        if raw is None:
            continue
        logprob = float(raw)
        if math.isnan(logprob) or math.isinf(logprob):
            continue
        values.append(math.exp(logprob))
    if not values:
        return None
    return sum(values) / len(values)
