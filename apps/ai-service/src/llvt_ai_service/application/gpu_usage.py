"""% sử dụng từng GPU — cùng nguồn và cùng cách tính với Task Manager của Windows.

Nguồn: bộ đếm hiệu năng ``\\GPU Engine(*)\\Utilization Percentage`` (PDH). Bộ đếm có
cho MỌI hãng (NVIDIA, AMD, Intel) qua driver WDDM, không cần NVML hay cài gì thêm.
Mỗi instance là một (tiến trình, GPU, engine); Task Manager cộng theo engine rồi lấy
engine bận nhất làm % của GPU — ở đây làm y như vậy.

Tên GPU lấy từ DXGI, nối với bộ đếm qua LUID của adapter (bộ đếm chỉ ghi LUID).

Chỉ Windows. macOS không có API công khai nào đọc % GPU mà không cần quyền root
(``powermetrics``), nên trả danh sách rỗng và giao diện hiện "—".
"""

from __future__ import annotations

import logging
import re
import sys
import threading
from dataclasses import dataclass

logger = logging.getLogger("llvt.gpu_usage")

# "pid_1234_luid_0x00000000_0x0000FD19_phys_0_eng_3_engtype_3D"
_INSTANCE = re.compile(r"luid_0x([0-9a-f]+)_0x([0-9a-f]+)_phys_\d+_eng_(\d+)", re.IGNORECASE)


@dataclass(frozen=True)
class GpuUsage:
    name: str
    percent: float


def busiest_engine_per_adapter(samples: dict[str, float]) -> dict[tuple[int, int], float]:
    """Gộp mẫu PDH thành % theo adapter: cộng các tiến trình trên cùng engine, rồi lấy
    engine bận nhất — đúng cách Task Manager hiện cột "GPU"."""
    per_engine: dict[tuple[int, int, int], float] = {}
    for instance, value in samples.items():
        match = _INSTANCE.search(instance)
        if not match:
            continue
        key = (int(match.group(1), 16), int(match.group(2), 16), int(match.group(3)))
        per_engine[key] = per_engine.get(key, 0.0) + value
    per_adapter: dict[tuple[int, int], float] = {}
    for (high, low, _engine), value in per_engine.items():
        adapter = (high, low)
        per_adapter[adapter] = max(per_adapter.get(adapter, 0.0), value)
    return {k: min(v, 100.0) for k, v in per_adapter.items()}


class _WindowsGpuUsage:
    """Giữ một truy vấn PDH sống suốt đời tiến trình: % là chênh lệch giữa hai lần
    thu, nên mỗi lần hỏi cho số của khoảng từ lần hỏi trước tới giờ (giao diện hỏi
    mỗi 2 giây). Lần hỏi đầu tiên chưa có mốc → 0."""

    def __init__(self) -> None:
        import ctypes
        from ctypes import wintypes

        self._ctypes = ctypes
        self._pdh = ctypes.WinDLL("pdh")
        self._lock = threading.Lock()
        self._names = self._adapter_names()

        self._query = ctypes.c_void_p()
        self._counter = ctypes.c_void_p()
        self._check(self._pdh.PdhOpenQueryW(None, 0, ctypes.byref(self._query)))
        self._check(
            self._pdh.PdhAddEnglishCounterW(
                self._query,
                wintypes.LPCWSTR(r"\GPU Engine(*)\Utilization Percentage"),
                0,
                ctypes.byref(self._counter),
            )
        )
        self._pdh.PdhCollectQueryData(self._query)

    @staticmethod
    def _check(status: int) -> None:
        if status != 0:
            raise OSError(f"PDH lỗi 0x{status & 0xFFFFFFFF:08X}")

    def _adapter_names(self) -> dict[tuple[int, int], str]:
        """LUID -> tên GPU, qua DXGI (COM gọi bằng vtable, không cần pywin32)."""
        ctypes = self._ctypes
        from ctypes import wintypes

        class Guid(ctypes.Structure):
            _fields_ = [
                ("d1", wintypes.DWORD),
                ("d2", wintypes.WORD),
                ("d3", wintypes.WORD),
                ("d4", ctypes.c_ubyte * 8),
            ]

        class Luid(ctypes.Structure):
            _fields_ = [("LowPart", wintypes.DWORD), ("HighPart", wintypes.LONG)]

        class AdapterDesc1(ctypes.Structure):
            _fields_ = [
                ("Description", wintypes.WCHAR * 128),
                ("VendorId", wintypes.UINT),
                ("DeviceId", wintypes.UINT),
                ("SubSysId", wintypes.UINT),
                ("Revision", wintypes.UINT),
                ("DedicatedVideoMemory", ctypes.c_size_t),
                ("DedicatedSystemMemory", ctypes.c_size_t),
                ("SharedSystemMemory", ctypes.c_size_t),
                ("AdapterLuid", Luid),
                ("Flags", wintypes.UINT),
            ]

        # IID_IDXGIFactory1 {770aae78-f26f-4dba-a829-253c83d1b387}
        iid = Guid(
            0x770AAE78,
            0xF26F,
            0x4DBA,
            (ctypes.c_ubyte * 8)(0xA8, 0x29, 0x25, 0x3C, 0x83, 0xD1, 0xB3, 0x87),
        )
        factory = ctypes.c_void_p()
        if ctypes.WinDLL("dxgi").CreateDXGIFactory1(ctypes.byref(iid), ctypes.byref(factory)) != 0:
            return {}

        def method(obj: ctypes.c_void_p, index: int, *argtypes):  # noqa: ANN202
            vtable = ctypes.cast(obj, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
            return ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, *argtypes)(vtable[index])

        names: dict[tuple[int, int], str] = {}
        try:
            # IDXGIFactory1::EnumAdapters1 = slot 12; IDXGIAdapter1::GetDesc1 = slot 10;
            # IUnknown::Release = slot 2.
            enum = method(factory, 12, wintypes.UINT, ctypes.POINTER(ctypes.c_void_p))
            index = 0
            while True:
                adapter = ctypes.c_void_p()
                if enum(factory, index, ctypes.byref(adapter)) != 0:  # DXGI_ERROR_NOT_FOUND
                    break
                desc = AdapterDesc1()
                method(adapter, 10, ctypes.POINTER(AdapterDesc1))(adapter, ctypes.byref(desc))
                method(adapter, 2)(adapter)
                luid = (desc.AdapterLuid.HighPart & 0xFFFFFFFF, desc.AdapterLuid.LowPart)
                # Flags & 2 = DXGI_ADAPTER_FLAG_SOFTWARE ("Microsoft Basic Render Driver").
                if not desc.Flags & 2:
                    names[luid] = desc.Description.strip()
                index += 1
        finally:
            method(factory, 2)(factory)
        return names

    def _samples(self) -> dict[str, float]:
        ctypes = self._ctypes
        from ctypes import wintypes

        class FmtValue(ctypes.Structure):
            _fields_ = [("CStatus", wintypes.DWORD), ("doubleValue", ctypes.c_double)]

        class Item(ctypes.Structure):
            _fields_ = [("szName", wintypes.LPWSTR), ("FmtValue", FmtValue)]

        pdh_fmt_double = 0x00000200
        pdh_more_data = 0x800007D2
        size, count = wintypes.DWORD(0), wintypes.DWORD(0)
        status = self._pdh.PdhGetFormattedCounterArrayW(
            self._counter, pdh_fmt_double, ctypes.byref(size), ctypes.byref(count), None
        )
        if status & 0xFFFFFFFF != pdh_more_data:
            return {}
        buffer = (ctypes.c_byte * size.value)()
        self._check(
            self._pdh.PdhGetFormattedCounterArrayW(
                self._counter, pdh_fmt_double, ctypes.byref(size), ctypes.byref(count), buffer
            )
        )
        items = ctypes.cast(buffer, ctypes.POINTER(Item))
        return {
            items[i].szName: items[i].FmtValue.doubleValue
            for i in range(count.value)
            if items[i].FmtValue.CStatus == 0
        }

    def read(self) -> list[GpuUsage]:
        with self._lock:
            self._pdh.PdhCollectQueryData(self._query)
            per_adapter = busiest_engine_per_adapter(self._samples())
        nvidia = _nvml_usage()
        return [
            GpuUsage(
                name=name,
                percent=round(nvidia[name] if name in nvidia else per_adapter.get(luid, 0.0), 1),
            )
            for luid, name in self._names.items()
        ]


