"""Theo dõi tiến trình nạp model để giao diện có cái mà hiển thị.

Nạp model lần đầu mất vài phút (tải hàng GB) mà `POST /api/models/load` thì chặn tới
lúc xong, nên trước đây người dùng chỉ thấy một vòng xoay không biết bao giờ hết. Lớp
này ghi lại tiến trình để `GET /api/models/progress` trả về trong lúc lệnh kia còn đang
chạy.

**Cách đo — và vì sao không móc vào thư viện.** whisper.cpp (pywhispercpp) và
transformers đều tự tải bằng `tqdm` riêng, không có callback nào để cắm vào; vá đè
`tqdm` của thư viện thứ ba thì gãy mỗi lần nâng phiên bản. Thay vào đó ta đo thứ chắc
chắn đúng: **số byte đã nằm trên đĩa** trong thư mục của khâu đó, lấy mẫu định kỳ.

Vì vậy:

- `doneBytes` là **số đo thật**, không ước lượng.
- `totalBytes` lấy từ bảng `EXPECTED_BYTES` bên dưới; khâu nào không có trong bảng thì
  để `None` và giao diện chỉ hiện số MB đã tải, **không** hiện phần trăm bịa
  (nguyên tắc xuyên suốt dự án: thà để trống còn hơn hiển thị số không có thật).
- `estimated=True` nói cho giao diện biết phần trăm ấy là xấp xỉ (hiện kèm dấu ≈).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

logger = logging.getLogger("llvt.load_progress")

# Chu kỳ lấy mẫu dung lượng thư mục. 0,5 s đủ mượt cho thanh tiến trình mà không
# làm phiền đĩa khi thư mục model có hàng nghìn file.
SAMPLE_INTERVAL_S = 0.5

# Dung lượng dự kiến của từng model, tính bằng byte. Dùng để quy ra phần trăm.
#
# whisper: đo trực tiếp file đã tải trên máy dev. nllb: lấy theo dung lượng
# `model.safetensors` ghi trên model card của HuggingFace, cộng tokenizer — nên là số
# xấp xỉ. Model nào không có ở đây thì không hiện phần trăm.
EXPECTED_BYTES: dict[str, int] = {
    "whisper-large-v3-turbo-q5": 574_041_195,  # đo được: ggml-large-v3-turbo-q5_0.bin
    "nllb-200-distilled-600M": 2_460_000_000,  # xấp xỉ theo model card
    "nllb-200-distilled-600M-int8": 2_460_000_000,
}

# Model nào là số đo, model nào là ước lượng (để giao diện hiện dấu ≈ cho trung thực).
MEASURED_MODELS = frozenset({"whisper-large-v3-turbo-q5"})

WAITING = "waiting"
DOWNLOADING = "downloading"
LOADING = "loading"
DONE = "done"
FAILED = "failed"
# Dừng theo yêu cầu người dùng — khác `failed`, không có gì hỏng cả.
CANCELLED = "cancelled"


@dataclass
class StageProgress:
    stage: str  # VAD | ASR | MT | TTS
    model: str = ""
    status: str = WAITING
    done_bytes: int = 0
    total_bytes: int | None = None
    estimated: bool = False
    # Khâu không tải gì (VAD nằm trong gói pip, TTS nạp voice lười lúc nói câu đầu).
    note: str = ""

    def percent(self) -> float | None:
        if self.status == DONE:
            return 100.0
        if not self.total_bytes or self.done_bytes == 0:
            # Chưa đo được byte nào tải thêm: hoặc không biết dung lượng, hoặc model đã
            # nằm sẵn trên đĩa và đang được nạp vào RAM. Hiện "0%" ở đây là sai lệch —
            # người dùng tưởng nó đứng im, trong khi thật ra không có gì để tải.
            return None
        return min(99.0, round(self.done_bytes / self.total_bytes * 100, 1))


def dir_size(path: Path) -> int:
    """Tổng dung lượng file trong thư mục; thư mục chưa có thì 0."""
    total = 0
    try:
        for item in path.rglob("*"):
            try:
                if item.is_file() and not item.is_symlink():
                    total += item.stat().st_size
            except OSError:
                continue  # file tải dở bị xoá giữa chừng — bỏ qua, đừng làm hỏng phép đo
    except OSError:
        return 0
    return total


class LoadProgress:
    """Trạng thái nạp model hiện tại. Ghi từ luồng nạp, đọc từ handler REST."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._stages: list[StageProgress] = []
        self._active = False
        self._error: str | None = None
        self._watcher: asyncio.Task[None] | None = None
        self._cancel = False

    # --- ghi -------------------------------------------------------------

    def begin(self, stages: list[tuple[str, str]]) -> None:
        """Bắt đầu một lượt nạp. `stages` là các cặp (tên khâu, tên model)."""
        with self._lock:
            self._stages = [StageProgress(stage=s, model=m) for s, m in stages]
            self._active = True
            self._error = None
            self._cancel = False

    def stage_begin(self, stage: str, watch_dir: Path | None = None) -> None:
        with self._lock:
            current = self._find(stage)
            if current is None:
                return
            current.status = LOADING
            expected = EXPECTED_BYTES.get(current.model)
            current.total_bytes = expected
            current.estimated = expected is not None and current.model not in MEASURED_MODELS
        if watch_dir is not None:
            self._start_watcher(stage, watch_dir)

    def stage_done(self, stage: str, note: str = "") -> None:
        self._stop_watcher()
        with self._lock:
            current = self._find(stage)
            if current is None:
                return
            current.status = DONE
            current.note = note or current.note

    def stage_failed(self, stage: str, message: str, *, fatal: bool = True) -> None:
        """Đánh dấu một khâu hỏng.

        ``fatal=False`` cho khâu không bắt buộc (DIA): ghi lý do để giao diện hiện
        được, nhưng KHÔNG tắt cờ "đang nạp" — lượt nạp vẫn chạy tiếp với những khâu
        còn lại, và báo là đã xong trong lúc còn đang nạp thì thanh tiến trình sẽ
        đứng im giữa chừng.
        """
        self._stop_watcher()
        with self._lock:
            current = self._find(stage)
            if current is not None:
                current.status = FAILED
            if fatal:
                self._active = False
            self._error = message

    def finish(self) -> None:
        self._stop_watcher()
        with self._lock:
            self._active = False
            self._cancel = False

    # --- huỷ giữa chừng ---------------------------------------------------

    @property
    def cancel_requested(self) -> bool:
        with self._lock:
            return self._cancel

    def request_cancel(self) -> None:
        """Xin dừng lượt nạp; vòng nạp dừng ở ranh giới khâu kế tiếp.

        Không dừng được một lượt tải ĐANG chạy: `huggingface_hub` và pywhispercpp
        tải trong worker thread, mà thread thì không giết ngang được. Nên khâu đang
        tải sẽ tải nốt rồi mới dừng — vẫn đáng, vì chỗ tốn nhất là những khâu SAU
        (bấm huỷ trước khi tới NLLB là tiết kiệm được 2,4 GB).
        """
        with self._lock:
            if self._active:
                self._cancel = True

    def cancelled(self) -> None:
        """Đánh dấu lượt nạp đã dừng theo yêu cầu (khác với hỏng)."""
        self._stop_watcher()
        with self._lock:
            for stage in self._stages:
                if stage.status in (WAITING, LOADING, DOWNLOADING):
                    stage.status = CANCELLED
            self._active = False
            self._cancel = False

    # --- đọc -------------------------------------------------------------

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            stages = list(self._stages)
            active = self._active
            error = self._error

        current = next((s for s in stages if s.status in (LOADING, DOWNLOADING)), None)
        return {
            "active": active,
            "cancelling": self.cancel_requested and active,
            "currentStage": current.stage if current else None,
            "overallPercent": self._overall(stages),
            "error": error,
            "stages": [
                {
                    "stage": s.stage,
                    "model": s.model,
                    "status": s.status,
                    "doneBytes": s.done_bytes,
                    "totalBytes": s.total_bytes,
                    "estimated": s.estimated,
                    "percent": s.percent(),
                    "note": s.note,
                }
                for s in stages
            ],
        }

    @staticmethod
    def _overall(stages: list[StageProgress]) -> float | None:
        """Phần trăm tổng: mỗi khâu một phần bằng nhau, khâu đang chạy tính theo byte.

        Chia đều thay vì theo dung lượng vì hai khâu nhẹ (VAD, TTS) gần như tức thì —
        chia theo dung lượng sẽ khiến thanh đứng im ở 0% suốt lúc tải NLLB rồi nhảy vọt.
        """
        if not stages:
            return None
        share = 100.0 / len(stages)
        total = 0.0
        for s in stages:
            if s.status == DONE:
                total += share
            elif s.status in (LOADING, DOWNLOADING):
                fraction = s.percent()
                total += share * (fraction or 0) / 100
        return round(total, 1)

    # --- nội bộ ----------------------------------------------------------

    def _find(self, stage: str) -> StageProgress | None:
        return next((s for s in self._stages if s.stage == stage), None)

    def _start_watcher(self, stage: str, watch_dir: Path) -> None:
        """Lấy mẫu dung lượng thư mục trong lúc khâu này đang nạp.

        Chạy được vì `provider.load()` đẩy phần chặn sang thread khác — event loop vẫn
        rảnh để chạy task này và để trả lời `GET /api/models/progress`.
        """
        self._stop_watcher()
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return  # gọi ngoài event loop (test đồng bộ) — bỏ qua phần theo dõi đĩa
        self._watcher = loop.create_task(self._watch(stage, watch_dir))

    def _stop_watcher(self) -> None:
        if self._watcher is not None:
            self._watcher.cancel()
            self._watcher = None

    async def _watch(self, stage: str, watch_dir: Path) -> None:
        baseline: int | None = None
        while True:
            try:
                size = await asyncio.to_thread(dir_size, watch_dir)
            except asyncio.CancelledError:
                raise
            except Exception:  # pragma: no cover - đo đạc không được làm hỏng việc nạp
                logger.debug("Không đo được %s", watch_dir, exc_info=True)
                return
            with self._lock:
                current = self._find(stage)
                if current is None or current.status not in (LOADING, DOWNLOADING):
                    return
                if baseline is None:
                    # Model có sẵn từ lần trước cũng nằm trong thư mục này; chỉ tính
                    # phần tải thêm thì thanh tiến trình mới đúng ở lần nạp thứ hai.
                    baseline = size
                grown = size - baseline
                if grown > 0:
                    current.status = DOWNLOADING
                    current.done_bytes = grown
            await asyncio.sleep(SAMPLE_INTERVAL_S)


# Một tiến trình chỉ nạp một lượt tại một thời điểm, nên dùng chung một bản.
progress = LoadProgress()
