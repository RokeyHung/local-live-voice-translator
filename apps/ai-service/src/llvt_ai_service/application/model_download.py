"""Tải MỘT model cụ thể về đĩa, không nạp vào bộ nhớ (nút "Tải" ở danh mục).

Khác `ModelManager.load_preset()` ở chỗ nó chỉ **tải**: người dùng chuẩn bị trước cho
lần dùng offline, hoặc thử một model khác mà chưa muốn đổi preset đang chạy.

Mỗi họ model tải theo một kiểu riêng, và cả bốn kiểu đó đều đã có sẵn trong adapter
tương ứng — module này chỉ **định tuyến theo tên** rồi gọi lại đúng hàm đó. Cố ý
không viết lại logic tải: hai đường tải khác nhau cho cùng một model là hai chỗ để
lệch nhau (khác thư mục đích, khác cách giải nén).
"""

from __future__ import annotations

import logging
from pathlib import Path

from llvt_ai_service.adapters.asr.faster_whisper import MODEL_MAP as FW_MODELS
from llvt_ai_service.adapters.asr.mlx_whisper import MODEL_MAP as MLX_MODELS
from llvt_ai_service.adapters.asr.whisper_cpp import MODEL_MAP as WHISPER_MODELS
from llvt_ai_service.adapters.mt.nllb import MODEL_MAP as NLLB_MODELS
from llvt_ai_service.config.settings import effective_hf_token

logger = logging.getLogger("llvt.model_download")


class UnknownModelError(ValueError):
    """Tên model không có trong danh mục nào."""


def _download_whisper_cpp(name: str, models_dir: Path) -> Path:
    from pywhispercpp.utils import download_model

    target = models_dir / "whisper-cpp"
    target.mkdir(parents=True, exist_ok=True)
    model_id = WHISPER_MODELS.get(name, name)
    return Path(download_model(model_id, str(target)))


def _snapshot(repo_id: str, models_dir: Path, sub_dir: str) -> Path:
    from huggingface_hub import snapshot_download

    target = models_dir / sub_dir
    target.mkdir(parents=True, exist_ok=True)
    # `token=` tường minh thay vì để thư viện tự dò: model gated (pyannote) cần nó, và
    # đưa thẳng vào đây thì lỗi thiếu quyền lộ ra ngay chỗ này.
    return Path(
        snapshot_download(repo_id, cache_dir=str(target), token=effective_hf_token() or None)
    )


def _download_sherpa_voice(name: str, models_dir: Path) -> Path:
    from llvt_ai_service.adapters.tts.sherpa_onnx import _download_voice

    return _download_voice(name, models_dir / "sherpa-tts")


def _download_kokoro(_name: str, models_dir: Path) -> Path:
    from llvt_ai_service.adapters.tts.kokoro_ja import _download_model

    return _download_model(models_dir)


def resolve(name: str) -> tuple[str, str]:
    """`(khâu, kiểu tải)` cho một tên model — dùng cả để kiểm tra tên có thật không."""
    clean = name.strip()
    if clean in WHISPER_MODELS:
        return "ASR", "whisper_cpp"
    if clean in MLX_MODELS:
        return "ASR", "mlx"
    if clean in FW_MODELS:
        return "ASR", "faster_whisper"
    if clean in NLLB_MODELS:
        return "MT", "nllb"
    if clean == "kokoro-ja":
        return "TTS", "kokoro"
    if clean.startswith(("vits-", "sherpa-onnx-vits-")):
        return "TTS", "sherpa"
    if clean.startswith("pyannote/"):
        return "DIA", "pyannote"
    raise UnknownModelError(f"Không biết model {name!r} — xem danh mục ở màn Quản lý model.")


def download(name: str, models_dir: Path) -> Path:
    """Tải model về ``models_dir``; trả đường dẫn đã tải. Blocking (I/O mạng).

    Model đã có sẵn thì các hàm bên dưới đều tự bỏ qua, nên gọi lại là rẻ.
    """
    clean = name.strip()
    _stage, kind = resolve(clean)
    logger.info("Tải model %s (%s)", clean, kind)
    if kind == "whisper_cpp":
        return _download_whisper_cpp(clean, models_dir)
    if kind == "mlx":
        return _snapshot(MLX_MODELS[clean], models_dir, "mlx-whisper")
    if kind == "faster_whisper":
        return _snapshot(FW_MODELS[clean], models_dir, "faster-whisper")
    if kind == "nllb":
        return _snapshot(NLLB_MODELS[clean], models_dir, "nllb")
    if kind == "kokoro":
        return _download_kokoro(clean, models_dir)
    if kind == "sherpa":
        return _download_sherpa_voice(clean, models_dir)
    return _snapshot(clean, models_dir, "pyannote")
