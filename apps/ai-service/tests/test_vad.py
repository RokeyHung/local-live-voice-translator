"""Test Silero VAD adapter (Tuần 2).

- Logic phân đoạn (buffer/cắt/timestamp/max-cut/min-filter) test bằng iterator giả
  để xác định, không phụ thuộc model.
- Một test tích hợp chạy model Silero thật trên tín hiệu tổng hợp offline.
"""

from __future__ import annotations

import asyncio
import base64

import numpy as np
from fastapi.testclient import TestClient

from llvt_ai_service.adapters.vad.silero import SileroVad, SileroVadStream, VadParams
from llvt_ai_service.app import app

WINDOW = 512
SR = 16000


class FakeIterator:
    """Trả event theo kịch bản {chỉ_số_lần_gọi: event}; đếm lại khi reset."""

    def __init__(self, plan: dict[int, dict[str, int]]):
        self.plan = plan
        self.n = 0

    def __call__(self, x: np.ndarray) -> dict[str, int] | None:
        event = self.plan.get(self.n)
        self.n += 1
        return event

    def reset_states(self) -> None:
        self.n = 0


def _windows(values: list[int]) -> bytes:
    """Mỗi cửa sổ 512 mẫu mang một giá trị int16 để dễ kiểm tra lát cắt."""
    return np.repeat(np.array(values, dtype=np.int16), WINDOW).tobytes()


def test_segment_slice_and_timestamps():
    # start ở lần gọi 2 (mẫu 1024), end ở lần gọi 5 (mẫu 3072).
    it = FakeIterator({2: {"start": 1024}, 5: {"end": 3072}})
    # soft_silence == min_silence → hangover = 0, chốt ngay khi VAD báo 'end':
    # test này chỉ quan tâm tới lát cắt và timestamp.
    stream = SileroVadStream(
        it,
        VadParams(
            min_speech_ms=50,
            speech_pad_ms=40,
            max_speech_ms=20000,
            min_silence_ms=100,
            soft_silence_ms=100,
        ),
    )

    segments = stream.accept(_windows(list(range(10))), SR)

    assert len(segments) == 1
    seg = segments[0]
    assert seg.started_at_ms == 64  # 1000 * 1024 / 16000
    assert seg.ended_at_ms == 192  # 1000 * 3072 / 16000
    # Đoạn gồm cửa sổ 2..5 (giá trị 2,3,4,5).
    got = np.frombuffer(seg.pcm, dtype=np.int16)
    assert got.size == 2048
    assert set(np.unique(got).tolist()) == {2, 3, 4, 5}


def test_short_segment_discarded():
    it = FakeIterator({2: {"start": 1024}, 3: {"end": 1536}})  # 512 mẫu = 32 ms
    stream = SileroVadStream(
        it, VadParams(min_speech_ms=50, min_silence_ms=100, soft_silence_ms=100)
    )
    assert stream.accept(_windows(list(range(6))), SR) == []


def test_max_speech_force_cut():
    it = FakeIterator({0: {"start": 0}})  # không có 'end' → ép cắt theo max_speech
    # backoff/carry = 0 → cắt đúng tại con trỏ, tức hành vi trần trụi của max_speech.
    stream = SileroVadStream(  # 96 ms = 1536 mẫu
        it, VadParams(min_speech_ms=10, max_speech_ms=96, backoff_ms=0, carry_ms=0)
    )

    segments = stream.accept(_windows(list(range(6))), SR)

    assert len(segments) == 2
    assert [s.started_at_ms for s in segments] == [0, 96]
    assert all(np.frombuffer(s.pcm, dtype=np.int16).size == 1536 for s in segments)
    # Đánh dấu forced để phía sau biết câu vẫn đang tiếp diễn, không phải người nói dừng.
    assert all(s.forced for s in segments)


