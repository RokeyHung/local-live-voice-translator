"""Chạy liên tục nhiều giờ để kiểm tra ổn định (SPEC `01` §18 tiêu chí 14).

Tiêu chí nghiệm thu số 14 là "chạy liên tục ít nhất 60 phút mà không crash". Bấm tay
60 phút thì không lặp lại được và cũng không ai ngồi canh, nên bài đó được viết thành
script: script đóng vai client, nói chuyện với AI service **đang chạy** đúng bằng giao
thức WebSocket mà desktop dùng.

Chạy:

    make service                       # cửa sổ 1 — service phải đang chạy
    make soak                          # cửa sổ 2 — mặc định 60 phút
    uv run python scripts/soak.py --minutes 5 --json soak.json

Mỗi vòng lặp mô phỏng một lượt nói: giữ PTT → phát audio theo **đúng nhịp thời gian
thực** (không dồn cục, vì dồn cục sẽ đo ra một thứ khác hẳn) → nhả PTT để chốt câu →
chờ pipeline chạy xong → nghỉ một nhịp rồi lặp lại.

Script theo dõi ba thứ, tương ứng ba kiểu hỏng hay gặp khi chạy dài:

- **Sập/đứt kết nối** — WebSocket rớt hoặc service chết giữa chừng.
- **Rò rỉ bộ nhớ** — RSS lấy định kỳ từ ``GET /api/resources``; tăng đều theo thời
  gian là dấu hiệu rò.
- **Trôi độ trễ** — so độ trễ 10% số câu đầu với 10% số câu cuối; chậm dần nghĩa là
  có thứ gì đó tích tụ (hàng đợi, cache, phân mảnh bộ nhớ).

Script KHÔNG đo độ chính xác (xem ``accuracy.py``) và cũng không thay cho phép đo độ
trễ một câu (xem ``POST /api/benchmark``): audio ở đây là sóng tổng hợp.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import math
import shutil
import statistics
import subprocess
import time
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Protocol

SAMPLE_RATE = 16000
DEFAULT_HTTP = "http://127.0.0.1:8756"
DEFAULT_WS = "ws://127.0.0.1:8756/ws"

# Chờ tối đa cho MỘT câu chạy hết pipeline. Rộng tay: preset Quality trên máy yếu,
# lần đầu tiên còn phải nạp model (hàng chục giây) nếu service khởi động chưa nạp.
UTTERANCE_TIMEOUT_S = 180.0


class Connection(Protocol):
    """Kênh WS tối thiểu — để test chạy được driver này qua TestClient của FastAPI."""

    async def send(self, message: dict[str, Any]) -> None: ...

    async def recv(self) -> dict[str, Any]: ...


ResourceSampler = Callable[[], Awaitable[dict[str, Any] | None]]


# ---------- nguồn audio ----------


def load_media_pcm(path: Path) -> bytes:
    """Đọc file ghi âm bất kể định dạng (wav/mp3/m4a/mov…) → PCM16 mono 16 kHz.

    Dùng khi muốn chạy soak bằng **giọng thật** thay vì sóng tổng hợp: VAD và ASR cư
    xử khác hẳn với tiếng nói thật (ngắt nghỉ, tạp âm, âm lượng thay đổi), nên đây là
    bài kiểm tra ổn định sát thực tế hơn.
    """
    if shutil.which("ffmpeg") is None:
        raise SystemExit("Cần ffmpeg để đọc file audio (brew install ffmpeg).")
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


def slice_utterances(pcm: bytes, seconds: float) -> list[bytes]:
    """Cắt một bản ghi dài thành các lượt nói dài bằng nhau.

    Cắt máy móc theo thời gian (có thể rơi vào giữa từ) là chấp nhận được ở đây: soak
    đo **độ ổn định**, không đo độ chính xác. Muốn từng đoạn là một câu trọn vẹn thì
    dùng `scripts/segment_audio.py` rồi truyền cả thư mục vào `--audio`.
    """
    size = int(SAMPLE_RATE * 2 * seconds)
    chunks = [pcm[i : i + size] for i in range(0, len(pcm), size)]
    # Bỏ mẩu cuối nếu quá ngắn (dưới nửa lượt) — nó chỉ làm nhiễu thống kê độ trễ.
    return [c for c in chunks if len(c) >= size // 2] or [pcm]


def load_utterances(source: Path | None, seconds: float) -> list[bytes]:
    """Danh sách lượt nói sẽ phát lặp đi lặp lại trong suốt bài soak."""
    if source is None:
        return [speech_like_pcm(seconds)]
    if source.is_dir():
        files = sorted(p for p in source.iterdir() if p.suffix.lower() in {".wav", ".mp3", ".m4a"})
        if not files:
            raise SystemExit(f"Không có file audio nào trong {source}")
        return [load_media_pcm(p) for p in files]
    return slice_utterances(load_media_pcm(source), seconds)


def speech_like_pcm(seconds: float, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Sóng có formant + nhịp âm tiết ~4 Hz để Silero VAD nhận là tiếng nói.

    Giống hàm trong ``application/benchmark.py`` (cố ý lặp lại: script không nên phụ
    thuộc vào chi tiết nội bộ của service — nó chạy như một client bên ngoài).
    """
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


