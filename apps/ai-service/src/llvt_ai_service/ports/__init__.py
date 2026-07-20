"""Ports: interface trừu tượng. Application chỉ phụ thuộc vào các port này,
không phụ thuộc adapter cụ thể (whisper.cpp, NLLB, sherpa-onnx...)."""

from llvt_ai_service.ports.asr import SpeechToTextProvider
from llvt_ai_service.ports.base import Provider
from llvt_ai_service.ports.repository import SessionRepository
from llvt_ai_service.ports.translator import TranslationProvider
from llvt_ai_service.ports.tts import TextToSpeechProvider
from llvt_ai_service.ports.vad import VoiceActivityDetector

__all__ = [
    "Provider",
    "VoiceActivityDetector",
    "SpeechToTextProvider",
    "TranslationProvider",
    "TextToSpeechProvider",
    "SessionRepository",
]
