"""Test lịch sử phiên: adapter SQLite, chính sách bật/tắt lưu và REST.

Adapter được test trực tiếp (không qua HTTP) vì nó là nơi có SQL; phần REST chỉ cần
một lượt end-to-end qua WebSocket để chứng minh câu dịch thật sự chảy vào DB.
"""

from __future__ import annotations

import asyncio
import base64

import numpy as np
from fastapi.testclient import TestClient

from llvt_ai_service.adapters.persistence.memory import InMemorySessionRepository
from llvt_ai_service.adapters.persistence.sqlite import SqliteSessionRepository
from llvt_ai_service.app import app
from llvt_ai_service.application.history import HistoryPolicy
from llvt_ai_service.domain.enums import (
    AudioSource,
    Language,
    Preset,
    SessionMode,
    UtteranceStatus,
)
from llvt_ai_service.domain.models import Session, SessionConfig, Utterance

SR = 16000


def _session(title: str = "Phiên A", started: int = 1000) -> Session:
    return Session(
        config=SessionConfig(mode=SessionMode.two_way, preset=Preset.balanced),
        started_at_ms=started,
        title=title,
    )


def _utterance(session_id: str, text: str, translated: str, started: int = 1100) -> Utterance:
    return Utterance(
        session_id=session_id,
        source=AudioSource.microphone,
        source_language=Language.vi,
        target_language=Language.en,
        source_text=text,
        translated_text=translated,
        started_at_ms=started,
        ended_at_ms=started + 500,
        asr_ms=100,
        mt_ms=200,
        tts_ms=50,
    )


def test_sqlite_roundtrip_and_upsert(tmp_path):
    repo = SqliteSessionRepository(tmp_path / "h.db")
    session = _session()
    asyncio.run(repo.save_session(session))
    asyncio.run(repo.save_utterance(_utterance(session.id, "xin chào", "hello")))

    # Lưu lần hai (lúc stop) chỉ cập nhật, không tạo thêm dòng.
    session.ended_at_ms = 9000
    asyncio.run(repo.save_session(session))

    assert len(asyncio.run(repo.list_sessions())) == 1
    stored = asyncio.run(repo.get_session(session.id))
    assert stored is not None
    assert stored.ended_at_ms == 9000
    assert stored.title == "Phiên A"
    assert stored.config is not None and stored.config.mode is SessionMode.two_way

    rows = asyncio.run(repo.get_utterances(session.id))
    assert len(rows) == 1
    assert rows[0].source_text == "xin chào"
    assert rows[0].translated_text == "hello"
    assert rows[0].asr_ms == 100 and rows[0].mt_ms == 200 and rows[0].tts_ms == 50
    assert rows[0].status is UtteranceStatus.success
    assert asyncio.run(repo.count_utterances(session.id)) == 1
    repo.dispose()


def test_sqlite_survives_restart(tmp_path):
    """Lý do tồn tại của cả thay đổi này: dữ liệu còn sau khi service tắt."""
    path = tmp_path / "h.db"
    first = SqliteSessionRepository(path)
    session = _session()
    asyncio.run(first.save_session(session))
    asyncio.run(first.save_utterance(_utterance(session.id, "một hai", "one two")))
    first.dispose()

    second = SqliteSessionRepository(path)
    assert [s.id for s in asyncio.run(second.list_sessions())] == [session.id]
    assert asyncio.run(second.count_utterances(session.id)) == 1
    second.dispose()


def test_sqlite_list_order_search_and_delete(tmp_path):
    repo = SqliteSessionRepository(tmp_path / "h.db")
    old, new = _session("Cuộc họp cũ", started=1000), _session("Cuộc họp mới", started=5000)
    for s in (old, new):
        asyncio.run(repo.save_session(s))
    asyncio.run(repo.save_utterance(_utterance(old.id, "báo giá dự án", "project quote")))
    asyncio.run(repo.save_utterance(_utterance(new.id, "chào buổi sáng", "good morning")))

    # Mới nhất trước.
    assert [s.id for s in asyncio.run(repo.list_sessions())] == [new.id, old.id]
    # Tìm theo tên phiên, nội dung câu gốc và nội dung bản dịch.
    assert [s.id for s in asyncio.run(repo.list_sessions("cũ"))] == [old.id]
    assert [s.id for s in asyncio.run(repo.list_sessions("báo giá"))] == [old.id]
    assert [s.id for s in asyncio.run(repo.list_sessions("morning"))] == [new.id]
    assert asyncio.run(repo.list_sessions("không có trong dữ liệu")) == []

    asyncio.run(repo.delete_session(old.id))
    assert [s.id for s in asyncio.run(repo.list_sessions())] == [new.id]
    assert asyncio.run(repo.get_utterances(old.id)) == []  # câu của phiên bị xoá theo

    asyncio.run(repo.delete_all_sessions())
    assert asyncio.run(repo.list_sessions()) == []
    assert asyncio.run(repo.count_utterances(new.id)) == 0
    repo.dispose()


def test_history_policy_off_blocks_writes_but_not_reads():
    inner = InMemorySessionRepository()
    policy = HistoryPolicy(inner, enabled=True)
    kept = _session("Có lưu")
    asyncio.run(policy.save_session(kept))
    asyncio.run(policy.save_utterance(_utterance(kept.id, "có", "yes")))

    policy.enabled = False
    dropped = _session("Không lưu")
    asyncio.run(policy.save_session(dropped))
    asyncio.run(policy.save_utterance(_utterance(kept.id, "không", "no")))

    # Không ghi thêm gì, nhưng dữ liệu cũ vẫn đọc được.
    assert [s.id for s in asyncio.run(policy.list_sessions())] == [kept.id]
    assert asyncio.run(policy.count_utterances(kept.id)) == 1

    # Tắt lưu vẫn phải xoá được (SPEC 14.4).
    asyncio.run(policy.delete_all_sessions())
    assert asyncio.run(policy.list_sessions()) == []


