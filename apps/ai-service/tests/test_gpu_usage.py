"""Gộp bộ đếm GPU Engine của Windows thành % theo từng GPU — cách Task Manager làm.

Tên instance lấy đúng dạng PDH trả về trên máy dev (Iris Xe + RTX 4060).
"""

from __future__ import annotations

from llvt_ai_service.application.gpu_usage import busiest_engine_per_adapter

IRIS = (0x0, 0xFD19)
RTX = (0x0, 0x10170)


def _inst(pid: int, luid_low: int, engine: int, kind: str = "3D") -> str:
    return f"pid_{pid}_luid_0x00000000_0x{luid_low:08X}_phys_0_eng_{engine}_engtype_{kind}"


def test_processes_on_the_same_engine_add_up():
    samples = {_inst(100, 0xFD19, 0): 3.0, _inst(200, 0xFD19, 0): 4.5}
    assert busiest_engine_per_adapter(samples) == {IRIS: 7.5}


def test_a_gpu_is_as_busy_as_its_busiest_engine_not_the_sum():
    """Engine 3D 40% + Copy 30% không phải 70%: Task Manager lấy engine bận nhất."""
    samples = {_inst(1, 0x10170, 0): 40.0, _inst(1, 0x10170, 5, "Copy"): 30.0}
    assert busiest_engine_per_adapter(samples) == {RTX: 40.0}


def test_each_gpu_is_kept_apart():
    samples = {_inst(1, 0xFD19, 0): 2.0, _inst(2, 0x10170, 0): 47.0}
    assert busiest_engine_per_adapter(samples) == {IRIS: 2.0, RTX: 47.0}


def test_never_above_100_and_ignores_unknown_instances():
    samples = {_inst(1, 0x10170, 0): 70.0, _inst(2, 0x10170, 0): 60.0, "_Total": 99.0}
    assert busiest_engine_per_adapter(samples) == {RTX: 100.0}
