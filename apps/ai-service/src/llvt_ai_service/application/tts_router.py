"""Định tuyến TTS theo ngôn ngữ đích.

Không có một engine nào đọc tốt cả bốn ngôn ngữ trong phạm vi đồ án: sherpa-onnx có
voice Piper cho vi/en/zh nhưng phần xử lý văn bản của nó chỉ hiểu tiếng Anh và tiếng
Trung, còn tiếng Nhật cần G2P riêng (xem `adapters/tts/kokoro_ja.py`). Lớp này hiện
thực chính port `TextToSpeechProvider` và chọn engine theo `language`, nên pipeline
vẫn chỉ thấy một provider TTS duy nhất.

Việc "ngôn ngữ nào chạy engine nào" là chính sách, không phải chi tiết của engine —
vì thế nó nằm ở application chứ không nhét vào adapter nào cả.
"""

from __future__ import annotations

import asyncio

from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import TtsResult
from llvt_ai_service.ports.tts import TextToSpeechProvider


class LanguageRoutedTts(TextToSpeechProvider):
    def __init__(
        self,
        default: TextToSpeechProvider,
        overrides: dict[Language, TextToSpeechProvider],
    ) -> None:
        self._default = default
        self._overrides = overrides
        # Màn Chẩn đoán hiện tên adapter; nói thẳng là đang chạy hai engine.
        self.name = " + ".join(p.name for p in self._all())

    def _provider_for(self, language: Language) -> TextToSpeechProvider:
        return self._overrides.get(language, self._default)

    def _all(self) -> list[TextToSpeechProvider]:
        seen: list[TextToSpeechProvider] = [self._default]
        for provider in self._overrides.values():
            if provider not in seen:
                seen.append(provider)
        return seen

    async def load(self) -> None:
        await asyncio.gather(*(p.load() for p in self._all()))

    async def unload(self) -> None:
        await asyncio.gather(*(p.unload() for p in self._all()))

    @property
    def loaded(self) -> bool:
        return all(p.loaded for p in self._all())

    def runtime_info(self) -> dict[str, str]:
        # Ghép thông tin của mọi engine để màn Chẩn đoán hiện đúng thứ đang chạy.
        infos = [p.runtime_info() for p in self._all()]
        languages = {lang.value for lang in self._overrides}
        for info in infos:
            languages.update(part for part in info.get("languages", "").split(", ") if part)
        return {
            "model": " + ".join(i.get("model", "—") for i in infos),
            "backend": " + ".join(i.get("backend", "—") for i in infos),
            "accel": infos[0].get("accel", "—"),
            "languages": ", ".join(sorted(languages)),
        }

    async def synthesize(
        self, text: str, language: Language, voice: str | None = None, speed: float = 1.0
    ) -> TtsResult:
        return await self._provider_for(language).synthesize(text, language, voice, speed)
