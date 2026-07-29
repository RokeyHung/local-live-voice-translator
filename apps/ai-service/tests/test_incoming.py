"""Test chiều incoming (âm thanh hệ thống) + số đo độ trễ (Tuần 7 / Tuần 8).

Chiều incoming là giọng phía cuộc họp: chạy liên tục, KHÔNG chịu PTT/mute, và
không tổng hợp TTS (nếu không sẽ nói chồng lên người thật đang nói).

Provider ASR/MT/TTS là bản giả (conftest); VAD là Silero thật.
"""

from __future__ import annotations

import base64

import numpy as np
from fastapi.testclient import TestClient

from llvt_ai_service.app import app

SR = 16000


def _voiced_pcm(seconds: float) -> np.ndarray:
    t = np.arange(int(SR * seconds)) / SR
    env = 0.5 * (1 + np.sin(2 * np.pi * 4 * t))  # nhịp âm tiết ~4 Hz
    sig = env * (
        np.sin(2 * np.pi * 130 * t)
        + 0.5 * np.sin(2 * np.pi * 260 * t)
        + 0.3 * np.sin(2 * np.pi * 520 * t)
    )
    sig = sig / np.max(np.abs(sig)) * 0.6
    return (sig * 32767).astype(np.int16)


def _b64_voiced(seconds: float) -> str:
    return base64.b64encode(_voiced_pcm(seconds).tobytes()).decode()


def _silence(seconds: float) -> str:
    return base64.b64encode(np.zeros(int(SR * seconds), dtype=np.int16).tobytes()).decode()


def _start_listen(ws) -> None:
    ws.receive_json()  # Idle
    ws.send_json(
        {
            "type": "session.start",
            "payload": {"mode": "listen", "incomingSource": "en", "incomingTarget": "vi"},
        }
    )
    assert ws.receive_json()["payload"]["state"] == "Listening"


def _collect(ws, target: str, limit: int = 40) -> list[dict]:
    """Đọc event tới khi gặp state=target; trả về toàn bộ message đã nhận."""
    out: list[dict] = []
    for _ in range(limit):
        msg = ws.receive_json()
        out.append(msg)
        assert msg["type"] != "error", msg
        if msg["type"] == "state" and msg["payload"]["state"] == target:
            break
    return out


def test_system_audio_runs_without_ptt():
    """Audio nguồn `system` chạy pipeline dù chưa bao giờ giữ PTT."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start_listen(ws)
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "system", "pcm": _b64_voiced(1.2)}}
            )
            # Khoảng lặng cuối để VAD chốt câu (chiều incoming không có PTT để flush).
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "system", "pcm": _silence(1.0)}}
            )
            types = [m["type"] for m in _collect(ws, "Completed")]
            assert "asr.final" in types
            assert "mt.result" in types


def test_incoming_does_not_synthesize():
    """Chiều incoming chỉ hiện phụ đề — không phát TTS đè lên người đang nói."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start_listen(ws)
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "system", "pcm": _b64_voiced(1.2)}}
            )
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "system", "pcm": _silence(1.0)}}
            )
            types = [m["type"] for m in _collect(ws, "Completed")]
            assert "tts.audio" not in types


def test_pipeline_reports_stage_timings():
    """Mỗi câu xong phải kèm số đo thật của từng khâu (client khỏi phải tự ước lượng)."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start_listen(ws)
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "system", "pcm": _b64_voiced(1.2)}}
            )
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "system", "pcm": _silence(1.0)}}
            )
            messages = _collect(ws, "Completed")

            asr = next(m for m in messages if m["type"] == "asr.final")
            mt = next(m for m in messages if m["type"] == "mt.result")
            metrics = next(m for m in messages if m["type"] == "metrics")

            assert isinstance(asr["payload"]["processingMs"], int)
            assert isinstance(mt["payload"]["processingMs"], int)
            assert isinstance(metrics["payload"]["asrMs"], int)
            assert isinstance(metrics["payload"]["mtMs"], int)
            # Chiều incoming không tổng hợp giọng nên không có số đo TTS.
            assert metrics["payload"]["ttsMs"] is None
