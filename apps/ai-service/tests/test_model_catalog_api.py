"""Huỷ lượt nạp, tải một model, xoá một model — ba nút vốn bị vô hiệu ở màn Quản lý model.

Không test nào chạm mạng: phần tải được thay bằng bản giả, còn phần xoá làm việc trên
thư mục thật trong `tmp_path`.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application import model_download
from llvt_ai_service.application.installed_models import NotManagedError, remove_one
from llvt_ai_service.application.load_progress import LoadProgress


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


# --- huỷ lượt nạp ---------------------------------------------------------


def test_cancel_is_ignored_when_nothing_is_loading():
    tracker = LoadProgress()
    tracker.request_cancel()
    assert tracker.cancel_requested is False, "không có gì chạy thì không có gì để huỷ"


def test_cancel_flag_is_visible_to_the_load_loop_and_to_the_ui():
    tracker = LoadProgress()
    tracker.begin([("VAD", "silero-vad"), ("ASR", "whisper-small-q5")])
    tracker.request_cancel()

    assert tracker.cancel_requested is True
    assert tracker.snapshot()["cancelling"] is True


def test_cancelled_marks_unfinished_stages_without_calling_them_failures():
    tracker = LoadProgress()
    tracker.begin([("VAD", "silero-vad"), ("ASR", "whisper-small-q5"), ("MT", "nllb")])
    tracker.stage_begin("VAD")
    tracker.stage_done("VAD")
    tracker.stage_begin("ASR")
    tracker.request_cancel()
    tracker.cancelled()

    statuses = {s["stage"]: s["status"] for s in tracker.snapshot()["stages"]}
    assert statuses == {"VAD": "done", "ASR": "cancelled", "MT": "cancelled"}
    assert tracker.snapshot()["active"] is False
    # Dừng theo yêu cầu KHÔNG phải lỗi — không được để lại thông báo lỗi đỏ.
    assert tracker.snapshot()["error"] is None


def test_a_new_load_clears_a_stale_cancel_request():
    tracker = LoadProgress()
    tracker.begin([("VAD", "silero-vad")])
    tracker.request_cancel()
    tracker.begin([("VAD", "silero-vad")])
    assert tracker.cancel_requested is False


def test_cancel_endpoint_is_a_no_op_without_a_running_load(client: TestClient):
    assert client.post("/api/models/load/cancel").status_code == 204


# --- tải một model --------------------------------------------------------


def test_catalog_names_route_to_the_right_downloader():
    assert model_download.resolve("whisper-small-q5") == ("ASR", "whisper_cpp")
    assert model_download.resolve("mlx-whisper-large-v3-turbo-q8") == ("ASR", "mlx")
    assert model_download.resolve("nllb-200-distilled-600M") == ("MT", "nllb")
    assert model_download.resolve("kokoro-ja") == ("TTS", "kokoro")
    assert model_download.resolve("vits-piper-vi_VN-vais1000-medium") == ("TTS", "sherpa")
    assert model_download.resolve("pyannote/speaker-diarization-community-1") == ("DIA", "pyannote")


def test_unknown_names_are_refused_before_any_network_call():
    with pytest.raises(model_download.UnknownModelError):
        model_download.resolve("model-khong-co-that")


def test_download_endpoint_reports_where_the_model_landed(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    called: list[str] = []

    def fake_download(name: str, models_dir: Path) -> Path:
        called.append(name)
        return models_dir / "whisper-cpp" / "ggml-small-q5_1.bin"

    monkeypatch.setattr(model_download, "download", fake_download)
    response = client.post("/api/models/download", json={"name": "whisper-small-q5"})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "whisper-small-q5"
    assert body["stage"] == "ASR"
    assert body["path"].endswith("ggml-small-q5_1.bin")
    assert called == ["whisper-small-q5"]


def test_download_endpoint_rejects_an_unknown_name_with_400(client: TestClient):
    response = client.post("/api/models/download", json={"name": "khong-co-that"})
    assert response.status_code == 400
    assert "danh mục" in response.json()["detail"]


def test_download_failure_is_503_not_500(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    # Mất mạng là lỗi môi trường, không phải lỗi của request.
    def boom(_name: str, _dir: Path) -> Path:
        raise OSError("Network is unreachable")

    monkeypatch.setattr(model_download, "download", boom)
    response = client.post("/api/models/download", json={"name": "whisper-small-q5"})

    assert response.status_code == 503
    assert "Network is unreachable" in response.json()["detail"]


# --- xoá một model --------------------------------------------------------


def _installed(models_dir: Path) -> Path:
    """Dựng một model whisper giả trên đĩa, đúng bố cục `scan()` nhận ra."""
    target = models_dir / "whisper-cpp"
    target.mkdir(parents=True, exist_ok=True)
    model = target / "ggml-small-q5_1.bin"
    model.write_bytes(b"x" * 1024)
    return model


def test_removing_a_listed_model_frees_its_bytes(tmp_path: Path):
    model = _installed(tmp_path)
    assert remove_one(tmp_path, str(model)) == 1024
    assert not model.exists()


def test_refuses_a_path_outside_the_managed_folders(tmp_path: Path):
    _installed(tmp_path)
    outsider = tmp_path / "anh-cuoi"
    outsider.mkdir()
    with pytest.raises(NotManagedError):
        remove_one(tmp_path, str(outsider))
    assert outsider.exists(), "thư mục của người dùng phải còn nguyên"


def test_refuses_to_delete_a_managed_root_wholesale(tmp_path: Path):
    _installed(tmp_path)
    with pytest.raises(NotManagedError):
        remove_one(tmp_path, str(tmp_path / "whisper-cpp"))


def test_refuses_a_path_that_is_not_a_listed_model(tmp_path: Path):
    """Nằm đúng thư mục vẫn chưa đủ: phải là thứ `GET /api/models` liệt kê."""
    _installed(tmp_path)
    stray = tmp_path / "whisper-cpp" / "ghi-chu.txt"
    stray.write_text("không phải model")
    with pytest.raises(NotManagedError):
        remove_one(tmp_path, str(stray))
    assert stray.exists()


def test_traversal_out_of_the_models_folder_is_refused(tmp_path: Path):
    _installed(tmp_path)
    with pytest.raises(NotManagedError):
        remove_one(tmp_path, str(tmp_path / "whisper-cpp" / ".." / ".." / "etc"))


def test_delete_endpoint_rejects_an_arbitrary_path(client: TestClient):
    response = client.request("DELETE", "/api/models/one", params={"path": "/etc/passwd"})
    assert response.status_code == 400
