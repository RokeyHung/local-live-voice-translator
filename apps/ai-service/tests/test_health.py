from fastapi.testclient import TestClient

from llvt_ai_service.app import app


def test_health():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["offlineReady"] is True


def test_config_default_preset():
    with TestClient(app) as client:
        r = client.get("/api/config")
        assert r.status_code == 200
        assert r.json()["preset"] == "balanced"


def test_ws_state_on_connect():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "state"
            assert msg["payload"]["state"] == "Idle"


def test_ws_session_start():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Idle
            ws.send_json({"type": "session.start", "payload": {"mode": "two_way"}})
            msg = ws.receive_json()
            assert msg["payload"]["state"] == "Listening"


def test_ws_unknown_type():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Idle
            ws.send_json({"type": "bogus", "payload": {}})
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert msg["payload"]["code"] == "unknown_type"
