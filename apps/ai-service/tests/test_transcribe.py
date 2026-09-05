"""Test nhập tệp âm thanh theo lô (`POST /api/transcribe`).

Các test đi qua HTTP dùng provider ASR/MT giả (conftest) nhưng **VAD là Silero thật**,
nên phần cắt đoạn được kiểm tra trên tín hiệu tổng hợp giống nhịp nói, đúng như luồng
realtime. Vài test gọi thẳng `transcribe_audio` với cả bộ provider giả ở dưới, để dựng
được đúng tình huống cần (huỷ giữa chừng) mà không phụ thuộc VAD cắt ra mấy đoạn.
"""

from __future__ import annotations

import asyncio
import io
import wave
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application.transcribe import (
    AudioDecodeError,
    decode_pcm16,
    progress,
    transcribe_audio,
)
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript, TranslationResult, VadSegment

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


def _speech_then_silence() -> bytes:
    """1,2 s "tiếng nói" rồi 1 s im lặng — đủ để VAD chốt một đoạn."""
    return np.concatenate(
        (_voiced_pcm(1.2), np.zeros(SR, dtype=np.int16)),
    ).tobytes()


def _wav_bytes(samples: np.ndarray, rate: int = SR, channels: int = 1) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(samples.tobytes())
    return buffer.getvalue()


# Provider giả cho các test gọi thẳng `transcribe_audio` (không qua HTTP): mỗi khúc
# audio ra đúng một đoạn, ASR/MT trả chuỗi cố định.
class OneSegmentVadStream:
    def accept(self, pcm: bytes, sample_rate: int = SR) -> list[VadSegment]:
        return [VadSegment(pcm=pcm, started_at_ms=0, ended_at_ms=100)]

    def reset(self) -> None: ...

    def flush(self) -> list[VadSegment]:
        return []


class FakeAsr:
    async def transcribe(self, _pcm: bytes, language: Language, _rate: int = SR) -> AsrTranscript:
        return AsrTranscript(text="xin chào", language=language, processing_ms=1)


class FakeMt:
    async def translate(self, text: str, src: Language, tgt: Language) -> TranslationResult:
        return TranslationResult(
            source_text=text,
            translated_text=f"[{tgt.value}] {text}",
            source_language=src,
            target_language=tgt,
        )


def _fake_providers(asr: object | None = None, diarizer: object | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        vad=SimpleNamespace(open_stream=OneSegmentVadStream),
        asr=asr or FakeAsr(),
        mt=FakeMt(),
        tts=None,
        diarizer=diarizer,
    )


# --- giải mã đầu vào ------------------------------------------------------


def test_decode_raw_pcm_passthrough():
    pcm = _voiced_pcm(0.5).tobytes()
    assert decode_pcm16(pcm) == pcm


def test_decode_wav_downmix_and_resample():
    """WAV stereo 48 kHz (curl/ffmpeg hay xuất ra) được trộn mono và resample về 16 kHz."""
    mono = np.full(48000, 1000, dtype=np.int16)  # 1 giây @ 48 kHz
    stereo = np.repeat(mono, 2)  # cùng giá trị ở cả hai kênh
    wav = _wav_bytes(stereo, rate=48000, channels=2)

    decoded = np.frombuffer(decode_pcm16(wav), dtype="<i2")
    assert abs(decoded.size - SR) <= 1  # 1 giây ở 16 kHz
    assert np.allclose(decoded, 1000, atol=1)  # trộn hai kênh giống nhau thì giữ nguyên biên độ


def test_decode_rejects_garbage():
    with pytest.raises(AudioDecodeError):
        decode_pcm16(b"")
    with pytest.raises(AudioDecodeError):
        decode_pcm16(b"RIFF khong phai wav")
    with pytest.raises(AudioDecodeError):
        decode_pcm16(b"\x01\x02\x03")  # PCM 16-bit không thể lẻ byte


# --- endpoint -------------------------------------------------------------


def test_transcribe_returns_segments_and_translation():
    with TestClient(app) as client:
        res = client.post(
            "/api/transcribe",
            params={"source": "en", "target": "vi", "name": "hop-tuan.mp3"},
            content=_speech_then_silence(),
            headers={"Content-Type": "application/octet-stream"},
        )
        assert res.status_code == 200, res.text
        body = res.json()

        assert body["source"] == "en"
        assert body["target"] == "vi"
        assert body["audioMs"] == pytest.approx(2200, abs=50)
        assert len(body["segments"]) >= 1

        segment = body["segments"][0]
        assert segment["text"]  # ASR giả trả " xin chào"
        assert segment["translatedText"].startswith("[")  # MT giả gắn tiền tố mã đích
        assert 0 <= segment["startedAtMs"] < segment["endedAtMs"] <= body["audioMs"] + 500