def test_force_cut_backs_off_to_quietest_frame():
    """Cắt cứng phải rơi vào khung yên nhất trong cửa sổ lùi, không phải ngay con trỏ."""
    it = FakeIterator({0: {"start": 0}})
    stream = SileroVadStream(
        # max 320 ms = 10 cửa sổ, lùi tối đa 128 ms = 4 cửa sổ cuối.
        it,
        VadParams(min_speech_ms=32, max_speech_ms=320, backoff_ms=128, carry_ms=0),
    )

    values = [3000] * 10
    values[7] = 1  # khung 7 gần như im lặng → phải cắt ở đây
    segments = stream.accept(_windows(values), SR)

    assert len(segments) == 1
    # Tâm khung 7 = mẫu 3840 = 240 ms, thay vì con trỏ ở 320 ms.
    assert segments[0].ended_at_ms == 240


def test_short_pause_does_not_split_sentence():
    """Nhịp ngắt ngắn giữa câu: VAD báo end rồi start lại ngay → vẫn là một câu.

    Đây là lý do VADIterator được cấu hình ở ngưỡng im lặng NGẮN còn phần chờ thêm
    nằm ở SileroVadStream: nói chậm không bị băm thành nhiều mảnh rời rạc.
    """
    it = FakeIterator({0: {"start": 0}, 3: {"end": 1536}, 4: {"start": 1600}})
    stream = SileroVadStream(
        it,
        VadParams(
            min_speech_ms=10,
            min_silence_ms=300,
            soft_silence_ms=100,  # hangover = 200 ms
            soft_max_ms=10000,
            max_speech_ms=10000,
        ),
    )

    assert stream.accept(_windows(list(range(8))), SR) == []
    # Nhả PTT mới chốt — và chốt thành ĐÚNG MỘT câu chạy suốt từ đầu.
    [seg] = stream.flush()
    assert seg.started_at_ms == 0
    assert not seg.forced


def test_long_pause_ends_sentence_after_hangover():
    it = FakeIterator({0: {"start": 0}, 3: {"end": 1536}})
    stream = SileroVadStream(
        it,
        VadParams(
            min_speech_ms=10,
            min_silence_ms=300,
            soft_silence_ms=100,
            soft_max_ms=10000,
            max_speech_ms=10000,
        ),
    )

    segments = stream.accept(_windows(list(range(16))), SR)

    assert len(segments) == 1
    assert segments[0].ended_at_ms == 96  # 1536 mẫu — không ôm theo phần im lặng
    assert not segments[0].forced


def test_long_sentence_closes_at_first_dip():
    """Câu đã vượt soft_max thì chốt ngay ở nhịp hụt hơi đầu tiên, khỏi chờ min_silence."""
    it = FakeIterator({0: {"start": 0}, 5: {"end": 3072}})
    stream = SileroVadStream(
        it,
        VadParams(
            min_speech_ms=10,
            min_silence_ms=300,
            soft_silence_ms=100,
            soft_max_ms=100,  # 3072 mẫu = 192 ms đã vượt ngưỡng này
            max_speech_ms=10000,
        ),
    )

    segments = stream.accept(_windows(list(range(8))), SR)

    assert len(segments) == 1
    assert segments[0].ended_at_ms == 192


def test_params_clamped_to_sane_range():
    p = VadParams(min_silence_ms=200, soft_silence_ms=400, soft_max_ms=9000, max_speech_ms=5000)
    assert p.soft_silence_ms == 200  # không thể dài hơn ngưỡng đầy đủ
    assert p.soft_max_ms == 5000  # không thể vượt trần cứng


def test_vad_tuning_matches_params():
    """config.presets.VadTuning và adapter VadParams phải trùng tên trường.

    model_manager.vad_params() chuyển thẳng dict giữa hai lớp; lệch tên là vỡ ngay
    lúc chạy chứ không có type checker nào bắt được.
    """
    from dataclasses import fields

    from llvt_ai_service.config.presets import VadTuning

    assert {f.name for f in fields(VadTuning)} == {f.name for f in fields(VadParams)}


def test_vad_overrides_applied(monkeypatch):
    from llvt_ai_service.application import model_manager as mm
    from llvt_ai_service.config.presets import get_preset_config
    from llvt_ai_service.domain.enums import Preset

    class _Settings:
        vad_overrides = {"max_speech_ms": 4000, "threshold": 0.6, "khong_co_that": 1}

    monkeypatch.setattr(mm, "get_settings", lambda: _Settings())
    params = mm.vad_params(get_preset_config(Preset.balanced))

    assert params.max_speech_ms == 4000
    assert params.threshold == 0.6
    # Khoá lạ bị bỏ qua chứ không làm hỏng cả lượt nạp model.
    assert params.min_speech_ms == VadParams().min_speech_ms


