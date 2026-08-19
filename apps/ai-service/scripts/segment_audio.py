"""Cắt một bản ghi dài thành các câu rời để làm bộ đo độ chính xác.

Bộ đo WER cần **từng câu một** kèm câu chữ đúng do người nghe gõ lại. Có sẵn một file
ghi âm/vlog dài thì đây là bước trung gian: script dùng chính Silero VAD của dự án để
tách các đoạn có tiếng nói, ghi mỗi đoạn thành một file wav 16 kHz mono, và sinh sẵn
khung JSON để điền lời.

    uv run python scripts/segment_audio.py video.mov --prefix vlog --limit 20

Kết quả: `scripts/audio/vlog-01.wav`… và `scripts/audio/vlog-draft.json`.

**Việc bắt buộc làm bằng tay sau đó:** nghe từng đoạn, gõ đúng những gì nghe được vào
`transcript`, dịch sang ngôn ngữ đích ở `translation`, rồi chép các case vào
`accuracy_corpus.json`. Không có bước này thì không có WER — lấy chính đầu ra của ASR
làm câu tham chiếu sẽ luôn cho WER ≈ 0% và con số đó vô nghĩa.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import wave
from pathlib import Path

from llvt_ai_service.adapters.vad.silero import SileroVad

SAMPLE_RATE = 16000
AUDIO_DIR = Path(__file__).parent / "audio"

# Giữ đoạn dài vừa một câu nói: quá ngắn thì WER dao động mạnh vì chỉ vài từ, quá dài
# thì gõ lại mệt và một lỗi nhỏ cũng khó soi.
MIN_SECONDS = 1.5
MAX_SECONDS = 12.0


def media_to_pcm(path: Path) -> bytes:
    """Bất kỳ định dạng nào (mov/mp4/mp3/m4a/wav) → PCM16 mono 16 kHz."""
    if shutil.which("ffmpeg") is None:
        raise SystemExit("Cần ffmpeg (brew install ffmpeg / winget install Gyan.FFmpeg).")
    result = subprocess.run(  # noqa: S603 (đường dẫn do người chạy truyền vào)
        [
            "ffmpeg", "-nostdin", "-loglevel", "error",
            "-i", str(path),
            "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le",
            "-f", "s16le", "-",
        ],
        capture_output=True,
    )  # fmt: skip
    if result.returncode != 0:
        raise SystemExit(f"ffmpeg không đọc được {path}: {result.stderr.decode()[:200]}")
    return result.stdout


def write_wav(path: Path, pcm: bytes) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm)


async def segment(pcm: bytes) -> list[tuple[int, int, bytes]]:
    """Trả các đoạn có tiếng nói: (bắt đầu ms, kết thúc ms, pcm)."""
    vad = SileroVad()
    await vad.load()
    stream = vad.open_stream()
    out: list[tuple[int, int, bytes]] = []
    step = SAMPLE_RATE * 2  # đẩy vào từng giây một, giống luồng thật
    for i in range(0, len(pcm), step):
        for seg in stream.accept(pcm[i : i + step], SAMPLE_RATE):
            out.append((seg.started_at_ms, seg.ended_at_ms, seg.pcm))
    for seg in stream.flush():
        out.append((seg.started_at_ms, seg.ended_at_ms, seg.pcm))
    await vad.unload()
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Cắt bản ghi dài thành câu cho bộ đo WER")
    parser.add_argument("media", type=Path, help="file ghi âm/quay màn hình đầu vào")
    parser.add_argument("--prefix", default="rec", help="tiền tố tên file đầu ra")
    parser.add_argument("--language", default="vi", help="ngôn ngữ nói trong bản ghi")
    parser.add_argument("--target", default="en", help="ngôn ngữ đích để dịch")
    parser.add_argument("--limit", type=int, default=20, help="số câu giữ lại (0 = tất cả)")
    parser.add_argument("--min-seconds", type=float, default=MIN_SECONDS)
    parser.add_argument("--max-seconds", type=float, default=MAX_SECONDS)
    parser.add_argument("--out-dir", type=Path, default=AUDIO_DIR)
    args = parser.parse_args()

    pcm = media_to_pcm(args.media)
    print(f"Đầu vào: {args.media.name} — {len(pcm) / 2 / SAMPLE_RATE:.0f} giây")

    segments = asyncio.run(segment(pcm))
    keep = [s for s in segments if args.min_seconds <= (s[1] - s[0]) / 1000 <= args.max_seconds]
    print(f"VAD tách được {len(segments)} đoạn, {len(keep)} đoạn dài phù hợp.")
    if args.limit:
        keep = keep[: args.limit]

    args.out_dir.mkdir(parents=True, exist_ok=True)
    cases = []
    for index, (start_ms, end_ms, seg_pcm) in enumerate(keep, start=1):
        name = f"{args.prefix}-{index:02d}.wav"
        write_wav(args.out_dir / name, seg_pcm)
        cases.append(
            {
                "id": f"{args.prefix}-{index:02d}",
                "language": args.language,
                "target": args.target,
                "audio": f"audio/{name}",
                "_source_time": f"{start_ms / 1000:.1f}s → {end_ms / 1000:.1f}s",
                "transcript": "",
                "translation": "",
            }
        )

    draft = args.out_dir / f"{args.prefix}-draft.json"
    draft.write_text(
        json.dumps(
            {
                "_note": [
                    "Khung nháp do segment_audio.py sinh ra.",
                    "Nghe từng file wav và gõ ĐÚNG lời vào `transcript`, dịch vào `translation`.",
                    "Xong thì chép các case sang accuracy_corpus.json rồi chạy `make accuracy`.",
                    "Bỏ `_source_time` khi chép — nó chỉ để tiện tua lại bản gốc.",
                ],
                "cases": cases,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    total = sum((e - s) for s, e, _ in keep) / 1000
    print(f"Đã ghi {len(cases)} file wav vào {args.out_dir} ({total:.0f} giây tiếng nói).")
    print(f"Khung điền lời: {draft}")
    print("Bước tiếp theo: nghe và gõ lời vào `transcript` — đây là việc không tự động được.")


if __name__ == "__main__":
    main()
