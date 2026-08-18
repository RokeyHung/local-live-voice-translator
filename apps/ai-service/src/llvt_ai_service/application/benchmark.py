"""Đo độ trễ từng khâu của pipeline trên máy đang chạy (phục vụ Tuần 8).

Đây là phép đo THỜI GIAN, không phải phép đo độ chính xác: mỗi khâu được chạy
với đầu vào cố định, độc lập nhau, nên số đo không phụ thuộc chất lượng của khâu
trước. Cụ thể:

- VAD + ASR chạy trên một đoạn sóng tổng hợp có nhịp giống tiếng nói. Thời gian
  của whisper.cpp phụ thuộc độ dài audio chứ gần như không phụ thuộc nội dung,
  nên đoạn này cho số đo sát thực tế mà không cần đính kèm file wav vào repo.
- MT và TTS chạy trên câu mẫu cố định — không dùng transcript mà ASR vừa trả về
  (đoạn sóng tổng hợp không ra chữ có nghĩa, sẽ làm MT nhanh giả tạo).

Mọi khâu đều được chạy nóng (warm-up) trước khi bấm giờ: TTS nạp voice lười theo
ngôn ngữ và lần suy luận đầu của ASR/MT tốn thêm thời gian dựng graph, nên đo
nguội sẽ ra số vô nghĩa. Con số trả về vì thế là độ trễ mỗi câu khi máy đã chạy
ổn định, KHÔNG bao gồm thời gian khởi động lần đầu.

Muốn đo độ chính xác thì dùng bộ câu kiểm thử riêng, không dùng hàm này.
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass

from llvt_ai_service.application.model_manager import ProviderSet
from llvt_ai_service.domain.enums import Language

logger = logging.getLogger("llvt.benchmark")

SAMPLE_RATE = 16000
SAMPLE_SECONDS = 3.0

# Câu mẫu cho khâu MT/TTS — độ dài xấp xỉ một câu nói trong họp.
SAMPLE_TEXT: dict[Language, str] = {
    Language.vi: "Tôi đã hoàn thành phần triển khai và sẽ gửi bản ghi chú sau buổi họp.",
    Language.en: "I have finished the implementation and will send the notes after the meeting.",
    Language.ja: "実装が完了しましたので、会議のあとにメモを送ります。",
    Language.zh: "我已经完成了实现，会议结束后会把笔记发给大家。",
}


@dataclass
class BenchmarkResult:
    vad_ms: int
    asr_ms: int
    mt_ms: int
    tts_ms: int | None  # None khi ngôn ngữ đích chưa có voice TTS
    total_ms: int
    source: Language
    target: Language
    audio_ms: int


def _speech_like_pcm(seconds: float, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Sóng tổng hợp có formant + nhịp âm tiết ~4 Hz để VAD nhận là tiếng nói."""
    n = int(sample_rate * seconds)
    out = bytearray()
    for i in range(n):
        t = i / sample_rate
        envelope = 0.5 * (1 + math.sin(2 * math.pi * 4 * t))
        sample = envelope * (
            math.sin(2 * math.pi * 130 * t)
            + 0.5 * math.sin(2 * math.pi * 260 * t)
            + 0.3 * math.sin(2 * math.pi * 520 * t)
        )
        value = int(max(-1.0, min(1.0, sample / 1.8)) * 0.6 * 32767)
        out += value.to_bytes(2, "little", signed=True)
    return bytes(out)


async def _warm_up(providers: ProviderSet, source: Language, target: Language) -> None:
    """Chạy trước mỗi khâu một lần, KHÔNG tính giờ.

    Bắt buộc: TTS nạp voice lười theo ngôn ngữ, còn MT/ASR tốn thêm thời gian cho
    lần suy luận đầu (dựng graph, cấp phát bộ nhớ thiết bị). Đo lần chạy nguội sẽ
    ra con số vô nghĩa — thực đo trên máy dev: lần đầu 34.7 s, các lần sau 1.7 s.
    """
    short_pcm = _speech_like_pcm(0.6)
    stream = providers.vad.open_stream()
    stream.accept(short_pcm, SAMPLE_RATE)
    stream.flush()
    await providers.asr.transcribe(short_pcm, source, SAMPLE_RATE)
    warm = await providers.mt.translate("xin chào", source, target)
    try:
        await providers.tts.synthesize(warm.translated_text, target)
    except NotImplementedError:
        pass


async def run_benchmark(
    providers: ProviderSet, source: Language, target: Language
) -> BenchmarkResult:
    await _warm_up(providers, source, target)

    pcm = _speech_like_pcm(SAMPLE_SECONDS)
    audio_ms = int(SAMPLE_SECONDS * 1000)

    started = time.perf_counter()

    vad_started = time.perf_counter()
    stream = providers.vad.open_stream()
    stream.accept(pcm, SAMPLE_RATE)
    stream.flush()
    vad_ms = int((time.perf_counter() - vad_started) * 1000)

    asr_started = time.perf_counter()
    await providers.asr.transcribe(pcm, source, SAMPLE_RATE)
    asr_ms = int((time.perf_counter() - asr_started) * 1000)

    text = SAMPLE_TEXT[source]
    mt_started = time.perf_counter()
    translation = await providers.mt.translate(text, source, target)
    mt_ms = int((time.perf_counter() - mt_started) * 1000)

    tts_ms: int | None = None
    try:
        tts_started = time.perf_counter()
        await providers.tts.synthesize(translation.translated_text, target)
        tts_ms = int((time.perf_counter() - tts_started) * 1000)
    except NotImplementedError:
        # Bốn ngôn ngữ trong phạm vi đồ án đều đã có voice; nhánh này chỉ còn cho
        # trường hợp máy chưa tải được model của khâu TTS cho ngôn ngữ đó.
        logger.info("Bỏ qua khâu TTS: chưa có voice cho %s", target.value)

    return BenchmarkResult(
        vad_ms=vad_ms,
        asr_ms=asr_ms,
        mt_ms=mt_ms,
        tts_ms=tts_ms,
        total_ms=int((time.perf_counter() - started) * 1000),
        source=source,
        target=target,
        audio_ms=audio_ms,
    )