def test_transcribe_without_target_skips_translation():
    with TestClient(app) as client:
        res = client.post(
            "/api/transcribe",
            params={"source": "en", "save": "false"},
            content=_speech_then_silence(),
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["target"] is None
        assert body["sessionId"] == ""
        assert all(s["translatedText"] is None for s in body["segments"])


def test_transcribe_writes_history_session():
    """Kết quả vào thẳng lịch sử để dùng lại phần tìm kiếm/xuất tệp của màn Lịch sử."""
    with TestClient(app) as client:
        res = client.post(
            "/api/transcribe",
            params={"source": "en", "target": "vi", "name": "hop-tuan.mp3"},
            content=_speech_then_silence(),
        )
        session_id = res.json()["sessionId"]
        assert session_id

        detail = client.get(f"/api/sessions/{session_id}").json()
        assert detail["title"] == "hop-tuan.mp3"
        assert detail["endedAtMs"] is not None  # phiên đóng ngay, không phải "đang chạy"
        assert len(detail["utterances"]) == len(res.json()["segments"])
        # Nguồn `file` phân biệt câu nhập từ tệp với câu thu từ mic/loa.
        assert {u["source"] for u in detail["utterances"]} == {"file"}


def test_transcribe_history_disabled_returns_no_session():
    with TestClient(app) as client:
        client.put("/api/config", json={"preset": "balanced", "historyEnabled": False})
        res = client.post(
            "/api/transcribe",
            params={"source": "en", "target": "vi", "name": "riêng tư.m4a"},
            content=_speech_then_silence(),
        )
        assert res.json()["sessionId"] == ""
        assert client.get("/api/sessions").json() == []


def test_transcribe_rejects_bad_audio():
    with TestClient(app) as client:
        res = client.post("/api/transcribe", params={"source": "en"}, content=b"\x01\x02\x03")
        assert res.status_code == 400
        assert "PCM" in res.json()["detail"]


def test_progress_clears_when_run_is_cancelled():
    """Huỷ giữa chừng phải dọn cờ "đang chạy".

    `asyncio.CancelledError` là BaseException — quên bắt riêng thì cờ kẹt ở `True` và
    mọi lần nhập tệp sau đều bị 409 cho tới khi khởi động lại service.
    """

    class CancellingAsr:
        async def transcribe(self, *_args: object, **_kwargs: object) -> None:
            raise asyncio.CancelledError

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(
            transcribe_audio(
                _fake_providers(CancellingAsr()),
                _speech_then_silence(),
                Language.en,
                file_name="x.wav",
            )
        )

    snapshot = progress.snapshot()
    assert snapshot["active"] is False
    assert snapshot["error"] is None  # huỷ không phải lỗi


def test_cancel_stops_early_and_keeps_finished_segments():
    """Huỷ trả về phần đã chạy được, không vứt đi và không ném lỗi."""

    calls = {"n": 0}

    async def stop_after_first_chunk() -> bool:
        calls["n"] += 1
        return calls["n"] > 1

    # 15 giây audio = 3 khúc 5 giây; dừng sau khúc đầu → chỉ có 1 đoạn.
    long_pcm = np.tile(_voiced_pcm(1.0), 15).tobytes()

    result = asyncio.run(
        transcribe_audio(
            _fake_providers(),
            long_pcm,
            Language.en,
            Language.vi,
            file_name="dai.wav",
            should_stop=stop_after_first_chunk,
        )
    )

    assert result.cancelled is True
    assert len(result.segments) == 1  # phần đã chạy được vẫn được giữ
    assert result.segments[0].translated_text == "[vi] xin chào"
    assert result.audio_ms == pytest.approx(15000, abs=50)  # vẫn là độ dài cả tệp
    assert progress.snapshot()["active"] is False
    assert progress.snapshot()["error"] is None  # huỷ không phải lỗi


def test_cancel_endpoint_is_a_noop_when_idle():
    with TestClient(app) as client:
        assert client.post("/api/transcribe/cancel").status_code == 204
        assert client.get("/api/transcribe/progress").json()["cancelling"] is False


def test_bad_request_releases_the_slot():
    """Tệp hỏng không được để service kẹt ở trạng thái "đang bận"."""
    with TestClient(app) as client:
        assert client.post("/api/transcribe", params={"source": "en"}, content=b"\x01").status_code
        assert client.get("/api/transcribe/progress").json()["active"] is False
        # Lần sau vẫn nhận được tệp tử tế, không dính 409.
        ok = client.post(
            "/api/transcribe",
            params={"source": "en", "save": "false"},
            content=_speech_then_silence(),
        )
        assert ok.status_code == 200


def test_transcribe_same_language_is_not_a_translation():
    with TestClient(app) as client:
        res = client.post(
            "/api/transcribe",
            params={"source": "en", "target": "en", "save": "false"},
            content=_speech_then_silence(),
        )
        body = res.json()
        assert body["target"] is None
        assert all(s["translatedText"] is None for s in body["segments"])


def test_ws_rejects_file_source_on_audio_chunk():
    """`file` là nguồn của luồng nhập tệp; lọt vào /ws sẽ bị coi nhầm là mic."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Idle
            ws.send_json(
                {
                    "type": "session.start",
                    "payload": {"mode": "listen", "incomingSource": "en", "incomingTarget": "vi"},
                }
            )
            ws.receive_json()  # Listening
            ws.send_json({"type": "audio.chunk", "payload": {"source": "file", "pcm": ""}})
            message = ws.receive_json()
            assert message["type"] == "error"
            assert message["payload"]["code"] == "bad_message"


def test_progress_is_idle_after_run():
    with TestClient(app) as client:
        client.post(
            "/api/transcribe",
            params={"source": "en", "name": "a.wav", "save": "false"},
            content=_speech_then_silence(),
        )
        body = client.get("/api/transcribe/progress").json()
        assert body["active"] is False
        assert body["fileName"] == "a.wav"
        assert body["percent"] == 100.0
        assert body["error"] is None
