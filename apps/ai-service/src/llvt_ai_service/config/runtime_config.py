"""Cấu hình người dùng đổi được lúc chạy, lưu ra file JSON.

`Settings` đọc từ biến môi trường nên chỉ người khởi chạy service đặt được. Vài thứ
lại thuộc về người dùng cuối và phải sống sót qua lần mở app sau — ví dụ **thư mục
lưu model** (chọn ở màn Cài đặt). Những thứ đó ghi vào file này.

Thứ tự ưu tiên: biến môi trường **thắng** file JSON. Ai đã đặt `LLVT_MODELS_DIR` khi
chạy service thì đó là chủ ý rõ ràng, giao diện không được ghi đè.

File nằm cạnh dữ liệu khác của app (``~/.llvt/settings.json``) và cố tình KHÔNG nằm
trong thư mục model — nếu không, đổi thư mục model xong là mất luôn chỗ ghi nhớ.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("llvt.runtime_config")

CONFIG_PATH = Path.home() / ".llvt" / "settings.json"

# Chỉ những khoá này được phép ghi từ API; tránh biến file thành nơi đặt bất cứ thứ gì.
WRITABLE_KEYS = frozenset({"models_dir"})


def load() -> dict[str, Any]:
    """Đọc cấu hình đã lưu; file hỏng hoặc không đọc được thì coi như chưa có."""
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError):
        logger.warning("Không đọc được %s — bỏ qua cấu hình đã lưu", CONFIG_PATH, exc_info=True)
        return {}
    if not isinstance(raw, dict):
        return {}
    return {k: v for k, v in raw.items() if k in WRITABLE_KEYS}


def save(**values: Any) -> dict[str, Any]:
    """Ghi đè các khoá được truyền, giữ nguyên phần còn lại. Trả cấu hình sau khi ghi."""
    unknown = set(values) - WRITABLE_KEYS
    if unknown:
        raise ValueError(f"Khoá không được phép ghi: {', '.join(sorted(unknown))}")
    merged = {**load(), **{k: str(v) for k, v in values.items()}}
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Ghi ra file tạm rồi đổi tên: mất điện giữa chừng không để lại file JSON cụt.
    tmp = CONFIG_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(CONFIG_PATH)
    return merged


def env_overrides(key: str) -> bool:
    """Biến môi trường có đang quyết định khoá này không (thì API không được đổi)."""
    return f"LLVT_{key.upper()}" in os.environ
