"""Adapter ASR: Whisper chạy trên MLX (Apple Silicon / Metal).

Backend thay thế cho ``whisper_cpp`` trên macOS. Cùng model Whisper, khác runtime:
whisper.cpp là C++ + Metal shader tự viết, MLX là framework mảng của Apple với
unified memory. Có hai lý do giữ cả hai:

* Đo được. Đồ án phải trả lời "chọn runtime nào trên máy Apple Silicon" bằng số chứ
  không bằng cảm tính — hai adapter sau cùng một port nên bộ đánh giá ở ``docs/05``
  chạy được cả hai mà không sửa pipeline.
* Đây đúng là ví dụ "thêm backend mới" mà ARCHITECTURE.md mô tả: một file adapter,
  một dòng trong ``ASR_REGISTRY``, không đụng vào pipeline hay transport.

Dùng ``mlx-audio`` (gói tùy chọn ``uv sync --extra mlx``, chỉ có nghĩa trên macOS
Apple Silicon). Tên model là repo HF trong không gian ``mlx-community`` theo lối đặt
tên ``-asr-`` — bản ``whisper-*-mlx`` cũ thiếu file processor của HuggingFace nên
``mlx-audio`` không nạp được (danh sách repo lấy theo TranscriptionSuite, tài liệu
tham khảo [1] của docs/00).

MLX gắn GPU stream vào chính thread đã tạo ra nó, nên adapter này dùng
``PinnedExecutor`` (một thread cố định) thay vì ``SerialExecutor`` — xem docstring
của lớp đó để biết vì sao ``asyncio.to_thread`` không dùng được ở đây.
"""

from __future__ import annotations

import logging
import math
import time
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.adapters.asr.hallucination import rejection_reason, strip_non_speech
from llvt_ai_service.application.inference import PinnedExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.mlx_whisper")

SAMPLE_RATE = 16000

# Repo HF mà adapter này chạy được. Khoá = giá trị = **đường dẫn thật**: bảng ở đây
# là danh sách model app biết (dùng để kiểm tra tên và dựng ô chọn), không phải một
# lớp đổi tên. Repo nào không có trong bảng vẫn nạp được (truyền thẳng), chỉ là app
# không tự biết dung lượng của nó.
MODEL_MAP: dict[str, str] = {
    "mlx-community/whisper-tiny-asr-4bit": "mlx-community/whisper-tiny-asr-4bit",
    "mlx-community/whisper-tiny-asr-8bit": "mlx-community/whisper-tiny-asr-8bit",
    "mlx-community/whisper-tiny-asr-fp16": "mlx-community/whisper-tiny-asr-fp16",
    "mlx-community/whisper-small-asr-4bit": "mlx-community/whisper-small-asr-4bit",
    "mlx-community/whisper-small-asr-8bit": "mlx-community/whisper-small-asr-8bit",
    "mlx-community/whisper-small-asr-fp16": "mlx-community/whisper-small-asr-fp16",
    "mlx-community/whisper-large-v3-asr-4bit": "mlx-community/whisper-large-v3-asr-4bit",
    "mlx-community/whisper-large-v3-asr-8bit": "mlx-community/whisper-large-v3-asr-8bit",
    "mlx-community/whisper-large-v3-asr-fp16": "mlx-community/whisper-large-v3-asr-fp16",
    "mlx-community/whisper-large-v3-turbo-asr-4bit": "mlx-community/whisper-large-v3-turbo-asr-4bit",
    "mlx-community/whisper-large-v3-turbo-asr-8bit": "mlx-community/whisper-large-v3-turbo-asr-8bit",
    "mlx-community/whisper-large-v3-turbo-asr-fp16": "mlx-community/whisper-large-v3-turbo-asr-fp16",
}

# Tham số giải mã. Cố ý ĐỐI XỨNG với DECODE_PARAMS của whisper_cpp: hai backend chỉ
# so sánh được nếu chính sách giải mã giống nhau, khác thì bảng số đo runtime lại
# lẫn cả khác biệt về tham số vào.
#
# * ``condition_on_previous_text=False`` — bản MLX của ``no_context``: không mang
#   ngữ cảnh câu trước sang câu sau, để một câu ma không tự nuôi chính nó.
# * ``temperature=0.0`` (một số, KHÔNG phải tuple mặc định) — tắt fallback nhiệt độ,
#   đúng lý do đã ghi ở whisper_cpp: giải mã lại ở nhiệt độ cao là lúc Whisper sáng
#   tác nhiều nhất, và tới 6 lượt giải mã thì vỡ ngân sách độ trễ. Đổi lại, giải mã
#   tất định nên số WER trên FLEURS lặp lại được.
# * ``word_timestamps=False`` — pipeline chỉ cần chữ; mốc thời gian là của VAD.
#
# Khác whisper.cpp một chỗ: ``no_speech_threshold`` ở đây CÓ tác dụng (pywhispercpp
# đánh dấu "not implemented"), nên giữ mặc định 0.6 của Whisper — nó bỏ đoạn im lặng
# ngay trong bộ giải mã, trước cả bộ lọc ``hallucination.py``.
DECODE_PARAMS: dict[str, Any] = {
    "task": "transcribe",  # KHÔNG dịch — việc dịch là của module MT
    "verbose": None,
    "temperature": 0.0,
    "condition_on_previous_text": False,
    "word_timestamps": False,
}


class MlxSttModel(Protocol):
    """Giao diện tối thiểu của model mlx-audio (cho phép tiêm bản giả khi test)."""

    def generate(self, audio: np.ndarray, **params: Any) -> Any: ...


# loader: (model_path, models_dir) -> MlxSttModel. Blocking (tải + nạp model).
ModelLoader = Callable[[str, str | None], MlxSttModel]


