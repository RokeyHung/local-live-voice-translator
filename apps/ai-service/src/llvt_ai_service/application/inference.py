"""Chạy blocking model call ngoài event loop.

whisper.cpp / NLLB / TTS là CPU/GPU-bound và context thường KHÔNG thread-safe,
nên mỗi provider dùng một SerialExecutor: đẩy hàm blocking sang worker thread và
tuần tự hóa bằng lock.

``PinnedExecutor`` là biến thể chặt hơn cho những runtime buộc phải gọi từ ĐÚNG
thread đã tạo ra context (MLX/Metal) — xem docstring của lớp.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Callable, TypeVar

T = TypeVar("T")


class SerialExecutor:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()

    async def run(self, fn: Callable[..., T], *args: object) -> T:
        async with self._lock:
            return await asyncio.to_thread(fn, *args)


class PinnedExecutor:
    """Như SerialExecutor nhưng ghim mọi lời gọi vào MỘT thread cố định.

    MLX gắn GPU stream vào chính thread đã tạo ra nó; gọi từ thread khác thì ném
    ``RuntimeError: There is no stream (gpu,0) in current thread``
    (ml-explore/mlx#2133). ``asyncio.to_thread`` dùng pool mặc định với các worker
    thay thế nhau được, nên ``load()`` và ``transcribe()`` gần như chắc chắn rơi
    vào hai thread khác nhau — đúng cái làm vỡ MLX.

    Một pool đúng một worker giải quyết cả hai việc: mọi lời gọi ở cùng một thread,
    và tuần tự sẵn nên không cần lock.
    """

    def __init__(self, name: str = "llvt-pinned") -> None:
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix=name)

    async def run(self, fn: Callable[..., T], *args: object) -> T:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._pool, partial(fn, *args))

    def shutdown(self) -> None:
        """Đóng thread ghim. Gọi khi provider unload() hẳn."""
        self._pool.shutdown(wait=False)
