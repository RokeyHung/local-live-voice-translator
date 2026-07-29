"""Test endpoint đo độ trễ + tài nguyên (Tuần 8).

Provider ASR/MT/TTS là bản giả (conftest) nên số đo ở đây gần 0; test chỉ kiểm
tra hình dạng dữ liệu và các nhánh xử lý, không kiểm tra giá trị đo.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from llvt_ai_service.app import app


def test_benchmark_reports_every_stage():
    with TestClient(app) as client:
        res = client.post("/api/benchmark", json={"source": "vi", "target": "en"})
        assert res.status_code == 200
        body = res.json()
        for key in ("vadMs", "asrMs", "mtMs", "totalMs", "audioMs"):
            assert isinstance(body[key], int), f"{key} phải là số nguyên: {body}"
        assert body["source"] == "vi"
        assert body["target"] == "en"
        # Đoạn mẫu dài 3 s → audioMs cố định, dùng để quy đổi tỉ lệ realtime.
        assert body["audioMs"] == 3000


def test_benchmark_defaults_to_vi_en():
    with TestClient(app) as client:
        res = client.post("/api/benchmark")
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "vi"
        assert body["target"] == "en"


def test_benchmark_rejects_unknown_language():
    with TestClient(app) as client:
        res = client.post("/api/benchmark", json={"source": "vi", "target": "de"})
        assert res.status_code == 422


def test_resources_reports_service_process():
    with TestClient(app) as client:
        res = client.get("/api/resources")
        assert res.status_code == 200
        body = res.json()
        assert body["cpuCount"] >= 1
        assert body["rssMb"] > 0
        assert body["systemTotalMb"] > 0
        assert body["threads"] >= 1