def _resolve_path(repo_id: str, models_dir: str | None) -> str:
    """Tải repo về ``models_dir`` và trả đường dẫn cục bộ.

    ``mlx_audio.stt.load`` nhận cả repo id lẫn đường dẫn, nhưng nếu đưa repo id thì
    nó tải vào cache mặc định của huggingface_hub (``~/.cache/huggingface``) —
    ngoài tầm với của màn "Quản lý model" và của nút xoá model. Tải trước bằng
    ``snapshot_download(cache_dir=...)`` giữ mọi thứ trong thư mục app quản lý.
    """
    if models_dir is None:
        return repo_id
    from huggingface_hub import snapshot_download

    return snapshot_download(repo_id, cache_dir=models_dir)


def _default_loader(repo_id: str, models_dir: str | None) -> MlxSttModel:
    try:
        from mlx_audio.stt import load as mlx_stt_load
    except ImportError as exc:  # pragma: no cover - phụ thuộc môi trường
        raise RuntimeError(
            "Chưa cài mlx-audio. Chạy: uv sync --extra mlx (chỉ dùng được trên "
            "macOS + Apple Silicon)."
        ) from exc

    model = mlx_stt_load(_resolve_path(repo_id, models_dir))

    # mlx-audio 0.4.x/0.5.x: set_alignment_heads() ghi vào `_alignment_heads` nhưng
    # timing.py lại đọc `alignment_heads`. Không có mốc thời gian theo từ thì pipeline
    # vẫn chạy, nhưng vá một dòng ở đây rẻ hơn là phải giải thích sau này.
    if hasattr(model, "_alignment_heads") and not hasattr(model, "alignment_heads"):
        model.alignment_heads = model._alignment_heads
    return model


class MlxWhisperAsr(SpeechToTextProvider):
    name = "mlx_whisper"

    def __init__(
        self,
        model: str,
        models_dir: str | None = None,
        loader: ModelLoader | None = None,
        *,
        min_confidence: float = 0.0,
    ) -> None:
        self._model_name = model
        self._repo_id = MODEL_MAP.get(model, model)
        self._models_dir = models_dir
        self._loader = loader or _default_loader
        self._model: MlxSttModel | None = None
        self._exec = PinnedExecutor("llvt-mlx")
        self._min_confidence = min_confidence

    async def load(self) -> None:
        logger.info("MlxWhisperAsr.load(model=%s -> %s)", self._model_name, self._repo_id)
        # Nạp PHẢI chạy trên đúng thread sẽ giải mã sau này (xem PinnedExecutor).
        self._model = await self._exec.run(self._loader, self._repo_id, self._models_dir)
        logger.info("MlxWhisperAsr loaded (models_dir=%s)", self._models_dir)

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def runtime_info(self) -> dict[str, str]:
        # MLX chỉ chạy trên GPU Apple, không có lựa chọn thiết bị nào khác — nên
        # "Metal" ở đây là sự thật đọc được chứ không phải suy đoán từ nền tảng.
        return {"model": self._repo_id, "backend": "mlx-audio", "accel": "Metal"}

    async def unload(self) -> None:
        if self._model is None:
            return
        await self._exec.run(self._release)
        self._model = None
        # Đóng thread ghim rồi tạo lại ở lần load() sau: giữ nó lại thì mỗi vòng
        # nạp/giải phóng lại bỏ quên một thread sống.
        self._exec.shutdown()
        self._exec = PinnedExecutor("llvt-mlx")

    def _release(self) -> None:
        """Trả bộ đệm Metal về hệ thống — phải chạy trên đúng thread đã tạo stream."""
        self._model = None
        try:
            import mlx.core as mx

            mx.clear_cache()
        except Exception:  # noqa: BLE001 — dọn bộ nhớ hỏng không được làm hỏng unload
            logger.debug("mlx.clear_cache() thất bại", exc_info=True)

    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        if sample_rate != SAMPLE_RATE:
            raise ValueError(
                f"MlxWhisperAsr cần PCM {SAMPLE_RATE} Hz (đã resample ở khâu thu), "
                f"nhận {sample_rate}"
            )
        if self._model is None:
            raise RuntimeError("MlxWhisperAsr chưa load() — không thể transcribe()")

        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

        started = time.perf_counter()
        segments = await self._exec.run(self._decode, audio, language)
        processing_ms = int((time.perf_counter() - started) * 1000)

        text = strip_non_speech("".join(str(seg.get("text", "")) for seg in segments))
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

    def _decode(self, audio: np.ndarray, language: Language) -> list[dict[str, Any]]:
        assert self._model is not None
        result = self._model.generate(audio, language=language.value, **DECODE_PARAMS)
        return list(getattr(result, "segments", None) or [])


def _mean_probability(segments: list[dict[str, Any]]) -> float | None:
    """Độ tin cậy trung bình, quy về cùng thang [0, 1] với whisper.cpp.

    Hai backend không báo cùng một đại lượng: pywhispercpp trả ``probability`` là
    trung bình xác suất token của đoạn, còn mlx-audio chỉ có ``avg_logprob`` — trung
    bình *log* xác suất, nên ``exp()`` của nó là trung bình NHÂN. Trung bình nhân
    luôn ≤ trung bình cộng, nghĩa là cùng một ngưỡng ``asr_min_confidence`` sẽ khắt
    khe hơn một chút trên backend này. Ghi ra đây để lúc so hai runtime không kết
    luận nhầm rằng MLX "kém tự tin hơn".
    """
    values: list[float] = []
    for seg in segments:
        raw = seg.get("avg_logprob")
        if raw is None:
            continue
        logprob = float(raw)
        if math.isnan(logprob) or math.isinf(logprob):
            continue
        values.append(math.exp(logprob))
    if not values:
        return None
    return sum(values) / len(values)
