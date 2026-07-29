"""Adapter VAD: Silero (mặc định) — tích hợp ở Tuần 2.

``SileroVad`` nạp/kiểm tra gói ``silero-vad`` (backend torch). Mỗi lần ``open_stream``
tạo một ``SileroVadStream`` với model + state riêng, nên hai nguồn audio (mic/system)
và nhiều phiên không dùng chung hidden-state.

``SileroVadStream`` bọc ``VADIterator`` của Silero (đã lo hysteresis + min_silence +
speech_pad) và bổ sung: gom PCM 16-bit thành cửa sổ 512 mẫu, giữ audio để cắt đúng
đoạn, ép cắt khi câu quá dài (``max_speech``) và bỏ đoạn quá ngắn (``min_speech``).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.domain.models import VadSegment
from llvt_ai_service.ports.vad import VadStream, VoiceActivityDetector

logger = logging.getLogger("llvt.adapters.vad.silero")

# Silero yêu cầu cửa sổ 512 mẫu ở 16 kHz cho mỗi lần suy luận.
WINDOW_SAMPLES = 512
SAMPLE_RATE = 16000


@dataclass(frozen=True)
class VadParams:
    threshold: float = 0.5
    min_silence_ms: int = 300
    speech_pad_ms: int = 120
    min_speech_ms: int = 250
    max_speech_ms: int = 20000


class _Iterator(Protocol):
    """Giao diện tối thiểu của Silero VADIterator (cho phép tiêm bản giả khi test)."""

    def __call__(self, x: np.ndarray) -> dict[str, int] | None: ...

    def reset_states(self) -> None: ...


class SileroVadStream(VadStream):
    def __init__(self, iterator: _Iterator, params: VadParams) -> None:
        self._it = iterator
        self._p = params
        self._pad = int(params.speech_pad_ms * SAMPLE_RATE / 1000)
        self._min_speech = int(params.min_speech_ms * SAMPLE_RATE / 1000)
        self._max_speech = int(params.max_speech_ms * SAMPLE_RATE / 1000)
        self._keep_tail = self._pad + WINDOW_SAMPLES
        self.reset()

    def reset(self) -> None:
        self._it.reset_states()
        self._pending = np.empty(0, dtype=np.int16)  # mẫu chưa đủ 1 cửa sổ
        self._audio = np.empty(0, dtype=np.int16)  # audio đang giữ để cắt
        self._origin = 0  # chỉ số tuyệt đối của _audio[0]
        self._cursor = 0  # tổng số mẫu đã xử lý (== đầu cửa sổ kế tiếp)
        self._in_seg = False
        self._seg_start = 0

    def accept(self, pcm: bytes, sample_rate: int = 16000) -> list[VadSegment]:
        if sample_rate != SAMPLE_RATE:
            raise ValueError(
                f"SileroVadStream cần PCM {SAMPLE_RATE} Hz (desktop resample trước), nhận {sample_rate}"
            )
        data = np.frombuffer(pcm, dtype=np.int16)
        buf = np.concatenate((self._pending, data)) if self._pending.size else data
        n_windows = buf.size // WINDOW_SAMPLES
        used = n_windows * WINDOW_SAMPLES
        self._pending = buf[used:].copy()

        segments: list[VadSegment] = []
        for i in range(n_windows):
            window = buf[i * WINDOW_SAMPLES : (i + 1) * WINDOW_SAMPLES]
            self._audio = np.concatenate((self._audio, window))
            event = self._it(window.astype(np.float32) / 32768.0)
            self._cursor += WINDOW_SAMPLES

            if event and "start" in event:
                self._in_seg = True
                self._seg_start = max(0, int(event["start"]))
            elif event and "end" in event and self._in_seg:
                seg = self._cut(self._seg_start, int(event["end"]))
                if seg is not None:
                    segments.append(seg)
                self._in_seg = False
            elif self._in_seg and self._cursor - self._seg_start >= self._max_speech:
                seg = self._cut(self._seg_start, self._cursor)
                if seg is not None:
                    segments.append(seg)
                self._seg_start = self._cursor  # câu vẫn tiếp diễn, mở đoạn mới

            self._trim()
        return segments

    def flush(self) -> list[VadSegment]:
        segments: list[VadSegment] = []
        if self._in_seg:
            seg = self._cut(self._seg_start, self._cursor)
            if seg is not None:
                segments.append(seg)
        self.reset()  # sạch state cho lượt nói kế tiếp
        return segments

    def _cut(self, start_abs: int, end_abs: int) -> VadSegment | None:
        if end_abs - start_abs < self._min_speech:
            return None  # đoạn quá ngắn → bỏ
        s = max(0, start_abs - self._origin)
        e = min(self._audio.size, end_abs - self._origin)
        pcm = self._audio[s:e].tobytes()
        return VadSegment(
            pcm=pcm,
            started_at_ms=int(1000 * start_abs / SAMPLE_RATE),
            ended_at_ms=int(1000 * end_abs / SAMPLE_RATE),
            sample_rate=SAMPLE_RATE,
        )

    def _trim(self) -> None:
        """Bỏ audio cũ không còn cần: khi rảnh chỉ giữ đuôi đủ cho speech_pad."""
        keep_from = self._seg_start if self._in_seg else self._cursor - self._keep_tail
        drop = max(0, keep_from - self._origin)
        if drop > 0:
            self._audio = self._audio[drop:]
            self._origin += drop


class SileroVad(VoiceActivityDetector):
    name = "silero"

    def __init__(self, params: VadParams | None = None) -> None:
        self._params = params or VadParams()
        self._loader: Callable[..., Any] | None = None
        self._iter_cls: Any = None

    async def load(self) -> None:
        from silero_vad import VADIterator, load_silero_vad

        self._loader = load_silero_vad
        self._iter_cls = VADIterator
        load_silero_vad()  # nạp sớm để bắt lỗi ngay khi khởi động + làm nóng cache
        logger.info("SileroVad loaded (torch backend)")

    async def unload(self) -> None:
        self._loader = None
        self._iter_cls = None

    @property
    def loaded(self) -> bool:
        return self._loader is not None

    def runtime_info(self) -> dict[str, str]:
        # Silero VAD chạy trên CPU: model rất nhỏ, đẩy sang GPU còn tốn hơn.
        return {"model": "silero-vad", "backend": "torch", "accel": "CPU"}

    def open_stream(self) -> SileroVadStream:
        if self._loader is None or self._iter_cls is None:
            raise RuntimeError("SileroVad chưa load() — không thể open_stream()")
        # Model + state riêng cho mỗi stream để không chia sẻ hidden-state.
        iterator = self._iter_cls(
            self._loader(),
            sampling_rate=SAMPLE_RATE,
            threshold=self._params.threshold,
            min_silence_duration_ms=self._params.min_silence_ms,
            speech_pad_ms=self._params.speech_pad_ms,
        )
        return SileroVadStream(iterator, self._params)
