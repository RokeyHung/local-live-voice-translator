"""Test việc nạp model theo yêu cầu (không nạp lúc khởi động).

Service phải mở được ngay để trả lời REST; model chỉ vào bộ nhớ khi người dùng bấm
"Khởi động model" ở màn Quản lý model, khi bắt đầu phiên, hoặc khi chạy benchmark.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Preset


def test_service_starts_without_loading_models():
    with TestClient(app) as client:
        body = client.get("/api/config").json()
        # Preset vẫn được báo (giao diện cần biết đang chọn cái gì) nhưng chưa nạp gì.
        assert body["preset"] == "balanced"
        assert body["stages"] == []
        # /health vẫn phải OK: service sống, chỉ là chưa nạp model.
        assert client.get("/health").json()["status"] == "ok"


def test_preload_flag_still_loads_at_startup(monkeypatch: pytest.MonkeyPatch):
    """Chạy tự động (benchmark, CI) vẫn nạp sẵn được bằng biến môi trường."""
    monkeypatch.setenv("LLVT_PRELOAD_MODELS", "true")
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert len(client.get("/api/config").json()["stages"]) == 4


def test_load_endpoint_is_idempotent_and_reload_rebuilds():
    with TestClient(app) as client:
        first = client.post("/api/models/load")
        assert first.status_code == 200
        assert len(first.json()["stages"]) == 4

        # Gọi lại khi đã nạp: không dựng lại provider.
        manager: ModelManager = client.app.state.container.model_manager
        before = manager.providers
        client.post("/api/models/load")
        assert client.app.state.container.model_manager.providers is before

        # reload=true thì dựng bộ provider mới.
        client.post("/api/models/load", params={"reload": "true"})
        assert client.app.state.container.model_manager.providers is not before


def test_unload_frees_models_but_keeps_preset_choice():
    with TestClient(app) as client:
        client.put("/api/config", json={"preset": "fast"})
        # Chọn preset không nạp gì — phải bấm nút nạp mới có model trong bộ nhớ.
        assert client.get("/api/config").json()["stages"] == []
        assert len(client.post("/api/models/load").json()["stages"]) == 4

        body = client.post("/api/models/unload").json()
        assert body["stages"] == []
        assert body["preset"] == "fast"  # giải phóng bộ nhớ ≠ quên lựa chọn


def test_benchmark_loads_models_when_needed():
    with TestClient(app) as client:
        assert client.get("/api/config").json()["stages"] == []
        res = client.post("/api/benchmark", json={"source": "vi", "target": "en"})
        assert res.status_code == 200
        assert res.json()["asrMs"] >= 0
        assert len(client.get("/api/config").json()["stages"]) == 4


def test_select_preset_refuses_when_models_are_loaded():
    manager = ModelManager()
    manager.select_preset(Preset.fast)
    assert manager.preset is Preset.fast
    assert manager.loaded is False
