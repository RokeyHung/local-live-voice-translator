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

Mỗi model còn mang cờ ``complete``: tải nửa chừng bị ngắt vẫn để lại thư mục trên
đĩa, và một model tải dở nằm lẫn trong danh sách "đã tải" là thứ tệ nhất — nó trông
như đã xong, chỉ nhỏ hơn, rồi gãy ở lúc nạp. Xem :func:`_hf_cache_complete`.
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
    # False = tải dở dang (bị ngắt giữa chừng). Vẫn liệt kê ra chứ không giấu đi: giấu
    # thì người dùng thấy đĩa đầy mà không hiểu vì sao, và không có lối nào xoá nó.
    complete: bool = True


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


def _no_partial_files(model_dir: Path) -> bool:
    """Thư mục còn sót file tải dở (``*.tmp``) không?

    Đường tải của sherpa-onnx và Kokoro đều ghi ra ``<tên>.tmp`` rồi mới đổi tên, nên
    còn ``.tmp`` nghĩa là lượt tải trước chết giữa chừng.
    """
    return not any(model_dir.rglob("*.tmp"))


def _blob_is_missing(blobs: Path, leftover: Path) -> bool:
    """File ``.incomplete`` này có thật sự là một lượt tải chưa xong không?

    ``huggingface_hub`` đặt tên file tạm là ``<sha>.<mã lượt tải>.incomplete`` (bản cũ
    chỉ có ``<sha>.incomplete``) rồi đổi tên thành ``blobs/<sha>`` khi xong — nhưng
    lượt CHẾT thì file tạm của nó nằm lại vĩnh viễn, kể cả sau khi một lượt sau tải
    thành công. Nên "có ``.incomplete``" tự nó không có nghĩa là model hỏng: phải xem
    blob đích đã có chưa. Đếm cả rác cũ là bảo người dùng tải lại vài GB vô ích.
    """
    base = leftover.name[: -len(".incomplete")]
    candidates = {base, base.rsplit(".", 1)[0]}
    return not any((blobs / name).is_file() for name in candidates)


def _live_revisions(repo_dir: Path) -> list[Path]:
    """Những revision thật sự được dùng: cái mà ``refs/`` trỏ tới.

    Cache có thể chứa nhiều revision, trong đó có bản tải dở của một revision mới hơn
    mà không ai trỏ tới. Chỉ revision trong ``refs/`` mới là thứ lúc nạp sẽ đọc, nên
    chỉ nó quyết định model dùng được hay không.
    """
    snapshots = repo_dir / "snapshots"
    if not snapshots.is_dir():
        return []
    present = [d for d in snapshots.iterdir() if d.is_dir()]
    named: set[str] = set()
    for ref in (repo_dir / "refs").rglob("*"):
        try:
            if ref.is_file():
                named.add(ref.read_text().strip())
        except OSError:
            continue
    # Có refs mà không revision nào khớp = chết trước khi lấy xong revision đó.
    return [d for d in present if d.name in named] if named else present


def _hf_cache_complete(repo_dir: Path) -> bool:
    """Thư mục cache HuggingFace này đã tải xong chưa?

    ``huggingface_hub`` tải mỗi file vào ``blobs/<sha>.incomplete`` rồi mới đổi tên
    thành ``blobs/<sha>`` và trỏ symlink từ ``snapshots/<rev>/<tên file>`` sang. Ba
    dấu vết của một lượt tải bị ngắt, theo đúng thứ tự nó có thể chết:

    1. còn ``.incomplete`` mà blob đích CHƯA có — chết giữa lúc tải một file;
    2. chưa có ``snapshots/``, hoặc không revision nào khớp ``refs/`` — chết trước
       khi lấy xong file đầu tiên;
    3. có symlink trỏ vào một blob không tồn tại — cache bị xoá tay một nửa.

    Không bắt được đúng một trường hợp: chết đúng khe giữa hai file, khi file trước
    đã xong hẳn và file sau chưa kịp tạo ``.incomplete``. Repo lúc đó thiếu hẳn một
    file mà trên đĩa không để lại dấu vết nào, và biết được nó thiếu thì phải hỏi
    HuggingFace — tức là phải có mạng, trong khi hàm này chạy cả lúc offline. Đó là
    lý do vẫn phải có nút "Tải lại".
    """
    blobs = repo_dir / "blobs"
    if blobs.is_dir():
        if any(_blob_is_missing(blobs, item) for item in blobs.glob("*.incomplete")):
            return False

    revisions = _live_revisions(repo_dir)
    if not revisions:
        return False

    for revision in revisions:
        contents = list(revision.rglob("*"))
        if not contents:
            return False
        for item in contents:
            # `exists()` đi theo symlink: symlink chỏng chơ thì trả False.
            if item.is_symlink() and not item.exists():
                return False
    return True


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
                        complete=_hf_cache_complete(entry),
                    )
                )

    tts_dir = models_dir / "sherpa-tts"
    if tts_dir.is_dir():
        for entry in sorted(tts_dir.iterdir()):
            # Bỏ qua thư mục giải nén dở (`.incomplete-<voice>`): nó không phải một
            # model, chỉ là rác của lượt tải trước, và lượt sau sẽ ghi đè lên nó.
            if entry.is_dir() and not entry.name.startswith("."):
                found.append(
                    InstalledModel(
                        name=entry.name,
                        stage="TTS",
                        path=str(entry),
                        size_bytes=_dir_size(entry),
                        complete=_no_partial_files(entry),
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
                complete=_no_partial_files(kokoro_dir),
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