# ---------- kết quả ----------


@dataclass
class ResourceSample:
    at_s: int
    rss_mb: float
    cpu_percent: float


@dataclass
class SoakReport:
    target_minutes: float
    elapsed_s: float
    utterances_ok: int
    utterances_failed: int
    errors: dict[str, int] = field(default_factory=dict)
    latency_ms: dict[str, float] = field(default_factory=dict)
    latency_drift_ms: float | None = None
    resources: list[ResourceSample] = field(default_factory=list)
    rss_growth_mb: float | None = None
    disconnected: bool = False
    verdict: str = ""
    notes: list[str] = field(default_factory=list)


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(pct / 100 * (len(ordered) - 1))))
    return ordered[index]


# ---------- driver ----------


@dataclass
class SoakOptions:
    minutes: float = 60.0
    utterance_seconds: float = 3.0
    gap_seconds: float = 1.0
    chunk_ms: int = 320
    source: str = "microphone"  # microphone (có PTT + TTS) | system (chiều nghe)
    mode: str = "speak"
    preset: str = "balanced"
    src_lang: str = "vi"
    tgt_lang: str = "en"
    realtime: bool = True  # phát audio theo nhịp thật; tắt khi chạy test
    sample_every_s: float = 30.0
    # File/thư mục ghi âm thật để phát thay cho sóng tổng hợp (None = sóng tổng hợp).
    audio_path: Path | None = None


async def _recv_until_state(
    conn: Connection, target: str, errors: Counter[str], timeout_s: float
) -> tuple[bool, dict[str, int]]:
    """Đọc event tới khi gặp ``state=target``. Trả (thành công, số ms từng khâu)."""
    stages: dict[str, int] = {}
    deadline = time.monotonic() + timeout_s
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            errors["timeout"] += 1
            return False, stages
        msg = await asyncio.wait_for(conn.recv(), timeout=remaining)
        kind = msg.get("type")
        payload = msg.get("payload", {})
        if kind == "error":
            errors[str(payload.get("code", "unknown"))] += 1
            return False, stages
        if kind == "metrics":
            stages = {
                "asr": int(payload.get("asrMs") or 0),
                "mt": int(payload.get("mtMs") or 0),
                "tts": int(payload.get("ttsMs") or 0),
            }
        if kind == "state" and payload.get("state") == target:
            return True, stages


async def _stream_utterance(conn: Connection, pcm: bytes, opts: SoakOptions, seq: int) -> int:
    """Đẩy audio thành nhiều chunk, giữ nhịp thời gian thực. Trả seq kế tiếp."""
    chunk_bytes = int(SAMPLE_RATE * 2 * opts.chunk_ms / 1000)
    for offset in range(0, len(pcm), chunk_bytes):
        piece = pcm[offset : offset + chunk_bytes]
        await conn.send(
            {
                "type": "audio.chunk",
                "payload": {
                    "source": opts.source,
                    "pcm": base64.b64encode(piece).decode(),
                    "seq": seq,
                    "sampleRate": SAMPLE_RATE,
                },
            }
        )
        seq += 1
        if opts.realtime:
            await asyncio.sleep(len(piece) / 2 / SAMPLE_RATE)
    return seq


