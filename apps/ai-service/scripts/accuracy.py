"""Đo độ chính xác ASR + MT trên bộ câu kiểm thử (docs/00 Tuần 8).

Chạy:  uv run python scripts/accuracy.py            # bảng kết quả ra stdout
       uv run python scripts/accuracy.py --json out.json

Hai chế độ, tuỳ trường `audio` trong accuracy_corpus.json:

- **audio thật** (khuyến nghị): file wav 16 kHz mono do người đọc. Đây là con số
  duy nhất dùng được cho báo cáo.
- **round-trip TTS** (khi `audio` rỗng): tự đọc câu tham chiếu bằng chính TTS của
  hệ thống rồi cho ASR nghe lại. Tiện để kiểm tra pipeline còn sống, nhưng WER sẽ
  LẠC QUAN hơn thực tế — giọng tổng hợp sạch, không nhiễu, không giọng vùng miền.
  Script đánh dấu rõ từng dòng để không lẫn hai loại số liệu.

Chỉ số:
- WER cho ASR (khoảng cách Levenshtein trên chuỗi từ, sau khi chuẩn hoá).
- chrF cho MT — F-score trên n-gram ký tự; hợp với tiếng Việt hơn BLEU ở bộ câu
  nhỏ vì không cần tách từ và không bị phạt nặng khi thiếu vài câu.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import unicodedata
import wave
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Language

CORPUS = Path(__file__).parent / "accuracy_corpus.json"
TARGET_SAMPLE_RATE = 16000


# ---------- chỉ số ----------


def normalize(text: str) -> str:
    """Bỏ dấu câu và chuẩn hoá khoảng trắng/hoa thường; giữ nguyên dấu tiếng Việt."""
    text = unicodedata.normalize("NFC", text.strip().lower())
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def word_error_rate(reference: str, hypothesis: str) -> float:
    ref = normalize(reference).split()
    hyp = normalize(hypothesis).split()
    if not ref:
        return 0.0 if not hyp else 1.0

    # Levenshtein trên chuỗi từ, chỉ giữ hai hàng (bộ câu nhỏ nhưng cứ gọn).
    previous = list(range(len(hyp) + 1))
    for i, ref_word in enumerate(ref, start=1):
        current = [i]
        for j, hyp_word in enumerate(hyp, start=1):
            cost = 0 if ref_word == hyp_word else 1
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost))
        previous = current
    return previous[-1] / len(ref)


def char_ngrams(text: str, n: int) -> Counter[str]:
    compact = normalize(text).replace(" ", "")
    return Counter(compact[i : i + n] for i in range(max(0, len(compact) - n + 1)))


def chrf(reference: str, hypothesis: str, max_n: int = 6, beta: float = 2.0) -> float:
    """chrF: trung bình F-score của n-gram ký tự 1..max_n, thiên về recall (beta=2)."""
    precisions: list[float] = []
    recalls: list[float] = []
    for n in range(1, max_n + 1):
        ref_grams = char_ngrams(reference, n)
        hyp_grams = char_ngrams(hypothesis, n)
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


# ---------- chạy bộ câu ----------


@dataclass
class CaseResult:
    id: str
    language: str
    target: str
    audio_source: str  # "recorded" | "tts-roundtrip"
    reference: str
    hypothesis: str
    wer: float
    reference_translation: str
    translation: str
    chrf: float


def read_wav_16k_mono(path: Path) -> bytes:
    with wave.open(str(path), "rb") as wav:
        if wav.getnchannels() != 1 or wav.getframerate() != TARGET_SAMPLE_RATE:
            raise ValueError(
                f"{path.name}: cần wav mono {TARGET_SAMPLE_RATE} Hz, "
                f"đang là {wav.getnchannels()} kênh @ {wav.getframerate()} Hz"
            )
        return wav.readframes(wav.getnframes())


def resample_to_16k(pcm: bytes, sample_rate: int) -> bytes:
    """Lấy mẫu lại tuyến tính — đủ cho việc đưa đầu ra TTS vào ASR."""
    if sample_rate == TARGET_SAMPLE_RATE:
        return pcm
    import array

    samples = array.array("h")
    samples.frombytes(pcm)
    ratio = TARGET_SAMPLE_RATE / sample_rate
    out = array.array("h")
    for i in range(int(len(samples) * ratio)):
        src = i / ratio
        left = int(src)
        right = min(left + 1, len(samples) - 1)
        frac = src - left
        out.append(int(samples[left] * (1 - frac) + samples[right] * frac))
    return out.tobytes()


async def run(corpus_path: Path) -> list[CaseResult]:
    data = json.loads(corpus_path.read_text(encoding="utf-8"))
    cases = data["cases"]

    manager = ModelManager()
    await manager.load_preset(get_settings().default_preset)
    providers = manager.providers

    results: list[CaseResult] = []
    try:
        for case in cases:
            language = Language(case["language"])
            target = Language(case["target"])

            audio_path = (corpus_path.parent / case["audio"]).resolve() if case["audio"] else None
            if audio_path and audio_path.is_file():
                pcm = read_wav_16k_mono(audio_path)
                audio_source = "recorded"
            else:
                spoken = await providers.tts.synthesize(case["transcript"], language)
                pcm = resample_to_16k(spoken.pcm, spoken.sample_rate)
                audio_source = "tts-roundtrip"

            transcript = await providers.asr.transcribe(pcm, language, TARGET_SAMPLE_RATE)
            # Dịch từ câu THAM CHIẾU: tách lỗi của MT khỏi lỗi của ASR.
            translated = await providers.mt.translate(case["transcript"], language, target)

            results.append(
                CaseResult(
                    id=case["id"],
                    language=language.value,
                    target=target.value,
                    audio_source=audio_source,
                    reference=case["transcript"],
                    hypothesis=transcript.text,
                    wer=round(word_error_rate(case["transcript"], transcript.text), 4),
                    reference_translation=case["translation"],
                    translation=translated.translated_text,
                    chrf=round(chrf(case["translation"], translated.translated_text), 4),
                )
            )
            print(f"  {case['id']} ({audio_source}) xong", flush=True)
    finally:
        await manager.unload()
    return results


def report(results: list[CaseResult]) -> None:
    if not results:
        print("Bộ câu rỗng.")
        return

    print()
    print(f"{'ID':<8} {'nguồn':<14} {'WER':>7} {'chrF':>7}  câu ASR nhận được")
    print("-" * 96)
    for r in results:
        print(f"{r.id:<8} {r.audio_source:<14} {r.wer:>7.1%} {r.chrf:>7.1%}  {r.hypothesis[:44]}")

    recorded = [r for r in results if r.audio_source == "recorded"]
    roundtrip = [r for r in results if r.audio_source == "tts-roundtrip"]
    print("-" * 96)
    for label, group in (("audio thật", recorded), ("round-trip TTS", roundtrip)):
        if not group:
            continue
        wer = sum(r.wer for r in group) / len(group)
        score = sum(r.chrf for r in group) / len(group)
        print(
            f"{label:<16} n={len(group):<3} WER trung bình {wer:.1%}   chrF trung bình {score:.1%}"
        )

    if roundtrip:
        print()
        print(
            "LƯU Ý: các dòng 'round-trip TTS' cho ASR nghe lại giọng máy, không phải giọng người —"
        )
        print(
            "       WER sẽ lạc quan hơn thực tế. Muốn số dùng được cho báo cáo thì thu âm thật và"
        )
        print("       điền đường dẫn vào trường `audio` trong accuracy_corpus.json.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Đo độ chính xác ASR + MT")
    parser.add_argument("--corpus", type=Path, default=CORPUS)
    parser.add_argument("--json", type=Path, help="ghi kết quả chi tiết ra file JSON")
    args = parser.parse_args()

    print(f"Bộ câu: {args.corpus}")
    results = asyncio.run(run(args.corpus))
    report(results)

    if args.json:
        args.json.write_text(
            json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nĐã ghi {args.json}")


if __name__ == "__main__":
    main()