_nvml = None


def _nvml_usage() -> dict[str, float]:
    """% bận của card NVIDIA theo chính driver (nguồn của `nvidia-smi`).

    Bộ đếm WDDM ở trên báo THẤP với tải tính toán: whisper.cpp Vulkan chạy hết RTX 4060
    thì `nvidia-smi` ra 89–99% mà engine 3D của Windows chỉ ~47%. nvml.dll đi kèm driver
    NVIDIA nên có sẵn trên mọi máy có card NVIDIA; máy khác thì trả rỗng.
    """
    global _nvml
    import ctypes

    if _nvml is False:
        return {}
    try:
        if _nvml is None:
            lib = ctypes.WinDLL("nvml")
            if lib.nvmlInit_v2() != 0:
                raise OSError("nvmlInit thất bại")
            _nvml = lib

        class Utilization(ctypes.Structure):
            _fields_ = [("gpu", ctypes.c_uint), ("memory", ctypes.c_uint)]

        count = ctypes.c_uint(0)
        _nvml.nvmlDeviceGetCount_v2(ctypes.byref(count))
        out: dict[str, float] = {}
        for i in range(count.value):
            handle = ctypes.c_void_p()
            if _nvml.nvmlDeviceGetHandleByIndex_v2(i, ctypes.byref(handle)) != 0:
                continue
            name = ctypes.create_string_buffer(96)
            util = Utilization()
            if (
                _nvml.nvmlDeviceGetName(handle, name, 96) == 0
                and _nvml.nvmlDeviceGetUtilizationRates(handle, ctypes.byref(util)) == 0
            ):
                out[name.value.decode(errors="replace").strip()] = float(util.gpu)
        return out
    except OSError:
        _nvml = False  # không có driver NVIDIA — đừng thử lại mỗi 2 giây
        return {}


_reader: _WindowsGpuUsage | None = None
_reader_failed = False


def read_gpu_usage() -> list[GpuUsage]:
    """% từng GPU phần cứng (bỏ adapter phần mềm). Rỗng nếu không đọc được — chỉ là
    thông tin hiển thị, không bao giờ được làm hỏng endpoint."""
    global _reader, _reader_failed
    if sys.platform != "win32" or _reader_failed:
        return []
    try:
        if _reader is None:
            _reader = _WindowsGpuUsage()
        return _reader.read()
    except Exception:  # noqa: BLE001
        _reader_failed = True
        logger.warning("Không đọc được bộ đếm GPU của Windows", exc_info=True)
        return []
