"""Nạp model hỏng giữa chừng (mất mạng lúc tải) phải hỏng một cách tử tế.

Tình huống thật gặp phải: whisper tải xong, tới NLLB thì DNS trượt → transformers ném
OSError. Trước khi có phần này, hậu quả là (1) whisper nằm lại trong RAM kèm context
Metal mà không ai tham chiếu, (2) REST trả 500 kèm traceback, (3) lỗi ở `session.start`
làm chết luôn vòng nhận message của WebSocket nên client chỉ thấy socket đóng.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application import load_progress
from llvt_ai_service.application import model_manager as mm
from llvt_ai_service.application.model_manager import ModelLoadError, ModelManager
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Preset


class FlakyProvider:
    """Provider giả: khâu chỉ định thì ném lỗi mạng, các khâu khác nạp bình thường."""

    def __init__(self, name: str, fail: bool) -> None:
        self.name = name
        self._fail = fail
        self.loaded = False
        self.unload_calls = 0

    async def load(self) -> None:
        if self._fail:
            raise OSError("Can't load the configuration of 'facebook/nllb-200-distilled-600M'")
        self.loaded = True

    async def unload(self) -> None:
        self.unload_calls += 1
        self.loaded = False

    def runtime_info(self) -> dict[str, str]:
        return {"model": self.name, "accel": "CPU"}

    def open_stream(self):  # chỉ VAD cần, không dùng trong các test này
        raise NotImplementedError


@pytest.fixture
def failing_mt(monkeypatch: pytest.MonkeyPatch) -> dict[str, FlakyProvider]:
    """Thay cả bốn registry bằng provider giả, riêng khâu MT thì hỏng."""
    made: dict[str, FlakyProvider] = {}

    def factory(stage: str, fail: bool):
        def build(_cfg):
            provider = FlakyProvider(stage.lower(), fail)
            made[stage] = provider
            return provider

        return build

    monkeypatch.setitem(mm.VAD_REGISTRY, "silero", factory("VAD", False))
    monkeypatch.setitem(mm.ASR_REGISTRY, "whisper_cpp", factory("ASR", False))
    monkeypatch.setitem(mm.MT_REGISTRY, "nllb", factory("MT", True))
    monkeypatch.setitem(mm.TTS_REGISTRY, "sherpa_onnx", factory("TTS", False))
    return made


@pytest.mark.anyio
async def test_failed_stage_frees_the_ones_already_loaded(failing_mt):
    manager = ModelManager()
    with pytest.raises(ModelLoadError) as caught:
        await manager.load_preset(Preset.balanced)

    assert caught.value.stage == "MT"
    assert not manager.loaded, "không được coi là đã nạp khi có khâu hỏng"
    # VAD + ASR đã nạp xong trước đó phải được giải phóng, không để rò rỉ.
    assert failing_mt["VAD"].unload_calls == 1
    assert failing_mt["ASR"].unload_calls == 1
    assert not failing_mt["ASR"].loaded
    # TTS chưa tới lượt nạp nên cũng không phải giải phóng.
    assert failing_mt["TTS"].unload_calls == 0


def test_load_endpoint_returns_503_not_500(failing_mt):
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post("/api/models/load")

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert "khâu MT" in detail
    assert "kiểm tra kết nối" in detail


@pytest.fixture
def failing_diarizer(monkeypatch: pytest.MonkeyPatch) -> dict[str, FlakyProvider]:
    """Bốn khâu dịch nạp bình thường, riêng khâu DIA (tùy chọn) thì hỏng."""
    made: dict[str, FlakyProvider] = {}

    def factory(stage: str, fail: bool):
        def build(*_args):
            provider = FlakyProvider(stage.lower(), fail)
            made[stage] = provider
            return provider

        return build

    monkeypatch.setitem(mm.VAD_REGISTRY, "silero", factory("VAD", False))
    monkeypatch.setitem(mm.ASR_REGISTRY, "whisper_cpp", factory("ASR", False))
    monkeypatch.setitem(mm.MT_REGISTRY, "nllb", factory("MT", False))
    monkeypatch.setitem(mm.TTS_REGISTRY, "sherpa_onnx", factory("TTS", False))
    monkeypatch.setitem(mm.DIARIZATION_REGISTRY, "pyannote", factory("DIA", True))
    monkeypatch.setenv("LLVT_DIARIZATION_ENABLED", "true")
    get_settings.cache_clear()
    return made


@pytest.mark.anyio
async def test_optional_stage_failure_still_loads_the_translation_pipeline(failing_diarizer):
    """Thiếu token HuggingFace cho pyannote không được làm chết cả ứng dụng dịch.

    Đây là tình huống mặc định của bất kỳ ai bật diarization lần đầu: repo pyannote là
    gated nên lần tải đầu trả 401. Mất nhãn người nói ở màn Nhập tệp là hậu quả đúng;
    mất luôn khả năng dịch thì không.
    """
    manager = ModelManager()
    providers = await manager.load_preset(Preset.balanced)

    assert manager.loaded
    assert providers.diarizer is None, "khâu hỏng phải bị bỏ, không giữ lại provider chết"
    for stage in ("VAD", "ASR", "MT", "TTS"):
        assert failing_diarizer[stage].loaded, stage
        assert failing_diarizer[stage].unload_calls == 0, stage

    # Lý do vẫn phải hiện được cho người dùng, và khâu DIA không nằm trong `stages`
    # vì nó không thật sự nằm trong bộ nhớ.
    snapshot = load_progress.progress.snapshot()
    assert snapshot["error"] is not None
    assert [s["status"] for s in snapshot["stages"] if s["stage"] == "DIA"] == ["failed"]
    assert [s.stage for s in manager.stages()] == ["VAD", "ASR", "MT", "TTS"]


def test_session_start_reports_error_without_killing_socket(failing_mt):
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # Idle
            ws.send_json(
                {
                    "type": "session.start",
                    "payload": {"mode": "speak", "outgoingSource": "vi", "outgoingTarget": "en"},
                }
            )
            error = ws.receive_json()
            assert error["type"] == "error"
            assert error["payload"]["code"] == "model_load_failed"
            assert "khâu MT" in error["payload"]["message"]
            assert ws.receive_json()["payload"]["state"] == "Error"

            # Kết nối vẫn sống: client thử lại được mà không phải mở socket mới.
            ws.send_json({"type": "control.mute", "payload": {"muted": True}})
            assert ws.receive_json()["type"] == "state"
