"""Test giao diện lấy được thông tin THẬT của runtime, không phải bảng chép tay.

Trước đây màn Quản lý Model đọc một bảng preset chép tay ở phía client nên có thể
lệch với thứ service đang chạy. Hai endpoint dưới đây là nguồn sự thật.

Provider trong test là bản giả (conftest) nên tên model/thiết bị không phải giá
trị thật của máy — test chỉ kiểm tra hình dạng dữ liệu và các bất biến.
"""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application.installed_models import scan

STAGES = ["VAD", "ASR", "MT", "TTS"]


def test_config_reports_every_pipeline_stage():
    with TestClient(app) as client:
        # Service không nạp model lúc khởi động → chưa nạp thì chưa có khâu nào.
        assert client.get("/api/config").json()["stages"] == []
        body = client.post("/api/models/load").json()
        assert [s["stage"] for s in body["stages"]] == STAGES
        for stage in body["stages"]:
            assert stage["adapter"], stage
            assert stage["model"], stage
            assert isinstance(stage["loaded"], bool)
        assert body["modelsDir"]


def test_choosing_a_preset_records_it_without_loading():
    """Bấm một ô preset chỉ GHI NHẬN lựa chọn, không nạp model.

    Trước đây nó nạp luôn: bấm thử một mức là đứng chờ hàng chục giây, lần đầu còn
    tải vài GB. Nạp là việc của nút "Khởi động model".
    """
    with TestClient(app) as client:
        before = client.get("/api/config").json()
        changed = client.put("/api/config", json={"preset": "fast"}).json()

        assert changed["preset"] == "fast"
        assert changed["stages"] == [], "chọn preset không được kéo theo một lượt nạp"
        client.put("/api/config", json={"preset": before["preset"]})


def test_config_stages_follow_preset_change():
    """Nạp xong thì `stages` phải mô tả đúng preset đang chọn.

    Đây là chỗ một bảng cấu hình chép tay ở giao diện sẽ lệch với thực tế.
    """
    with TestClient(app) as client:
        before = client.get("/api/config").json()
        client.put("/api/config", json={"preset": "fast"})
        loaded = client.post("/api/models/load").json()

        assert loaded["preset"] == "fast"
        assert [s["stage"] for s in loaded["stages"]] == STAGES
        client.put("/api/config", json={"preset": before["preset"]})


def test_models_endpoint_lists_real_files():
    with TestClient(app) as client:
        body = client.get("/api/models").json()
        assert isinstance(body, list)
        for model in body:
            assert model["stage"] in {"ASR", "MT", "TTS"}
            assert model["sizeBytes"] > 0
            assert Path(model["path"]).exists()


def test_scan_ignores_missing_directory(tmp_path: Path):
    assert scan(tmp_path / "khong-ton-tai") == []


def test_scan_reads_real_sizes(tmp_path: Path):
    whisper = tmp_path / "whisper-cpp"
    whisper.mkdir(parents=True)
    (whisper / "ggml-tiny.bin").write_bytes(b"x" * 2048)

    tts = tmp_path / "sherpa-tts" / "vits-piper-vi_VN-vais1000-medium"
    tts.mkdir(parents=True)
    (tts / "model.onnx").write_bytes(b"y" * 512)

    nllb = tmp_path / "nllb" / "models--facebook--nllb-200-distilled-600M"
    nllb.mkdir(parents=True)
    (nllb / "pytorch_model.bin").write_bytes(b"z" * 4096)

    by_stage = {m.stage: m for m in scan(tmp_path)}
    assert by_stage["ASR"].size_bytes == 2048
    assert by_stage["TTS"].size_bytes == 512
    assert by_stage["MT"].size_bytes == 4096
    # Tên thư mục cache HF được đổi về dạng repo id cho dễ đọc.
    assert by_stage["MT"].name == "facebook/nllb-200-distilled-600M"
