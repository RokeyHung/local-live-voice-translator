"""Cấu hình người dùng đổi được lúc chạy, lưu ra file JSON.

`Settings` đọc từ biến môi trường nên chỉ người khởi chạy service đặt được. Vài thứ
lại thuộc về người dùng cuối và phải sống sót qua lần mở app sau — ví dụ **thư mục
lưu model** (chọn ở màn Cài đặt). Những thứ đó ghi vào file này.

Thứ tự ưu tiên: biến môi trường **thắng** file JSON. Ai đã đặt `LLVT_MODELS_DIR` khi
chạy service thì đó là chủ ý rõ ràng, giao diện không được ghi đè.

File nằm cạnh dữ liệu khác của app (``~/.llvt/settings.json``) và cố tình KHÔNG nằm
trong thư mục model — nếu không, đổi thư mục model xong là mất luôn chỗ ghi nhớ.

File này chứa **access token HuggingFace** nên được ghi với quyền ``0600`` (chỉ chủ
sở hữu đọc được). Token nằm ở dạng thường, giống hệt cách ``huggingface_hub`` lưu
``~/.cache/huggingface/token``; đây là máy cá nhân một người dùng, và chỗ duy nhất
chặt hơn được là keychain của hệ điều hành — ghi vào `docs/18` để cân nhắc sau.
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
WRITABLE_KEYS = frozenset({"models_dir", "hf_token"})

# Khoá là bí mật: không được log ra, không được trả về nguyên văn qua REST.
SECRET_KEYS = frozenset({"hf_token"})


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
    """Ghi đè các khoá được truyền, giữ nguyên phần còn lại. Trả cấu hình sau khi ghi.

    Truyền chuỗi rỗng cho một khoá nghĩa là **xoá** nó khỏi file, chứ không phải lưu
    một chuỗi rỗng — dùng để gỡ token đã lưu.
    """
    unknown = set(values) - WRITABLE_KEYS
    if unknown:
        raise ValueError(f"Khoá không được phép ghi: {', '.join(sorted(unknown))}")
    merged = {**load()}
    for key, value in values.items():
        text = str(value)
        if text:
            merged[key] = text
        else:
            merged.pop(key, None)

    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Ghi ra file tạm rồi đổi tên: mất điện giữa chừng không để lại file JSON cụt.
    tmp = CONFIG_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    # Siết quyền TRƯỚC khi đổi tên, và siết trên file tạm: đặt quyền sau `replace`
    # để lại một khe thời gian file bí mật đọc được bởi mọi người trên máy.
    _restrict(tmp)
    tmp.replace(CONFIG_PATH)
    return merged


def _restrict(path: Path) -> None:
    """Chỉ chủ sở hữu đọc/ghi được (0600). Không làm được thì cảnh báo, không chết."""
    try:
        path.chmod(0o600)
    except OSError:
        # Windows không có quyền POSIX; NTFS thừa kế ACL của thư mục người dùng nên
        # vẫn kín, chỉ là không siết thêm được từ đây.
        logger.debug("Không đặt được quyền 0600 cho %s", path, exc_info=True)


def env_overrides(key: str) -> bool:
    """Biến môi trường có đang quyết định khoá này không (thì API không được đổi)."""
    return f"LLVT_{key.upper()}" in os.environ
