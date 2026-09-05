"""Chạy một bộ câu mẫu qua hệ thống và tự chấm điểm — màn "Đánh giá" trong app.

Đây là việc GVHD giao ở biên bản 19/08 mục 3d: chọn câu mẫu **có bản dịch tham chiếu**,
chạy qua hệ thống, app tự tính **độ trễ** và **chất lượng**. Trước đợt này chỉ có bản
CLI (`scripts/accuracy.py`), phải mở terminal mới xem được số.

Ba điều đáng nói về phương pháp:

**Độ đo tự cài, không dùng jiwer/sacrebleu.** Hai gói đó nằm ở nhóm phụ thuộc `eval`
(không có trong bản cài của người dùng), và tokenizer `flores200` của sacrebleu còn
**tải thêm một model** lần đầu dùng — trái với "cài xong là chạy offline". Phần tính ở
đây là Levenshtein và chrF thuần Python, chạy trên vài trăm câu thì thừa nhanh.

Đổi lại, số ở đây **không thay thế** được `make eval-asr` / `make eval-mt`: bộ script
đó dùng jiwer + spBLEU (tokenizer flores200) nên số của nó đặt cạnh số công bố của
NLLB-200 là so sánh được. Màn hình trong app là để **thử nhanh và so các cấu hình với
nhau**; bảng đưa vào báo cáo vẫn lấy từ script.

**Dịch từ câu THAM CHIẾU, không dịch từ câu ASR vừa nhận ra.** Nếu dịch từ đầu ra của
ASR thì lỗi hai khâu cộng dồn và không biết chất lượng dịch thật sự là bao nhiêu.

**WER hay CER tuỳ ngôn ngữ.** zh/ja không tách từ bằng khoảng trắng nên chấm WER là
chấm theo chỗ Whisper tình cờ chèn dấu cách — dùng CER. Cùng quy tắc với
`scripts/metrics.py`, xem docstring bên đó để biết lý do đầy đủ.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Awaitable, Callable

from llvt_ai_service.application.model_manager import ProviderSet
from llvt_ai_service.domain.enums import Language

logger = logging.getLogger("llvt.evaluation")

SAMPLE_RATE = 16000

# Ngôn ngữ không tách từ bằng khoảng trắng → chấm theo ký tự.
CHARACTER_LANGUAGES = frozenset({Language.zh, Language.ja})

_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_SPACES = re.compile(r"\s+")


# --- độ đo ----------------------------------------------------------------


def metric_name(language: Language) -> str:
    return "CER" if language in CHARACTER_LANGUAGES else "WER"


def normalize(text: str) -> str:
    """Bỏ dấu câu, gộp khoảng trắng, hạ chữ hoa. GIỮ dấu tiếng Việt vì nó mang nghĩa."""
    text = unicodedata.normalize("NFC", text.strip().casefold())
    return _SPACES.sub(" ", _PUNCT.sub(" ", text)).strip()


def _levenshtein(reference: list[str], hypothesis: list[str]) -> int:
    """Khoảng cách sửa đổi, chỉ giữ hai hàng của bảng quy hoạch động."""
    previous = list(range(len(hypothesis) + 1))
    for i, ref_token in enumerate(reference, start=1):
        current = [i]
        for j, hyp_token in enumerate(hypothesis, start=1):
            cost = 0 if ref_token == hyp_token else 1
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost))
        previous = current
    return previous[-1]


def error_rate(reference: str, hypothesis: str, language: Language) -> float:
    """WER (vi/en) hoặc CER (zh/ja) của MỘT câu.

    Câu tham chiếu rỗng: trả 0 nếu máy cũng không nghe ra gì, ngược lại 1 — không có
    mẫu số để chia, mà coi như "đúng hoàn toàn" thì sai hẳn.
    """
    if language in CHARACTER_LANGUAGES:
        ref = list(normalize(reference).replace(" ", ""))
        hyp = list(normalize(hypothesis).replace(" ", ""))
    else:
        ref = normalize(reference).split()
        hyp = normalize(hypothesis).split()
    if not ref:
        return 0.0 if not hyp else 1.0
    return _levenshtein(ref, hyp) / len(ref)


def _char_ngrams(text: str, n: int) -> Counter[str]:
    compact = normalize(text).replace(" ", "")
    return Counter(compact[i : i + n] for i in range(max(0, len(compact) - n + 1)))


def chrf(reference: str, hypothesis: str, max_n: int = 6, beta: float = 2.0) -> float:
    """chrF: trung bình F-score của n-gram ký tự 1..max_n, thiên về recall (beta=2).

    Chọn chrF thay vì BLEU cho màn hình này vì nó không cần tách từ (hợp cả bốn ngôn
    ngữ của đề tài) và ổn định hơn hẳn trên bộ vài chục câu.
    """
    precisions: list[float] = []
    recalls: list[float] = []
    for n in range(1, max_n + 1):
        ref_grams = _char_ngrams(reference, n)
        hyp_grams = _char_ngrams(hypothesis, n)
        if not ref_grams or not hyp_grams:
            continue
        overlap = sum((ref_grams & hyp_grams).values())
        precisions.append(overlap / sum(hyp_grams.values()))
        recalls.append(overlap / sum(ref_grams.values()))
    if not precisions:
        return 0.0
    precision = sum(precisions) / len(precisions)
    recall = sum(recalls) / len(recalls)
    if precision + recall == 0:
        return 0.0
    beta_sq = beta * beta
    return (1 + beta_sq) * precision * recall / (beta_sq * precision + recall)


def percentile(values: list[float], fraction: float) -> float:
    """Phân vị theo chỉ số gần nhất — p90 của 10 mẫu là mẫu lớn thứ 9.

    Báo p90 chứ không báo trung bình cho độ trễ: người dùng cảm nhận được đúng những
    câu chậm nhất, còn trung bình thì che mất chúng.

    Công thức phải TRÙNG với `scripts/eval_latency.py` (nó gọi lại hàm này), nếu không
    thì cùng một bộ dữ liệu sẽ ra hai con số p90 khác nhau tuỳ chỗ đọc.
    """
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(fraction * (len(ordered) - 1)))]


# --- dữ liệu --------------------------------------------------------------


@dataclass
class EvaluationCase:
    """Một câu mẫu: câu gốc chuẩn + bản dịch tham chiếu (và audio nếu có)."""

    id: str
    language: Language
    target: Language
    transcript: str  # câu gốc do người viết — vừa là tham chiếu ASR, vừa là đầu vào MT
    translation: str  # bản dịch tham chiếu
    # PCM 16-bit mono 16 kHz của giọng đọc thật. Rỗng = chưa có bản ghi, khâu chạy sẽ
    # tự đọc câu tham chiếu bằng TTS (xem `audio_source` của kết quả).
    pcm: bytes = b""


@dataclass
class CaseResult:
    id: str
    language: str
    target: str
    # "recorded" = giọng người thật · "tts-roundtrip" = máy tự đọc rồi tự nghe lại
    audio_source: str
    reference: str
    hypothesis: str
    error_rate: float
    metric: str  # "WER" | "CER"
    reference_translation: str
    translation: str
    chrf: float
    asr_ms: int
    mt_ms: int
    audio_ms: int


@dataclass
class EvaluationReport:
    cases: list[CaseResult] = field(default_factory=list)
    # Tổng hợp: lỗi trung bình, chrF trung bình, độ trễ p50/p90 và RTF.
    error_rate: float = 0.0
    chrf: float = 0.0
    asr_p50_ms: int = 0
    asr_p90_ms: int = 0
    mt_p50_ms: int = 0
    mt_p90_ms: int = 0
    total_p90_ms: int = 0
    rtf_p90: float = 0.0
    # True khi CÓ ÍT NHẤT một câu chạy bằng giọng tổng hợp — số liệu lạc quan hơn
    # thực tế, giao diện phải nói rõ chứ không được để người đọc tưởng là giọng thật.
    has_synthetic_audio: bool = False
    cancelled: bool = False


# --- tiến trình -----------------------------------------------------------


class EvaluationProgress:
    """Tiến trình lượt đánh giá đang chạy — cùng lối với `transcribe.progress`.

    Đo bằng **số câu đã chạy xong** chứ không ước lượng thời gian: chạy tới câu thứ 7
    trên 20 thì đúng là 35%, dù máy nhanh hay chậm.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._active = False
        self._total = 0
        self._done = 0
        self._current = ""
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
        with self._lock:
            if self._active:
                self._cancel = True

    def begin(self, total: int) -> None:
        with self._lock:
            self._active = True
            self._total = total
            self._done = 0
            self._current = ""
            self._error = None
            self._cancel = False

    def advance(self, done: int, current: str) -> None:
        with self._lock:
            self._done = done
            self._current = current

    def fail(self, message: str) -> None:
        with self._lock:
            self._active = False
            self._error = message

    def finish(self) -> None:
        with self._lock:
            self._active = False
            self._cancel = False

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            percent = round(self._done / self._total * 100, 1) if self._total else None
            return {
                "active": self._active,
                "total": self._total,
                "done": self._done,
                "currentCase": self._current,
                "percent": percent,
                "error": self._error,
                "cancelling": self._cancel and self._active,
            }


