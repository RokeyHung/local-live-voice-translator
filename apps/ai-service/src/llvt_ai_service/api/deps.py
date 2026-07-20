"""Dependency injection cho REST: lấy Container từ app.state."""

from __future__ import annotations

from fastapi import Request

from llvt_ai_service.application.container import Container


def get_container(request: Request) -> Container:
    return request.app.state.container
