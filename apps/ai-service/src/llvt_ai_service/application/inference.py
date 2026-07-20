"""Chạy blocking model call ngoài event loop.

whisper.cpp / NLLB / TTS là CPU/GPU-bound và context thường KHÔNG thread-safe,
nên mỗi provider dùng một SerialExecutor: đẩy hàm blocking sang worker thread và
tuần tự hóa bằng lock.
"""

from __future__ import annotations

import asyncio
from typing import Callable, TypeVar

T = TypeVar("T")


class SerialExecutor:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()

    async def run(self, fn: Callable[..., T], *args: object) -> T:
        async with self._lock:
            return await asyncio.to_thread(fn, *args)
