"""Swagger UI phục vụ hoàn toàn cục bộ.

FastAPI mặc định nhúng Swagger UI từ cdn.jsdelivr.net. Với đồ án "chạy hoàn toàn
trên máy" thì đó là mâu thuẫn: máy không có mạng sẽ mở /docs ra trang trắng. Nên
hai file asset được đóng gói kèm service (``llvt_ai_service/static``) và mount ở
``/static``; route /docs bên dưới trỏ Swagger UI vào đó.

Cùng lý do: bỏ ReDoc (cũng nạp từ CDN) — một bộ tài liệu chạy offline là đủ.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

router = APIRouter(include_in_schema=False)


@router.get("/docs")
def swagger_ui() -> HTMLResponse:
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="LLVT Local AI Service — API",
        swagger_js_url="/static/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui.css",
        swagger_favicon_url="/static/favicon.svg",
    )


def mount_docs(app: FastAPI) -> None:
    """Gắn asset tĩnh + route /docs cục bộ vào app."""
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    app.include_router(router)
