"""Adapter MT: NLLB-200 distilled 600M (mặc định).

TODO (Tuần 4): nạp NLLB (ctranslate2/transformers), map ngôn ngữ sang mã NLLB
(vie_Latn, eng_Latn, jpn_Jpan, zho_Hans), dịch trên transcript final.
"""

from __future__ import annotations

import logging

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TranslationResult
from llvt_ai_service.ports.translator import TranslationProvider

logger = logging.getLogger("llvt.adapters.mt.nllb")

# Ánh xạ ngôn ngữ nội bộ -> mã NLLB.
NLLB_CODE: dict[Language, str] = {
    Language.vi: "vie_Latn",
    Language.en: "eng_Latn",
    Language.ja: "jpn_Jpan",
    Language.zh: "zho_Hans",
}


class NllbTranslator(TranslationProvider):
    name = "nllb"

    def __init__(self, model: str) -> None:
        self.model = model

    async def load(self) -> None:
        logger.info("NllbTranslator.load(model=%s) — stub (Tuần 4)", self.model)

    async def unload(self) -> None:
        logger.info("NllbTranslator.unload() — stub")

    async def translate(self, text: str, source: Language, target: Language) -> TranslationResult:
        raise NotImplementedError("NLLB-200 sẽ được tích hợp ở Tuần 4")
