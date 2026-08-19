"""Test bộ chạy soak (`scripts/soak.py`) — tiêu chí nghiệm thu 14.

Bài soak thật chạy 60 phút với model thật; ở đây chỉ kiểm tra **driver** nói đúng
giao thức WS và tổng hợp báo cáo đúng: chạy vài giây qua TestClient với provider giả
(conftest), tắt nhịp thời gian thực.
"""

from __future__ import annotations

import asyncio
import importlib.util
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from llvt_ai_service.app import app

# scripts/ không phải package nên nạp thẳng theo đường dẫn file.
_SOAK_PATH = Path(__file__).resolve().parents[1] / "scripts" / "soak.py"
_spec = importlib.util.spec_from_file_location("llvt_soak", _SOAK_PATH)
assert _spec and _spec.loader
soak = importlib.util.module_from_spec(_spec)
sys.modules["llvt_soak"] = soak
_spec.loader.exec_module(soak)


class WsBridge:
    """Bọc WebSocket của TestClient (đồng bộ) cho vừa Protocol bất đồng bộ của driver."""

    def __init__(self, ws: Any) -> None:
        self._ws = ws

    async def send(self, message: dict[str, Any]) -> None:
        await asyncio.to_thread(self._ws.send_json, message)

    async def recv(self) -> dict[str, Any]:
        return await asyncio.to_thread(self._ws.receive_json)


def _run(opts: Any, sampler: Any = None) -> Any:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            return asyncio.run(soak.run_soak(WsBridge(ws), opts, sampler=sampler))


def test_soak_completes_and_reports_utterances():
    """Chạy hết thời lượng → verdict ĐẠT, có câu chạy trọn pipeline, không lỗi."""
    opts = soak.SoakOptions(
        minutes=3 / 60,  # 3 giây
        utterance_seconds=1.0,
        gap_seconds=0.0,
        realtime=False,
    )
    report = _run(opts)

    assert report.verdict == "ĐẠT", report.notes
    assert report.utterances_ok >= 1
    assert report.utterances_failed == 0
    assert not report.errors
    assert not report.disconnected
    assert report.latency_ms["p50"] >= 0


def test_soak_records_resource_samples():
    """Có sampler thì báo cáo kèm RSS đầu/cuối để phát hiện rò rỉ."""
    calls = {"n": 0}

    async def sampler() -> dict[str, Any]:
        calls["n"] += 1
        # Giả lập RSS tăng dần: 1000 MB rồi 1500 MB.
        return {"rssMb": 1000.0 + 500 * (calls["n"] - 1), "cpuPercent": 12.5}

    opts = soak.SoakOptions(
        minutes=3 / 60,
        utterance_seconds=1.0,
        gap_seconds=0.0,
        realtime=False,
        sample_every_s=0.0,  # lấy mẫu mỗi vòng
    )
    report = _run(opts, sampler=sampler)

    assert len(report.resources) >= 2
    assert report.rss_growth_mb is not None and report.rss_growth_mb > 0
    # Tăng >200 MB phải được cảnh báo, nhưng KHÔNG làm trượt bài (chỉ sập mới trượt).
    assert report.verdict == "ĐẠT"
    assert any("rò rỉ bộ nhớ" in note for note in report.notes)


def test_soak_fails_when_connection_drops():
    """Kết nối chết giữa chừng → TRƯỢT (đây đúng là thứ tiêu chí 14 muốn bắt)."""

    class DeadConnection:
        async def send(self, message: dict[str, Any]) -> None:
            raise ConnectionError("service đã chết")

        async def recv(self) -> dict[str, Any]:
            return {"type": "state", "payload": {"state": "Idle"}}

    opts = soak.SoakOptions(minutes=1 / 60, realtime=False)
    report = asyncio.run(soak.run_soak(DeadConnection(), opts))

    assert report.verdict == "TRƯỢT"
    assert report.disconnected
    assert any("Mất kết nối" in note for note in report.notes)
