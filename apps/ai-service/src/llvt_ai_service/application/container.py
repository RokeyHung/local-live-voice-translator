"""Container DI: gom các thành phần dùng chung, gắn vào app.state."""

from __future__ import annotations

from dataclasses import dataclass

from llvt_ai_service.application.history import HistoryPolicy
from llvt_ai_service.application.model_manager import ModelManager
from llvt_ai_service.application.session_service import SessionService
from llvt_ai_service.config.settings import Settings


@dataclass
class Container:
    settings: Settings
    # Kiểu là HistoryPolicy (không phải port trần) để API bật/tắt lưu lịch sử được.
    repository: HistoryPolicy
    model_manager: ModelManager
    session_service: SessionService
