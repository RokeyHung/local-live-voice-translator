from fastapi.testclient import TestClient

from llvt_ai_service.server import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["offlineReady"] is True


def test_ws_state_on_connect():
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "state"
        assert msg["payload"]["state"] == "Idle"


def test_ws_session_start():
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # Idle
        ws.send_json({"type": "session.start", "payload": {"mode": "two_way"}})
        msg = ws.receive_json()
        assert msg["payload"]["state"] == "Listening"
