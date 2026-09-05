"""Liệt kê model ĐÃ TẢI trên đĩa (không phải danh mục giả).

Mỗi adapter tự tải model theo kiểu riêng nên bố cục thư mục khác nhau:

- ``whisper-cpp/``  : file ``.bin`` phẳng do pywhispercpp tải về.
- ``mlx-whisper/``  : cache HuggingFace của backend MLX (``models--mlx-community--…``).
- ``faster-whisper/``: cache HuggingFace của backend CTranslate2.
- ``nllb/``         : cache của HuggingFace (``models--facebook--nllb-...``).
- ``sherpa-tts/``   : mỗi voice một thư mục đã giải nén.
- ``kokoro-ja/``    : model + bộ giọng tiếng Nhật (hai file .onnx/.bin rời).
- ``pyannote/``     : cache HuggingFace của model tách người nói (tùy chọn).

Hàm ở đây quét đúng những bố cục đó và trả dung lượng thật để giao diện khỏi phải
bịa số. Thư mục nào chưa tồn tại thì bỏ qua — nghĩa là khâu đó chưa tải model.
"""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger("llvt.installed_models")

# Chỉ những thư mục này là do app tạo ra. Xoá model nghĩa là xoá đúng chúng, KHÔNG
# phải xoá sạch `models_dir` — người dùng có thể trỏ nó vào một thư mục có sẵn thứ khác.
MANAGED_DIRS = (
    "whisper-cpp",
    "mlx-whisper",
    "faster-whisper",
    "nllb",
    "sherpa-tts",
    "kokoro-ja",
    "pyannote",
)

# Thư mục dùng bố cục cache HuggingFace (`models--<org>--<repo>/`) -> khâu tương ứng.
HF_CACHE_DIRS: tuple[tuple[str, str], ...] = (
    ("mlx-whisper", "ASR"),
    ("faster-whisper", "ASR"),
    ("nllb", "MT"),
    ("pyannote", "DIA"),
)


@dataclass
class InstalledModel:
    name: str
    stage: str  # ASR | MT | TTS | DIA
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

    for dir_name, stage in HF_CACHE_DIRS:
        cache_dir = models_dir / dir_name
        if not cache_dir.is_dir():
            continue
        for entry in sorted(cache_dir.iterdir()):
            if entry.is_dir() and entry.name.startswith("models--"):
                found.append(
                    InstalledModel(
                        name=_hf_repo_name(entry.name),
                        stage=stage,
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


def managed_bytes(models_dir: Path) -> int:
    """Tổng dung lượng của các thư mục do app quản lý.

    Đây là con số đúng cho câu hỏi "xoá model thì lấy lại được bao nhiêu đĩa", vì nó
    đo đúng những thư mục mà :func:`purge` sẽ xoá. Nó lớn hơn tổng của :func:`scan`
    một chút: cache HuggingFace còn có ``refs``/``.locks`` nằm ngoài các thư mục
    ``models--*`` mà bảng model không liệt kê.
    """
    return sum(
        _dir_size(models_dir / name) for name in MANAGED_DIRS if (models_dir / name).is_dir()
    )


def file_bytes(path: Path) -> int:
    """Dung lượng một file; SQLite tính kèm ``-wal``/``-shm`` đi cùng nó."""
    total = 0
    for candidate in (path, path.with_name(f"{path.name}-wal"), path.with_name(f"{path.name}-shm")):
        try:
            if candidate.is_file():
                total += candidate.stat().st_size
        except OSError:
            continue
    return total


class NotManagedError(ValueError):
    """Đường dẫn nằm ngoài những thư mục app tự tạo — từ chối xoá."""


def remove_one(models_dir: Path, path: str) -> int:
    """Xoá đúng một model đã tải; trả số byte giải phóng.

    ``path`` phải là đường dẫn ``GET /api/models`` vừa trả về. Kiểm tra lại chứ không
    tin: nhận một đường dẫn tuỳ ý từ REST rồi ``rmtree`` là cách nhanh nhất để xoá
    nhầm thư mục của người dùng. Hai điều kiện phải đúng cả hai — nằm trong một
    ``MANAGED_DIRS``, và là thứ ``scan()`` thật sự liệt kê.
    """
    target = Path(path).resolve()
    roots = [(models_dir / name).resolve() for name in MANAGED_DIRS]
    if not any(target.is_relative_to(root) and target != root for root in roots):
        raise NotManagedError(f"{path} không nằm trong thư mục model do app quản lý.")
    if target not in {Path(m.path).resolve() for m in scan(models_dir)}:
        raise NotManagedError(f"{path} không phải model đã tải nào.")

    size = _dir_size(target) if target.is_dir() else target.stat().st_size
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    logger.info("Đã xoá model %s (%d byte)", target, size)
    return size


def purge(models_dir: Path) -> tuple[list[str], int]:
    """Xoá model đã tải; trả (tên thư mục đã xoá, số byte giải phóng).

    Chỉ đụng tới ``MANAGED_DIRS``. Gọi hàm này khi provider đã được giải phóng, nếu
    không Windows sẽ không cho xoá file đang mở.
    """
    removed: list[str] = []
    freed = 0
    for name in MANAGED_DIRS:
        target = models_dir / name
        if not target.is_dir():
            continue
        size = _dir_size(target)
        try:
            shutil.rmtree(target)
        except OSError:
            logger.warning("Không xoá được %s", target, exc_info=True)
            continue
        removed.append(name)
        freed += size
    return removed, freed
