"""Đo độ trễ toàn hệ thống trên FLEURS — mục 3(c) biên bản GVHD 19/08.

Chạy đủ chuỗi **VAD → Whisper (ASR) → NLLB (MT) → TTS** trên audio thật của FLEURS và
báo hai chỉ số thầy yêu cầu:

* **Total Inference Time** — tổng thời gian tính toán để biến một đoạn tiếng nói đầu
  vào thành tiếng nói đã dịch.
* **RTF (Real-Time Factor)** = Total Inference Time ÷ thời lượng audio đầu vào.
  RTF < 1 nghĩa là xử lý nhanh hơn thời gian thực. Xem ``docs/17`` về công thức và
  ngưỡng.

    uv run python scripts/eval_latency.py --limit 20
    uv run python scripts/eval_latency.py --source vi --target ja --json do-tre.json

Bảng còn tách riêng cột **chờ chốt** — thời gian từ lúc người nói dứt câu tới lúc VAD
nhả câu ra. Đó KHÔNG phải thời gian tính toán nên không nằm trong RTF, nhưng người dùng
vẫn phải ngồi chờ, nên báo cáo cần có cả hai con số chứ không chỉ RTF.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import fleurs

from llvt_ai_service.application.evaluation import percentile
from llvt_ai_service.application.model_manager import ModelManager, ProviderSet
from llvt_ai_service.domain.enums import Language, Preset

CHUNK_MS = 100  # desktop gửi audio lên theo khối 100 ms


@dataclass
class Sample:
    id: int
    audio_s: float
    segments: int
    vad_ms: float
    asr_ms: float
    mt_ms: float
    tts_ms: float
    total_ms: float
    rtf: float
    wait_ms: float  # chờ chốt câu — không tính vào RTF


async def run_sample(
    providers: ProviderSet, item: fleurs.AudioItem, source: Language, target: Language
) -> Sample:
    stream = providers.vad.open_stream()
    step = fleurs.SAMPLE_RATE * 2 * CHUNK_MS // 1000

    vad_ms = asr_ms = mt_ms = tts_ms = 0.0
    waits: list[float] = []
    fed_ms = 0.0
    segments = []

    for offset in range(0, len(item.pcm), step):
        chunk = item.pcm[offset : offset + step]
        fed_ms += len(chunk) / 2 / fleurs.SAMPLE_RATE * 1000
        started = time.perf_counter()
        cut = stream.accept(chunk, fleurs.SAMPLE_RATE)
        vad_ms += (time.perf_counter() - started) * 1000
        for seg in cut:
            waits.append(max(0.0, fed_ms - seg.ended_at_ms))
            segments.append(seg)
    started = time.perf_counter()
    segments.extend(stream.flush())
    vad_ms += (time.perf_counter() - started) * 1000

    for seg in segments:
        started = time.perf_counter()
        transcript = await providers.asr.transcribe(seg.pcm, source)
        asr_ms += (time.perf_counter() - started) * 1000
        if not transcript.text.strip():
            continue  # đoạn không ra chữ thì pipeline thật cũng dừng ở đây

        started = time.perf_counter()
        translated = await providers.mt.translate(transcript.text, source, target)
        mt_ms += (time.perf_counter() - started) * 1000

        started = time.perf_counter()
        await providers.tts.synthesize(translated.translated_text, target)
        tts_ms += (time.perf_counter() - started) * 1000

    total_ms = vad_ms + asr_ms + mt_ms + tts_ms
    return Sample(
        id=item.id,
        audio_s=round(item.duration_s, 2),
        segments=len(segments),
        vad_ms=round(vad_ms, 1),
        asr_ms=round(asr_ms, 1),
        mt_ms=round(mt_ms, 1),
        tts_ms=round(tts_ms, 1),
        total_ms=round(total_ms, 1),
        rtf=round(total_ms / 1000 / item.duration_s, 3) if item.duration_s else 0.0,
        wait_ms=round(statistics.fmean(waits), 1) if waits else 0.0,
    )


# Dùng lại phân vị của package: màn "Đánh giá" trong app và script này phải ra cùng
# một con số p90 trên cùng bộ dữ liệu.
_pct = percentile


def print_table(samples: list[Sample], direction: str) -> dict[str, float]:
    def col(name: str) -> list[float]:
        return [getattr(s, name) for s in samples]

    summary = {
        "samples": len(samples),
        "audio_seconds": round(sum(col("audio_s")), 1),
        "vad_ms_mean": round(statistics.fmean(col("vad_ms")), 1),
        "asr_ms_mean": round(statistics.fmean(col("asr_ms")), 1),
        "mt_ms_mean": round(statistics.fmean(col("mt_ms")), 1),
        "tts_ms_mean": round(statistics.fmean(col("tts_ms")), 1),
        "total_ms_mean": round(statistics.fmean(col("total_ms")), 1),
        "total_ms_p90": round(_pct(col("total_ms"), 0.9), 1),
        "rtf_mean": round(statistics.fmean(col("rtf")), 3),
        "rtf_p90": round(_pct(col("rtf"), 0.9), 3),
        "wait_ms_mean": round(statistics.fmean(col("wait_ms")), 1),
    }

    print(
        f"\nChiều {direction} — {summary['samples']} mẫu, {summary['audio_seconds']:.0f}s audio\n"
    )
    print(f"  {'VAD':<26}{summary['vad_ms_mean']:>10.1f} ms")
    print(f"  {'ASR (Whisper)':<26}{summary['asr_ms_mean']:>10.1f} ms")
    print(f"  {'MT (NLLB)':<26}{summary['mt_ms_mean']:>10.1f} ms")
    print(f"  {'TTS':<26}{summary['tts_ms_mean']:>10.1f} ms")
    print("  " + "-" * 36)
    print(f"  {'Total Inference Time TB':<26}{summary['total_ms_mean']:>10.1f} ms")
    print(f"  {'Total Inference Time p90':<26}{summary['total_ms_p90']:>10.1f} ms")
    print(f"  {'RTF trung bình':<26}{summary['rtf_mean']:>10.3f}")
    print(f"  {'RTF p90':<26}{summary['rtf_p90']:>10.3f}")
    print()
    print(f"  Ngoài RTF: chờ chốt câu TB {summary['wait_ms_mean']:.0f} ms (độ trễ của VAD,")
    print("  không phải thời gian tính toán — xem docstring).")
    verdict = "ĐẠT (nhanh hơn thời gian thực)" if summary["rtf_p90"] < 1 else "CHƯA ĐẠT"
    print(f"\n  Kết luận theo RTF p90 < 1: {verdict}\n")
    return summary


async def main_async(args: argparse.Namespace) -> None:
    source, target = Language(args.source), Language(args.target)
    if source == target:
        raise SystemExit("--source và --target phải khác nhau")

    manager = ModelManager()
    print(f"Nạp preset {args.preset} (VAD + ASR + MT + TTS)…", flush=True)
    providers = await manager.load_preset(Preset(args.preset))

    samples = []
    for index, item in enumerate(fleurs.load_audio(source, limit=args.limit), start=1):
        samples.append(await run_sample(providers, item, source, target))
        if index % 10 == 0:
            print(f"    {index} mẫu…", flush=True)
    await manager.unload()

    if not samples:
        raise SystemExit("Không lấy được mẫu nào từ FLEURS")

    direction = f"{source.value}→{target.value}"
    summary = print_table(samples, direction)
    if args.json:
        payload = {
            "dataset": "google/fleurs",
            "split": "test",
            "preset": args.preset,
            "direction": direction,
            "rtf_definition": "Total Inference Time / thời lượng audio đầu vào",
            "summary": summary,
            "samples": [asdict(s) for s in samples],
        }
        Path(args.json).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Đã ghi {args.json}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Đo Total Inference Time + RTF trên FLEURS")
    parser.add_argument("--source", default=Language.vi.value, choices=[x.value for x in Language])
    parser.add_argument("--target", default=Language.en.value, choices=[x.value for x in Language])
    parser.add_argument("--limit", type=int, default=20, help="số mẫu (mặc định 20)")
    parser.add_argument(
        "--preset", default=Preset.balanced.value, choices=[p.value for p in Preset]
    )
    parser.add_argument("--json", help="ghi kết quả ra file JSON")
    asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    main()
