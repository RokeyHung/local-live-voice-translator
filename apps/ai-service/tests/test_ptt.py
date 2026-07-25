"""Test Push-to-talk gating + mute + flush khi nhả nút (Tuần 7).

PTT là gate mặc định cho chiều outgoing (mic): audio chỉ được xử lý khi đang GIỮ
nút và không mute. Khi nhả nút, VAD được flush để chốt câu đang nói dở (client đã
ngừng gửi audio nên VAD không còn thấy khoảng lặng để tự phát hiện 'end').

Provider ASR/MT/TTS là bản giả (conftest); VAD là Silero thật.
"""

from __future__ import annotations

import base64

import numpy as np
from fastapi.testclient import TestClient

from llvt_ai_service.app import app

SR = 16000
PIPELINE_EVENTS = {"asr.final", "mt.result", "tts.audio"}


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


def _start_speak(ws) -> None:
    ws.receive_json()  # Idle
    ws.send_json(
        {
            "type": "session.start",
            "payload": {"mode": "speak", "outgoingSource": "vi", "outgoingTarget": "en"},
        }
    )
    assert ws.receive_json()["payload"]["state"] == "Listening"


def _drain_until_state(ws, target: str, limit: int = 30) -> list[str]:
    """Đọc event tới khi gặp state=target; trả danh sách type đã thấy."""
    seen: list[str] = []
    for _ in range(limit):
        msg = ws.receive_json()
        seen.append(msg["type"])
        assert msg["type"] != "error", msg
        if msg["type"] == "state" and msg["payload"]["state"] == target:
            break
    return seen


def test_audio_dropped_without_ptt():
    """Không giữ PTT → audio mic bị bỏ, pipeline không chạy."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start_speak(ws)
            # Gửi audio mà KHÔNG giữ PTT.
            ws.send_json(
                {
                    "type": "audio.chunk",
                    "payload": {"source": "microphone", "pcm": _b64_voiced(1.0)},
                }
            )
            ws.send_json({"type": "session.stop", "payload": {}})
            seen = _drain_until_state(ws, "Stopped")
            assert PIPELINE_EVENTS.isdisjoint(seen), f"audio phải bị bỏ, nhưng thấy: {seen}"


def test_mute_blocks_audio_even_while_ptt():
    """Mute đè cả PTT: đang giữ nút mà mute thì audio vẫn bị bỏ."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start_speak(ws)
            ws.send_json({"type": "control.ptt", "payload": {"pressed": True}})
            assert ws.receive_json()["payload"]["state"] == "SpeechDetected"
            ws.send_json({"type": "control.mute", "payload": {"muted": True}})
            assert ws.receive_json()["payload"]["state"] == "Listening"
            ws.send_json(
                {
                    "type": "audio.chunk",
                    "payload": {"source": "microphone", "pcm": _b64_voiced(1.0)},
                }
            )
            ws.send_json({"type": "session.stop", "payload": {}})
            seen = _drain_until_state(ws, "Stopped")
            assert PIPELINE_EVENTS.isdisjoint(seen), f"mute phải chặn audio, nhưng thấy: {seen}"


def test_flush_on_ptt_release_finalizes_utterance():
    """Giữ PTT + gửi giọng KHÔNG có khoảng lặng cuối → nhả nút mới chốt được câu."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start_speak(ws)
            ws.send_json({"type": "control.ptt", "payload": {"pressed": True}})
            assert ws.receive_json()["payload"]["state"] == "SpeechDetected"
            # Giọng liên tục, không kèm im lặng → VAD chưa tự phát hiện 'end'.
            ws.send_json(
                {
                    "type": "audio.chunk",
                    "payload": {"source": "microphone", "pcm": _b64_voiced(1.2)},
                }
            )
            # Nhả nút → flush chốt câu → cả pipeline chạy rồi quay lại Listening.
            ws.send_json({"type": "control.ptt", "payload": {"pressed": False}})
            seen = _drain_until_state(ws, "Listening")
            assert PIPELINE_EVENTS <= set(seen), f"flush phải chạy trọn pipeline, thấy: {seen}"
