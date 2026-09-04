"""Đăng ký adapter + nạp/giải phóng provider theo preset.

Đây là "composition root" của tầng model: nơi duy nhất biết adapter cụ thể nào
ứng với tên nào. Pipeline chỉ thấy ProviderSet (các port).
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any, Callable

from llvt_ai_service.adapters.asr.faster_whisper import FasterWhisperAsr
from llvt_ai_service.adapters.asr.whisper_cpp import WhisperCppAsr
from llvt_ai_service.adapters.mt.nllb import NllbTranslator
from llvt_ai_service.adapters.tts.kokoro_ja import KokoroJaTts
from llvt_ai_service.adapters.tts.sherpa_onnx import SherpaOnnxTts
from llvt_ai_service.adapters.vad.silero import SileroVad, VadParams
from llvt_ai_service.application.load_progress import progress
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


def vad_params(cfg: PresetConfig) -> VadParams:
    """Ngưỡng endpointing của preset, cho phép ``LLVT_VAD_OVERRIDES`` đè từng khoá.

    Chuyển đổi ở đây (chứ không trong config) vì đây là chỗ duy nhất được phép biết cả
    tầng config lẫn adapter cụ thể.
    """
    values = asdict(cfg.vad)
    for key, value in get_settings().vad_overrides.items():
        if key not in values:
            logger.warning("LLVT_VAD_OVERRIDES: bỏ qua khoá không có thật %r", key)
            continue
        values[key] = float(value) if key == "threshold" else int(value)
    return VadParams(**values)


# Registry: tên adapter -> factory. Thêm backend mới = thêm 1 dòng ở đây.
VAD_REGISTRY: dict[str, Callable[[PresetConfig], VoiceActivityDetector]] = {
    "silero": lambda cfg: SileroVad(vad_params(cfg)),
}
ASR_REGISTRY: dict[str, Callable[[PresetConfig], SpeechToTextProvider]] = {
    "whisper_cpp": lambda cfg: WhisperCppAsr(
        cfg.asr_model,
        models_dir=str(get_settings().models_dir / "whisper-cpp"),
        min_confidence=get_settings().asr_min_confidence,
        audio_ctx=get_settings().asr_audio_ctx,
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


class ModelLoadError(RuntimeError):
    """Một khâu không nạp được (thường là tải model hỏng vì mất mạng).

    Có kiểu riêng để transport phân biệt được với lỗi lập trình: REST trả 503 và WS
    gửi event ``error`` kèm lời giải thích, thay vì ném traceback ra ngoài.
    """

    def __init__(self, stage: str, cause: Exception) -> None:
        self.stage = stage
        self.cause = cause
        super().__init__(f"Không nạp được model cho khâu {stage}: {cause}")


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
        models_dir = get_settings().models_dir
        # (khâu, provider, tên model để tra dung lượng, thư mục để đo byte đã tải)
        plan = (
            ("VAD", providers.vad, "silero-vad", None, "nằm trong gói cài đặt"),
            ("ASR", providers.asr, cfg.asr_model, models_dir / "whisper-cpp", ""),
            ("MT", providers.mt, cfg.mt_model, models_dir / "nllb", ""),
            # TTS nạp voice lười theo ngôn ngữ (lúc đọc câu đầu tiên), nên khâu này
            # xong ngay và phần tải voice không nằm trong lượt nạp này.
            ("TTS", providers.tts, cfg.tts_adapter, None, "voice tải khi đọc câu đầu"),
        )
        progress.begin([(stage, model) for stage, _p, model, _d, _n in plan])

        # Nạp lần lượt và nhớ những khâu đã xong: nếu khâu sau hỏng (hay gặp nhất là
        # mất mạng giữa lúc tải model), phải giải phóng những khâu trước đó. Không thì
        # chúng nằm lại trong RAM mà không ai tham chiếu tới — whisper.cpp còn giữ cả
        # context Metal — và lần bấm "Khởi động model" tiếp theo lại nạp thêm một bộ.
        loaded: list[Any] = []
        for stage, provider, _model, watch_dir, note in plan:
            progress.stage_begin(stage, watch_dir)
            try:
                await provider.load()
            except Exception as exc:
                logger.warning("Nạp khâu %s thất bại: %s", stage, exc)
                progress.stage_failed(stage, str(exc))
                for done in loaded:
                    await done.unload()
                raise ModelLoadError(stage, exc) from exc
            progress.stage_done(stage, note)
            loaded.append(provider)
        progress.finish()
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
