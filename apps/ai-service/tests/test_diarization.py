"""Diarization trong luồng nhập tệp: nhãn người nói, xuống nước khi hỏng, ghi lịch sử.

Toàn bộ dùng diarizer giả. Model pyannote thật là repo *gated* (cần token
HuggingFace) và nặng vài trăm MB — không thể là điều kiện để chạy được test suite.
Phần thật được kiểm bằng tay theo docs/19.
"""

from __future__ import annotations

import asyncio

from llvt_ai_service.adapters.diarization.pyannote import _to_turns
from llvt_ai_service.application.transcribe import progress, transcribe_audio
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript, SpeakerTurn, TranslationResult, VadSegment

SR = 16000


class TwoSegmentVadStream:
    """Cắt mỗi lượt gọi thành một đoạn, mốc thời gian tăng dần theo tệp."""

    def __init__(self) -> None:
        self._offset_ms = 0

    def accept(self, pcm: bytes, sample_rate: int = SR) -> list[VadSegment]:
        duration_ms = int(len(pcm) / 2 / sample_rate * 1000)
        segment = VadSegment(
            pcm=pcm,
            started_at_ms=self._offset_ms,
            ended_at_ms=self._offset_ms + duration_ms,
        )
        self._offset_ms += duration_ms
        return [segment]

    def reset(self) -> None: ...

    def flush(self) -> list[VadSegment]:
        return []


class FakeAsr:
    async def transcribe(self, _pcm: bytes, language: Language, _rate: int = SR) -> AsrTranscript:
        return AsrTranscript(text="xin chào", language=language, processing_ms=1)


class FakeMt:
    async def translate(self, text: str, src: Language, tgt: Language) -> TranslationResult:
        return TranslationResult(
            source_text=text,
            translated_text=text,
            source_language=src,
            target_language=tgt,
        )


class FakeDiarizer:
    """Diarizer giả: trả danh sách lượt nói dựng sẵn, hoặc ném lỗi để thử đường hỏng."""

    name = "fake"
    loaded = True

    def __init__(self, turns: list[SpeakerTurn] | None = None, error: Exception | None = None):
        self.turns = turns or []
        self.error = error
        self.calls = 0

    async def diarize(self, pcm: bytes, sample_rate: int = SR) -> list[SpeakerTurn]:
        self.calls += 1
        if self.error is not None:
            raise self.error
        return self.turns


class Providers:
    def __init__(self, diarizer: object | None) -> None:
        self.vad = _VadFactory()
        self.asr = FakeAsr()
        self.mt = FakeMt()
        self.tts = None
        self.diarizer = diarizer


class _VadFactory:
    def open_stream(self) -> TwoSegmentVadStream:
        return TwoSegmentVadStream()


def _pcm(seconds: float) -> bytes:
    return b"\x00\x00" * int(SR * seconds)


def _run(providers: object, pcm: bytes) -> object:
    return asyncio.run(transcribe_audio(providers, pcm, Language.vi))


# --- gán nhãn -------------------------------------------------------------


def test_segments_get_speaker_labels_renumbered_by_who_speaks_first():
    # Tệp 10 s, VAD cắt thành 2 đoạn 5 s. SPEAKER_07 nói nửa đầu, SPEAKER_02 nửa sau,
    # nên nhãn phải là speaker-1 rồi speaker-2 — theo lượt nói, không theo số của model.
    diarizer = FakeDiarizer(
        [
            SpeakerTurn(speaker="SPEAKER_07", started_at_ms=0, ended_at_ms=5000),
            SpeakerTurn(speaker="SPEAKER_02", started_at_ms=5000, ended_at_ms=10000),
        ]
    )
    result = _run(Providers(diarizer), _pcm(10))

    assert diarizer.calls == 1
    assert [s.speaker for s in result.segments] == ["speaker-1", "speaker-2"]
    assert result.speaker_count == 2


def test_no_diarizer_leaves_every_segment_without_a_label():
    result = _run(Providers(None), _pcm(10))

    assert [s.speaker for s in result.segments] == [None, None]
    assert result.speaker_count == 0


def test_diarization_failure_keeps_the_transcript():
    # Mất nhãn người nói thì vẫn còn bản ghi; không có bản ghi mới là mất trắng.
    diarizer = FakeDiarizer(error=RuntimeError("hết VRAM"))
    result = _run(Providers(diarizer), _pcm(10))

    assert len(result.segments) == 2
    assert [s.speaker for s in result.segments] == [None, None]
    assert result.speaker_count == 0


def test_progress_reports_the_diarizing_phase_then_returns_to_transcribing():
    seen: list[str] = []

    class WatchingDiarizer(FakeDiarizer):
        async def diarize(self, pcm: bytes, sample_rate: int = SR) -> list[SpeakerTurn]:
            seen.append(progress.snapshot()["phase"])
            return await super().diarize(pcm, sample_rate)

    _run(Providers(WatchingDiarizer()), _pcm(5))

    assert seen == ["diarizing"]
    assert progress.snapshot()["phase"] == "transcribing"


# --- đọc kết quả pyannote -------------------------------------------------


class _Segment:
    def __init__(self, start: float, end: float) -> None:
        self.start = start
        self.end = end


class _Annotation:
    def __init__(self, tracks: list[tuple[_Segment, str, str]]) -> None:
        self._tracks = tracks

    def itertracks(self, yield_label: bool = False) -> list[tuple[_Segment, str, str]]:
        assert yield_label
        return self._tracks


class _DiarizeOutput:
    """Bọc như `speaker-diarization-community-1`: phần cần dùng nằm ở một thuộc tính."""

    def __init__(self, annotation: _Annotation) -> None:
        self.speaker_diarization = annotation


def test_reads_both_the_wrapped_and_the_bare_pyannote_output():
    tracks = [
        (_Segment(1.5, 2.25), "_", "SPEAKER_01"),
        (_Segment(0.0, 1.5), "_", "SPEAKER_00"),
    ]
    expected = [
        SpeakerTurn(speaker="SPEAKER_00", started_at_ms=0, ended_at_ms=1500),
        SpeakerTurn(speaker="SPEAKER_01", started_at_ms=1500, ended_at_ms=2250),
    ]

    assert _to_turns(_DiarizeOutput(_Annotation(tracks))) == expected
    assert _to_turns(_Annotation(tracks)) == expected


def test_unreadable_diarization_output_raises_instead_of_returning_nothing():
    try:
        _to_turns(object())
    except RuntimeError as exc:
        assert "không đọc được" in str(exc)
    else:  # pragma: no cover - chỉ chạy khi có lỗi lập trình
        raise AssertionError("phải ném RuntimeError khi kết quả không có itertracks()")
