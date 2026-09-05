"""Adapter diarization: pyannote.audio (``speaker-diarization-community-1``).

Gói tùy chọn — ``uv sync --extra diarization``. Không cài thì ``load()`` báo lỗi rõ
ràng và đường nhập tệp vẫn chạy bình thường, chỉ là không có nhãn người nói.

**Hai điều kiện cần nói thẳng**, vì chúng đi ngược tinh thần "chạy hoàn toàn cục bộ"
của đồ án (SPEC 14 / docs/00) nên diarization mặc định TẮT:

1. Repo pyannote trên HuggingFace là *gated*: phải bấm đồng ý điều khoản trên web và
   đưa access token (``LLVT_HF_TOKEN``) thì mới tải được. Token chỉ dùng cho **lần
   tải đầu tiên**; sau đó model nằm trên đĩa và chạy offline như mọi model khác.
2. pyannote kéo theo torchaudio/lightning — vài trăm MB phụ thuộc chỉ để phục vụ một
   tính năng của màn nhập tệp.

Thiết bị: MPS (Apple Silicon) → CUDA → CPU, dò thật bằng torch chứ không suy từ nền
tảng. Model không thread-safe nên lời gọi đi qua ``SerialExecutor``.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Protocol

import numpy as np

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.models import SpeakerTurn
from llvt_ai_service.ports.diarization import SpeakerDiarizer

logger = logging.getLogger("llvt.adapters.diarization.pyannote")

DEFAULT_MODEL = "pyannote/speaker-diarization-community-1"


class DiarizationPipeline(Protocol):
    """Giao diện tối thiểu của pyannote Pipeline (cho phép tiêm bản giả khi test)."""

    def __call__(self, audio: dict[str, Any], **params: Any) -> Any: ...


# loader: (model, token, models_dir, device) -> DiarizationPipeline. Blocking.
PipelineLoader = Callable[[str, str | None, str | None, str | None], DiarizationPipeline]


def _pick_device() -> str:
    try:
        import torch
    except ImportError:  # pragma: no cover - torch luôn có (silero-vad kéo theo)
        return "cpu"
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _default_loader(
    model: str, token: str | None, models_dir: str | None, device: str | None
) -> DiarizationPipeline:
    try:
        from pyannote.audio import Pipeline
    except ImportError as exc:  # pragma: no cover - phụ thuộc môi trường
        raise RuntimeError("Chưa cài pyannote.audio. Chạy: uv sync --extra diarization") from exc
    import torch

    pipeline = Pipeline.from_pretrained(model, token=token, cache_dir=models_dir)
    if pipeline is None:
        # pyannote trả None (không ném lỗi) khi token thiếu quyền hoặc chưa đồng ý
        # điều khoản — nếu để nguyên thì lỗi thật chỉ lộ ra ở lần gọi sau, dưới dạng
        # "NoneType is not callable".
        raise RuntimeError(
            f"Không tải được {model}: hãy đồng ý điều khoản của repo trên "
            "huggingface.co rồi đặt LLVT_HF_TOKEN bằng một access token có quyền đọc."
        )
    return pipeline.to(torch.device(device or _pick_device()))


class PyannoteDiarizer(SpeakerDiarizer):
    name = "pyannote"

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        *,
        token: str | None = None,
        models_dir: str | None = None,
        device: str | None = None,
        min_speakers: int | None = None,
        max_speakers: int | None = None,
        loader: PipelineLoader | None = None,
    ) -> None:
        self._model = model
        self._token = token or None
        self._models_dir = models_dir
        self._device = device
        self._min_speakers = min_speakers
        self._max_speakers = max_speakers
        self._loader = loader or _default_loader
        self._pipeline: DiarizationPipeline | None = None
        self._exec = SerialExecutor()

    async def load(self) -> None:
        logger.info("PyannoteDiarizer.load(model=%s)", self._model)
        device = self._device or _pick_device()
        self._pipeline = await self._exec.run(
            self._loader, self._model, self._token, self._models_dir, device
        )
        self._device = device
        logger.info("PyannoteDiarizer loaded (device=%s)", device)

    @property
    def loaded(self) -> bool:
        return self._pipeline is not None

    def runtime_info(self) -> dict[str, str]:
        return {
            "model": self._model,
            "backend": "pyannote.audio",
            "accel": self._device or "—",
        }

    async def unload(self) -> None:
        self._pipeline = None

    async def diarize(self, pcm: bytes, sample_rate: int = 16000) -> list[SpeakerTurn]:
        if self._pipeline is None:
            raise RuntimeError("PyannoteDiarizer chưa load() — không thể diarize()")
        if not pcm:
            return []
        return await self._exec.run(self._run, pcm, sample_rate)

    def _run(self, pcm: bytes, sample_rate: int) -> list[SpeakerTurn]:
        import torch

        assert self._pipeline is not None
        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        # pyannote nhận tensor [kênh, mẫu] để khỏi phải ghi file tạm rồi đọc lại —
        # audio của mình đã nằm sẵn trong RAM, và ghi ra đĩa là thứ SPEC 14 cấm.
        waveform = torch.from_numpy(audio).unsqueeze(0)
        output = self._pipeline(
            {"waveform": waveform, "sample_rate": sample_rate},
            min_speakers=self._min_speakers,
            max_speakers=self._max_speakers,
        )
        return _to_turns(output)


def _to_turns(output: Any) -> list[SpeakerTurn]:
    """Đổi kết quả pyannote thành ``SpeakerTurn`` của domain.

    ``speaker-diarization-community-1`` trả về một object bọc nhiều loại kết quả và
    phần cần dùng nằm ở ``.speaker_diarization``; các pipeline cũ trả thẳng
    ``Annotation``. Nhận cả hai để đổi model không phải sửa adapter.
    """
    annotation = getattr(output, "speaker_diarization", output)
    if not hasattr(annotation, "itertracks"):
        raise RuntimeError(f"Kết quả diarization không đọc được: {type(output)!r}")

    turns = [
        SpeakerTurn(
            speaker=str(speaker),
            started_at_ms=int(segment.start * 1000),
            ended_at_ms=int(segment.end * 1000),
        )
        for segment, _track, speaker in annotation.itertracks(yield_label=True)
    ]
    turns.sort(key=lambda t: (t.started_at_ms, t.speaker))
    return turns
