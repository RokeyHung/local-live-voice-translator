"""Liệt kê model ĐÃ TẢI trên đĩa (không phải danh mục giả).

Mỗi adapter tự tải model theo kiểu riêng nên bố cục thư mục khác nhau:

- ``whisper-cpp/``  : file ``.bin`` phẳng do pywhispercpp tải về.
- ``nllb/``         : cache của HuggingFace (``models--facebook--nllb-...``).
- ``sherpa-tts/``   : mỗi voice một thư mục đã giải nén.
- ``kokoro-ja/``    : model + bộ giọng tiếng Nhật (hai file .onnx/.bin rời).

Hàm ở đây quét đúng bốn bố cục đó và trả dung lượng thật để giao diện khỏi phải
bịa số. Thư mục nào chưa tồn tại thì bỏ qua — nghĩa là khâu đó chưa tải model.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger("llvt.installed_models")


@dataclass
class InstalledModel:
    name: str
    stage: str  # ASR | MT | TTS
    path: str
    size_bytes: int


def _dir_size(path: Path) -> int:
    total = 0
    for item in path.rglob("*"):
        try:
            if item.is_file() and not item.is_symlink():
                total += item.stat().st_size
        except OSError:
            # File biến mất giữa chừng hoặc không đọc được — bỏ qua, đừng làm hỏng cả danh sách.
            continue
    return total


def _hf_repo_name(cache_dir_name: str) -> str:
    """`models--facebook--nllb-200-distilled-600M` → `facebook/nllb-200-distilled-600M`."""
    if not cache_dir_name.startswith("models--"):
        return cache_dir_name
    return cache_dir_name[len("models--") :].replace("--", "/")


def scan(models_dir: Path) -> list[InstalledModel]:
    found: list[InstalledModel] = []

    whisper_dir = models_dir / "whisper-cpp"
    if whisper_dir.is_dir():
        for file in sorted(whisper_dir.glob("*.bin")):
            try:
                found.append(
                    InstalledModel(
                        name=file.stem,
                        stage="ASR",
                        path=str(file),
                        size_bytes=file.stat().st_size,
                    )
                )
            except OSError:
                continue

    nllb_dir = models_dir / "nllb"
    if nllb_dir.is_dir():
        for entry in sorted(nllb_dir.iterdir()):
            if entry.is_dir() and entry.name.startswith("models--"):
                found.append(
                    InstalledModel(
                        name=_hf_repo_name(entry.name),
                        stage="MT",
                        path=str(entry),
                        size_bytes=_dir_size(entry),
                    )
                )

    tts_dir = models_dir / "sherpa-tts"
    if tts_dir.is_dir():
        for entry in sorted(tts_dir.iterdir()):
            if entry.is_dir():
                found.append(
                    InstalledModel(
                        name=entry.name,
                        stage="TTS",
                        path=str(entry),
                        size_bytes=_dir_size(entry),
                    )
                )

    # Voice tiếng Nhật không nằm chung với sherpa-onnx vì dùng runtime khác.
    kokoro_dir = models_dir / "kokoro-ja"
    if kokoro_dir.is_dir():
        found.append(
            InstalledModel(
                name="kokoro-ja",
                stage="TTS",
                path=str(kokoro_dir),
                size_bytes=_dir_size(kokoro_dir),
            )
        )

    return found
