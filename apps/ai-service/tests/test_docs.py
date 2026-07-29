"""Test trang tài liệu API mở được khi KHÔNG có mạng.

FastAPI mặc định nhúng Swagger UI từ cdn.jsdelivr.net — máy offline sẽ mở /docs
ra trang trắng, trái với tiêu chí "chạy hoàn toàn cục bộ" của đồ án. Test dưới
đây chặn hồi quy: mọi tài nguyên của /docs phải là đường dẫn nội bộ.
"""

from __future__ import annotations

import re

from fastapi.testclient import TestClient

from llvt_ai_service.app import app

# Bắt mọi src=/href= trỏ ra ngoài (http/https/protocol-relative).
EXTERNAL_ASSET = re.compile(r'(?:src|href)\s*=\s*"(?:https?:)?//', re.IGNORECASE)


def test_docs_page_loads():
    with TestClient(app) as client:
        res = client.get("/docs")
        assert res.status_code == 200
        assert "swagger-ui" in res.text


def test_docs_has_no_external_assets():
    with TestClient(app) as client:
        html = client.get("/docs").text
        found = EXTERNAL_ASSET.findall(html)
        assert not found, f"/docs còn nạp tài nguyên từ ngoài: {found}"


def test_swagger_assets_served_locally():
    with TestClient(app) as client:
        for path in ("/static/swagger-ui-bundle.js", "/static/swagger-ui.css"):
            res = client.get(path)
            assert res.status_code == 200, path
            assert len(res.content) > 1000, path


def test_redoc_disabled():
    """ReDoc nạp từ CDN nên tắt hẳn — một bộ tài liệu chạy offline là đủ."""
    with TestClient(app) as client:
        assert client.get("/redoc").status_code == 404


def test_openapi_documents_websocket_contract():
    """OpenAPI không mô tả được WS, nên contract phải nằm trong phần description."""
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
        description = schema["info"]["description"]
        for token in ("session.start", "audio.chunk", "control.ptt", "tts.audio"):
            assert token in description, token


def test_every_endpoint_documented():
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                assert operation.get("summary"), f"{method.upper()} {path} thiếu summary"
