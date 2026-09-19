"""Adapter ASR: whisper.cpp (runtime mặc định cho cả Windows và macOS) — Tuần 3.

Dùng gói ``pywhispercpp`` (nhúng whisper.cpp, có wheel dựng sẵn kèm Metal trên
Apple Silicon). Model GGML tự tải lần đầu từ HF ``ggerganov/whisper.cpp`` vào
``models_dir``. Chỉ chạy task ``transcribe`` (``translate=False``) để lấy văn bản
theo đúng ngôn ngữ nguồn — việc dịch là của module MT (Tuần 4).

whisper.cpp context KHÔNG thread-safe: một ``SerialExecutor`` nội bộ đẩy lời gọi
blocking sang worker thread và tuần tự hóa bằng lock, nên nhiều pipeline
(mic/system) dùng chung một model instance vẫn an toàn.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import os
import re
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol, Sequence

import numpy as np

from llvt_ai_service.adapters.asr.hallucination import rejection_reason, strip_non_speech
from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript
from llvt_ai_service.ports.asr import SpeechToTextProvider

logger = logging.getLogger("llvt.adapters.asr.whisper_cpp")

SAMPLE_RATE = 16000

# Tham số giải mã dùng cho MỌI lần transcribe. Lý do từng cái (biên bản GVHD 19/08
# mục 4.1 — hallucination trên đoạn im lặng):
#
# * ``no_context`` — không mang ngữ cảnh câu trước sang câu sau. Bật ngữ cảnh thì một
#   câu ma sinh ra sẽ tự nuôi chính nó ở các câu kế tiếp. pywhispercpp đã mặc định
#   True nhưng đây là tham số quan trọng nhất, không để nó phụ thuộc mặc định của lib.
# * ``temperature_inc = 0`` — TẮT fallback nhiệt độ. Whisper giải mã lại ở nhiệt độ
#   cao hơn khi thấy kết quả "kém", và đó đúng là lúc nó sáng tác nhiều nhất; một câu
#   xấu còn có thể tốn tới 6 lượt giải mã, phá vỡ ngân sách độ trễ. Mất đường thoát
#   khỏi vòng lặp lặp từ, nhưng ``hallucination.is_degenerate()`` bắt lại. Thêm một
#   cái lợi: giải mã tất định → số WER đo trên FLEURS lặp lại được.
# * ``single_segment`` — đoạn vào đây đã là MỘT câu do VAD cắt (≤ ``max_speech_ms``).
#   Ép một segment chặn đúng kiểu ma phổ biến nhất: text thật, rồi dính thêm một
#   segment "Thanks for watching" ở phần im lặng cuối.
# * ``suppress_nst`` — bỏ token phi-lời-nói ([Music], (applause)…).
#
# Cố tình KHÔNG đặt ``no_speech_thold`` / ``entropy_thold`` / ``logprob_thold``:
# pywhispercpp đánh dấu no_speech_thold là "not implemented", còn hai cái kia chỉ có
# tác dụng bên trong vòng fallback nhiệt độ vừa bị tắt. Việc lọc thật nằm ở
# ``adapters/asr/hallucination.py``, nơi kiểm thử được.
DECODE_PARAMS: dict[str, Any] = {
    "translate": False,  # task=transcribe, KHÔNG dịch — việc dịch là của module MT
    "print_progress": False,
    "print_realtime": False,
    "no_context": True,
    "temperature": 0.0,
    "temperature_inc": 0.0,
    "single_segment": True,
    "suppress_blank": True,
    "suppress_nst": True,
}


def _supported(params: dict[str, Any]) -> dict[str, Any]:
    """Bỏ tham số mà bản pywhispercpp đang cài không biết (nó raise nếu gặp khoá lạ)."""
    try:
        from pywhispercpp.constants import PARAMS_SCHEMA
    except Exception:  # noqa: BLE001 — không có lib thì cứ truyền nguyên, để nó tự báo
        return dict(params)
    known = {key: value for key, value in params.items() if key in PARAMS_SCHEMA}
    for key in params.keys() - known.keys():
        logger.warning("pywhispercpp không hỗ trợ tham số %r — bỏ qua", key)
    return known


# Tên file THẬT trong repo `ggerganov/whisper.cpp` -> id mà pywhispercpp hiểu.
#
# Khoá cố ý là **đường dẫn thật** chứ không phải một tên tự đặt: nó là thứ người dùng
# thấy trên HuggingFace, thứ nằm trên đĩa sau khi tải (bỏ đuôi `.bin`), và thứ dán
# thẳng vào ô "Tự chọn" hay `POST /api/models/download` được. Một tên cho một model,
# không phải hai.
#
# Giá trị là id của pywhispercpp — nó tự dựng lại tên file, nên phần này vẫn phải có.
# Tên nào không nằm trong bảng được truyền thẳng xuống pywhispercpp, nên mọi id trong
# `constants.AVAILABLE_MODELS` vẫn dùng được.
#
# CỐ TÌNH không liệt kê các biến thể `.en` (small.en, medium.en…) dù whisper.cpp có:
# ứng dụng luôn phải nhận cả vi/ja/zh, model English-only sẽ trả rác cho ba thứ tiếng
# đó. Ai muốn đo riêng chiều en→vi vẫn đặt thẳng `small.en` vào preset được.
MODEL_MAP: dict[str, str] = {
    "ggml-tiny-q5_1.bin": "tiny-q5_1",
    "ggml-tiny-q8_0.bin": "tiny-q8_0",
    "ggml-base-q5_1.bin": "base-q5_1",
    "ggml-base-q8_0.bin": "base-q8_0",
    "ggml-small.bin": "small",
    "ggml-small-q5_1.bin": "small-q5_1",
    "ggml-small-q8_0.bin": "small-q8_0",
    "ggml-medium.bin": "medium",
    "ggml-medium-q5_0.bin": "medium-q5_0",
    "ggml-medium-q8_0.bin": "medium-q8_0",
    "ggml-large-v3.bin": "large-v3",
    "ggml-large-v3-q5_0.bin": "large-v3-q5_0",
    "ggml-large-v3-turbo.bin": "large-v3-turbo",
    "ggml-large-v3-turbo-q5_0.bin": "large-v3-turbo-q5_0",
    "ggml-large-v3-turbo-q8_0.bin": "large-v3-turbo-q8_0",
}


class WhisperModel(Protocol):
    """Giao diện tối thiểu của pywhispercpp.model.Model (cho phép tiêm bản giả)."""

    def transcribe(self, media: np.ndarray, **params: Any) -> list[Any]: ...


# loader: (model_id, models_dir) -> WhisperModel. Blocking (tải + nạp model).
ModelLoader = Callable[[str, str | None], WhisperModel]


def _read_system_info() -> str:
    """Cờ build thật của whisper.cpp (METAL/CUDA/BLAS…) — không đoán từ nền tảng."""
    try:
        from pywhispercpp.model import Model

        return str(Model.system_info())
    except Exception:  # noqa: BLE001 — chỉ là thông tin hiển thị, không được làm hỏng load
        return ""


_GPU_LINE = re.compile(r"whisper_backend_init_gpu: using (\S+) backend")
# Tên thiết bị ggml ("Vulkan0", "CUDA0", "MTL0") -> tên hiển thị.
_GPU_NAMES = (("vulkan", "Vulkan"), ("cuda", "CUDA"), ("mtl", "Metal"), ("metal", "Metal"))


def gpu_device_from_log(log: str) -> str | None:
    """Tên thiết bị ggml whisper.cpp đã nạp model lên ("Vulkan1", "MTL0"), hoặc None."""
    match = _GPU_LINE.search(log)
    return match.group(1) if match else None


def gpu_backend_from_log(log: str) -> str | None:
    """Thiết bị GPU whisper.cpp THẬT SỰ dùng, đọc từ log lúc nạp model.

    Cần thiết vì backend Vulkan không khai báo gì trong ``system_info()`` — bản build
    Vulkan chạy GPU mà cờ build vẫn trông như CPU. Log thì ghi đúng cả hai trường hợp:
    ``using Vulkan0 backend`` khi có card, ``no GPU found`` khi không (lúc đó ggml
    tự lùi về CPU và hàm này trả ``None``).
    """
    device = gpu_device_from_log(log)
    return None if device is None else backend_name(device)


def backend_name(ggml_device: str) -> str:
    """Tên thiết bị ggml ("Vulkan1", "CUDA0", "MTL0") -> tên backend ("Vulkan"…)."""
    lowered = ggml_device.lower()
    for prefix, name in _GPU_NAMES:
        if lowered.startswith(prefix):
            return name
    return ggml_device


# enum ggml_backend_dev_type
DEV_CPU = 0
DEV_GPU = 1
DEV_IGPU = 2

# Lựa chọn thiết bị tính toán (settings.compute_device). Ngoài hai giá trị này thì
# là tên một GPU, đúng như `GgmlDevice.description`.
AUTO = "auto"
CPU_ONLY = "cpu"


@dataclass(frozen=True)
class GgmlDevice:
    """Một thiết bị ggml thấy. ``name`` là tên nội bộ ("Vulkan1"), ``description``
    là tên thật của card ("NVIDIA GeForce RTX 4060 Laptop GPU")."""

    name: str
    description: str
    kind: int
    memory_mb: int | None = None

    @property
    def is_gpu(self) -> bool:
        return self.kind in (DEV_GPU, DEV_IGPU)


def pick_gpu_device(devices: Sequence[GgmlDevice]) -> dict[str, Any] | None:
    """Chế độ "auto": chọn thiết bị cho whisper.cpp từ danh sách của ggml.

    whisper.cpp lấy GPU **đầu tiên** ggml liệt kê, mà trên laptop hybrid đó là GPU
    tích hợp. Đo trên máy dev (Iris Xe + RTX 4060), large-v3-turbo với 3–5 s audio:
    Iris Xe ~9,9 s, RTX 4060 ~0,13 s. Nên có card rời thì chọn card rời. Chỉ có GPU
    tích hợp thì vẫn để nó chạy — Iris Xe vẫn nhanh hơn CPU (~17 s).
    Trả ``context_params`` cho pywhispercpp, ``None`` = giữ mặc định.
    """
    gpus = [d.kind for d in devices if d.is_gpu]
    if DEV_GPU not in gpus:
        return None
    # gpu_device đếm trong số thiết bị GPU/IGPU, đúng cách whisper.cpp đếm.
    index = gpus.index(DEV_GPU)
    return None if index == 0 else {"gpu_device": index}


def resolve_device(choice: str, devices: Sequence[GgmlDevice]) -> dict[str, Any] | None:
    """Đổi lựa chọn của người dùng thành ``context_params`` cho pywhispercpp.

    GPU đã lưu mà không còn trên máy (tháo eGPU, đổi máy mang theo settings.json) thì
    lùi về auto thay vì làm hỏng lượt nạp.
    """
    if choice == CPU_ONLY:
        return {"use_gpu": False}
    if choice and choice != AUTO:
        gpus = [d for d in devices if d.is_gpu]
        for index, device in enumerate(gpus):
            if device.description == choice:
                return None if index == 0 else {"gpu_device": index}
        logger.warning("Không thấy GPU %r trên máy này — dùng chế độ tự động", choice)
    return pick_gpu_device(devices)


@functools.cache
def list_ggml_devices() -> tuple[GgmlDevice, ...]:
    """Thiết bị ggml thấy, theo đúng thứ tự whisper.cpp duyệt. Rỗng nếu không hỏi được.

    pywhispercpp không bọc API thiết bị của ggml, nên gọi thẳng vào DLL của nó bằng
    ctypes — các DLL này đã được nạp sẵn khi import ``_pywhispercpp``. Chỉ làm trên
    Windows, nơi duy nhất bản cài mang whisper.cpp Vulkan (tools/build_whisper_vulkan.sh);
    macOS chỉ có một GPU Metal nên mặc định đã đúng. Danh sách cố định suốt đời tiến
    trình (registry của ggml cũng vậy) nên nhớ lại, khỏi dựng lại mỗi lần gọi API.
    """
    if sys.platform != "win32":
        return ()
    try:
        import ctypes
        import sysconfig

        import _pywhispercpp  # noqa: F401 — nạp DLL của ggml vào tiến trình

        # repairwheel đổi tên DLL thành "ggml-base-<md5>.dll", nên tìm theo mẫu.
        root = Path(sysconfig.get_paths()["platlib"])

        def load(prefix: str) -> Any:
            pattern = re.compile(rf"^{prefix}(-[0-9a-f]{{32}})?\.dll$")
            path = next(p for p in root.glob("ggml*.dll") if pattern.match(p.name))
            return ctypes.CDLL(str(path))

        ggml, base = load("ggml"), load("ggml-base")
        size_p = ctypes.POINTER(ctypes.c_size_t)
        ggml.ggml_backend_dev_count.restype = ctypes.c_size_t
        ggml.ggml_backend_dev_get.restype = ctypes.c_void_p
        ggml.ggml_backend_dev_get.argtypes = [ctypes.c_size_t]
        for fn in (base.ggml_backend_dev_name, base.ggml_backend_dev_description):
            fn.restype = ctypes.c_char_p
            fn.argtypes = [ctypes.c_void_p]
        base.ggml_backend_dev_type.restype = ctypes.c_int
        base.ggml_backend_dev_type.argtypes = [ctypes.c_void_p]
        base.ggml_backend_dev_memory.restype = None
        base.ggml_backend_dev_memory.argtypes = [ctypes.c_void_p, size_p, size_p]

        devices = []
        for i in range(ggml.ggml_backend_dev_count()):
            dev = ggml.ggml_backend_dev_get(i)
            kind = base.ggml_backend_dev_type(dev)
            memory_mb = None
            if kind != DEV_CPU:
                free, total = ctypes.c_size_t(0), ctypes.c_size_t(0)
                base.ggml_backend_dev_memory(dev, ctypes.byref(free), ctypes.byref(total))
                memory_mb = total.value // (1024 * 1024) or None
            devices.append(
                GgmlDevice(
                    name=base.ggml_backend_dev_name(dev).decode(),
                    description=base.ggml_backend_dev_description(dev).decode().strip(),
                    kind=kind,
                    memory_mb=memory_mb,
                )
            )
        return tuple(devices)
    except Exception:  # noqa: BLE001 — không hỏi được thì để whisper.cpp tự chọn như cũ
        logger.debug("Không liệt kê được thiết bị ggml", exc_info=True)
        return ()


def _accel_from_system_info(info: str) -> str:
    """Rút gọn chuỗi cờ build thành tên bộ tăng tốc đang bật."""
    if not info:
        return "unknown"
    if "MTL" in info or "METAL = 1" in info:
        return "Metal"
    if "CUDA = 1" in info:
        return "CUDA"
    if "BLAS = 1" in info:
        return "BLAS"
    return "CPU"


def download_ggml(model_id: str, target_dir: Path) -> Path:
    """Tải file GGML về ``target_dir``, chỉ đặt vào chỗ khi đã tải XONG.

    pywhispercpp ghi thẳng vào đường dẫn cuối cùng và chỉ dọn dẹp khi *bắt được*
    exception. Bị kill giữa chừng (đóng app, mất điện, hết pin) thì nó để lại một
    file ``.bin`` cụt ngay tại chỗ — và lần sau chính nó thấy "file đã có" nên
    không bao giờ tải lại nữa. Model đó hỏng vĩnh viễn mà nhìn thì vẫn như đã tải.

    Tải vào thư mục tạm rồi đổi tên là cách duy nhất khiến "có file" đồng nghĩa với
    "đã tải xong": ``os.replace`` trong cùng một phân vùng là thao tác nguyên tử,
    không có trạng thái ở giữa.
    """
    from pywhispercpp.utils import download_model

    target_dir.mkdir(parents=True, exist_ok=True)
    ready = target_dir / f"ggml-{model_id}.bin"
    if ready.is_file():
        return ready

    staging = target_dir / ".incomplete"
    staging.mkdir(parents=True, exist_ok=True)
    try:
        fetched = download_model(model_id, str(staging))
        if not fetched:
            # pywhispercpp trả None cho tên lạ (chỉ log rồi bỏ qua), không ném lỗi.
            raise ValueError(
                f"whisper.cpp không có model {model_id!r}. Xem danh sách file GGML "
                "trong repo ggerganov/whisper.cpp."
            )
        done = target_dir / Path(fetched).name
        os.replace(fetched, done)
    finally:
        # Xoá phần tải dở: pywhispercpp không tải tiếp được, giữ lại chỉ tổ chiếm đĩa.
        shutil.rmtree(staging, ignore_errors=True)
    return done


def _default_loader(model_id: str, models_dir: str | None, device: str = AUTO) -> WhisperModel:
    from pywhispercpp.model import Model

    # Tải trước bằng đường có staging: để `Model()` tự tải thì nó dùng thẳng
    # pywhispercpp, và một lượt nạp bị ngắt sẽ để lại file .bin cụt.
    if models_dir:
        download_ggml(model_id, Path(models_dir))
    # Log của whisper.cpp đi vào file tạm thay vì stderr của service: không làm nhiễu
    # log, mà vẫn đọc lại được để biết model đang chạy GPU nào. Greedy (mặc định)
    # cho low-latency.
    devices = list_ggml_devices()
    context_params = resolve_device(device, devices)
    # Chỉ truyền khi cần đổi thiết bị: đây là tham số mới của pywhispercpp, và
    # macOS có thể đang ở bản chưa có nó (ở đó chỉ "Chỉ CPU" mới cần tới).
    extra: dict[str, Any] = {}
    if context_params is not None:
        logger.info("Lựa chọn %r, thiết bị ggml %s → %s", device, devices, context_params)
        extra["context_params"] = context_params
    fd, log_path = tempfile.mkstemp(prefix="whisper-init-", suffix=".log")
    os.close(fd)
    try:
        model = Model(
            model_id, models_dir=models_dir, redirect_whispercpp_logs_to=log_path, **extra
        )
        init_log = Path(log_path).read_text(encoding="utf-8", errors="replace")
    finally:
        Path(log_path).unlink(missing_ok=True)
    gpu = gpu_backend_from_log(init_log)
    logger.info("whisper.cpp chạy trên %s", gpu or "CPU")
    if gpu == "Vulkan":
        # ggml biên dịch pipeline Vulkan ở lần chạy đầu: lần đầu tiên trên một máy mất
        # ~12 s (RTX 4060), sau đó driver giữ cache trên đĩa và chỉ còn ~0,2 s. Làm
        # nóng ở đây để khoảng chờ đó rơi vào bước nạp model — có thanh tiến trình —
        # chứ không phải vào câu nói đầu tiên của người dùng.
        started = time.perf_counter()
        model.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32), **_supported(DECODE_PARAMS))
        logger.info("Làm nóng Vulkan: %.1f s", time.perf_counter() - started)
    # Gắn lên chính instance: loader chỉ trả về model, và test tiêm loader giả
    # không có thuộc tính này thì adapter lùi về đọc cờ build như cũ.
    #
    # "Chỉ CPU" phải được ghi rõ: system_info() là cờ lúc BUILD, bản macOS luôn có
    # METAL = 1, nên lùi về đó là báo "Metal" cho một model đang chạy CPU.
    model.llvt_gpu_backend = gpu or ("CPU" if device == CPU_ONLY else None)
    ggml_name = gpu_device_from_log(init_log)
    model.llvt_device = next(
        (d.description for d in devices if d.name == ggml_name),
        CPU_ONLY if device == CPU_ONLY or not gpu else ggml_name,
    )
    return model


class WhisperCppAsr(SpeechToTextProvider):
    name = "whisper_cpp"

    def __init__(
        self,
        model: str,
        models_dir: str | None = None,
        loader: ModelLoader | None = None,
        *,
        min_confidence: float = 0.0,
        audio_ctx: int = 0,
        device: str = AUTO,
    ) -> None:
        self._model_name = model
        self._model_id = MODEL_MAP.get(model, model)
        self._models_dir = models_dir
        self._loader = loader or functools.partial(_default_loader, device=device or AUTO)
        self._model: WhisperModel | None = None
        self._exec = SerialExecutor()
        self._system_info = ""
        self._min_confidence = min_confidence
        self._audio_ctx = audio_ctx
        self._params: dict[str, Any] = {}

    async def load(self) -> None:
        logger.info("WhisperCppAsr.load(model=%s -> %s)", self._model_name, self._model_id)
        # Tải/nạp model là blocking (I/O + CPU) -> chạy ngoài event loop.
        self._model = await asyncio.to_thread(self._loader, self._model_id, self._models_dir)
        self._system_info = await asyncio.to_thread(_read_system_info)
        params = dict(DECODE_PARAMS)
        if self._audio_ctx > 0:
            # Cắt bớt ngữ cảnh encoder: đoạn VAD chỉ vài giây chứ không phải 30 s nên
            # phần lớn cửa sổ là padding. Nhanh hơn đáng kể nhưng ẢNH HƯỞNG ĐỘ CHÍNH
            # XÁC → mặc định tắt, chỉ bật khi đã đo được WER tương ứng.
            params["audio_ctx"] = self._audio_ctx
        self._params = _supported(params)
        logger.info("WhisperCppAsr loaded (models_dir=%s)", self._models_dir)

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def active_device(self) -> str | None:
        """Thiết bị model đang chạy: tên GPU thật, ``"cpu"``, hoặc None nếu chưa nạp
        (hay loader giả trong test không ghi lại)."""
        return getattr(self._model, "llvt_device", None)

    def runtime_info(self) -> dict[str, str]:
        return {
            # Tên NGƯỜI DÙNG chọn (`ggml-small-q5_1.bin`), không phải id nội bộ của
            # pywhispercpp (`small-q5_1`). Một model chỉ được có một cái tên: mọi
            # adapter khác đã trả đường dẫn thượng nguồn, danh mục và bảng tiến trình
            # cũng dùng dạng có `.bin`. Trả id ở đây là bắt màn Phiên dịch hiện một
            # cái tên thứ hai cho cùng một model.
            "model": self._model_name,
            "backend": "whisper.cpp",
            "accel": getattr(self._model, "llvt_gpu_backend", None)
            or _accel_from_system_info(self._system_info),
        }

    async def unload(self) -> None:
        self._model = None

    async def transcribe(
        self, pcm: bytes, language: Language, sample_rate: int = 16000
    ) -> AsrTranscript:
        if sample_rate != SAMPLE_RATE:
            raise ValueError(
                f"WhisperCppAsr cần PCM {SAMPLE_RATE} Hz (đã resample ở khâu thu), nhận {sample_rate}"
            )
        if self._model is None:
            raise RuntimeError("WhisperCppAsr chưa load() — không thể transcribe()")

        # PCM signed 16-bit -> float32 chuẩn hóa [-1, 1] (whisper.cpp yêu cầu).
        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

        started = time.perf_counter()
        segments = await self._exec.run(self._decode, audio, language)
        processing_ms = int((time.perf_counter() - started) * 1000)

        text = strip_non_speech("".join(seg.text for seg in segments))
        confidence = _mean_probability(segments)
        reason = rejection_reason(text, confidence, min_confidence=self._min_confidence)
        if reason is not None:
            # Không log nội dung câu (SPEC 14: chỉ mã lỗi ra log), chỉ log vì sao bỏ —
            # đủ để giải thích với hội đồng và để đếm tần suất lúc đo.
            logger.info(
                "Bỏ câu ASR: lý do=%s, độ dài=%d, confidence=%s",
                reason,
                len(text),
                f"{confidence:.2f}" if confidence is not None else "—",
            )
            text = ""

        return AsrTranscript(
            text=text,
            language=language,
            confidence=confidence,
            processing_ms=processing_ms,
        )

    def _decode(self, audio: np.ndarray, language: Language) -> list[Any]:
        assert self._model is not None
        return self._model.transcribe(
            audio,
            language=language.value,  # 'vi'/'en'/'ja'/'zh' khớp mã whisper
            extract_probability=True,  # để tính confidence
            **self._params,
        )


def _mean_probability(segments: list[Any]) -> float | None:
    probs = [
        float(seg.probability)
        for seg in segments
        if getattr(seg, "probability", None) is not None
        and not np.isnan(getattr(seg, "probability"))
    ]
    if not probs:
        return None
    return sum(probs) / len(probs)
