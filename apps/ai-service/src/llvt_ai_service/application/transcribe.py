"""Chuyển một tệp âm thanh có sẵn thành văn bản (và bản dịch) — xử lý theo lô.

Khác `TranslationPipeline` ở ba điểm, nên là một use case riêng chứ không phải một
chế độ của pipeline realtime:

- Đầu vào là **cả tệp** chứ không phải luồng khung audio, nên VAD được nạp lần lượt
  từng khúc và chốt bằng ``flush()`` ở cuối thay vì chờ khoảng lặng.
- **Không tổng hợp giọng**: người dùng muốn văn bản, không muốn nghe lại.
- Không phát event qua WebSocket; tiến trình được ghi vào một bản ghi dùng chung để
  `GET /api/transcribe/progress` trả về trong lúc `POST /api/transcribe` còn đang chặn
  (cùng cách làm với tiến trình nạp model, xem `application/load_progress`).

Phần giải mã tệp (MP3/M4A/WebM…) nằm ở **desktop**: Chromium đã có sẵn bộ giải mã cho
mọi định dạng thông dụng nên client gửi lên PCM 16-bit mono 16 kHz — service không cần
kéo thêm ffmpeg vào bản cài đặt. Hàm ``decode_pcm16`` dưới đây vì thế chỉ nhận PCM thô
hoặc WAV (để gọi bằng curl khi kiểm thử vẫn tiện).
"""

from __future__ import annotations

import asyncio
import io
import logging
import time
import wave
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Awaitable, Callable

import numpy as np

from llvt_ai_service.application.model_manager import ProviderSet
from llvt_ai_service.domain.enums import AudioSource, Language, UtteranceStatus
from llvt_ai_service.domain.models import Utterance, VadSegment
from llvt_ai_service.ports.repository import SessionRepository

logger = logging.getLogger("llvt.transcribe")

SAMPLE_RATE = 16000

# Nạp VAD theo khúc 5 giây: đủ nhỏ để thanh tiến trình nhúc nhích đều, đủ lớn để
# không gọi qua lại giữa event loop và worker thread hàng nghìn lần cho một tệp dài.
CHUNK_SECONDS = 5.0


class AudioDecodeError(ValueError):
    """Dữ liệu gửi lên không phải PCM/WAV đọc được."""


def _resample_linear(samples: np.ndarray, rate: int) -> np.ndarray:
    """Đổi tần số lấy mẫu bằng nội suy tuyến tính.

    Chỉ dùng cho đường WAV gọi bằng curl; đường chính (desktop) đã gửi đúng 16 kHz
    vì AudioContext resample sẵn lúc giải mã.
    """
    if rate == SAMPLE_RATE or samples.size == 0:
        return samples
    duration = samples.size / rate
    target_n = int(duration * SAMPLE_RATE)
    if target_n <= 0:
        return np.empty(0, dtype=np.int16)
    src_index = np.linspace(0, samples.size - 1, target_n)
    resampled = np.interp(src_index, np.arange(samples.size), samples.astype(np.float32))
    return resampled.astype(np.int16)


def _read_wav(data: bytes) -> tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(data), "rb") as wav:
        if wav.getsampwidth() != 2:
            raise AudioDecodeError("Chỉ đọc được WAV PCM 16-bit.")
        channels = wav.getnchannels()
        rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())
    samples = np.frombuffer(frames, dtype="<i2")
    if channels > 1:
        # Cắt phần dư (tệp hỏng ở khung cuối) rồi trộn các kênh về mono.
        usable = samples.size - (samples.size % channels)
        samples = samples[:usable].reshape(-1, channels).mean(axis=1).astype(np.int16)
    return samples, rate


def decode_pcm16(data: bytes) -> bytes:
    """Trả PCM signed 16-bit mono 16 kHz từ WAV hoặc từ PCM thô đã đúng định dạng."""
    if not data:
        raise AudioDecodeError("Không có dữ liệu âm thanh.")
    if data[:4] == b"RIFF":
        try:
            samples, rate = _read_wav(data)
        except AudioDecodeError:
            raise
        except Exception as exc:  # wave.Error và mọi lỗi đọc header khác
            raise AudioDecodeError(f"Không đọc được tệp WAV: {exc}") from exc
    else:
        if len(data) % 2:
            raise AudioDecodeError("PCM 16-bit phải có số byte chẵn.")
        samples, rate = np.frombuffer(data, dtype="<i2"), SAMPLE_RATE
    samples = _resample_linear(samples, rate)
    if samples.size == 0:
        raise AudioDecodeError("Tệp không có mẫu âm thanh nào.")
    return samples.tobytes()


