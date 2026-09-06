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
import shutil
from pathlib import Path

from llvt_ai_service.adapters.asr.faster_whisper import MODEL_MAP as FW_MODELS
from llvt_ai_service.adapters.asr.mlx_whisper import MODEL_MAP as MLX_MODELS
from llvt_ai_service.adapters.asr.whisper_cpp import MODEL_MAP as WHISPER_MODELS
from llvt_ai_service.adapters.mt.nllb import MODEL_MAP as NLLB_MODELS
from llvt_ai_service.config.settings import effective_hf_token

logger = logging.getLogger("llvt.model_download")


class UnknownModelError(ValueError):
    """Tên model không có trong danh mục nào."""


def _ggml_key(name: str) -> str:
    """Tên file GGML chuẩn hoá.

    ``GET /api/models`` trả tên KHÔNG có ``.bin`` (nó là ``Path.stem``), nên nút "Tải
    lại" gửi lên đúng chuỗi đó. Nhận cả hai dạng để cùng một model không có hai cái
    tên tuỳ theo nó đến từ danh mục hay từ danh sách trên đĩa.
    """
    return name if name in WHISPER_MODELS else f"{name}.bin"


def _download_whisper_cpp(name: str, models_dir: Path) -> Path:
    from llvt_ai_service.adapters.asr.whisper_cpp import download_ggml

    model_id = WHISPER_MODELS.get(_ggml_key(name), name)
    try:
        return download_ggml(model_id, models_dir / "whisper-cpp")
    except ValueError as exc:
        # Tên GGML gõ tay không có thật — lỗi của yêu cầu, không phải sự cố tải.
        raise UnknownModelError(str(exc)) from exc


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


# Kiểu tải -> (khâu, thư mục con trong models_dir). Dùng khi người dùng tự gõ một repo
# HuggingFace không có trong danh mục: không đoán được nó thuộc runtime nào từ cái tên,
# nên client phải nói rõ.
KINDS: dict[str, tuple[str, str]] = {
    "whisper_cpp": ("ASR", "whisper-cpp"),
    "mlx": ("ASR", "mlx-whisper"),
    "faster_whisper": ("ASR", "faster-whisper"),
    "nllb": ("MT", "nllb"),
    "pyannote": ("DIA", "pyannote"),
}


def resolve(name: str, kind: str = "") -> tuple[str, str]:
    """`(khâu, kiểu tải)` cho một tên model — dùng cả để kiểm tra tên có thật không.

    ``kind`` là lối thoát cho model NGOÀI danh mục: người dùng gõ một repo HF bất kỳ
    thì không suy ra được nó chạy trên runtime nào (`org/repo` nào cũng giống nhau),
    nên client chỉ rõ. Tên có trong danh mục thì bỏ qua ``kind`` — danh mục biết rõ hơn.
    """
    clean = name.strip()
    if _ggml_key(clean) in WHISPER_MODELS:
        return "ASR", "whisper_cpp"
    if clean in MLX_MODELS:
        return "ASR", "mlx"
    if clean in FW_MODELS:
        return "ASR", "faster_whisper"
    if clean in NLLB_MODELS:
        return "MT", "nllb"
    if clean in ("kokoro-ja", "kokoro-v1.0.onnx"):
        return "TTS", "kokoro"
    if clean.startswith(("vits-", "sherpa-onnx-vits-")):
        return "TTS", "sherpa"
    if clean.startswith("pyannote/"):
        return "DIA", "pyannote"

    if kind:
        if kind not in KINDS:
            raise UnknownModelError(f"Không có runtime {kind!r}. Chọn một trong {list(KINDS)}.")
        if kind == "whisper_cpp":
            # whisper.cpp phân phối theo FILE trong ggerganov/whisper.cpp, không theo
            # repo — `org/repo` đưa vào đây là nhầm chỗ.
            if "/" in clean or not clean.startswith("ggml-"):
                raise UnknownModelError(
                    f"{clean!r} không phải file GGML. whisper.cpp nhận tên dạng "
                    "`ggml-<cỡ>.bin` trong repo ggerganov/whisper.cpp."
                )
        elif "/" not in clean:
            raise UnknownModelError(
                f"{clean!r} không phải repo HuggingFace. Cần dạng `tổ-chức/tên-repo`."
            )
        return KINDS[kind][0], kind

    raise UnknownModelError(
        f"Không biết model {name!r}. Chọn một mục trong danh mục, hoặc gõ đường dẫn "
        "HuggingFace kèm runtime muốn chạy nó."
    )


def _artifact(resolved: str, clean: str, models_dir: Path) -> Path | None:
    """Chỗ model nằm trên đĩa — để xoá đi trước khi tải lại (``force``)."""
    if resolved == "whisper_cpp":
        model_id = WHISPER_MODELS.get(_ggml_key(clean), clean)
        return models_dir / "whisper-cpp" / f"ggml-{model_id}.bin"
    if resolved == "kokoro":
        return models_dir / "kokoro-ja"
    if resolved == "sherpa":
        return models_dir / "sherpa-tts" / clean
    repos = {"mlx": MLX_MODELS, "faster_whisper": FW_MODELS, "nllb": NLLB_MODELS}
    sub_dirs = {"mlx": "mlx-whisper", "faster_whisper": "faster-whisper", "nllb": "nllb"}
    repo_id = repos.get(resolved, {}).get(clean, clean)
    sub_dir = sub_dirs.get(resolved, "pyannote")
    return models_dir / sub_dir / f"models--{repo_id.replace('/', '--')}"


def _discard(target: Path) -> None:
    """Xoá bản đã có trên đĩa. Không ném lỗi: tải lại vẫn chạy được nếu xoá hụt."""
    try:
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()
    except OSError:
        logger.warning("Không xoá được %s trước khi tải lại", target, exc_info=True)


def download(name: str, models_dir: Path, kind: str = "", force: bool = False) -> Path:
    """Tải model về ``models_dir``; trả đường dẫn đã tải. Blocking (I/O mạng).

    Model đã có sẵn thì các hàm bên dưới đều tự bỏ qua, nên gọi lại là rẻ.

    ``force`` xoá bản đang có rồi tải lại từ đầu. Đây là lối thoát cho một bản tải
    dở mà máy không tự nhận ra được — ví dụ file GGML bị cắt cụt từ trước khi có
    staging, hay một repo HF chết đúng khe giữa hai file nên không để lại
    ``.incomplete`` nào. Không có ``force`` thì những bản đó hỏng vĩnh viễn, vì mọi
    đường tải đều bỏ qua model "đã có".
    """
    clean = name.strip()
    _stage, resolved = resolve(clean, kind)
    if force:
        target = _artifact(resolved, clean, models_dir)
        if target is not None:
            logger.info("Tải lại %s: xoá bản đang có ở %s", clean, target)
            _discard(target)
    logger.info("Tải model %s (%s)", clean, resolved)
    if resolved == "whisper_cpp":
        return _download_whisper_cpp(clean, models_dir)
    if resolved == "mlx":
        return _snapshot(MLX_MODELS.get(clean, clean), models_dir, "mlx-whisper")
    if resolved == "faster_whisper":
        return _snapshot(FW_MODELS.get(clean, clean), models_dir, "faster-whisper")
    if resolved == "nllb":
        return _snapshot(NLLB_MODELS.get(clean, clean), models_dir, "nllb")
    if resolved == "kokoro":
        return _download_kokoro(clean, models_dir)
    if resolved == "sherpa":
        return _download_sherpa_voice(clean, models_dir)
    return _snapshot(clean, models_dir, "pyannote")