def _voiced_pcm(seconds: float) -> np.ndarray:
    t = np.arange(int(SR * seconds)) / SR
    env = 0.5 * (1 + np.sin(2 * np.pi * 4 * t))
    sig = env * (np.sin(2 * np.pi * 130 * t) + 0.5 * np.sin(2 * np.pi * 260 * t))
    sig = sig / np.max(np.abs(sig)) * 0.6
    return (sig * 32767).astype(np.int16)


def _run_one_utterance(client: TestClient, title: str, stop: bool = True) -> str:
    """Chạy một câu qua WS (provider giả) và trả sessionId của phiên."""
    pcm = np.concatenate((_voiced_pcm(1.0), np.zeros(int(SR * 0.6), dtype=np.int16)))
    b64 = base64.b64encode(pcm.tobytes()).decode()
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # Idle
        ws.send_json(
            {
                "type": "session.start",
                "payload": {
                    "mode": "speak",
                    "outgoingSource": "vi",
                    "outgoingTarget": "en",
                    "title": title,
                },
            }
        )
        started = ws.receive_json()
        assert started["payload"]["state"] == "Listening"
        session_id = started["payload"]["sessionId"]
        assert session_id  # client cần id này để biết phiên đang chạy là phiên nào

        ws.send_json({"type": "control.ptt", "payload": {"pressed": True}})
        assert ws.receive_json()["payload"]["state"] == "SpeechDetected"
        ws.send_json(
            {"type": "audio.chunk", "payload": {"source": "microphone", "pcm": b64, "seq": 0}}
        )
        for _ in range(15):
            msg = ws.receive_json()
            assert msg["type"] != "error"
            if msg["type"] == "state" and msg["payload"]["state"] == "Completed":
                break
        if stop:
            ws.send_json({"type": "session.stop", "payload": {}})
            for _ in range(5):
                msg = ws.receive_json()
                if msg["type"] == "state" and msg["payload"]["state"] == "Stopped":
                    break
    return session_id


def test_ws_session_lands_in_history():
    with TestClient(app) as client:
        session_id = _run_one_utterance(client, "Họp thử")

        listed = client.get("/api/sessions").json()
        assert [s["id"] for s in listed] == [session_id]
        assert listed[0]["title"] == "Họp thử"
        assert listed[0]["utteranceCount"] == 1
        assert listed[0]["mode"] == "speak"
        assert listed[0]["endedAtMs"] is not None  # session.stop đã ghi mốc kết thúc

        detail = client.get(f"/api/sessions/{session_id}").json()
        row = detail["utterances"][0]
        assert row["sourceText"].strip() == "xin chào"  # FakeWhisperModel ở conftest
        assert row["translatedText"].startswith("[eng_Latn]")  # FakeNllbBackend
        assert row["sourceLanguage"] == "vi" and row["targetLanguage"] == "en"
        assert row["status"] == "success"
        assert row["asrMs"] is not None and row["mtMs"] is not None
        assert row["ttsMs"] is not None  # chiều outgoing có TTS

        # Tìm kiếm chạy trên dữ liệu thật trong DB.
        assert client.get("/api/sessions", params={"q": "xin chào"}).json()[0]["id"] == session_id
        assert client.get("/api/sessions", params={"q": "zzz"}).json() == []

        renamed = client.patch(f"/api/sessions/{session_id}", json={"title": "Tên mới"})
        assert renamed.status_code == 200
        assert renamed.json()["title"] == "Tên mới"

        assert client.get("/api/sessions/khong-ton-tai").status_code == 404
        assert client.delete("/api/sessions").status_code == 204
        assert client.get("/api/sessions").json() == []


def test_close_abandoned_session():
    """App tắt giữa phiên → không có session.stop → phiên còn endedAtMs rỗng.

    Đây là dấu hiệu để giao diện hiện dải "khôi phục phiên chưa lưu"; PATCH close
    đóng nó lại theo mốc câu cuối, không phải theo lúc bấm nút.
    """
    with TestClient(app) as client:
        session_id = _run_one_utterance(client, "Bị bỏ dở", stop=False)

        listed = client.get("/api/sessions").json()
        assert listed[0]["endedAtMs"] is None
        assert listed[0]["utteranceCount"] == 1

        detail = client.get(f"/api/sessions/{session_id}").json()
        last = detail["utterances"][-1]

        closed = client.patch(f"/api/sessions/{session_id}", json={"close": True})
        assert closed.status_code == 200
        assert closed.json()["endedAtMs"] == (last["endedAtMs"] or last["startedAtMs"])
        assert closed.json()["title"] == "Bị bỏ dở"  # không gửi title thì giữ nguyên


def test_config_exposes_history_state_and_toggle():
    with TestClient(app) as client:
        body = client.get("/api/config").json()
        assert body["historyEnabled"] is True
        assert body["historyDbPath"].endswith("history.db")

        # Tắt lưu: gửi lại đúng preset đang chạy nên không nạp lại model.
        off = client.put("/api/config", json={"preset": body["preset"], "historyEnabled": False})
        assert off.status_code == 200
        assert off.json()["historyEnabled"] is False

        _run_one_utterance(client, "Không được lưu")
        assert client.get("/api/sessions").json() == []

        on = client.put("/api/config", json={"preset": body["preset"], "historyEnabled": True})
        assert on.json()["historyEnabled"] is True