def test_accepts_split_across_chunks():
    # Nửa cửa sổ mỗi lần → stream phải gộp phần dư 'pending'.
    it = FakeIterator({0: {"start": 0}, 1: {"end": 1024}})
    stream = SileroVadStream(
        it, VadParams(min_speech_ms=10, min_silence_ms=100, soft_silence_ms=100)
    )
    half = np.zeros(WINDOW // 2, dtype=np.int16).tobytes()

    out: list = []
    for _ in range(4):  # 4 nửa = 2 cửa sổ
        out += stream.accept(half, SR)
    assert len(out) == 1
    assert out[0].ended_at_ms == 64  # 1024 mẫu


def test_wrong_sample_rate_raises():
    stream = SileroVadStream(FakeIterator({}), VadParams())
    try:
        stream.accept(b"\x00\x00", 8000)
        raise AssertionError("phải raise ValueError với sample rate != 16000")
    except ValueError:
        pass


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


def test_integration_real_silero():
    vad = SileroVad(VadParams(min_silence_ms=200, speech_pad_ms=100, min_speech_ms=150))
    asyncio.run(vad.load())

    # Tín hiệu giọng-tổng-hợp 1 s + 0.5 s im lặng.
    voiced = _voiced_pcm(1.0)
    silence = np.zeros(SR // 2, dtype=np.int16)
    pcm = np.concatenate((voiced, silence)).tobytes()

    stream = vad.open_stream()
    segments: list = []
    step = 1600 * 2  # 100 ms mỗi lần (int16 = 2 byte)
    for i in range(0, len(pcm), step):
        segments += stream.accept(pcm[i : i + step], SR)

    assert len(segments) >= 1
    longest = max(segments, key=lambda s: s.ended_at_ms - s.started_at_ms)
    assert longest.ended_at_ms - longest.started_at_ms > 500  # ~1 s giọng nói
    assert longest.started_at_ms < 300

    # Stream mới trên im lặng thuần → không có đoạn nào (state độc lập).
    silent_stream = vad.open_stream()
    assert silent_stream.accept(np.zeros(SR, dtype=np.int16).tobytes(), SR) == []


def test_ws_audio_triggers_pipeline():
    """Contract desktop→service: audio.chunk giọng nói → VAD cắt segment → cả pipeline chạy.

    Với provider giả (conftest), luồng chạy trọn vẹn VAD→ASR→MT→TTS và phát đủ event
    tới trạng thái Completed — chứng minh VAD cắt được utterance và đẩy qua đúng luồng WS.
    """
    pcm = np.concatenate((_voiced_pcm(1.0), np.zeros(int(SR * 0.6), dtype=np.int16)))
    b64 = base64.b64encode(pcm.tobytes()).decode()

    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Idle
            ws.send_json(
                {
                    "type": "session.start",
                    "payload": {
                        "mode": "speak",
                        "outgoingSource": "vi",
                        "outgoingTarget": "en",
                    },
                }
            )
            assert ws.receive_json()["payload"]["state"] == "Listening"
            # Push-to-talk là gate mặc định: phải giữ nút thì mic mới được xử lý.
            ws.send_json({"type": "control.ptt", "payload": {"pressed": True}})
            assert ws.receive_json()["payload"]["state"] == "SpeechDetected"
            ws.send_json(
                {"type": "audio.chunk", "payload": {"source": "microphone", "pcm": b64, "seq": 0}}
            )
            seen = []
            for _ in range(15):
                msg = ws.receive_json()
                seen.append(msg["type"])
                assert msg["type"] != "error"
                if msg["type"] == "state" and msg["payload"]["state"] == "Completed":
                    break
            # Pipeline đã hoàn tất một chiều outgoing: có ASR, MT và TTS.
            assert {"asr.final", "mt.result", "tts.audio"} <= set(seen)
