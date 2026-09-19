"""Tài nguyên mà tiến trình AI service đang dùng (phục vụ Tuần 8).

Renderer không đọc được thông tin này: nó nằm trong sandbox Chromium và chỉ thấy
được vài chỉ số chung của máy. Model chạy trong tiến trình Python nên chỉ tiến
trình đó tự đo được phần mình chiếm.

VRAM cố ý không đo: trên Apple Silicon bộ nhớ là hợp nhất (đã tính trong RSS),
còn đọc VRAM rời cần thư viện riêng theo từng hãng — ngoài phạm vi đồ án.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import psutil

from llvt_ai_service.application.gpu_usage import GpuUsage, read_gpu_usage


@dataclass
class ResourceUsage:
    # % của MỘT lõi, kiểu `top`: máy 16 luồng lên được 1600. Giữ nguyên đơn vị này
    # vì báo cáo soak (scripts/soak.py) đã ghi theo nó; giao diện dùng hai số bên dưới.
    cpu_percent: float
    cpu_count: int
    # % CPU toàn máy, 0–100 — con số Task Manager hiện. Màn Chẩn đoán từng hiện
    # `cpu_percent` và ra "400%" khi whisper.cpp chạy 4 luồng trên máy 16 luồng.
    system_cpu_percent: float
    gpus: list[GpuUsage]
    rss_mb: float  # bộ nhớ thường trú của tiến trình service
    system_total_mb: float
    system_used_percent: float
    threads: int


_process = psutil.Process(os.getpid())
# Lần gọi đầu của cpu_percent() luôn trả 0.0 (chưa có mốc so sánh) — gọi trước
# một lần lúc nạp module để lần đo thật đầu tiên đã có số.
_process.cpu_percent(interval=None)
psutil.cpu_percent(interval=None)


def read_usage() -> ResourceUsage:
    memory = psutil.virtual_memory()
    return ResourceUsage(
        cpu_percent=round(_process.cpu_percent(interval=None), 1),
        cpu_count=psutil.cpu_count(logical=True) or 0,
        system_cpu_percent=round(psutil.cpu_percent(interval=None), 1),
        gpus=read_gpu_usage(),
        rss_mb=round(_process.memory_info().rss / (1024 * 1024), 1),
        system_total_mb=round(memory.total / (1024 * 1024), 1),
        system_used_percent=memory.percent,
        threads=_process.num_threads(),
    )
