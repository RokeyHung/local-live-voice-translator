"""Màn "Đánh giá": độ đo và luồng chấm điểm (GVHD biên bản 19/08 mục 3d).

Phần độ đo kiểm bằng những cặp câu tính tay được, để nếu ai sửa công thức thì test
nói ngay chứ không phải đợi số trong báo cáo trông lạ.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.application.evaluation import (
    EvaluationCase,
    chrf,
    error_rate,
    evaluate,
    metric_name,
    normalize,
    percentile,
    progress,
)
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.domain.models import AsrTranscript, TranslationResult, TtsResult

SR = 16000


# --- độ đo ----------------------------------------------------------------


def test_normalize_drops_punctuation_but_keeps_vietnamese_tones():
    # Bỏ dấu tiếng Việt là đổi nghĩa từ — "hoàn thành" khác "hoan thanh".
    assert normalize("Tôi đã hoàn thành!") == "tôi đã hoàn thành"


def test_wer_counts_word_edits():
    # Bỏ một từ trong sáu → 1/6.
    rate = error_rate("tôi đã hoàn thành phần API", "tôi đã hoàn thành API", Language.vi)
    assert rate == pytest.approx(1 / 6)


def test_perfect_match_is_zero_error():
    assert error_rate("hello world", "Hello, world!", Language.en) == 0.0


def test_chinese_and_japanese_are_scored_by_character():
    # zh/ja không tách từ bằng khoảng trắng — chấm WER là chấm theo chỗ Whisper tình
    # cờ chèn dấu cách. Chỗ nào máy chèn dấu cách cũng không được ảnh hưởng kết quả.
    assert metric_name(Language.zh) == "CER"
    assert metric_name(Language.ja) == "CER"
    assert error_rate("我完成了接口", "我 完成 了 接口", Language.zh) == 0.0


def test_empty_reference_is_zero_only_when_nothing_was_heard():
    assert error_rate("", "", Language.vi) == 0.0
    assert error_rate("", "máy bịa ra câu này", Language.vi) == 1.0


def test_chrf_is_one_for_an_exact_match_and_zero_for_no_overlap():
    assert chrf("xin chào", "xin chào") == 1.0
    assert chrf("aaaa", "bbbb") == 0.0


def test_percentile_matches_the_report_script():
    # Công thức phải trùng `scripts/eval_latency.py` (nó gọi chính hàm này), nếu không
    # cùng một bộ dữ liệu sẽ ra hai con số p90.
    values = [float(i) for i in range(1, 11)]
    assert percentile(values, 0.9) == 9.0
    assert percentile(values, 0.5) == 5.0
    assert percentile([], 0.9) == 0.0


# --- luồng chấm -----------------------------------------------------------


class FakeAsr:
    def __init__(self, text: str = "tôi đã hoàn thành phần API") -> None:
        self._text = text

    async def transcribe(self, _pcm: bytes, language: Language, _rate: int = SR) -> AsrTranscript:
        return AsrTranscript(text=self._text, language=language, processing_ms=1)


class FakeMt:
    def __init__(self) -> None:
        self.seen: list[str] = []

    async def translate(self, text: str, src: Language, tgt: Language) -> TranslationResult:
        self.seen.append(text)
        return TranslationResult(
            source_text=text,
            translated_text="I have finished the API part",
            source_language=src,
            target_language=tgt,
        )


class FakeTts:
    def __init__(self) -> None:
        self.calls = 0

    async def synthesize(self, _text: str, _language: Language) -> TtsResult:
        self.calls += 1
        return TtsResult(pcm=b"\x00\x00" * SR, sample_rate=SR, duration_ms=1000, processing_ms=1)


class Providers:
    def __init__(self, asr: FakeAsr | None = None) -> None:
        self.vad = None
        self.asr = asr or FakeAsr()
        self.mt = FakeMt()
        self.tts = FakeTts()
        self.diarizer = None


def _case(pcm: bytes = b"") -> EvaluationCase:
    return EvaluationCase(
        id="vi-01",
        language=Language.vi,
        target=Language.en,
        transcript="tôi đã hoàn thành phần API",
        translation="I have finished the API part",
        pcm=pcm,
    )


@pytest.mark.anyio
async def test_a_case_with_recorded_audio_skips_tts():
    providers = Providers()
    report = await evaluate(providers, [_case(pcm=b"\x00\x00" * SR)])  # type: ignore[arg-type]

    assert providers.tts.calls == 0
    assert report.cases[0].audio_source == "recorded"
    assert report.has_synthetic_audio is False


@pytest.mark.anyio
async def test_a_case_without_audio_falls_back_to_tts_and_says_so():
    # Số của giọng tổng hợp LẠC QUAN hơn thực tế; cờ này là thứ giao diện dùng để nói
    # rõ chuyện đó, nên nó phải bật.
    providers = Providers()
    report = await evaluate(providers, [_case()])  # type: ignore[arg-type]

    assert providers.tts.calls == 1
    assert report.cases[0].audio_source == "tts-roundtrip"
    assert report.has_synthetic_audio is True


@pytest.mark.anyio
async def test_translation_runs_on_the_reference_not_on_the_asr_output():
    """Dịch từ đầu ra ASR thì lỗi hai khâu cộng dồn — không biết MT thật sự tốt cỡ nào."""
    providers = Providers(FakeAsr("máy nghe nhầm thành câu khác hẳn"))
    await evaluate(providers, [_case()])  # type: ignore[arg-type]

    assert providers.mt.seen == ["tôi đã hoàn thành phần API"]


@pytest.mark.anyio
async def test_a_perfect_run_scores_zero_error_and_full_chrf():
    report = await evaluate(Providers(), [_case()])  # type: ignore[arg-type]

    assert report.cases[0].error_rate == 0.0
    assert report.cases[0].metric == "WER"
    assert report.chrf == 1.0


@pytest.mark.anyio
async def test_cancelling_keeps_the_cases_already_scored():
    seen = 0

    async def should_stop() -> bool:
        nonlocal seen
        seen += 1
        return seen > 2  # cho chạy hai câu rồi dừng

    report = await evaluate(
        Providers(),  # type: ignore[arg-type]
        [_case(), _case(), _case(), _case()],
        should_stop=should_stop,
    )

    assert report.cancelled is True
    assert len(report.cases) == 2, "phần đã chấm xong vẫn phải dùng được"
    assert report.chrf == 1.0


@pytest.mark.anyio
async def test_progress_clears_after_a_run():
    await evaluate(Providers(), [_case()])  # type: ignore[arg-type]
    snapshot = progress.snapshot()
    assert snapshot["active"] is False
    assert snapshot["error"] is None


# --- REST -----------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_bundled_corpus_is_served_so_the_screen_has_something_to_run(client: TestClient):
    cases = client.get("/api/evaluate/corpus").json()
    assert len(cases) > 0
    assert {"id", "language", "target", "transcript", "translation"} <= set(cases[0])


def test_empty_case_list_with_no_bundled_data_is_a_400(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    from llvt_ai_service.api import evaluate as evaluate_api

    monkeypatch.setattr(evaluate_api, "_load_bundled", list)
    response = client.post("/api/evaluate", json={"cases": []})
    assert response.status_code == 400


def test_a_relative_audio_path_is_refused(client: TestClient):
    response = client.post(
        "/api/evaluate",
        json={
            "cases": [
                {
                    "id": "x",
                    "language": "vi",
                    "target": "en",
                    "transcript": "xin chào",
                    "translation": "hello",
                    "audio": "ghi-am.wav",
                }
            ]
        },
    )
    assert response.status_code == 400
    assert "tuyệt đối" in response.json()["detail"]


def test_a_missing_audio_file_is_reported_not_silently_replaced(client: TestClient):
    # Khai báo file rồi mà sai đường dẫn thì phải BÁO — rơi lặng lẽ về giọng tổng hợp
    # thì người chạy tưởng mình đang có số đo giọng thật.
    response = client.post(
        "/api/evaluate",
        json={
            "cases": [
                {
                    "id": "x",
                    "language": "vi",
                    "target": "en",
                    "transcript": "xin chào",
                    "translation": "hello",
                    "audio": "/tmp/khong-co-that-12345.wav",
                }
            ]
        },
    )
    assert response.status_code == 400
    assert "không thấy" in response.json()["detail"]


def test_too_many_cases_is_refused_with_a_pointer_to_the_cli(client: TestClient):
    case = {
        "id": "x",
        "language": "vi",
        "target": "en",
        "transcript": "xin chào",
        "translation": "hello",
    }
    response = client.post("/api/evaluate", json={"cases": [case] * 500})
    assert response.status_code == 400
    assert "eval-asr" in response.json()["detail"]


def test_cancel_is_a_no_op_when_nothing_is_running(client: TestClient):
    assert client.post("/api/evaluate/cancel").status_code == 204


def test_progress_endpoint_reports_idle(client: TestClient):
    # `done` giữ nguyên số của lượt vừa xong (giống tiến trình nhập tệp và nạp model):
    # giao diện đọc ảnh chụp cuối cùng sau khi lệnh chặn trả về. Cái phải bằng False
    # là "đang chạy".
    body = client.get("/api/evaluate/progress").json()
    assert body["active"] is False
    assert body["cancelling"] is False
