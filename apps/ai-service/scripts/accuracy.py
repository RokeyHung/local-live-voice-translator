"""Đo độ chính xác ASR + MT trên bộ câu kiểm thử (docs/00 Tuần 8).

Chạy:  uv run python scripts/accuracy.py            # bảng kết quả ra stdout
       uv run python scripts/accuracy.py --json out.json

Hai chế độ, tuỳ trường `audio` trong accuracy_corpus.json:

- **audio thật** (khuyến nghị): file ghi âm do người đọc, đặt trong ``scripts/audio/``
  rồi điền tên vào trường ``audio``. Nhận wav/mp3/m4a — thứ gì không phải wav PCM16
  mono 16 kHz sẽ được ffmpeg chuyển giúp. Đây là con số duy nhất dùng cho báo cáo.
- **round-trip TTS** (khi `audio` rỗng): tự đọc câu tham chiếu bằng chính TTS của
  hệ thống rồi cho ASR nghe lại. Tiện để kiểm tra pipeline còn sống, nhưng WER sẽ
  LẠC QUAN hơn thực tế — giọng tổng hợp sạch, không nhiễu, không giọng vùng miền.
  Script đánh dấu rõ từng dòng để không lẫn hai loại số liệu.

Chỉ số:
- WER cho ASR (vi/en) và CER (zh/ja) — hai thứ tiếng đó không tách từ bằng khoảng
  trắng nên chấm WER là chấm theo chỗ Whisper tình cờ chèn dấu cách.
- chrF cho MT — F-score trên n-gram ký tự; hợp với tiếng Việt hơn BLEU ở bộ câu
  nhỏ vì không cần tách từ và không bị phạt nặng khi thiếu vài câu.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import tempfile
import wave
from dataclasses import asdict, dataclass
from pathlib import Path

from llvt_ai_service.application.evaluation import chrf, error_rate, metric_name
from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Language

CORPUS = Path(__file__).parent / "accuracy_corpus.json"
TARGET_SAMPLE_RATE = 16000


# Độ đo dùng lại của `application/evaluation.py` — màn "Đánh giá" trong app và script
# này phải chấm GIỐNG NHAU, hai bản chép tay là hai chỗ để lệch nhau. Bản trong package
# còn có CER cho zh/ja, thứ bản cũ ở đây thiếu.


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
    metric: str  # "WER" cho vi/en · "CER" cho zh/ja
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


def convert_to_wav_16k_mono(path: Path) -> bytes:
    """Chuyển mp3/m4a/wav-khác-chuẩn về PCM16 mono 16 kHz bằng ffmpeg.

    Điện thoại và máy ghi âm xuất ra mp3/m4a stereo 44.1 kHz, trong khi ASR chỉ nhận
    đúng một định dạng (PCM16 mono 16 kHz). Bắt người dùng tự convert trước khi đưa
    vào bộ câu là chỗ dễ sai, nên script tự làm — miễn là máy có ffmpeg.
    """
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            f"{path.name}: cần ffmpeg để đọc định dạng này.\n"
            "  macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg\n"
            f"  Hoặc tự chuyển sang wav: ffmpeg -i {path.name} -ac 1 -ar 16000 out.wav"
        )
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "converted.wav"
        result = subprocess.run(  # noqa: S603 (đường dẫn từ bộ câu của chính người dùng)
            [
                "ffmpeg", "-nostdin", "-loglevel", "error", "-y",
                "-i", str(path),
                "-ac", "1", "-ar", str(TARGET_SAMPLE_RATE), "-c:a", "pcm_s16le",
                str(out),
            ],
            capture_output=True,
            text=True,
        )  # fmt: skip
        if result.returncode != 0:
            raise RuntimeError(f"{path.name}: ffmpeg lỗi — {result.stderr.strip()[:200]}")
        return read_wav_16k_mono(out)


def load_audio(path: Path) -> bytes:
    """Đọc file audio tham chiếu bất kể định dạng; trả PCM16 mono 16 kHz."""
    if path.suffix.lower() == ".wav":
        try:
            return read_wav_16k_mono(path)
        except (ValueError, wave.Error):
            # wav stereo / 44.1 kHz / nén — vẫn dùng được, chỉ cần đi qua ffmpeg.
            return convert_to_wav_16k_mono(path)
    return convert_to_wav_16k_mono(path)


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
            if audio_path and not audio_path.is_file():
                # Khai báo file rồi mà gõ sai đường dẫn thì phải BÁO, không được lặng lẽ
                # rơi về round-trip: người chạy sẽ tưởng mình đang có số đo giọng thật.
                raise FileNotFoundError(f"{case['id']}: không thấy file audio {audio_path}")
            if audio_path:
                pcm = load_audio(audio_path)
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
                    wer=round(error_rate(case["transcript"], transcript.text, language), 4),
                    metric=metric_name(language),
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
    print(f"{'ID':<8} {'nguồn':<14} {'lỗi':>7} {'chrF':>7}  câu ASR nhận được")
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
            f"{label:<16} n={len(group):<3} "
            f"{group[0].metric} trung bình {wer:.1%}   chrF trung bình {score:.1%}"
        )

    if roundtrip:
        print()
        print(
            "LƯU Ý: các dòng 'round-trip TTS' cho ASR nghe lại giọng máy, không phải giọng người —"
        )
        print("       số sẽ lạc quan hơn thực tế. Muốn số dùng được cho báo cáo thì thu âm thật và")
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
