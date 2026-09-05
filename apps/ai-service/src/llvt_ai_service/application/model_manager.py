"""Đăng ký adapter + nạp/giải phóng provider theo preset.

Đây là "composition root" của tầng model: nơi duy nhất biết adapter cụ thể nào
ứng với tên nào. Pipeline chỉ thấy ProviderSet (các port).
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

from llvt_ai_service.adapters.asr.faster_whisper import FasterWhisperAsr
from llvt_ai_service.adapters.asr.mlx_whisper import MlxWhisperAsr
from llvt_ai_service.adapters.asr.whisper_cpp import WhisperCppAsr
from llvt_ai_service.adapters.diarization.pyannote import PyannoteDiarizer
from llvt_ai_service.adapters.mt.nllb import NllbTranslator
from llvt_ai_service.adapters.tts.kokoro_ja import KokoroJaTts
from llvt_ai_service.adapters.tts.sherpa_onnx import SherpaOnnxTts
from llvt_ai_service.adapters.vad.silero import SileroVad, VadParams
from llvt_ai_service.application.load_progress import progress
from llvt_ai_service.application.tts_router import LanguageRoutedTts
from llvt_ai_service.config.presets import PresetConfig, get_preset_config
from llvt_ai_service.config.settings import effective_hf_token, get_settings
from llvt_ai_service.domain.enums import Language, Preset
from llvt_ai_service.ports.asr import SpeechToTextProvider
from llvt_ai_service.ports.diarization import SpeakerDiarizer
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
    # Tùy chọn: chỉ có khi bật LLVT_DIARIZATION_ENABLED. Bốn khâu trên là pipeline
    # dịch; diarization là thứ thêm vào cho đường nhập tệp, nên mọi chỗ đọc nó phải
    # chịu được None thay vì coi như luôn có.
    diarizer: SpeakerDiarizer | None = None


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


def asr_adapter_name(cfg: PresetConfig) -> str:
    """Adapter ASR sẽ dùng: ``LLVT_ASR_ADAPTER`` nếu có đặt, không thì của preset."""
    override = get_settings().asr_adapter.strip()
    if not override:
        return cfg.asr_adapter
    if override not in ASR_REGISTRY:
        logger.warning(
            "LLVT_ASR_ADAPTER=%r không có trong registry — dùng %r của preset",
            override,
            cfg.asr_adapter,
        )
        return cfg.asr_adapter
    return override


def asr_model(cfg: PresetConfig, adapter: str) -> str:
    """Model của preset cho đúng runtime ``adapter``.

    Mỗi runtime gọi tên model theo kiểu riêng (``small-q5_1`` của whisper.cpp và
    ``mlx-community/whisper-small-asr-8bit`` không thay nhau được), nên khi đổi
    adapter phải tra sang cột tương ứng trong ``asr_alternatives``. Preset không khai
    báo cột cho runtime đó thì giữ nguyên ``asr_model`` và để adapter tự báo lỗi —
    im lặng thay bằng một model khác mức chất lượng còn khó hiểu hơn.
    """
    if adapter == cfg.asr_adapter:
        return cfg.asr_model
    alternative = cfg.asr_alternatives.get(adapter)
    if alternative:
        return alternative
    logger.warning("Preset không có model cho adapter %r — dùng nguyên %r", adapter, cfg.asr_model)
    return cfg.asr_model


# Registry: tên adapter -> factory. Thêm backend mới = thêm 1 dòng ở đây.
VAD_REGISTRY: dict[str, Callable[[PresetConfig], VoiceActivityDetector]] = {
    "silero": lambda cfg: SileroVad(vad_params(cfg)),
}
ASR_REGISTRY: dict[str, Callable[[PresetConfig], SpeechToTextProvider]] = {
    "whisper_cpp": lambda cfg: WhisperCppAsr(
        asr_model(cfg, "whisper_cpp"),
        models_dir=str(get_settings().models_dir / "whisper-cpp"),
        min_confidence=get_settings().asr_min_confidence,
        audio_ctx=get_settings().asr_audio_ctx,
    ),
    "mlx_whisper": lambda cfg: MlxWhisperAsr(
        asr_model(cfg, "mlx_whisper"),
        models_dir=str(get_settings().models_dir / "mlx-whisper"),
        min_confidence=get_settings().asr_min_confidence,
    ),
    "faster_whisper": lambda cfg: FasterWhisperAsr(
        asr_model(cfg, "faster_whisper"),
        models_dir=str(get_settings().models_dir / "faster-whisper"),
        min_confidence=get_settings().asr_min_confidence,
    ),
}
DIARIZATION_REGISTRY: dict[str, Callable[[], SpeakerDiarizer]] = {
    "pyannote": lambda: PyannoteDiarizer(
        get_settings().diarization_model,
        # `effective_hf_token` chứ không phải `settings.hf_token`: người dùng có thể
        # đã export sẵn `HF_TOKEN` chuẩn của huggingface_hub từ trước.
        token=effective_hf_token(),
        models_dir=str(get_settings().models_dir / "pyannote"),
        min_speakers=get_settings().diarization_min_speakers,
        max_speakers=get_settings().diarization_max_speakers,
    ),
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


class ModelLoadCancelled(RuntimeError):
    """Người dùng bấm Huỷ giữa lượt nạp.

    Kiểu riêng để transport phân biệt với ``ModelLoadError``: không có gì hỏng cả,
    nên REST trả 409 chứ không phải 503, và giao diện không hiện thông báo lỗi đỏ.
    """

    def __init__(self, stage: str) -> None:
        self.stage = stage
        super().__init__(f"Đã dừng lượt nạp model trước khâu {stage}")


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
        """Các khâu kèm model + thiết bị đang thật sự dùng (rỗng nếu chưa nạp preset).

        Bốn khâu của pipeline dịch luôn có; khâu DIA chỉ xuất hiện khi diarization
        được bật — danh sách này mô tả cái đang nằm trong bộ nhớ, không phải cái
        service có khả năng chạy.
        """
        if self._providers is None:
            return []
        pairs: tuple[tuple[str, Any], ...] = (
            ("VAD", self._providers.vad),
            ("ASR", self._providers.asr),
            ("MT", self._providers.mt),
            ("TTS", self._providers.tts),
        )
        if self._providers.diarizer is not None:
            pairs = (*pairs, ("DIA", self._providers.diarizer))
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
        settings = get_settings()
        cfg = get_preset_config(preset)
        asr_adapter = asr_adapter_name(cfg)
        providers = ProviderSet(
            vad=VAD_REGISTRY[cfg.vad_adapter](cfg),
            asr=ASR_REGISTRY[asr_adapter](cfg),
            mt=MT_REGISTRY[cfg.mt_adapter](cfg),
            tts=TTS_REGISTRY[cfg.tts_adapter](cfg),
            diarizer=(
                DIARIZATION_REGISTRY[settings.diarization_adapter]()
                if settings.diarization_enabled
                else None
            ),
        )
        models_dir = settings.models_dir
        asr_dir = models_dir / ("mlx-whisper" if asr_adapter == "mlx_whisper" else "whisper-cpp")
        # (khâu, provider, tên model để tra dung lượng, thư mục đo byte đã tải, ghi
        #  chú, bắt buộc?) — "bắt buộc" = hỏng thì cả lượt nạp hỏng.
        plan: tuple[tuple[str, Any, str, Path | None, str, bool], ...] = (
            ("VAD", providers.vad, "silero-vad", None, "nằm trong gói cài đặt", True),
            ("ASR", providers.asr, asr_model(cfg, asr_adapter), asr_dir, "", True),
            ("MT", providers.mt, cfg.mt_model, models_dir / "nllb", "", True),
            # TTS nạp voice lười theo ngôn ngữ (lúc đọc câu đầu tiên), nên khâu này
            # xong ngay và phần tải voice không nằm trong lượt nạp này.
            ("TTS", providers.tts, cfg.tts_adapter, None, "voice tải khi đọc câu đầu", True),
        )
        if providers.diarizer is not None:
            # Diarization là phần thêm cho màn nhập tệp, KHÔNG bắt buộc: thiếu token
            # HuggingFace hay chưa cài `--extra diarization` thì chỉ mất nhãn người
            # nói, không có lý do gì để cả ứng dụng dịch ngừng chạy theo.
            plan = (
                *plan,
                (
                    "DIA",
                    providers.diarizer,
                    settings.diarization_model,
                    models_dir / "pyannote",
                    "",
                    False,
                ),
            )
        progress.begin([(stage, model) for stage, _p, model, _d, _n, _r in plan])

        # Nạp lần lượt và nhớ những khâu đã xong: nếu khâu sau hỏng (hay gặp nhất là
        # mất mạng giữa lúc tải model), phải giải phóng những khâu trước đó. Không thì
        # chúng nằm lại trong RAM mà không ai tham chiếu tới — whisper.cpp còn giữ cả
        # context Metal — và lần bấm "Khởi động model" tiếp theo lại nạp thêm một bộ.
        loaded: list[Any] = []
        for stage, provider, _model, watch_dir, note, required in plan:
            if progress.cancel_requested:
                # Người dùng bấm Huỷ. Kiểm ở RANH GIỚI khâu vì không giết ngang được
                # một lượt tải đang chạy trong worker thread — nhưng vẫn cứu được
                # những khâu sau, mà đó mới là chỗ tốn (NLLB ~2,4 GB).
                logger.info("Huỷ lượt nạp model trước khâu %s theo yêu cầu", stage)
                for done in loaded:
                    await done.unload()
                progress.cancelled()
                raise ModelLoadCancelled(stage)
            progress.stage_begin(stage, watch_dir)
            try:
                await provider.load()
            except Exception as exc:
                logger.warning("Nạp khâu %s thất bại: %s", stage, exc)
                progress.stage_failed(stage, str(exc), fatal=required)
                if required:
                    for done in loaded:
                        await done.unload()
                    raise ModelLoadError(stage, exc) from exc
                # Khâu không bắt buộc: bỏ provider đi và chạy tiếp. Thanh tiến trình
                # giữ nguyên trạng thái "failed" kèm lý do nên người dùng vẫn thấy.
                providers.diarizer = None
                continue
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
            self._providers.diarizer,
        ):
            if provider is not None:
                await provider.unload()
        self._providers = None
        # Giữ lại preset đang chọn: giải phóng bộ nhớ không có nghĩa là quên lựa chọn
        # của người dùng — `ensure_loaded()` sẽ nạp đúng preset đó khi cần.