@dataclass
class TranscriptSegment:
    """Một đoạn giọng nói VAD cắt ra, kèm mốc thời gian TÍNH TỪ ĐẦU TỆP."""

    started_at_ms: int
    ended_at_ms: int
    text: str
    translated_text: str | None = None
    asr_ms: int | None = None
    mt_ms: int | None = None


@dataclass
class TranscriptionResult:
    source: Language
    target: Language | None
    audio_ms: int
    processing_ms: int
    segments: list[TranscriptSegment] = field(default_factory=list)
    # Phiên trong lịch sử (rỗng khi người dùng không lưu, hoặc khi lưu lịch sử đang tắt).
    session_id: str = ""
    # Dừng giữa chừng theo yêu cầu: `segments` là phần chạy được tới lúc đó, không phải
    # cả tệp. Trả về thay vì ném lỗi — phần đã dịch xong vẫn có ích cho người dùng.
    cancelled: bool = False


class TranscribeProgress:
    """Tiến trình của lượt nhập tệp đang chạy.

    Đo bằng **vị trí trong tệp đã xử lý xong**, không phải bằng thời gian ước lượng:
    một tệp 10 phút chạy tới giây thứ 300 thì đúng là 50%, dù máy nhanh hay chậm.
    Ghi từ luồng xử lý, đọc từ handler REST nên có lock.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._active = False
        self._name = ""
        self._audio_ms = 0
        self._done_ms = 0
        self._segments = 0
        self._error: str | None = None
        self._cancel = False

    @property
    def active(self) -> bool:
        with self._lock:
            return self._active

    @property
    def cancel_requested(self) -> bool:
        with self._lock:
            return self._cancel

    def request_cancel(self) -> None:
        """Xin dừng lượt đang chạy; vòng xử lý sẽ dừng ở ranh giới khúc kế tiếp."""
        with self._lock:
            self._cancel = True

    def reserve(self, name: str) -> None:
        """Giữ chỗ trước khi biết độ dài tệp.

        Nạp model có thể mất vài phút và nằm TRƯỚC lúc chạy. Không giữ chỗ từ đây thì
        yêu cầu huỷ trong quãng đó sẽ bị `begin()` xoá mất, và tệp vẫn chạy tiếp.
        """
        with self._lock:
            self._active = True
            self._name = name
            self._audio_ms = 0
            self._done_ms = 0
            self._segments = 0
            self._error = None
            self._cancel = False

    def begin(self, name: str, audio_ms: int) -> None:
        with self._lock:
            self._name = name
            self._audio_ms = audio_ms
            self._done_ms = 0
            self._segments = 0
            if not self._active:
                # Không ai giữ chỗ trước (gọi thẳng transcribe_audio) → đây là lượt mới.
                self._active = True
                self._error = None
                self._cancel = False

    def advance(self, done_ms: int, segments: int) -> None:
        with self._lock:
            self._done_ms = min(done_ms, self._audio_ms) if self._audio_ms else done_ms
            self._segments = segments

    def fail(self, message: str) -> None:
        with self._lock:
            self._active = False
            self._error = message

    def release(self) -> None:
        """Nhả chỗ: hết "đang chạy" mà không phải lỗi (dừng giữa chừng, hoặc bỏ dở)."""
        with self._lock:
            self._active = False

    def finish(self) -> None:
        with self._lock:
            self._active = False
            self._done_ms = self._audio_ms

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            percent = round(self._done_ms / self._audio_ms * 100, 1) if self._audio_ms else None
            return {
                "active": self._active,
                "fileName": self._name,
                "audioMs": self._audio_ms,
                "doneMs": self._done_ms,
                "segments": self._segments,
                "percent": percent,
                "error": self._error,
                # Đã xin dừng nhưng khúc đang chạy chưa xong — giao diện hiện "đang dừng…".
                "cancelling": self._cancel and self._active,
            }


# Mỗi lần chỉ chạy một tệp (API trả 409 nếu đang bận) nên dùng chung một bản.
progress = TranscribeProgress()


async def _cut_segments(stream: Any, pcm: bytes) -> list[VadSegment]:
    """Chạy VAD ngoài event loop: Silero là torch, blocking và tốn CPU."""
    return await asyncio.to_thread(stream.accept, pcm, SAMPLE_RATE)


async def transcribe_audio(
    providers: ProviderSet,
    pcm: bytes,
    source: Language,
    target: Language | None = None,
    *,
    repository: SessionRepository | None = None,
    session_id: str = "",
    session_started_at_ms: int = 0,
    file_name: str = "",
    should_stop: Callable[[], Awaitable[bool]] | None = None,
) -> TranscriptionResult:
    """VAD → ASR → (MT) cho cả tệp; ghi lịch sử nếu được đưa repository.

    ``target=None`` nghĩa là chỉ nhận dạng chữ, không dịch.

    ``should_stop`` được hỏi ở ranh giới mỗi khúc: trả True thì dừng và trả về phần đã
    chạy được (``cancelled=True``). Dùng cho nút Huỷ và cho trường hợp client bỏ đi.
    """
    audio_ms = int(len(pcm) / 2 / SAMPLE_RATE * 1000)
    progress.begin(file_name, audio_ms)
    started = time.perf_counter()
    stream = providers.vad.open_stream()
    segments: list[TranscriptSegment] = []
    chunk_bytes = int(CHUNK_SECONDS * SAMPLE_RATE) * 2

    async def handle(segment: VadSegment) -> None:
        result = await _process_segment(
            providers,
            segment,
            source,
            target,
            repository=repository,
            session_id=session_id,
            session_started_at_ms=session_started_at_ms,
        )
        if result is not None:
            segments.append(result)

    cancelled = False
    try:
        for offset in range(0, len(pcm), chunk_bytes):
            if should_stop is not None and await should_stop():
                cancelled = True
                break
            for segment in await _cut_segments(stream, pcm[offset : offset + chunk_bytes]):
                await handle(segment)
            # Vị trí đã nạp vào VAD; đoạn cuối còn nằm trong buffer sẽ được flush() chốt.
            progress.advance(int((offset + chunk_bytes) / 2 / SAMPLE_RATE * 1000), len(segments))
        if not cancelled:
            for segment in await asyncio.to_thread(stream.flush):
                await handle(segment)
    except asyncio.CancelledError:
        # Người dùng bấm huỷ (hoặc đóng app) → uvicorn huỷ task xử lý request. Phải dọn
        # cờ "đang chạy", nếu không mọi lần nhập tệp sau đều bị từ chối bằng 409 cho tới
        # khi khởi động lại service. CancelledError là BaseException nên nhánh Exception
        # bên dưới KHÔNG bắt được — cần nhánh riêng.
        progress.release()
        logger.info("Huỷ lượt nhập tệp %r sau %d đoạn", file_name, len(segments))
        raise
    except Exception as exc:
        progress.fail(str(exc))
        raise
    if cancelled:
        progress.release()
        logger.info("Dừng lượt nhập tệp %r theo yêu cầu, giữ %d đoạn", file_name, len(segments))
    else:
        progress.finish()

    return TranscriptionResult(
        source=source,
        target=target,
        audio_ms=audio_ms,
        processing_ms=int((time.perf_counter() - started) * 1000),
        segments=segments,
        session_id=session_id,
        cancelled=cancelled,
    )


async def _process_segment(
    providers: ProviderSet,
    segment: VadSegment,
    source: Language,
    target: Language | None,
    *,
    repository: SessionRepository | None,
    session_id: str,
    session_started_at_ms: int,
) -> TranscriptSegment | None:
    """Một đoạn: ASR → (MT) → ghi lịch sử. Trả None nếu đoạn không ra chữ."""
    transcript = await providers.asr.transcribe(segment.pcm, source, segment.sample_rate)
    text = transcript.text.strip()
    if not text:
        # VAD cắt cả tiếng ồn/nhạc nền → ASR trả rỗng; đừng làm rác bản ghi.
        return None

    translated: str | None = None
    mt_ms: int | None = None
    if target is not None and target != source:
        mt_started = time.perf_counter()
        translation = await providers.mt.translate(text, source, target)
        mt_ms = int((time.perf_counter() - mt_started) * 1000)
        translated = translation.translated_text

    result = TranscriptSegment(
        started_at_ms=segment.started_at_ms,
        ended_at_ms=segment.ended_at_ms,
        text=text,
        translated_text=translated,
        asr_ms=transcript.processing_ms,
        mt_ms=mt_ms,
    )
    if repository is not None and session_id:
        await _save(
            repository,
            Utterance(
                session_id=session_id,
                source=AudioSource.file,
                source_language=source,
                target_language=target or source,
                source_text=text,
                translated_text=translated,
                asr_ms=result.asr_ms,
                mt_ms=mt_ms,
                status=UtteranceStatus.success,
                # Mốc thời gian = lúc bắt đầu nhập + vị trí trong tệp, nên bản ghi giữ
                # đúng thứ tự và người đọc thấy được câu nằm ở phút thứ mấy của tệp.
                started_at_ms=session_started_at_ms + segment.started_at_ms,
                ended_at_ms=session_started_at_ms + segment.ended_at_ms,
            ),
        )
    return result


async def _save(repository: SessionRepository, utterance: Utterance) -> None:
    """Lỗi lưu trữ không được làm hỏng cả lượt nhập tệp."""
    try:
        await repository.save_utterance(utterance)
    except Exception:  # noqa: BLE001 — chỉ log, không log nội dung câu
        logger.warning("Không lưu được câu %s vào lịch sử", utterance.id, exc_info=True)
