"""Cấu hình và preset.

Cố tình KHÔNG re-export biến singleton ``settings``: tên đó trùng với submodule
``config.settings``, nên khi nó là thuộc tính của package thì
``import llvt_ai_service.config.settings`` trả về *đối tượng Settings* chứ không phải
module — kể cả `monkeypatch.setattr` theo tên đầy đủ cũng vấp. Ai cần cấu hình thì gọi
``get_settings()``, đằng nào nó cũng là bản duy nhất và đọc lại được sau khi đổi.
"""

from llvt_ai_service.config.settings import Settings, get_settings

__all__ = ["Settings", "get_settings"]
