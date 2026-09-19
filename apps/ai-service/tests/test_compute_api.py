"""REST /api/compute — chọn thiết bị tính toán (màn Thiết bị âm thanh → Cấu hình thực thi).

Danh sách GPU giả lập đúng máy dev: laptop hybrid, ggml liệt kê GPU tích hợp trước
card rời. Đó là trường hợp làm lộ lỗi whisper.cpp chạy nhầm trên Iris Xe.
"""

from __future__ import annotations

import pytest
from conftest import FakeNllbBackend, FakeWhisperModel
from fastapi.testclient import TestClient

from llvt_ai_service.adapters.asr import whisper_cpp
from llvt_ai_service.adapters.asr.whisper_cpp import DEV_CPU, DEV_GPU, DEV_IGPU, GgmlDevice
from llvt_ai_service.api import compute
from llvt_ai_service.config import runtime_config
from llvt_ai_service.config.settings import get_settings

IRIS = GgmlDevice("Vulkan0", "Intel(R) Iris(R) Xe Graphics", DEV_IGPU, 16000)
RTX = GgmlDevice("Vulkan1", "NVIDIA GeForce RTX 4060 Laptop GPU", DEV_GPU, 8000)
CPU = GgmlDevice("CPU", "12th Gen Intel(R) Core(TM) i5-12500H", DEV_CPU)


@pytest.fixture
def devices(monkeypatch: pytest.MonkeyPatch) -> list[GgmlDevice]:
    found = [IRIS, RTX, CPU]
    monkeypatch.setattr(compute, "list_ggml_devices", lambda: tuple(found))
    return found


@pytest.fixture
def client(devices: list[GgmlDevice]) -> TestClient:
    from llvt_ai_service.app import app

    with TestClient(app) as test_client:
        yield test_client


def test_lists_only_gpus_with_real_names_kind_and_vram(client: TestClient):
    body = client.get("/api/compute").json()

    assert body["choice"] == "auto"
    assert body["deviceSelectable"] is True
    assert body["devices"] == [
        {
            "id": "Intel(R) Iris(R) Xe Graphics",
            "backend": "Vulkan",
            "kind": "integrated",
            "memoryMb": 16000,
        },
        {
            "id": "NVIDIA GeForce RTX 4060 Laptop GPU",
            "backend": "Vulkan",
            "kind": "discrete",
            "memoryMb": 8000,
        },
    ]
    # Tên CPU lấy từ ggml chứ không phải "Intel64 Family 6 Model 154…" của Windows.
    assert body["cpuName"] == "12th Gen Intel(R) Core(TM) i5-12500H"
    assert body["cpuCores"] and body["ramGb"]


def test_nothing_loaded_means_no_active_device(client: TestClient):
    assert client.get("/api/compute").json()["activeDevice"] is None


def test_choosing_a_gpu_is_saved_and_unloads_the_models(client: TestClient):
    client.post("/api/models/load")
    assert client.get("/api/config").json()["stages"], "tiền đề: đã nạp"

    response = client.put("/api/compute", json={"choice": RTX.description})

    assert response.status_code == 200, response.text
    assert response.json()["choice"] == RTX.description
    assert get_settings().compute_device == RTX.description
    assert runtime_config.load()["compute_device"] == RTX.description
    # Model trong RAM chạy trên thiết bị cũ → giải phóng, lần nạp sau mới đúng.
    assert client.get("/api/config").json()["stages"] == []


def test_auto_is_the_default_and_is_not_written_to_disk(client: TestClient):
    client.put("/api/compute", json={"choice": "cpu"})
    client.put("/api/compute", json={"choice": "auto"})

    assert client.get("/api/compute").json()["choice"] == "auto"
    assert "compute_device" not in runtime_config.load()


def test_choosing_the_same_thing_again_keeps_the_models(client: TestClient):
    client.post("/api/models/load")
    client.put("/api/compute", json={"choice": "auto"})

    assert client.get("/api/config").json()["stages"], "không đổi gì thì không giải phóng"


def test_a_device_that_is_not_on_this_machine_is_refused(client: TestClient):
    response = client.put("/api/compute", json={"choice": "AMD Radeon RX 7900"})

    assert response.status_code == 400
    assert get_settings().compute_device == ""


def test_cpu_only_reaches_every_stage_that_can_take_it(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    """Ô "Chỉ CPU" phải đúng cho cả whisper.cpp lẫn NLLB, không chỉ khâu ASR."""
    seen: dict[str, object] = {}

    def asr_loader(_model_id, _models_dir, device="auto"):
        seen["asr"] = device
        return FakeWhisperModel()

    def mt_loader(_repo, _dir, device):
        seen["mt"] = device
        return FakeNllbBackend()

    from llvt_ai_service.adapters.mt import nllb

    monkeypatch.setattr(whisper_cpp, "_default_loader", asr_loader)
    monkeypatch.setattr(nllb, "_default_loader", mt_loader)

    client.put("/api/compute", json={"choice": "cpu"})
    client.post("/api/models/load")

    assert seen == {"asr": "cpu", "mt": "cpu"}


def test_without_a_device_list_only_auto_and_cpu_make_sense(
    client: TestClient, devices: list[GgmlDevice]
):
    """macOS / bản build CPU: ggml không liệt kê được GPU nào để chọn riêng."""
    devices.clear()

    body = client.get("/api/compute").json()
    assert body["devices"] == []
    assert body["deviceSelectable"] is False
    assert client.put("/api/compute", json={"choice": "cpu"}).status_code == 200
