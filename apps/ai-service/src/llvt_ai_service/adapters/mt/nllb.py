"""Adapter MT: NLLB-200 distilled 600M (mặc định) — Tuần 4.

Dùng ``transformers`` (PyTorch): ``AutoModelForSeq2SeqLM`` + ``AutoTokenizer`` tải
``facebook/nllb-200-distilled-600M`` từ HF (lần đầu; sau đó offline). Dịch text→text
theo từng utterance (chỉ trên transcript final), tách biệt hoàn toàn với Whisper.

Thiết bị tự dò: MPS (Apple Silicon) → CPU. Model không hẳn thread-safe nên một
``SerialExecutor`` nội bộ đẩy lời gọi blocking sang worker thread + tuần tự hóa.
Tối ưu INT8/CTranslate2 có thể thêm sau, cùng port ``TranslationProvider``.
"""

from __future__ import annotations

import logging
import time
from typing import Callable, Protocol

from llvt_ai_service.application.inference import SerialExecutor
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TranslationResult
from llvt_ai_service.ports.translator import TranslationProvider

logger = logging.getLogger("llvt.adapters.mt.nllb")

# Ánh xạ ngôn ngữ nội bộ -> mã NLLB (FLORES-200).
NLLB_CODE: dict[Language, str] = {
    Language.vi: "vie_Latn",
    Language.en: "eng_Latn",
    Language.ja: "jpn_Jpan",
    Language.zh: "zho_Hans",
}

# Tên model logic trong preset -> repo HF. (Biến thể INT8 dùng lại repo gốc; lượng
# tử hóa là việc của backend tối ưu sau này.)
MODEL_MAP: dict[str, str] = {
    "nllb-200-distilled-600M": "facebook/nllb-200-distilled-600M",
    "nllb-200-distilled-600M-int8": "facebook/nllb-200-distilled-600M",
}

# Số token sinh tối đa cho một utterance (câu/đoạn ngắn).
MAX_NEW_TOKENS = 256


class TranslationBackend(Protocol):
    """Backend dịch một câu giữa hai mã NLLB (cho phép tiêm bản giả khi test)."""

    def translate(self, text: str, src_code: str, tgt_code: str) -> str: ...


# loader: (repo_id, models_dir, device) -> TranslationBackend. Blocking (tải + nạp).
BackendLoader = Callable[[str, str | None, str | None], TranslationBackend]


class _TransformersNllb:
    """Backend thật: bọc tokenizer + seq2seq model của transformers."""

    def __init__(self, repo_id: str, models_dir: str | None, device: str | None) -> None:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self._torch = torch
        self.device = device or ("mps" if torch.backends.mps.is_available() else "cpu")
        self._device = self.device
        self._tokenizer = AutoTokenizer.from_pretrained(repo_id, cache_dir=models_dir)
        self._model = AutoModelForSeq2SeqLM.from_pretrained(repo_id, cache_dir=models_dir).to(
            self._device
        )
        self._model.eval()

    def translate(self, text: str, src_code: str, tgt_code: str) -> str:
        self._tokenizer.src_lang = src_code
        inputs = self._tokenizer(text, return_tensors="pt").to(self._device)
        bos = self._tokenizer.convert_tokens_to_ids(tgt_code)
        with self._torch.inference_mode():
            generated = self._model.generate(
                **inputs, forced_bos_token_id=bos, max_new_tokens=MAX_NEW_TOKENS
            )
        return self._tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()


def _default_loader(repo_id: str, models_dir: str | None, device: str | None) -> TranslationBackend:
    return _TransformersNllb(repo_id, models_dir, device)


class NllbTranslator(TranslationProvider):
    name = "nllb"

    def __init__(
        self,
        model: str,
        models_dir: str | None = None,
        device: str | None = None,
        loader: BackendLoader | None = None,
    ) -> None:
        self._model_name = model
        self._repo_id = MODEL_MAP.get(model, model)
        self._models_dir = models_dir
        self._device = device
        self._loader = loader or _default_loader
        self._backend: TranslationBackend | None = None
        self._exec = SerialExecutor()

    async def load(self) -> None:
        import asyncio

        logger.info("NllbTranslator.load(model=%s -> %s)", self._model_name, self._repo_id)
        self._backend = await asyncio.to_thread(
            self._loader, self._repo_id, self._models_dir, self._device
        )
        logger.info("NllbTranslator loaded (models_dir=%s)", self._models_dir)

    async def unload(self) -> None:
        self._backend = None

    @property
    def loaded(self) -> bool:
        return self._backend is not None

    def runtime_info(self) -> dict[str, str]:
        # Thiết bị do chính backend chọn lúc nạp (mps/cuda/cpu), không phải suy đoán.
        device = getattr(self._backend, "device", None) or self._device or "—"
        return {"model": self._repo_id, "backend": "transformers", "accel": str(device)}

    async def translate(self, text: str, source: Language, target: Language) -> TranslationResult:
        if self._backend is None:
            raise RuntimeError("NllbTranslator chưa load() — không thể translate()")

        normalized = _normalize(text)
        # Đầu vào rỗng hoặc cùng ngôn ngữ → khỏi gọi model.
        if not normalized:
            translated = ""
        elif source == target:
            translated = normalized
        else:
            started = time.perf_counter()
            translated = await self._exec.run(
                self._backend.translate, normalized, NLLB_CODE[source], NLLB_CODE[target]
            )
            processing_ms = int((time.perf_counter() - started) * 1000)
            return TranslationResult(
                source_text=normalized,
                translated_text=translated,
                source_language=source,
                target_language=target,
                processing_ms=processing_ms,
            )

        return TranslationResult(
            source_text=normalized,
            translated_text=translated,
            source_language=source,
            target_language=target,
            processing_ms=0,
        )


def _normalize(text: str) -> str:
    """Chuẩn hóa nhẹ trước khi dịch: gộp khoảng trắng thừa, bỏ đầu/cuối."""
    return " ".join(text.split())