async def run_soak(
    conn: Connection,
    opts: SoakOptions,
    sampler: ResourceSampler | None = None,
    on_progress: Callable[[int, float], None] | None = None,
) -> SoakReport:
    """Vòng lặp chính. Tách khỏi phần kết nối để test chạy được qua TestClient."""
    errors: Counter[str] = Counter()
    latencies: list[float] = []
    samples: list[ResourceSample] = []
    ok_count = 0
    failed_count = 0
    disconnected = False
    notes: list[str] = []

    utterances = load_utterances(opts.audio_path, opts.utterance_seconds)
    started = time.monotonic()
    deadline = started + opts.minutes * 60
    next_sample = started
    seq = 0

    try:
        # Bắt tay mở phiên nằm TRONG try: service chết ngay lúc này cũng phải ra báo
        # cáo "TRƯỢT" chứ không phải một traceback.
        await conn.recv()  # state Idle ngay khi kết nối
        await conn.send(
            {
                "type": "session.start",
                "payload": {
                    "mode": opts.mode,
                    "preset": opts.preset,
                    "outgoingSource": opts.src_lang,
                    "outgoingTarget": opts.tgt_lang,
                    "incomingSource": opts.tgt_lang,
                    "incomingTarget": opts.src_lang,
                    "title": f"Soak test {opts.minutes:g} phút",
                },
            }
        )
        await _recv_until_state(conn, "Listening", errors, UTTERANCE_TIMEOUT_S)

        while time.monotonic() < deadline:
            if sampler and time.monotonic() >= next_sample:
                sample = await sampler()
                if sample:
                    samples.append(
                        ResourceSample(
                            at_s=int(time.monotonic() - started),
                            rss_mb=round(float(sample.get("rssMb", 0.0)), 1),
                            cpu_percent=round(float(sample.get("cpuPercent", 0.0)), 1),
                        )
                    )
                next_sample = time.monotonic() + opts.sample_every_s

            turn_started = time.monotonic()
            if opts.source == "microphone":
                await conn.send({"type": "control.ptt", "payload": {"pressed": True}})
                await _recv_until_state(conn, "SpeechDetected", errors, UTTERANCE_TIMEOUT_S)

            # Bản ghi thật thường ngắn hơn bài soak nhiều → phát vòng lại từ đầu.
            pcm = utterances[(ok_count + failed_count) % len(utterances)]
            seq = await _stream_utterance(conn, pcm, opts, seq)

            if opts.source == "microphone":
                # Nhả nút = chốt câu (VadStream.flush) — không có nó thì audio liên tục
                # sẽ không bao giờ có khoảng lặng để VAD tự kết thúc câu.
                await conn.send({"type": "control.ptt", "payload": {"pressed": False}})

            ok, stages = await _recv_until_state(conn, "Listening", errors, UTTERANCE_TIMEOUT_S)
            elapsed_ms = (time.monotonic() - turn_started) * 1000
            if ok:
                ok_count += 1
                # Ưu tiên số đo của service (đã trừ thời gian phát audio); khi thiếu
                # thì lấy thời gian tường và trừ đi phần phát cho khỏi lệch. Trừ theo
                # độ dài THẬT của đoạn vừa phát — bản ghi thật dài ngắn khác nhau.
                played_ms = len(pcm) / 2 / SAMPLE_RATE * 1000
                total = sum(stages.values()) if stages else elapsed_ms - played_ms
                latencies.append(max(0.0, float(total)))
            else:
                failed_count += 1

            if on_progress:
                on_progress(ok_count + failed_count, time.monotonic() - started)

            if opts.gap_seconds and opts.realtime:
                await asyncio.sleep(opts.gap_seconds)

        await conn.send({"type": "session.stop", "payload": {}})
        await _recv_until_state(conn, "Stopped", errors, UTTERANCE_TIMEOUT_S)
    except (asyncio.TimeoutError, ConnectionError, OSError) as exc:
        disconnected = True
        errors[type(exc).__name__] += 1
        notes.append(f"Mất kết nối sau {int(time.monotonic() - started)} s: {exc}")

    elapsed = time.monotonic() - started
    report = SoakReport(
        target_minutes=opts.minutes,
        elapsed_s=round(elapsed, 1),
        utterances_ok=ok_count,
        utterances_failed=failed_count,
        errors=dict(errors),
        resources=samples,
        disconnected=disconnected,
        notes=notes,
    )

    if latencies:
        report.latency_ms = {
            "p50": round(_percentile(latencies, 50), 1),
            "p95": round(_percentile(latencies, 95), 1),
            "max": round(max(latencies), 1),
            "mean": round(statistics.fmean(latencies), 1),
        }
        # Trôi độ trễ: 10% đầu so với 10% cuối (tối thiểu 3 câu mỗi bên mới có nghĩa).
        edge = max(3, len(latencies) // 10)
        if len(latencies) >= edge * 2:
            head = statistics.fmean(latencies[:edge])
            tail = statistics.fmean(latencies[-edge:])
            report.latency_drift_ms = round(tail - head, 1)

    if len(samples) >= 2:
        report.rss_growth_mb = round(samples[-1].rss_mb - samples[0].rss_mb, 1)

    report.verdict, extra_notes = _verdict(report, opts)
    report.notes.extend(extra_notes)
    return report


def _verdict(report: SoakReport, opts: SoakOptions) -> tuple[str, list[str]]:
    """Kết luận đạt/không đạt + các cảnh báo. Chỉ 'sập' mới là trượt."""
    notes: list[str] = []
    failed = report.disconnected or report.elapsed_s < opts.minutes * 60 * 0.95

    if report.utterances_failed:
        notes.append(
            f"{report.utterances_failed} câu lỗi trên tổng "
            f"{report.utterances_ok + report.utterances_failed}."
        )
    if report.rss_growth_mb is not None and report.rss_growth_mb > 200:
        notes.append(
            f"RSS tăng {report.rss_growth_mb:.0f} MB trong lúc chạy — kiểm tra rò rỉ bộ nhớ."
        )
    if report.latency_drift_ms is not None and report.latency_drift_ms > 500:
        notes.append(
            f"Độ trễ cuối cao hơn đầu {report.latency_drift_ms:.0f} ms — có dấu hiệu trôi."
        )
    if failed:
        return "TRƯỢT", notes
    return "ĐẠT", notes


# ---------- kết nối thật ----------


class WebsocketConnection:
    """Bọc client `websockets` cho vừa Protocol ở trên."""

    def __init__(self, ws: Any) -> None:
        self._ws = ws

    async def send(self, message: dict[str, Any]) -> None:
        await self._ws.send(json.dumps(message))

    async def recv(self) -> dict[str, Any]:
        raw = await self._ws.recv()
        return json.loads(raw)


def _http_sampler(base_url: str) -> ResourceSampler:
    def read() -> dict[str, Any] | None:
        try:
            with urllib.request.urlopen(f"{base_url}/api/resources", timeout=5) as resp:  # noqa: S310
                return json.loads(resp.read())
        except (urllib.error.URLError, OSError, json.JSONDecodeError):
            return None

    async def sample() -> dict[str, Any] | None:
        return await asyncio.to_thread(read)

    return sample


def _service_alive(base_url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{base_url}/health", timeout=5) as resp:  # noqa: S310
            return resp.status == 200
    except (urllib.error.URLError, OSError):
        return False


async def main_async(args: argparse.Namespace) -> SoakReport:
    import websockets

    opts = SoakOptions(
        minutes=args.minutes,
        utterance_seconds=args.utterance_seconds,
        gap_seconds=args.gap_seconds,
        source=args.source,
        mode="listen" if args.source == "system" else "speak",
        preset=args.preset,
        src_lang=args.source_lang,
        tgt_lang=args.target_lang,
        sample_every_s=args.sample_every,
        audio_path=args.audio,
    )

    def progress(count: int, elapsed: float) -> None:
        if count % 10 == 0:
            print(f"  … {count} câu / {elapsed / 60:.1f} phút", flush=True)

    async with websockets.connect(args.ws, max_size=None) as ws:
        report = await run_soak(
            WebsocketConnection(ws), opts, sampler=_http_sampler(args.http), on_progress=progress
        )

    if not _service_alive(args.http):
        report.disconnected = True
        report.verdict = "TRƯỢT"
        report.notes.append("Service không trả lời /health sau khi chạy xong.")
    return report


def print_report(report: SoakReport) -> None:
    print()
    print(f"Kết quả: {report.verdict}")
    print(
        f"  Thời lượng      : {report.elapsed_s / 60:.1f} phút (mục tiêu {report.target_minutes:g})"
    )
    print(f"  Câu chạy xong   : {report.utterances_ok} (lỗi: {report.utterances_failed})")
    if report.latency_ms:
        lat = report.latency_ms
        print(
            f"  Độ trễ mỗi câu  : p50 {lat['p50']:.0f} ms · p95 {lat['p95']:.0f} ms "
            f"· max {lat['max']:.0f} ms"
        )
    if report.latency_drift_ms is not None:
        print(f"  Trôi độ trễ     : {report.latency_drift_ms:+.0f} ms (cuối so với đầu)")
    if report.resources:
        first, last = report.resources[0], report.resources[-1]
        peak = max(s.rss_mb for s in report.resources)
        print(f"  RSS service     : {first.rss_mb:.0f} → {last.rss_mb:.0f} MB (đỉnh {peak:.0f} MB)")
    if report.errors:
        print(f"  Lỗi theo mã     : {report.errors}")
    for note in report.notes:
        print(f"  ! {note}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Chạy liên tục để kiểm tra ổn định (tiêu chí nghiệm thu 14)"
    )
    parser.add_argument("--minutes", type=float, default=60.0, help="thời lượng (mặc định 60)")
    parser.add_argument("--ws", default=DEFAULT_WS)
    parser.add_argument("--http", default=DEFAULT_HTTP)
    parser.add_argument("--preset", default="balanced", choices=["fast", "balanced", "quality"])
    parser.add_argument("--source", default="microphone", choices=["microphone", "system"])
    parser.add_argument("--source-lang", default="vi")
    parser.add_argument("--target-lang", default="en")
    parser.add_argument(
        "--audio",
        type=Path,
        help="file ghi âm thật (wav/mp3/m4a/mov) hoặc thư mục chứa các đoạn; "
        "bỏ trống = dùng sóng tổng hợp",
    )
    parser.add_argument("--utterance-seconds", type=float, default=3.0)
    parser.add_argument("--gap-seconds", type=float, default=1.0)
    parser.add_argument("--sample-every", type=float, default=30.0, help="chu kỳ lấy RSS/CPU (s)")
    parser.add_argument("--json", type=Path, help="ghi báo cáo ra file JSON")
    args = parser.parse_args()

    if not _service_alive(args.http):
        raise SystemExit(f"AI service không chạy ở {args.http} — bật bằng `make service` trước.")

    nguon = f"audio thật ({args.audio.name})" if args.audio else "sóng tổng hợp"
    print(
        f"Soak test {args.minutes:g} phút · {args.source} · "
        f"{args.source_lang}→{args.target_lang} · {nguon}"
    )
    print("Lần đầu có thể mất vài chục giây để nạp model.", flush=True)
    report = asyncio.run(main_async(args))
    print_report(report)

    if args.json:
        args.json.write_text(
            json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\nĐã ghi {args.json}")

    if report.verdict != "ĐẠT":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
