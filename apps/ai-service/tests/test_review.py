"""Duyệt bản dịch trước khi đọc ra micro ảo (SPEC 7.10 `Review before speaking`).

Điểm cốt lõi phải giữ: khi bật, **không có giọng nào phát ra** cho tới lúc người dùng
bấm gửi, và cái được đọc là bản họ đã sửa chứ không phải bản máy dịch.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application.pipeline import MAX_PENDING, TranslationPipeline
from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import AudioSource, Language, PipelineState
from llvt_ai_service.domain.models import (
    AsrTranscript,
    AudioChunk,
    LanguagePair,
    TranslationResult,
    TtsResult,
    VadSegment,
)

SR = 16000


class FakeAsr:
    async def transcribe(self, _pcm: bytes, language: Language, _rate: int = SR) -> AsrTranscript:
        return AsrTranscript(text="xin chào", language=language, processing_ms=1)


class FakeMt:
    async def translate(self, text: str, src: Language, tgt: Language) -> TranslationResult:
        return TranslationResult(
            source_text=text,
            translated_text="hello",
            source_language=src,
            target_language=tgt,
        )


class FakeTts:
    def __init__(self) -> None:
        self.spoken: list[str] = []

    async def synthesize(self, text: str, _language: Language) -> TtsResult:
        self.spoken.append(text)
        return TtsResult(pcm=b"\x00\x00", sample_rate=SR, duration_ms=10, processing_ms=1)


class OneSegmentStream:
    """VAD giả: mỗi khung audio ra đúng một câu, để test đi qua `feed()` thật."""

    def accept(self, pcm: bytes, _rate: int = SR) -> list[VadSegment]:
        return [VadSegment(pcm=pcm, started_at_ms=0, ended_at_ms=100)]

    def flush(self) -> list[VadSegment]:
        return []

    def reset(self) -> None: ...


class FakeVad:
    def open_stream(self) -> OneSegmentStream:
        return OneSegmentStream()


class Providers:
    def __init__(self, tts: FakeTts) -> None:
        self.vad = FakeVad()
        self.asr = FakeAsr()
        self.mt = FakeMt()
        self.tts = tts
        self.diarizer = None


class Recorder:
    """Thu lại mọi event pipeline phát ra."""

    def __init__(self) -> None:
        self.events: list[ev.PipelineEvent] = []

    async def __call__(self, event: ev.PipelineEvent) -> None:
        self.events.append(event)

    def states(self) -> list[str]:
        return [e.state.value for e in self.events if isinstance(e, ev.StateChanged)]

    def utterance_id(self) -> str:
        return next(e.utterance_id for e in self.events if isinstance(e, ev.MtResult))


def _pipeline(recorder: Recorder, tts: FakeTts, *, review: bool) -> TranslationPipeline:
    return TranslationPipeline(
        Providers(tts),  # type: ignore[arg-type]
        LanguagePair(Language.vi, Language.en),
        AudioSource.microphone,
        recorder,
        synthesize=True,
        review=review,
    )


async def _speak_once(pipeline: TranslationPipeline) -> None:
    """Một khung audio → VAD giả cắt ra một câu → chạy hết luồng công khai."""
    await pipeline.feed(
        AudioChunk(session_id="", source=AudioSource.microphone, pcm=b"\x00\x00", seq=0)
    )


# --- treo lại chờ duyệt ---------------------------------------------------


@pytest.mark.anyio
async def test_review_stops_before_speaking():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)

    await _speak_once(pipeline)

    # Điều quan trọng nhất: chưa có gì phát ra micro ảo.
    assert tts.spoken == []
    assert recorder.states() == ["Recognizing", "Translating", "WaitingForConfirmation"]
    assert not any(isinstance(e, ev.TtsAudio) for e in recorder.events)
    assert len(pipeline.pending_ids) == 1


@pytest.mark.anyio
async def test_translation_is_still_sent_so_the_user_has_something_to_edit():
    recorder, tts = Recorder(), FakeTts()
    await _speak_once(_pipeline(recorder, tts, review=True))

    result = next(e for e in recorder.events if isinstance(e, ev.MtResult))
    assert result.translated_text == "hello"


@pytest.mark.anyio
async def test_without_review_it_speaks_straight_through():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=False)

    await _speak_once(pipeline)

    assert tts.spoken == ["hello"]
    assert recorder.states()[-1] == "Completed"
    assert pipeline.pending_ids == []


@pytest.mark.anyio
async def test_review_is_ignored_on_the_incoming_direction():
    """Chiều nghe remote không tổng hợp giọng nên chẳng có gì để duyệt."""
    recorder, tts = Recorder(), FakeTts()
    pipeline = TranslationPipeline(
        Providers(tts),  # type: ignore[arg-type]
        LanguagePair(Language.en, Language.vi),
        AudioSource.system,
        recorder,
        synthesize=False,
        review=True,
    )

    await _speak_once(pipeline)

    assert recorder.states()[-1] == "Completed"
    assert pipeline.pending_ids == []


# --- gửi ------------------------------------------------------------------


@pytest.mark.anyio
async def test_confirm_speaks_the_edited_text_not_the_machine_translation():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)
    await _speak_once(pipeline)

    assert await pipeline.confirm(recorder.utterance_id(), "hi there")

    assert tts.spoken == ["hi there"]
    assert recorder.states()[-2:] == ["Synthesizing", "Completed"]
    assert pipeline.pending_ids == []


@pytest.mark.anyio
async def test_confirm_without_edits_speaks_the_machine_translation():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)
    await _speak_once(pipeline)

    await pipeline.confirm(recorder.utterance_id(), None)

    assert tts.spoken == ["hello"]


@pytest.mark.anyio
async def test_blank_edit_falls_back_to_the_translation_instead_of_speaking_nothing():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)
    await _speak_once(pipeline)

    await pipeline.confirm(recorder.utterance_id(), "   ")

    assert tts.spoken == ["hello"]


@pytest.mark.anyio
async def test_confirming_twice_is_refused_rather_than_speaking_twice():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)
    await _speak_once(pipeline)
    utterance_id = recorder.utterance_id()

    assert await pipeline.confirm(utterance_id, None) is True
    assert await pipeline.confirm(utterance_id, None) is False
    assert tts.spoken == ["hello"], "bấm hai lần không được đọc hai lần"


# --- bỏ -------------------------------------------------------------------


@pytest.mark.anyio
async def test_discard_is_never_spoken():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)
    await _speak_once(pipeline)

    assert await pipeline.discard_pending(recorder.utterance_id())

    assert tts.spoken == []
    assert recorder.states()[-1] == "Completed"
    assert pipeline.pending_ids == []


@pytest.mark.anyio
async def test_discarding_an_unknown_id_is_a_no_op():
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)
    assert await pipeline.discard_pending("khong-co-that") is False


# --- chặn trên số câu treo ------------------------------------------------


@pytest.mark.anyio
async def test_pending_queue_is_bounded_and_keeps_the_newest():
    """Người dùng bỏ đi giữa chừng thì hàng đợi không được phình mãi."""
    recorder, tts = Recorder(), FakeTts()
    pipeline = _pipeline(recorder, tts, review=True)

    for _ in range(MAX_PENDING + 3):
        await _speak_once(pipeline)

    assert len(pipeline.pending_ids) == MAX_PENDING
    dropped = [e for e in recorder.events if isinstance(e, ev.PipelineError)]
    assert [e.code for e in dropped] == ["review_dropped"] * 3
    # Câu bị bỏ phải là câu CŨ nhất — câu vừa nói mới là câu người ta còn muốn gửi.
    assert dropped[0].utterance_id not in pipeline.pending_ids


# --- qua WebSocket --------------------------------------------------------


def _start(ws, **extra) -> None:
    ws.receive_json()  # Idle
    ws.send_json(
        {
            "type": "session.start",
            "payload": {
                "mode": "speak",
                "outgoingSource": "vi",
                "outgoingTarget": "en",
                **extra,
            },
        }
    )
    ws.receive_json()  # Listening


def test_confirming_an_expired_utterance_reports_an_error(monkeypatch: pytest.MonkeyPatch):
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start(ws, reviewBeforeSpeaking=True)
            ws.send_json({"type": "control.confirm", "payload": {"utteranceId": "khong-co-that"}})

            message = ws.receive_json()
            assert message["type"] == "error"
            assert message["payload"]["code"] == "review_expired"

            # Kết nối vẫn sống sau lỗi đó.
            ws.send_json({"type": "control.mute", "payload": {"muted": True}})
            assert ws.receive_json()["type"] == "state"


def test_session_start_carries_the_review_flag():
    from llvt_ai_service.ws.protocol import parse_session_config

    payload = {"mode": "speak", "outgoingSource": "vi", "outgoingTarget": "en"}
    assert parse_session_config(payload).review_before_speaking is False
    assert parse_session_config({**payload, "reviewBeforeSpeaking": True}).review_before_speaking


def test_stopping_the_session_forgets_pending_utterances():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            _start(ws, reviewBeforeSpeaking=True)
            ws.send_json({"type": "session.stop", "payload": {}})
            assert ws.receive_json()["payload"]["state"] == PipelineState.stopped.value