# Mỗi lần chỉ chạy một lượt (API trả 409 nếu đang bận) nên dùng chung một bản.
progress = EvaluationProgress()


# --- chạy -----------------------------------------------------------------


async def evaluate(
    providers: ProviderSet,
    cases: list[EvaluationCase],
    *,
    should_stop: Callable[[], Awaitable[bool]] | None = None,
) -> EvaluationReport:
    """Chạy từng câu qua ASR + MT rồi chấm điểm. Blocking theo nghĩa chạy tuần tự.

    Dừng giữa chừng thì trả về phần đã chạy được kèm ``cancelled=True`` — số của 8 câu
    đầu vẫn dùng được, vứt đi thì phí.
    """
    progress.begin(len(cases))
    report = EvaluationReport()
    totals: list[float] = []
    rtfs: list[float] = []
    try:
        for index, case in enumerate(cases):
            if should_stop is not None and await should_stop():
                report.cancelled = True
                break
            progress.advance(index, case.id)
            result = await _run_case(providers, case)
            report.cases.append(result)
            if result.audio_source == "tts-roundtrip":
                report.has_synthetic_audio = True
            totals.append(result.asr_ms + result.mt_ms)
            if result.audio_ms > 0:
                rtfs.append((result.asr_ms + result.mt_ms) / result.audio_ms)
            progress.advance(index + 1, case.id)
    except Exception as exc:
        progress.fail(str(exc))
        raise
    finally:
        if not report.cancelled:
            progress.finish()
        else:
            progress.finish()

    _summarise(report, totals, rtfs)
    return report


