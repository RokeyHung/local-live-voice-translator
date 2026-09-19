"""REST: phần cứng tính toán và lựa chọn thiết bị (màn Thiết bị âm thanh → Cấu hình thực thi).

Cách làm theo TranscriptionSuite: phát hiện phần cứng ở phía có quyền hỏi hệ điều hành
(ở đây là AI service, chính tiến trình sẽ chạy model), cho người dùng chọn thiết bị,
lưu lựa chọn, và áp dụng ở lần nạp model kế tiếp.
"""

from __future__ import annotations

import asyncio
import logging
import platform
import subprocess
import sys

import psutil
from fastapi import APIRouter, Depends, HTTPException

from llvt_ai_service.adapters.asr.whisper_cpp import (
    AUTO,
    CPU_ONLY,
    DEV_CPU,
    DEV_GPU,
    backend_name,
    list_ggml_devices,
)
from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.config import runtime_config
from llvt_ai_service.config.settings import get_settings, reload_settings
from llvt_ai_service.schemas import ComputeDeviceSchema, ComputeResponse, ComputeUpdate

logger = logging.getLogger("llvt.api.compute")

router = APIRouter(prefix="/api", tags=["compute"])


def _cpu_name() -> str:
    """Tên CPU dễ đọc. platform.processor() trên Windows chỉ ra "Intel64 Family 6…"."""
    for device in list_ggml_devices():
        if device.kind == DEV_CPU and device.description:
            return device.description
    if sys.platform == "darwin":
        try:
            out = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=2,
                check=True,
            )
            return out.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            pass
    return platform.processor() or platform.machine()


def _describe(container: Container) -> ComputeResponse:
    devices = [d for d in list_ggml_devices() if d.is_gpu]
    choice = get_settings().compute_device or AUTO
    loaded = container.model_manager.loaded
    return ComputeResponse(
        choice=choice,
        devices=[
            ComputeDeviceSchema(
                id=d.description,
                backend=backend_name(d.name),
                kind="discrete" if d.kind == DEV_GPU else "integrated",
                memoryMb=d.memory_mb,
            )
            for d in devices
        ],
        deviceSelectable=bool(devices),
        activeDevice=container.model_manager.asr_device(),
        asrAdapter=container.model_manager.providers.asr.name if loaded else None,
        platform=sys.platform,
        cpuName=_cpu_name(),
        cpuCores=psutil.cpu_count(logical=True),
        ramGb=round(psutil.virtual_memory().total / 1024**3, 1),
    )


@router.get(
    "/compute",
    response_model=ComputeResponse,
    summary="Phần cứng tính toán + thiết bị đang chọn",
    description=(
        "GPU liệt kê từ chính whisper.cpp (ggml) nên đúng là những thiết bị model chạy "
        "được — trên laptop hybrid thấy cả GPU tích hợp lẫn card rời, kèm VRAM. "
        "`activeDevice` là thiết bị ASR đang thật sự dùng, `null` khi chưa nạp model."
    ),
)
async def get_compute(container: Container = Depends(get_container)) -> ComputeResponse:
    # Lần đầu phải nạp DLL ggml và khởi tạo Vulkan (~vài trăm ms) → ra khỏi event loop.
    return await asyncio.to_thread(_describe, container)


@router.put(
    "/compute",
    response_model=ComputeResponse,
    summary="Chọn thiết bị tính toán",
    description=(
        "`choice` là `auto`, `cpu`, hoặc `id` của một GPU trong `devices`. Lưu vào "
        "`~/.llvt/settings.json`. Model đang nạp được **giải phóng** chứ không nạp lại "
        '(giống đổi preset): lựa chọn có hiệu lực ở lần nạp kế tiếp — nút "Khởi động '
        'model" hoặc phiên đầu tiên. 400 nếu `choice` không phải thiết bị có trên máy.'
    ),
)
async def update_compute(
    body: ComputeUpdate, container: Container = Depends(get_container)
) -> ComputeResponse:
    choice = body.choice.strip() or AUTO
    gpu_ids = {d.description for d in await asyncio.to_thread(list_ggml_devices) if d.is_gpu}
    if choice not in {AUTO, CPU_ONLY} | gpu_ids:
        raise HTTPException(status_code=400, detail=f"Không có thiết bị tính toán {choice!r}.")

    if choice != (get_settings().compute_device or AUTO):
        # Chuỗi rỗng xoá khoá khỏi settings.json — "auto" là mặc định, khỏi lưu.
        runtime_config.save(compute_device="" if choice == AUTO else choice)
        reload_settings()
        # Model trong RAM đang chạy trên thiết bị CŨ: để nguyên thì ô "đang dùng" và ô
        # vừa chọn lệch nhau. Giải phóng, không nạp lại — nạp là việc của nút riêng.
        await container.model_manager.unload()
        logger.info("Đổi thiết bị tính toán sang %r; đã giải phóng provider", choice)
    return await asyncio.to_thread(_describe, container)
