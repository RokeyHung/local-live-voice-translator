"""Test: model tải dở dang không được tính là "đã tải".

Tải một model hàng GB bị ngắt giữa chừng (đóng app, mất mạng, mất điện) vẫn để lại
thư mục trên đĩa. Nếu bảng "model đã tải" đếm cả nó thì người dùng thấy model có sẵn,
bấm nạp, rồi nhận một lỗi chẳng liên quan gì tới việc tải — và tệ hơn: mọi đường tải
đều bỏ qua model "đã có", nên bản hỏng đó nằm lại vĩnh viễn.

Ở đây dựng đúng bố cục cache mà `huggingface_hub` để lại ở từng thời điểm nó có thể
chết, và kiểm hai lối thoát: xoá đi, hoặc tải lại với `force`.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application import model_download
from llvt_ai_service.application.installed_models import scan
from llvt_ai_service.config.settings import get_settings


def _symlinks_work(tmp_path: Path) -> bool:
    """Máy này có tạo được symlink không.

    Windows chỉ cho tạo symlink khi bật Developer Mode hoặc chạy bằng quyền admin, còn
    lại ném `WinError 1314`. Hỏi bằng cách thử chứ không bằng `sys.platform`: một máy
    Windows đã bật Developer Mode thì vẫn nên chạy đủ bài.
    """
    probe = tmp_path / ".symlink-probe"
    target = tmp_path / ".symlink-target"
    target.write_bytes(b"")
    try:
        probe.symlink_to(target)
    except (OSError, NotImplementedError):
        return False
    finally:
        probe.unlink(missing_ok=True)
        target.unlink(missing_ok=True)
    return True


def _link_or_copy(link: Path, blob: Path) -> None:
    """Symlink nếu được, không thì copy — đúng cách `huggingface_hub` tự lùi.

    Cache thật trên một máy Windows không bật Developer Mode là file copy chứ không
    phải symlink (`huggingface_hub` in hẳn cảnh báo về việc đó khi tải). Dựng cache giả
    bằng symlink cứng nhắc thì 13 test ở file này hỏng sẵn trên Windows bằng
    `WinError 1314` — hỏng vì môi trường, không phải vì mã sai, mà lại che mất những
    lần hỏng thật.
    """
    try:
        link.symlink_to(blob)
    except (OSError, NotImplementedError):
        shutil.copy2(blob, link)


def _hf_repo(cache_dir: Path, repo: str, *, files: dict[str, bytes]) -> Path:
    """Dựng một cache HuggingFace ĐÃ TẢI XONG: blob thật + symlink từ snapshot."""
    repo_dir = cache_dir / f"models--{repo.replace('/', '--')}"
    blobs = repo_dir / "blobs"
    snapshot = repo_dir / "snapshots" / "abc123"
    blobs.mkdir(parents=True)
    snapshot.mkdir(parents=True)
    (repo_dir / "refs").mkdir()
    (repo_dir / "refs" / "main").write_text("abc123")
    for index, (name, data) in enumerate(files.items()):
        blob = blobs / f"sha{index}"
        blob.write_bytes(data)
        _link_or_copy(snapshot / name, blob)
    return repo_dir


def test_a_finished_download_is_complete(tmp_path):
    _hf_repo(tmp_path / "nllb", "facebook/nllb-200-distilled-600M", files={"model.bin": b"x" * 64})

    (model,) = scan(tmp_path)
    assert model.name == "facebook/nllb-200-distilled-600M"
    assert model.complete is True


def test_a_download_cut_mid_file_is_incomplete(tmp_path):
    """Chết giữa lúc tải một file: `huggingface_hub` để lại `blobs/<sha>.incomplete`."""
    repo = _hf_repo(tmp_path / "nllb", "facebook/nllb-200-1.3B", files={"model.bin": b"x" * 64})
    (repo / "blobs" / "sha1.incomplete").write_bytes(b"y" * 8)

    (model,) = scan(tmp_path)
    assert model.complete is False


def test_a_leftover_incomplete_from_a_retried_download_is_not_a_problem(tmp_path):
    """Lượt tải chết để lại file tạm VĨNH VIỄN, kể cả khi lượt sau đã tải xong.

    Đây là tình huống thật trên máy dev: hai file tạm 0 byte của hai lần đứt mạng nằm
    cạnh blob 2,4 GB đã tải xong. Đếm cả rác cũ là bắt người dùng tải lại vài GB vô ích.
    """
    repo = _hf_repo(tmp_path / "nllb", "facebook/nllb-200-distilled-600M", files={"m.bin": b"x"})
    # Tên thật: `<sha>.<mã lượt tải>.incomplete`, và `blobs/sha0` thì đã có.
    (repo / "blobs" / "sha0.c2d5700f.incomplete").write_bytes(b"")
    (repo / "blobs" / "sha0.c4982148.incomplete").write_bytes(b"")

    (model,) = scan(tmp_path)
    assert model.complete is True


def test_a_revision_nothing_points_at_does_not_decide(tmp_path):
    """Cache giữ cả bản tải dở của một revision mới hơn mà `refs/` không trỏ tới.

    Lúc nạp chỉ đọc revision trong `refs/`, nên đúng nó mới quyết định model dùng được.
    """
    cache = tmp_path / "nllb"
    repo = _hf_repo(cache, "facebook/nllb-200-distilled-600M", files={"config.json": b"{}"})
    orphan = repo / "snapshots" / "moi-hon"
    orphan.mkdir()
    _link_or_copy(orphan / "model.safetensors", repo / "blobs" / "sha0")

    (model,) = scan(tmp_path)
    assert model.complete is True


def test_a_ref_pointing_at_a_missing_revision_is_incomplete(tmp_path):
    repo = _hf_repo(tmp_path / "nllb", "facebook/nllb-200-1.3B", files={"config.json": b"{}"})
    (repo / "refs" / "main").write_text("mot-revision-chua-tai")

    (model,) = scan(tmp_path)
    assert model.complete is False


def test_a_download_cut_before_the_first_file_is_incomplete(tmp_path):
    """Chết trước khi file đầu tiên xong: có thư mục repo nhưng chưa có snapshot nào."""
    repo_dir = tmp_path / "mlx-whisper" / "models--mlx-community--whisper-tiny-asr-4bit"
    (repo_dir / "blobs").mkdir(parents=True)
    (repo_dir / "refs").mkdir()

    (model,) = scan(tmp_path)
    assert model.complete is False


def test_a_cache_with_a_dangling_symlink_is_incomplete(tmp_path):
    """Blob bị xoá tay mà snapshot còn trỏ vào: file coi như không có."""
    if not _symlinks_work(tmp_path):
        pytest.skip("máy không tạo được symlink — cache thật ở đây là file copy")
    repo = _hf_repo(tmp_path / "pyannote", "pyannote/segmentation-3.0", files={"w.bin": b"z" * 16})
    (repo / "blobs" / "sha0").unlink()

    (model,) = scan(tmp_path)
    assert model.complete is False


def test_a_half_extracted_voice_is_incomplete(tmp_path):
    """sherpa-onnx/Kokoro tải ra `<tên>.tmp` rồi mới đổi tên — còn `.tmp` là còn dở."""
    voice = tmp_path / "sherpa-tts" / "vits-piper-vi_VN-vais1000-medium"
    voice.mkdir(parents=True)
    (voice / "model.onnx.tmp").write_bytes(b"a" * 32)

    (model,) = scan(tmp_path)
    assert model.complete is False


def test_the_staging_folder_is_not_a_model(tmp_path):
    """Thư mục giải nén dở là rác của lượt trước, không phải một model để liệt kê."""
    staging = tmp_path / "sherpa-tts" / ".incomplete-vits-piper-vi_VN-vais1000-medium"
    staging.mkdir(parents=True)
    (staging / "junk").write_bytes(b"a")

    assert scan(tmp_path) == []


def test_the_api_reports_the_incomplete_flag(monkeypatch: pytest.MonkeyPatch, tmp_path):
    models = tmp_path / "models"
    repo = _hf_repo(models / "nllb", "facebook/nllb-200-1.3B", files={"model.bin": b"x" * 64})
    (repo / "blobs" / "sha9.incomplete").write_bytes(b"y")
    monkeypatch.setenv("LLVT_MODELS_DIR", str(models))
    get_settings.cache_clear()

    with TestClient(app) as client:
        body = client.get("/api/models").json()

    assert [(m["name"], m["complete"]) for m in body] == [("facebook/nllb-200-1.3B", False)]


def test_force_wipes_the_broken_copy_before_downloading_again(
    monkeypatch: pytest.MonkeyPatch, tmp_path
):
    """Không có `force` thì bản cụt nằm lại mãi: mọi đường tải đều bỏ qua "đã có"."""
    repo = _hf_repo(tmp_path / "nllb", "facebook/nllb-200-1.3B", files={"model.bin": b"x" * 64})
    (repo / "blobs" / "sha9.incomplete").write_bytes(b"y")

    seen: list[bool] = []

    def fake_snapshot(_repo_id: str, _models_dir: Path, _sub_dir: str) -> Path:
        seen.append(repo.exists())
        return repo

    monkeypatch.setattr(model_download, "_snapshot", fake_snapshot)
    model_download.download("facebook/nllb-200-1.3B", tmp_path, force=True)

    # Bản hỏng phải biến mất TRƯỚC khi lượt tải mới bắt đầu.
    assert seen == [False]


def test_whisper_bin_only_appears_after_the_download_finishes(tmp_path, monkeypatch):
    """File GGML tải vào thư mục tạm rồi mới đổi tên sang chỗ thật.

    pywhispercpp ghi thẳng vào đường dẫn cuối cùng, nên bị kill giữa chừng là để lại
    một `.bin` cụt mà chính nó sẽ coi là "đã có" ở lần sau.
    """
    from llvt_ai_service.adapters.asr import whisper_cpp

    target = tmp_path / "whisper-cpp"

    def killed_midway(model_name: str, download_dir: str, **_: object) -> str:
        # Giống hệt lúc chết thật: file dở đã nằm trên đĩa, hàm không trả về.
        Path(download_dir, f"ggml-{model_name}.bin").write_bytes(b"cut" * 8)
        raise KeyboardInterrupt

    monkeypatch.setattr("pywhispercpp.utils.download_model", killed_midway)
    with pytest.raises(KeyboardInterrupt):
        whisper_cpp.download_ggml("small-q5_1", target)

    assert list(target.glob("*.bin")) == []
    assert scan(tmp_path) == []
