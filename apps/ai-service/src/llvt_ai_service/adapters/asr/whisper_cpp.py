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
import os
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.adapters.asr.hallucination import rejection_reason, strip_non_speech
from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.whisper_cpp")

SAMPLE_RATE = 16000

# Tham số giải mã dùng cho MỌI lần transcribe. Lý do từng cái (biên bản GVHD 19/08
# mục 4.1 — hallucination trên đoạn im lặng):
#
# * ``no_context`` — không mang ngữ cảnh câu trước sang câu sau. Bật ngữ cảnh thì một
#   câu ma sinh ra sẽ tự nuôi chính nó ở các câu kế tiếp. pywhispercpp đã mặc định
#   True nhưng đây là tham số quan trọng nhất, không để nó phụ thuộc mặc định của lib.
# * ``temperature_inc = 0`` — TẮT fallback nhiệt độ. Whisper giải mã lại ở nhiệt độ
#   cao hơn khi thấy kết quả "kém", và đó đúng là lúc nó sáng tác nhiều nhất; một câu
#   xấu còn có thể tốn tới 6 lượt giải mã, phá vỡ ngân sách độ trễ. Mất đường thoát
#   khỏi vòng lặp lặp từ, nhưng ``hallucination.is_degenerate()`` bắt lại. Thêm một
#   cái lợi: giải mã tất định → số WER đo trên FLEURS lặp lại được.
# * ``single_segment`` — đoạn vào đây đã là MỘT câu do VAD cắt (≤ ``max_speech_ms``).
#   Ép một segment chặn đúng kiểu ma phổ biến nhất: text thật, rồi dính thêm một
#   segment "Thanks for watching" ở phần im lặng cuối.
# * ``suppress_nst`` — bỏ token phi-lời-nói ([Music], (applause)…).
#
# Cố tình KHÔNG đặt ``no_speech_thold`` / ``entropy_thold`` / ``logprob_thold``:
# pywhispercpp đánh dấu no_speech_thold là "not implemented", còn hai cái kia chỉ có
# tác dụng bên trong vòng fallback nhiệt độ vừa bị tắt. Việc lọc thật nằm ở
# ``adapters/asr/hallucination.py``, nơi kiểm thử được.
DECODE_PARAMS: dict[str, Any] = {
    "translate": False,  # task=transcribe, KHÔNG dịch — việc dịch là của module MT
    "print_progress": False,
    "print_realtime": False,
    "no_context": True,
    "temperature": 0.0,
    "temperature_inc": 0.0,
    "single_segment": True,
    "suppress_blank": True,
    "suppress_nst": True,
}


def _supported(params: dict[str, Any]) -> dict[str, Any]:
    """Bỏ tham số mà bản pywhispercpp đang cài không biết (nó raise nếu gặp khoá lạ)."""
    try:
        from pywhispercpp.constants import PARAMS_SCHEMA
    except Exception:  # noqa: BLE001 — không có lib thì cứ truyền nguyên, để nó tự báo
        return dict(params)
    known = {key: value for key, value in params.items() if key in PARAMS_SCHEMA}
    for key in params.keys() - known.keys():
        logger.warning("pywhispercpp không hỗ trợ tham số %r — bỏ qua", key)
    return known


# Tên file THẬT trong repo `ggerganov/whisper.cpp` -> id mà pywhispercpp hiểu.
#
# Khoá cố ý là **đường dẫn thật** chứ không phải một tên tự đặt: nó là thứ người dùng
# thấy trên HuggingFace, thứ nằm trên đĩa sau khi tải (bỏ đuôi `.bin`), và thứ dán
# thẳng vào ô "Tự chọn" hay `POST /api/models/download` được. Một tên cho một model,
# không phải hai.
#
# Giá trị là id của pywhispercpp — nó tự dựng lại tên file, nên phần này vẫn phải có.
# Tên nào không nằm trong bảng được truyền thẳng xuống pywhispercpp, nên mọi id trong
# `constants.AVAILABLE_MODELS` vẫn dùng được.
#
# CỐ TÌNH không liệt kê các biến thể `.en` (small.en, medium.en…) dù whisper.cpp có:
# ứng dụng luôn phải nhận cả vi/ja/zh, model English-only sẽ trả rác cho ba thứ tiếng
# đó. Ai muốn đo riêng chiều en→vi vẫn đặt thẳng `small.en` vào preset được.
MODEL_MAP: dict[str, str] = {
    "ggml-tiny-q5_1.bin": "tiny-q5_1",
    "ggml-tiny-q8_0.bin": "tiny-q8_0",
    "ggml-base-q5_1.bin": "base-q5_1",
    "ggml-base-q8_0.bin": "base-q8_0",
    "ggml-small.bin": "small",
    "ggml-small-q5_1.bin": "small-q5_1",
    "ggml-small-q8_0.bin": "small-q8_0",
    "ggml-medium.bin": "medium",
    "ggml-medium-q5_0.bin": "medium-q5_0",
    "ggml-medium-q8_0.bin": "medium-q8_0",
    "ggml-large-v3.bin": "large-v3",
    "ggml-large-v3-q5_0.bin": "large-v3-q5_0",
    "ggml-large-v3-turbo.bin": "large-v3-turbo",
    "ggml-large-v3-turbo-q5_0.bin": "large-v3-turbo-q5_0",
    "ggml-large-v3-turbo-q8_0.bin": "large-v3-turbo-q8_0",
}


class WhisperModel(Protocol):
    """Giao diện tối thiểu của pywhispercpp.model.Model (cho phép tiêm bản giả)."""

    def transcribe(self, media: np.ndarray, **params: Any) -> list[Any]: ...


