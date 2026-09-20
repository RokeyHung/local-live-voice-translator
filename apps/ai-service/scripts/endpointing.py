"""Đo cơ chế tách câu (endpointing) trên một bản ghi thật, để dò ngưỡng VAD.

Câu hỏi mà script này trả lời: *người dùng nói xong thì bao lâu sau hệ thống mới bắt
đầu dịch?* Đây là phần độ trễ do VAD chịu trách nhiệm — nó nằm TRƯỚC toàn bộ thời gian
suy luận của ASR/MT/TTS, và trước khi sửa thì chính nó gây ra chuyện "phải chờ câu dài
5–10 giây" (biên bản GVHD 19/08 mục 4.2).

    uv run python scripts/endpointing.py meeting.mov
    uv run python scripts/endpointing.py meeting.mov --preset fast --preset quality
    uv run python scripts/endpointing.py meeting.mov --set max_speech_ms=4000

Script KHÔNG nạp ASR/MT/TTS, chỉ Silero VAD, nên chạy trong vài giây và so được nhiều
bộ ngưỡng trên cùng một file. Audio được đẩy vào từng khối 100 ms đúng như desktop gửi
lên, nên "chờ chốt" đo được là con số thật chứ không phải tính lý thuyết.

Cột kết quả:

* **đoạn** — số câu VAD tách ra.
* **dài TB / p90** — độ dài các câu. Câu quá dài nghĩa là ngưỡng đang lỏng.
* **cắt cứng** — số câu bị cắt vì chạm ``max_speech_ms`` chứ không phải vì người nói
  dừng. Tỉ lệ cao = đang băm giữa câu, MT sẽ phải dịch mảnh vụn.
* **chờ chốt** — trung bình và p90 của khoảng cách từ lúc câu kết thúc tới lúc VAD nhả
  nó ra. Đây là đại lượng cần tối ưu; đổi ``min_silence_ms``/``soft_silence_ms`` là
  thấy ngay.
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
from dataclasses import asdict, dataclass, fields, replace
from pathlib import Path

from segment_audio import SAMPLE_RATE, media_to_pcm

from llvt_ai_service.adapters.vad.silero import SileroVad, VadParams
from llvt_ai_service.config.presets import PRESETS, VadTuning
from llvt_ai_service.domain.enums import Preset

CHUNK_MS = 100  # desktop gửi audio lên theo khối 100 ms

# Ngưỡng TRƯỚC khi sửa, để bảng có mốc so sánh: chờ đủ 300 ms im lặng, không có chế độ
# chốt sớm, và trần 20 giây — tức là nói liên tục thì 20 giây mới ra một câu.
LEGACY = VadParams(
    min_silence_ms=300,
    soft_silence_ms=300,
    soft_max_ms=20000,
    max_speech_ms=20000,
    backoff_ms=0,
    carry_ms=0,
)


@dataclass
class Row:
    label: str
    segments: int
    mean_len: float
    p90_len: float
    forced: int
    mean_wait: float
    p90_wait: float


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round(q * (len(ordered) - 1)))
    return ordered[index]


async def measure(label: str, params: VadParams, pcm: bytes) -> Row:
    vad = SileroVad(params)
    await vad.load()
    stream = vad.open_stream()

    step = SAMPLE_RATE * 2 * CHUNK_MS // 1000  # byte cho mỗi khối 100 ms
    lengths: list[float] = []
    waits: list[float] = []
    forced = 0
    fed_ms = 0.0

    for offset in range(0, len(pcm), step):
        chunk = pcm[offset : offset + step]
        fed_ms += len(chunk) / 2 / SAMPLE_RATE * 1000
        for seg in stream.accept(chunk, SAMPLE_RATE):
            lengths.append((seg.ended_at_ms - seg.started_at_ms) / 1000)
            # Đã đẩy tới fed_ms mà giờ mới nhả đoạn kết thúc ở ended_at_ms → phần chênh
            # là thời gian người dùng ngồi chờ sau khi đã nói xong.
            waits.append(max(0.0, (fed_ms - seg.ended_at_ms) / 1000))
            forced += int(seg.forced)
    for seg in stream.flush():
        lengths.append((seg.ended_at_ms - seg.started_at_ms) / 1000)
        forced += int(seg.forced)

    await vad.unload()
    return Row(
        label=label,
        segments=len(lengths),
        mean_len=statistics.fmean(lengths) if lengths else 0.0,
        p90_len=_pct(lengths, 0.9),
        forced=forced,
        mean_wait=statistics.fmean(waits) if waits else 0.0,
        p90_wait=_pct(waits, 0.9),
    )


def _apply(base: VadParams, overrides: dict[str, float]) -> VadParams:
    known = {f.name for f in fields(VadParams)}
    unknown = sorted(set(overrides) - known)
    if unknown:
        raise SystemExit(f"--set không có ngưỡng {unknown}. Chọn trong: {sorted(known)}")
    values = {k: (float(v) if k == "threshold" else int(v)) for k, v in overrides.items()}
    return replace(base, **values)


def _from_tuning(tuning: VadTuning) -> VadParams:
    return VadParams(**asdict(tuning))


def _print(rows: list[Row], duration_s: float) -> None:
    print(f"\nBản ghi dài {duration_s:.0f} giây\n")
    head = f"{'cấu hình':<28}{'đoạn':>6}{'dài TB':>9}{'dài p90':>9}{'cắt cứng':>11}"
    head += f"{'chờ TB':>9}{'chờ p90':>9}"
    print(head)
    print("-" * len(head))
    for r in rows:
        pct = f"{r.forced} ({r.forced * 100 // max(1, r.segments)}%)"
        print(
            f"{r.label:<28}{r.segments:>6}{r.mean_len:>8.2f}s{r.p90_len:>8.2f}s"
            f"{pct:>11}{r.mean_wait:>8.2f}s{r.p90_wait:>8.2f}s"
        )
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Đo endpointing của VAD trên bản ghi thật")
    parser.add_argument("media", type=Path, help="file ghi âm/quay màn hình có tiếng nói")
    parser.add_argument(
        "--preset",
        action="append",
        choices=[p.value for p in PRESETS],
        help="preset cần đo (lặp lại được); mặc định đo cả ba",
    )
    parser.add_argument(
        "--set",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="đè một ngưỡng lên preset balanced, vd --set max_speech_ms=4000",
    )
    parser.add_argument(
        "--no-legacy", action="store_true", help="bỏ dòng so sánh với ngưỡng cũ (20 s)"
    )
    args = parser.parse_args()

    pcm = media_to_pcm(args.media)
    duration_s = len(pcm) / 2 / SAMPLE_RATE
    print(f"Đầu vào: {args.media.name} — {duration_s:.0f} giây")

    configs: list[tuple[str, VadParams]] = []
    if not args.no_legacy:
        configs.append(("trước khi sửa (max 20s)", LEGACY))

    presets = [Preset(p) for p in (args.preset or [p.value for p in PRESETS])]
    for preset in presets:
        tuning = PRESETS[preset].vad
        configs.append((f"{preset.value} ({tuning.max_speech_ms}ms)", _from_tuning(tuning)))

    if args.set:
        overrides = {}
        for item in args.set:
            key, _, value = item.partition("=")
            if not value:
                raise SystemExit(f"--set cần dạng KEY=VALUE, nhận {item!r}")
            overrides[key.strip()] = float(value)
        base = _from_tuning(PRESETS[Preset.balanced].vad)
        label = "tuỳ chỉnh: " + ", ".join(f"{k}={int(v)}" for k, v in overrides.items())
        configs.append((label[:28], _apply(base, overrides)))

    rows = [asyncio.run(measure(label, params, pcm)) for label, params in configs]
    _print(rows, duration_s)


if __name__ == "__main__":
    main()
