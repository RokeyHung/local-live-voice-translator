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