# loader: (model_id, models_dir) -> WhisperModel. Blocking (tải + nạp model).
ModelLoader = Callable[[str, str | None], WhisperModel]


def _read_system_info() -> str:
    """Cờ build thật của whisper.cpp (METAL/CUDA/BLAS…) — không đoán từ nền tảng."""
    try:
        from pywhispercpp.model import Model

        return str(Model.system_info())
    except Exception:  # noqa: BLE001 — chỉ là thông tin hiển thị, không được làm hỏng load
        return ""


def _accel_from_system_info(info: str) -> str:
    """Rút gọn chuỗi cờ build thành tên bộ tăng tốc đang bật."""
    if not info:
        return "unknown"
    if "MTL" in info or "METAL = 1" in info:
        return "Metal"
    if "CUDA = 1" in info:
        return "CUDA"
    if "BLAS = 1" in info:
        return "BLAS"
    return "CPU"


def download_ggml(model_id: str, target_dir: Path) -> Path:
    """Tải file GGML về ``target_dir``, chỉ đặt vào chỗ khi đã tải XONG.

    pywhispercpp ghi thẳng vào đường dẫn cuối cùng và chỉ dọn dẹp khi *bắt được*
    exception. Bị kill giữa chừng (đóng app, mất điện, hết pin) thì nó để lại một
    file ``.bin`` cụt ngay tại chỗ — và lần sau chính nó thấy "file đã có" nên
    không bao giờ tải lại nữa. Model đó hỏng vĩnh viễn mà nhìn thì vẫn như đã tải.

    Tải vào thư mục tạm rồi đổi tên là cách duy nhất khiến "có file" đồng nghĩa với
    "đã tải xong": ``os.replace`` trong cùng một phân vùng là thao tác nguyên tử,
    không có trạng thái ở giữa.
    """
    from pywhispercpp.utils import download_model

    target_dir.mkdir(parents=True, exist_ok=True)
    ready = target_dir / f"ggml-{model_id}.bin"
    if ready.is_file():
        return ready

    staging = target_dir / ".incomplete"
    staging.mkdir(parents=True, exist_ok=True)
    try:
        fetched = download_model(model_id, str(staging))
        if not fetched:
            # pywhispercpp trả None cho tên lạ (chỉ log rồi bỏ qua), không ném lỗi.
            raise ValueError(
                f"whisper.cpp không có model {model_id!r}. Xem danh sách file GGML "
                "trong repo ggerganov/whisper.cpp."
            )
        done = target_dir / Path(fetched).name
        os.replace(fetched, done)
    finally:
        # Xoá phần tải dở: pywhispercpp không tải tiếp được, giữ lại chỉ tổ chiếm đĩa.
        shutil.rmtree(staging, ignore_errors=True)
    return done


def _default_loader(model_id: str, models_dir: str | None) -> WhisperModel:
    from pywhispercpp.model import Model

    # Tải trước bằng đường có staging: để `Model()` tự tải thì nó dùng thẳng
    # pywhispercpp, và một lượt nạp bị ngắt sẽ để lại file .bin cụt.
    if models_dir:
        download_ggml(model_id, Path(models_dir))
    # redirect logs để không làm nhiễu log của service; greedy (mặc định) cho low-latency.
    return Model(model_id, models_dir=models_dir, redirect_whispercpp_logs_to=None)


class WhisperCppAsr(SpeechToTextProvider):
    name = "whisper_cpp"

    def __init__(
        self,
        model: str,
        models_dir: str | None = None,
        loader: ModelLoader | None = None,
        *,
        min_confidence: float = 0.0,
        audio_ctx: int = 0,
    ) -> None:
        self._model_name = model
        self._model_id = MODEL_MAP.get(model, model)
        self._models_dir = models_dir
        self._loader = loader or _default_loader
        self._model: WhisperModel | None = None
        self._exec = SerialExecutor()
        self._system_info = ""
        self._min_confidence = min_confidence
        self._audio_ctx = audio_ctx
        self._params: dict[str, Any] = {}

    async def load(self) -> None:
        logger.info("WhisperCppAsr.load(model=%s -> %s)", self._model_name, self._model_id)
        # Tải/nạp model là blocking (I/O + CPU) -> chạy ngoài event loop.
        self._model = await asyncio.to_thread(self._loader, self._model_id, self._models_dir)
        self._system_info = await asyncio.to_thread(_read_system_info)
        params = dict(DECODE_PARAMS)
        if self._audio_ctx > 0:
            # Cắt bớt ngữ cảnh encoder: đoạn VAD chỉ vài giây chứ không phải 30 s nên
            # phần lớn cửa sổ là padding. Nhanh hơn đáng kể nhưng ẢNH HƯỞNG ĐỘ CHÍNH
            # XÁC → mặc định tắt, chỉ bật khi đã đo được WER tương ứng.
            params["audio_ctx"] = self._audio_ctx
        self._params = _supported(params)
        logger.info("WhisperCppAsr loaded (models_dir=%s)", self._models_dir)

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def runtime_info(self) -> dict[str, str]:
        return {
            "model": self._model_id,
            "backend": "whisper.cpp",
            "accel": _accel_from_system_info(self._system_info),
        }

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

        text = strip_non_speech("".join(seg.text for seg in segments))
        confidence = _mean_probability(segments)
        reason = rejection_reason(text, confidence, min_confidence=self._min_confidence)
        if reason is not None:
            # Không log nội dung câu (SPEC 14: chỉ mã lỗi ra log), chỉ log vì sao bỏ —
            # đủ để giải thích với hội đồng và để đếm tần suất lúc đo.
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
        return self._model.transcribe(
            audio,
            language=language.value,  # 'vi'/'en'/'ja'/'zh' khớp mã whisper
            extract_probability=True,  # để tính confidence
            **self._params,
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
