"""Adapter VAD: Silero (mặc định) — tích hợp ở Tuần 2, chỉnh endpointing sau họp GVHD.

``SileroVad`` nạp/kiểm tra gói ``silero-vad`` (backend torch). Mỗi lần ``open_stream``
tạo một ``SileroVadStream`` với model + state riêng, nên hai nguồn audio (mic/system)
và nhiều phiên không dùng chung hidden-state.

``SileroVadStream`` bọc ``VADIterator`` của Silero và bổ sung phần *endpointing* —
quyết định "khi nào chốt câu", tức là thứ quyết định người dùng phải chờ bao lâu mới
thấy bản dịch (biên bản GVHD 19/08 mục 4.2):

* **Hai ngưỡng im lặng.** VADIterator được cấu hình ở ngưỡng NGẮN (``soft_silence_ms``)
  nên nó báo ``end`` sớm. Với câu còn ngắn, stream giữ lại quyết định thêm
  ``min_silence_ms - soft_silence_ms`` nữa: nếu giọng nói quay lại trong lúc đó thì đó
  chỉ là nhịp ngắt giữa câu, nối tiếp đoạn cũ. Câu đã dài quá ``soft_max_ms`` thì chốt
  ngay ở nhịp hụt hơi đầu tiên. Nói chậm → câu không bị băm; nói liên tục → không phải
  chờ hết câu mới được dịch.
* **Cắt cứng có lùi.** Khi vượt ``max_speech_ms`` mà vẫn chưa có khoảng lặng nào, thay
  vì chặt ngay tại con trỏ (dễ rơi vào giữa một từ) thì lùi tìm khung 32 ms yên nhất
  trong ``backoff_ms`` cuối và cắt ở đó, rồi mở đoạn mới chồng lấn ``carry_ms`` để
  không mất âm đầu của từ kế tiếp.

Ngoài ra vẫn giữ: gom PCM 16-bit thành cửa sổ 512 mẫu, giữ audio để cắt đúng đoạn, và
bỏ đoạn ngắn hơn ``min_speech_ms``.
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
    """Ngưỡng phân đoạn câu.

    Giá trị mặc định ở đây chỉ là điểm rơi an toàn; giá trị thật đến từ
    ``config.presets.VadTuning`` (mỗi preset một bộ). Hai lớp phải TRÙNG TÊN TRƯỜNG —
    ``tests/test_vad.py::test_vad_tuning_matches_params`` giữ ràng buộc đó.
    """

    threshold: float = 0.5
    # Im lặng cần có để chốt một câu chưa dài. Ngắn quá thì một câu nói chậm bị băm
    # thành nhiều mảnh, MT dịch từng mảnh rời rạc sẽ sai nghĩa.
    min_silence_ms: int = 320
    # Im lặng đủ để chốt khi câu đã vượt ``soft_max_ms`` — chỉ cần hụt hơi một nhịp.
    soft_silence_ms: int = 140
    speech_pad_ms: int = 120
    min_speech_ms: int = 250
    # Qua mốc này thì chuyển sang chế độ "chốt sớm".
    soft_max_ms: int = 3500
    # Trần tuyệt đối: nói liên tục không nghỉ thì vẫn phải cắt để còn kịp dịch.
    max_speech_ms: int = 6000
    # Cửa sổ lùi lại tìm điểm cắt yên nhất khi buộc phải cắt cứng.
    backoff_ms: int = 400
    # Phần chồng lấn giữ lại cho đoạn sau khi cắt cứng.
    carry_ms: int = 100

    def __post_init__(self) -> None:
        # Kẹp lại cho state machine không rơi vào trạng thái vô nghĩa: giá trị đến từ
        # preset + LLVT_VAD_OVERRIDES nên không tin tuyệt đối được.
        def clamp(name: str, value: int) -> None:
            object.__setattr__(self, name, value)

        clamp("soft_silence_ms", min(self.soft_silence_ms, self.min_silence_ms))
        clamp("soft_max_ms", min(self.soft_max_ms, self.max_speech_ms))
        # Cắt cứng phải TIẾN được: đoạn mới (sau khi lùi + chồng lấn) luôn phải ngắn
        # hơn max_speech, nếu không vòng lặp sẽ cắt lại ngay ở cửa sổ kế tiếp.
        room = max(0, self.max_speech_ms - self.min_speech_ms) // 2
        clamp("backoff_ms", min(self.backoff_ms, room))
        clamp("carry_ms", min(self.carry_ms, room))


class _Iterator(Protocol):
    """Giao diện tối thiểu của Silero VADIterator (cho phép tiêm bản giả khi test)."""

    def __call__(self, x: np.ndarray) -> dict[str, int] | None: ...

    def reset_states(self) -> None: ...


class SileroVadStream(VadStream):
    def __init__(self, iterator: _Iterator, params: VadParams) -> None:
        self._it = iterator
        self._p = params
        per_ms = SAMPLE_RATE / 1000
        self._pad = int(params.speech_pad_ms * per_ms)
        self._min_speech = int(params.min_speech_ms * per_ms)
        self._soft_max = int(params.soft_max_ms * per_ms)
        self._max_speech = int(params.max_speech_ms * per_ms)
        self._backoff = int(params.backoff_ms * per_ms)
        self._carry = int(params.carry_ms * per_ms)
        # VADIterator đã chờ soft_silence trước khi báo 'end'; câu ngắn chờ nốt phần
        # còn thiếu để đủ min_silence.
        self._hangover = int(max(0, params.min_silence_ms - params.soft_silence_ms) * per_ms)
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
        self._pending_end: int | None = None  # điểm kết VAD đề xuất, đang chờ hangover
        self._pending_at = 0  # giá trị _cursor lúc nhận event 'end'

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
            self._apply(event)

            if self._in_seg:
                seg = self._close_if_due()
                if seg is not None:
                    segments.append(seg)
            self._trim()
        return segments

    def _apply(self, event: dict[str, int] | None) -> None:
        """Cập nhật state theo event của VADIterator."""
        if event is None:
            return
        if "start" in event:
            if self._in_seg and self._pending_end is not None:
                # Giọng nói quay lại trước khi hết hangover → đây chỉ là nhịp ngắt
                # giữa câu: huỷ quyết định kết thúc, nối tiếp đoạn đang mở.
                self._pending_end = None
            else:
                self._in_seg = True
                self._seg_start = max(0, int(event["start"]))
                self._pending_end = None
        elif "end" in event and self._in_seg and self._pending_end is None:
            self._pending_end = max(self._seg_start, int(event["end"]))
            self._pending_at = self._cursor

    def _close_if_due(self) -> VadSegment | None:
        """Chốt đoạn nếu đã đủ điều kiện: im lặng đủ lâu, hoặc chạm trần độ dài."""
        if self._pending_end is not None:
            spoken = self._pending_end - self._seg_start
            # Câu đã dài → chốt ngay; câu ngắn → chờ đủ min_silence để khỏi băm nhỏ.
            wait = 0 if spoken >= self._soft_max else self._hangover
            if self._cursor - self._pending_at < wait:
                return None
            seg = self._cut(self._seg_start, self._pending_end)
            self._in_seg = False
            self._pending_end = None
            return seg
        if self._cursor - self._seg_start >= self._max_speech:
            return self._force_cut()
        return None

    def _force_cut(self) -> VadSegment | None:
        """Cắt câu quá dài tại điểm yên nhất gần cuối, mở đoạn mới có chồng lấn."""
        cut = self._quietest_before(self._cursor)
        seg = self._cut(self._seg_start, cut, forced=True)
        # Giữ carry_ms cho đoạn sau, nhưng điểm mở mới phải tiến hơn _seg_start cũ.
        new_start = cut - self._carry
        self._seg_start = new_start if new_start > self._seg_start else cut
        return seg

    def _quietest_before(self, end_abs: int) -> int:
        """Chỉ số mẫu của khung 32 ms yên nhất trong ``backoff_ms`` trước ``end_abs``.

        Dùng năng lượng (RMS bình phương) chứ không chạy lại VAD: rẻ hơn nhiều lần và
        đủ tốt để tránh chặt giữa nguyên âm — chỗ yên nhất gần như luôn là ranh giới từ.
        """
        lo = max(self._seg_start + self._min_speech, end_abs - self._backoff)
        if end_abs - lo < 2 * WINDOW_SAMPLES:
            return end_abs
        tail = self._audio[lo - self._origin : end_abs - self._origin].astype(np.float32)
        n = tail.size // WINDOW_SAMPLES
        if n < 2:
            return end_abs
        frames = tail[: n * WINDOW_SAMPLES].reshape(n, WINDOW_SAMPLES)
        energy = np.einsum("ij,ij->i", frames, frames)
        return lo + int(np.argmin(energy)) * WINDOW_SAMPLES + WINDOW_SAMPLES // 2

    def flush(self) -> list[VadSegment]:
        segments: list[VadSegment] = []
        if self._in_seg:
            # VAD đã đề xuất điểm kết thì cắt ở đó, đừng ôm theo phần im lặng cuối.
            end = self._pending_end if self._pending_end is not None else self._cursor
            seg = self._cut(self._seg_start, end)
            if seg is not None:
                segments.append(seg)
        self.reset()  # sạch state cho lượt nói kế tiếp
        return segments

    def _cut(self, start_abs: int, end_abs: int, *, forced: bool = False) -> VadSegment | None:
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
            forced=forced,
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
        logger.info(
            "SileroVad loaded (torch backend, endpointing soft=%dms hard=%dms)",
            self._params.soft_max_ms,
            self._params.max_speech_ms,
        )

    async def unload(self) -> None:
        self._loader = None
        self._iter_cls = None

    @property
    def loaded(self) -> bool:
        return self._loader is not None

    def runtime_info(self) -> dict[str, str]:
        # Silero VAD chạy trên CPU: model rất nhỏ, đẩy sang GPU còn tốn hơn.
        return {
            "model": "silero-vad",
            "backend": "torch",
            "accel": "CPU",
            # Lộ ra /api/config để lúc đo đạc còn biết đang chạy ở ngưỡng nào.
            "endpointing": f"{self._params.soft_max_ms}/{self._params.max_speech_ms}ms",
        }

    def open_stream(self) -> SileroVadStream:
        if self._loader is None or self._iter_cls is None:
            raise RuntimeError("SileroVad chưa load() — không thể open_stream()")
        # Model + state riêng cho mỗi stream để không chia sẻ hidden-state.
        # min_silence ở đây cố tình là ngưỡng NGẮN: phần chờ thêm cho câu ngắn do
        # SileroVadStream tự xử lý (xem docstring đầu file).
        iterator = self._iter_cls(
            self._loader(),
            sampling_rate=SAMPLE_RATE,
            threshold=self._params.threshold,
            min_silence_duration_ms=self._params.soft_silence_ms,
            speech_pad_ms=self._params.speech_pad_ms,
        )
        return SileroVadStream(iterator, self._params)
