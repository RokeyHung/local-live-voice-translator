"""Test thư mục lưu model đổi được lúc chạy và lệnh xoá model đã tải.

Điểm cần giữ đúng: cấu hình phải SỐNG SÓT qua lần khởi động sau, biến môi trường phải
thắng lựa chọn trong giao diện, xoá model chỉ đụng thư mục do app tạo, và sau khi đổi
thư mục / xoá model thì phiên kế tiếp vẫn bắt đầu được (model tự nạp lại).
"""

from __future__ import annotations

import base64

import numpy as np
import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application.installed_models import MANAGED_DIRS, purge, scan
from llvt_ai_service.config import runtime_config
from llvt_ai_service.config.settings import Settings, get_settings

SR = 16000


def test_saved_config_survives_restart(tmp_path):
    runtime_config.save(models_dir=str(tmp_path / "models"))
    get_settings.cache_clear()
    assert get_settings().models_dir == tmp_path / "models"
    # "Khởi động lại" = dựng Settings mới từ đầu.
    assert Settings().models_dir == tmp_path / "models"


def test_env_beats_saved_config(monkeypatch: pytest.MonkeyPatch, tmp_path):
    runtime_config.save(models_dir=str(tmp_path / "from-ui"))
    monkeypatch.setenv("LLVT_MODELS_DIR", str(tmp_path / "from-env"))
    get_settings.cache_clear()
    assert get_settings().models_dir == tmp_path / "from-env"
    assert runtime_config.env_overrides("models_dir") is True


def test_save_rejects_unknown_keys():
    with pytest.raises(ValueError):
        runtime_config.save(db_path="/tmp/somewhere")


def test_put_models_dir_persists_and_frees_models(tmp_path):
    with TestClient(app) as client:
        assert client.get("/api/config").json()["modelsDirEditable"] is True
        assert len(client.post("/api/models/load").json()["stages"]) == 4

        target = tmp_path / "models-moi"
        body = client.put("/api/config", json={"preset": "balanced", "modelsDir": str(target)})
        assert body.status_code == 200
        assert body.json()["modelsDir"] == str(target)
        assert target.is_dir()  # tạo sẵn để lần tải sau ghi được
        assert runtime_config.load()["models_dir"] == str(target)

        # Provider cũ trỏ vào thư mục cũ nên phải được giải phóng, không phải nạp lại
        # ngay trong request (thư mục mới thường rỗng → sẽ kéo vài GB).
        assert client.get("/api/config").json()["stages"] == []


def test_put_models_dir_rejects_bad_paths(tmp_path):
    with TestClient(app) as client:
        assert (
            client.put("/api/config", json={"preset": "balanced", "modelsDir": "duong/dan/tuong"})
        ).status_code == 400

        # Đường dẫn nằm trong một FILE → không thể mkdir.
        blocker = tmp_path / "toi-la-file"
        blocker.write_text("x")
        res = client.put(
            "/api/config", json={"preset": "balanced", "modelsDir": str(blocker / "models")}
        )
        assert res.status_code == 400


def test_put_models_dir_blocked_by_env(monkeypatch: pytest.MonkeyPatch, tmp_path):
    monkeypatch.setenv("LLVT_MODELS_DIR", str(tmp_path / "do-env-quyet-dinh"))
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert client.get("/api/config").json()["modelsDirEditable"] is False
        res = client.put("/api/config", json={"preset": "balanced", "modelsDir": str(tmp_path)})
        assert res.status_code == 409
        assert runtime_config.load() == {}  # không ghi gì cả


def test_purge_only_touches_managed_dirs(tmp_path):
    for name in MANAGED_DIRS:
        (tmp_path / name).mkdir(parents=True)
        (tmp_path / name / "model.bin").write_bytes(b"0" * 1000)
    # Thứ của người dùng nằm cùng thư mục — tuyệt đối không được xoá.
    (tmp_path / "anh-cuoi.jpg").write_bytes(b"0" * 10)
    (tmp_path / "tai-lieu").mkdir()

    removed, freed = purge(tmp_path)

    assert sorted(removed) == sorted(MANAGED_DIRS)
    assert freed == 1000 * len(MANAGED_DIRS)
    assert (tmp_path / "anh-cuoi.jpg").is_file()
    assert (tmp_path / "tai-lieu").is_dir()
    assert scan(tmp_path) == []


def test_delete_models_endpoint(monkeypatch: pytest.MonkeyPatch, tmp_path):
    models = tmp_path / "models"
    (models / "whisper-cpp").mkdir(parents=True)
    (models / "whisper-cpp" / "ggml-tiny.bin").write_bytes(b"0" * 2048)
    monkeypatch.setenv("LLVT_MODELS_DIR", str(models))
    get_settings.cache_clear()

    with TestClient(app) as client:
        assert len(client.get("/api/models").json()) == 1
        res = client.delete("/api/models")
        assert res.status_code == 200
        assert res.json() == {"removed": ["whisper-cpp"], "freedBytes": 2048}
        assert client.get("/api/models").json() == []
        # Xoá model = giải phóng luôn bộ nhớ.
        assert client.get("/api/config").json()["stages"] == []


def _voiced_pcm(seconds: float) -> np.ndarray:
    t = np.arange(int(SR * seconds)) / SR
    env = 0.5 * (1 + np.sin(2 * np.pi * 4 * t))
    sig = env * (np.sin(2 * np.pi * 130 * t) + 0.5 * np.sin(2 * np.pi * 260 * t))
    return ((sig / np.max(np.abs(sig)) * 0.6) * 32767).astype(np.int16)


def test_session_reloads_models_after_they_were_freed(tmp_path):
    """Sau khi đổi thư mục model, bấm Bắt đầu vẫn phải chạy — model tự nạp lại."""
    pcm = np.concatenate((_voiced_pcm(1.0), np.zeros(int(SR * 0.6), dtype=np.int16)))
    b64 = base64.b64encode(pcm.tobytes()).decode()

    with TestClient(app) as client:
        client.put("/api/config", json={"preset": "balanced", "modelsDir": str(tmp_path / "m")})
        assert client.get("/api/config").json()["stages"] == []

        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Idle
            ws.send_json(
                {
                    "type": "session.start",
                    "payload": {"mode": "speak", "outgoingSource": "vi", "outgoingTarget": "en"},
                }
            )
            assert ws.receive_json()["payload"]["state"] == "Listening"
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
            assert {"asr.final", "mt.result"} <= set(seen)

        assert len(client.get("/api/config").json()["stages"]) == 4  # đã nạp lại