async def _run_case(providers: ProviderSet, case: EvaluationCase) -> CaseResult:
    pcm, audio_source = case.pcm, "recorded"
    if not pcm:
        # Chưa có bản ghi: đọc câu tham chiếu bằng chính TTS của hệ thống rồi cho ASR
        # nghe lại. Tiện để thử pipeline, nhưng giọng tổng hợp sạch và đều nên WER sẽ
        # LẠC QUAN hơn giọng người thật — kết quả đánh dấu rõ để không lẫn hai loại số.
        spoken = await providers.tts.synthesize(case.transcript, case.language)
        pcm = _resample_to_16k(spoken.pcm, spoken.sample_rate)
        audio_source = "tts-roundtrip"

    started = time.perf_counter()
    transcript = await providers.asr.transcribe(pcm, case.language, SAMPLE_RATE)
    asr_ms = int((time.perf_counter() - started) * 1000)

    started = time.perf_counter()
    # Dịch từ câu THAM CHIẾU, không dịch từ `transcript.text`: tách lỗi MT khỏi lỗi ASR.
    translated = await providers.mt.translate(case.transcript, case.language, case.target)
    mt_ms = int((time.perf_counter() - started) * 1000)

    return CaseResult(
        id=case.id,
        language=case.language.value,
        target=case.target.value,
        audio_source=audio_source,
        reference=case.transcript,
        hypothesis=transcript.text,
        error_rate=round(error_rate(case.transcript, transcript.text, case.language), 4),
        metric=metric_name(case.language),
        reference_translation=case.translation,
        translation=translated.translated_text,
        chrf=round(chrf(case.translation, translated.translated_text), 4),
        asr_ms=asr_ms,
        mt_ms=mt_ms,
        audio_ms=int(len(pcm) / 2 / SAMPLE_RATE * 1000),
    )


def _summarise(report: EvaluationReport, totals: list[float], rtfs: list[float]) -> None:
    """Gộp kết quả từng câu thành bảng tổng.

    Lỗi và chrF lấy **trung bình theo câu** (không gộp theo độ dài) vì bộ mẫu ở màn
    này thường chỉ vài chục câu và người dùng đọc bảng theo từng dòng — số tổng phải
    khớp với cái họ thấy. Bảng đưa vào báo cáo thì dùng `make eval-asr`, ở đó tính gộp.
    """
    if not report.cases:
        return
    report.error_rate = round(sum(c.error_rate for c in report.cases) / len(report.cases), 4)
    report.chrf = round(sum(c.chrf for c in report.cases) / len(report.cases), 4)
    asr = [float(c.asr_ms) for c in report.cases]
    mt = [float(c.mt_ms) for c in report.cases]
    report.asr_p50_ms = int(percentile(asr, 0.5))
    report.asr_p90_ms = int(percentile(asr, 0.9))
    report.mt_p50_ms = int(percentile(mt, 0.5))
    report.mt_p90_ms = int(percentile(mt, 0.9))
    report.total_p90_ms = int(percentile(totals, 0.9))
    report.rtf_p90 = round(percentile(rtfs, 0.9), 3)


def _resample_to_16k(pcm: bytes, sample_rate: int) -> bytes:
    """Nội suy tuyến tính về 16 kHz (TTS trả 22,05 kHz)."""
    if sample_rate == SAMPLE_RATE or not pcm:
        return pcm
    import numpy as np

    samples = np.frombuffer(pcm, dtype="<i2")
    target_n = int(samples.size * SAMPLE_RATE / sample_rate)
    if target_n <= 0:
        return b""
    src_index = np.linspace(0, samples.size - 1, target_n)
    resampled = np.interp(src_index, np.arange(samples.size), samples.astype(np.float32))
    return resampled.astype(np.int16).tobytes()


async def _noop() -> None:  # pragma: no cover - giữ asyncio import có ý nghĩa
    await asyncio.sleep(0)
