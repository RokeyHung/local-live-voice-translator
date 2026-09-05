"""Quy tắc gán nhãn người nói cho một đoạn VAD (application/speaker_labels.py).

Kiểm ở đây chứ không qua pyannote: quy tắc "ai chiếm nhiều thời lượng nhất" là phần
dễ sai và phải chạy được mà không cần tải model gated về máy.
"""

from __future__ import annotations

from llvt_ai_service.application.speaker_labels import (
    label_for,
    overlap_ms,
    rename_by_first_appearance,
)
from llvt_ai_service.domain.models import SpeakerTurn


def _turn(speaker: str, start: int, end: int) -> SpeakerTurn:
    return SpeakerTurn(speaker=speaker, started_at_ms=start, ended_at_ms=end)


# --- chồng lấn ------------------------------------------------------------


def test_overlap_is_zero_for_disjoint_ranges():
    assert overlap_ms(0, 100, 100, 200) == 0
    assert overlap_ms(300, 400, 0, 100) == 0


def test_overlap_counts_only_the_shared_part():
    assert overlap_ms(0, 1000, 500, 2000) == 500


# --- chọn nhãn ------------------------------------------------------------


def test_picks_the_speaker_holding_most_of_the_segment():
    turns = [_turn("A", 0, 900), _turn("B", 900, 1000)]
    assert label_for(0, 1000, turns) == "A"


def test_sums_multiple_turns_of_the_same_speaker():
    # A nói hai lần 300 ms (600 tổng), B một lần 400 ms → A thắng dù mỗi lượt ngắn hơn.
    turns = [_turn("A", 0, 300), _turn("B", 300, 700), _turn("A", 700, 1000)]
    assert label_for(0, 1000, turns) == "A"


def test_returns_none_when_nobody_holds_the_minimum_share():
    # Đoạn 1000 ms nhưng chỉ 100 ms có người nói → dưới ngưỡng 25%, không gắn nhãn.
    assert label_for(0, 1000, [_turn("A", 0, 100)]) is None


def test_returns_none_without_turns_or_for_empty_segment():
    assert label_for(0, 1000, []) is None
    assert label_for(500, 500, [_turn("A", 0, 1000)]) is None


def test_ties_resolve_deterministically_by_label():
    # Hai người chia đôi đúng 50/50: kết quả phải lặp lại được giữa các lần chạy.
    turns = [_turn("B", 0, 500), _turn("A", 500, 1000)]
    assert label_for(0, 1000, turns) == "A"


def test_overlapping_speech_gives_the_segment_to_the_dominant_voice():
    # Hai người nói đè lên nhau — pyannote trả về các lượt chồng lấn, không phải
    # một phân hoạch, nên hàm phải chịu được cả trường hợp tổng > độ dài đoạn.
    turns = [_turn("A", 0, 1000), _turn("B", 600, 1000)]
    assert label_for(0, 1000, turns) == "A"


# --- đánh số lại ----------------------------------------------------------


def test_renames_by_who_speaks_first_not_by_model_numbering():
    turns = [_turn("SPEAKER_03", 0, 500), _turn("SPEAKER_00", 500, 900)]
    mapping = rename_by_first_appearance(turns)
    assert mapping == {"SPEAKER_03": "speaker-1", "SPEAKER_00": "speaker-2"}


def test_rename_is_stable_regardless_of_input_order():
    turns = [_turn("SPEAKER_00", 500, 900), _turn("SPEAKER_03", 0, 500)]
    assert rename_by_first_appearance(turns)["SPEAKER_03"] == "speaker-1"
