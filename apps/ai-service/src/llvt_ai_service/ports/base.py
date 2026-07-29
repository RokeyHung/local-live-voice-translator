"""Port cơ sở cho mọi AI provider có vòng đời load/unload."""

from __future__ import annotations

from abc import ABC, abstractmethod


class Provider(ABC):
    #: Tên adapter (dùng để đăng ký trong ModelManager).
    name: str = "provider"

    @abstractmethod
    async def load(self) -> None:
        """Nạp model vào RAM/VRAM. Gọi một lần khi bắt đầu phiên/khởi động."""

    @abstractmethod
    async def unload(self) -> None:
        """Giải phóng tài nguyên khi kết thúc."""

    @property
    def loaded(self) -> bool:
        """Model đã thật sự nằm trong bộ nhớ chưa (mặc định: coi như đã sẵn sàng)."""
        return True

    def runtime_info(self) -> dict[str, str]:
        """Thông tin THẬT lúc chạy: model đang dùng, thiết bị tính toán, backend…

        Giao diện hiển thị đúng những gì service đang chạy thay vì đoán từ phía
        client. Chỉ trả về thứ đọc được chắc chắn; không suy diễn.
        """
        return {}
