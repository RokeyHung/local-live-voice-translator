"""Tiến trình nạp model (`GET /api/models/progress`).

Điểm cần giữ đúng: `doneBytes` là số ĐO ĐƯỢC trên đĩa, còn khâu nào không biết dung
lượng model thì `percent` phải là `null` — không được bịa ra phần trăm.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application import load_progress as lp
from llvt_ai_service.application import model_manager as mm
from llvt_ai_service.application.load_progress import LoadProgress
from llvt_ai_service.domain.enums import Preset


@pytest.fixture(autouse=True)
def _fresh_progress():
    """Mỗi test một bản trạng thái sạch (module dùng chung một singleton)."""
    lp.progress.__init__()  # type: ignore[misc]
    yield
    lp.progress.__init__()  # type: ignore[misc]


def test_percent_is_none_when_model_size_unknown():
    tracker = LoadProgress()
    tracker.begin([("ASR", "model-la-hoac"), ("MT", "facebook/nllb-200-distilled-600M")])
    tracker.stage_begin("ASR")

    asr = tracker.snapshot()["stages"][0]
    assert asr["totalBytes"] is None
    assert asr["percent"] is None, "không biết tổng thì không được bịa phần trăm"

    tracker.stage_begin("MT")
    mt = tracker.snapshot()["stages"][1]
    assert mt["totalBytes"] == lp.EXPECTED_BYTES["facebook/nllb-200-distilled-600M"]
    assert mt["estimated"] is True, "dung lượng NLLB là số xấp xỉ, phải nói rõ"


def test_no_percent_while_loading_a_model_already_on_disk():
    """Model có sẵn → không tải gì → phải là 'đang nạp', không phải '≈0%'.

    Hiện 0% trong lúc nạp từ đĩa vào RAM khiến người dùng tưởng tiến trình đứng im,
    trong khi thực ra chẳng có gì để tải.
    """
    tracker = LoadProgress()
    tracker.begin([("MT", "nllb-200-distilled-600M")])
    tracker.stage_begin("MT")

    mt = tracker.snapshot()["stages"][0]
    assert mt["status"] == "loading"
    assert mt["doneBytes"] == 0
    assert mt["percent"] is None


def test_overall_counts_finished_stages():
    tracker = LoadProgress()
    tracker.begin([("VAD", "silero-vad"), ("ASR", "whisper-large-v3-turbo-q5")])
    assert tracker.snapshot()["overallPercent"] == 0.0

    tracker.stage_done("VAD")
    assert tracker.snapshot()["overallPercent"] == 50.0

    tracker.stage_done("ASR")
    tracker.finish()
    snapshot = tracker.snapshot()
    assert snapshot["overallPercent"] == 100.0
    assert snapshot["active"] is False


def test_failed_stage_is_reported_with_reason():
    tracker = LoadProgress()
    tracker.begin([("ASR", "whisper-large-v3-turbo-q5"), ("MT", "nllb-200-distilled-600M")])
    tracker.stage_done("ASR")
    tracker.stage_failed("MT", "mất mạng")

    snapshot = tracker.snapshot()
    assert snapshot["active"] is False
    assert snapshot["error"] == "mất mạng"
    assert snapshot["stages"][1]["status"] == "failed"


@pytest.mark.anyio
async def test_watcher_measures_bytes_written_to_disk(tmp_path):
    """Byte báo lên phải là dung lượng thật ghi thêm vào thư mục, không phải phỏng đoán."""
    models = tmp_path / "whisper-cpp"
    models.mkdir()
    (models / "cu.bin").write_bytes(b"x" * 1000)  # model có sẵn từ lần trước

    tracker = LoadProgress()
    tracker.begin([("ASR", "whisper-large-v3-turbo-q5")])
    tracker.stage_begin("ASR", models)
    await asyncio.sleep(lp.SAMPLE_INTERVAL_S * 1.5)  # để watcher lấy mốc ban đầu

    (models / "moi.bin").write_bytes(b"y" * 5000)  # phần đang tải về
    await asyncio.sleep(lp.SAMPLE_INTERVAL_S * 1.5)

    asr = tracker.snapshot()["stages"][0]
    tracker.finish()
    assert asr["doneBytes"] == 5000, "chỉ tính phần tải THÊM, không tính model có sẵn"
    assert asr["status"] == "downloading"


@pytest.mark.anyio
async def test_progress_is_readable_while_loading(monkeypatch: pytest.MonkeyPatch):
    """Tiền đề của cả tính năng: đọc được tiến trình TRONG LÚC lệnh nạp còn chặn.

    Đúng vì `provider.load()` của các adapter thật đẩy phần chặn sang thread khác
    (`asyncio.to_thread`), nên event loop vẫn rảnh để trả lời REST.
    """

    class SlowProvider:
        name = "slow"
        loaded = False

        async def load(self) -> None:
            await asyncio.sleep(0.05)
            self.loaded = True

        async def unload(self) -> None:
            self.loaded = False

        def runtime_info(self) -> dict[str, str]:
            return {}

    for registry, key in (
        (mm.VAD_REGISTRY, "silero"),
        (mm.ASR_REGISTRY, "whisper_cpp"),
        (mm.MT_REGISTRY, "nllb"),
        (mm.TTS_REGISTRY, "sherpa_onnx"),
    ):
        monkeypatch.setitem(registry, key, lambda _cfg: SlowProvider())

    manager = mm.ModelManager()
    task = asyncio.create_task(manager.load_preset(Preset.balanced))

    seen: list[dict] = []
    while not task.done():
        seen.append(lp.progress.snapshot())
        await asyncio.sleep(0.02)
    await task

    in_flight = [s for s in seen if s["active"]]
    assert in_flight, "phải quan sát được trạng thái đang nạp, không chỉ lúc xong"
    assert in_flight[0]["currentStage"] in {"VAD", "ASR", "MT", "TTS"}
    # Phần trăm tổng phải tăng dần chứ không nhảy thẳng từ 0 lên 100.
    percents = [s["overallPercent"] for s in in_flight]
    assert percents == sorted(percents)
    assert lp.progress.snapshot()["overallPercent"] == 100.0


def test_progress_endpoint_idle_by_default():
    with TestClient(app) as client:
        body = client.get("/api/models/progress").json()

    assert body["active"] is False
    assert body["stages"] == []


def test_progress_endpoint_after_load():
    with TestClient(app) as client:
        client.post("/api/models/load")
        body = client.get("/api/models/progress").json()

    assert body["active"] is False  # nạp xong thì không còn "đang chạy"
    assert [s["stage"] for s in body["stages"]] == ["VAD", "ASR", "MT", "TTS"]
    assert all(s["status"] == "done" for s in body["stages"])
    assert body["overallPercent"] == 100.0
    # TTS nạp voice lười — phải nói rõ để người dùng khỏi tưởng đã tải xong giọng.
    assert "voice" in body["stages"][3]["note"]
