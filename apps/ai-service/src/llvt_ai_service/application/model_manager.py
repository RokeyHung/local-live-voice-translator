"""Đăng ký adapter + nạp/giải phóng provider theo preset.

Đây là "composition root" của tầng model: nơi duy nhất biết adapter cụ thể nào
ứng với tên nào. Pipeline chỉ thấy ProviderSet (các port).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable

from llvt_ai_service.adapters.asr.faster_whisper import FasterWhisperAsr
from llvt_ai_service.adapters.asr.whisper_cpp import WhisperCppAsr
from llvt_ai_service.adapters.mt.nllb import NllbTranslator
from llvt_ai_service.adapters.tts.kokoro_ja import KokoroJaTts
from llvt_ai_service.adapters.tts.sherpa_onnx import SherpaOnnxTts
from llvt_ai_service.adapters.vad.silero import SileroVad
from llvt_ai_service.application.tts_router import LanguageRoutedTts
from llvt_ai_service.config.presets import PresetConfig, get_preset_config
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Language, Preset
from llvt_ai_service.ports.asr import SpeechToTextProvider
from llvt_ai_service.ports.translator import TranslationProvider
from llvt_ai_service.ports.tts import TextToSpeechProvider
from llvt_ai_service.ports.vad import VoiceActivityDetector

logger = logging.getLogger("llvt.model_manager")


@dataclass
class ProviderSet:
    vad: VoiceActivityDetector
    asr: SpeechToTextProvider
    mt: TranslationProvider
    tts: TextToSpeechProvider


# Registry: tên adapter -> factory. Thêm backend mới = thêm 1 dòng ở đây.
VAD_REGISTRY: dict[str, Callable[[PresetConfig], VoiceActivityDetector]] = {
    "silero": lambda _cfg: SileroVad(),
}
ASR_REGISTRY: dict[str, Callable[[PresetConfig], SpeechToTextProvider]] = {
    "whisper_cpp": lambda cfg: WhisperCppAsr(
        cfg.asr_model,
        models_dir=str(get_settings().models_dir / "whisper-cpp"),
    ),
    "faster_whisper": lambda cfg: FasterWhisperAsr(cfg.asr_model),
}
MT_REGISTRY: dict[str, Callable[[PresetConfig], TranslationProvider]] = {
    "nllb": lambda cfg: NllbTranslator(
        cfg.mt_model,
        models_dir=str(get_settings().models_dir / "nllb"),
    ),
}
TTS_REGISTRY: dict[str, Callable[[PresetConfig], TextToSpeechProvider]] = {
    # sherpa-onnx đọc vi/en/zh; tiếng Nhật đi qua Kokoro + G2P OpenJTalk vì phần xử
    # lý văn bản của sherpa-onnx không hỗ trợ tiếng Nhật (xem adapters/tts/kokoro_ja).
    "sherpa_onnx": lambda _cfg: LanguageRoutedTts(
        SherpaOnnxTts(models_dir=str(get_settings().models_dir / "sherpa-tts")),
        {Language.ja: KokoroJaTts(models_dir=str(get_settings().models_dir))},
    ),
}


@dataclass
class StageInfo:
    """Một khâu của pipeline với thông tin THẬT lấy từ provider đang chạy."""

    stage: str
    adapter: str
    model: str
    accel: str
    loaded: bool


class ModelManager:
    def __init__(self) -> None:
        self._providers: ProviderSet | None = None
        self._preset: Preset | None = None

    @property
    def preset(self) -> Preset | None:
        return self._preset

    @property
    def loaded(self) -> bool:
        return self._providers is not None

    def select_preset(self, preset: Preset) -> None:
        """Ghi nhận preset sẽ dùng mà KHÔNG nạp model.

        Dùng lúc khởi động: service sẵn sàng trả lời REST ngay, model chỉ vào bộ nhớ
        khi người dùng bấm "Khởi động model" hoặc bắt đầu một phiên.
        """
        if self._providers is not None:
            raise RuntimeError("Đang có provider nạp sẵn — dùng load_preset() để đổi.")
        self._preset = preset

    @property
    def providers(self) -> ProviderSet:
        if self._providers is None:
            raise RuntimeError("Chưa nạp preset — gọi load_preset() trước.")
        return self._providers

    def stages(self) -> list[StageInfo]:
        """Bốn khâu kèm model + thiết bị đang thật sự dùng (rỗng nếu chưa nạp preset)."""
        if self._providers is None:
            return []
        pairs = (
            ("VAD", self._providers.vad),
            ("ASR", self._providers.asr),
            ("MT", self._providers.mt),
            ("TTS", self._providers.tts),
        )
        out: list[StageInfo] = []
        for stage, provider in pairs:
            info = provider.runtime_info()
            out.append(
                StageInfo(
                    stage=stage,
                    adapter=provider.name,
                    model=info.get("model", "—"),
                    accel=info.get("accel", "—"),
                    loaded=provider.loaded,
                )
            )
        return out

    async def ensure_loaded(self) -> ProviderSet:
        """Nạp preset gần nhất (hoặc mặc định) nếu đang trống.

        Cần thiết vì đổi thư mục model / xoá model sẽ giải phóng provider: phiên bắt
        đầu ngay sau đó phải tự nạp lại thay vì ném RuntimeError ra transport.
        """
        if self._providers is not None:
            return self._providers
        return await self.load_preset(self._preset or get_settings().default_preset)

    async def load_preset(self, preset: Preset) -> ProviderSet:
        await self.unload()
        cfg = get_preset_config(preset)
        providers = ProviderSet(
            vad=VAD_REGISTRY[cfg.vad_adapter](cfg),
            asr=ASR_REGISTRY[cfg.asr_adapter](cfg),
            mt=MT_REGISTRY[cfg.mt_adapter](cfg),
            tts=TTS_REGISTRY[cfg.tts_adapter](cfg),
        )
        for provider in (providers.vad, providers.asr, providers.mt, providers.tts):
            await provider.load()
        self._providers = providers
        self._preset = preset
        logger.info("Loaded preset=%s", preset.value)
        return providers

    async def unload(self) -> None:
        if self._providers is None:
            return
        for provider in (
            self._providers.vad,
            self._providers.asr,
            self._providers.mt,
            self._providers.tts,
        ):
            await provider.unload()
        self._providers = None
        # Giữ lại preset đang chọn: giải phóng bộ nhớ không có nghĩa là quên lựa chọn
        # của người dùng — `ensure_loaded()` sẽ nạp đúng preset đó khi cần.
