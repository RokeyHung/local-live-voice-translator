"""Test bộ lọc câu ma của ASR (biên bản GVHD 19/08 mục 4.1).

Trọng tâm không chỉ là "chặn được câu ma" mà còn là "KHÔNG chặn nhầm câu thật":
trong một ứng dụng phiên dịch, mất một câu người dùng vừa nói còn tệ hơn để lọt một
câu rác thỉnh thoảng.
"""

from __future__ import annotations

import pytest

from llvt_ai_service.adapters.asr.hallucination import (
    is_degenerate,
    is_phantom,
    rejection_reason,
    strip_non_speech,
)


@pytest.mark.parametrize(
    "text",
    [
        "Thanks for watching!",
        "  thank you for watching.  ",
        "Subtitles by the Amara.org community",
        "Hãy subscribe cho kênh Ghiền Mì Gõ để không bỏ lỡ những video hấp dẫn",
        "ご視聴ありがとうございました",
        "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目",
    ],
)
def test_phantom_phrases_detected(text: str):
    assert is_phantom(text)


@pytest.mark.parametrize(
    "text",
    [
        "Cảm ơn anh.",
        "Thank you.",
        "Vâng, tôi đồng ý với đề xuất đó.",
        "ありがとう",
        "谢谢",
        "Tôi đã xem video hướng dẫn subscribe kênh rồi, giờ nói chuyện khác nhé.",
    ],
)
def test_real_short_utterances_kept(text: str):
    """Câu ngắn lịch sự là lời nói THẬT trong cuộc họp — không được chặn."""
    assert not is_phantom(text)
    assert not is_degenerate(text)


def test_degenerate_repetition_detected():
    assert is_degenerate("một một một một một một")
    assert is_degenerate("we will we will we will we will")
    assert is_degenerate("的的的的的的的的的的")


def test_normal_sentence_not_degenerate():
    assert not is_degenerate("Chúng ta sẽ họp lại vào thứ Hai tuần sau để chốt phương án.")
    assert not is_degenerate("Rất rất tốt.")  # lặp 2 lần là cách nói bình thường


def test_strip_non_speech_markers():
    assert strip_non_speech("[Music] Xin chào mọi người (applause)") == "Xin chào mọi người"
    assert strip_non_speech("♪♪♪") == ""


def test_rejection_reason_reports_cause():
    assert rejection_reason("", None) == "empty"
    assert rejection_reason("[Music]", 0.9) == "empty"
    assert rejection_reason("Thanks for watching!", 0.95) == "phantom_phrase"
    assert rejection_reason("a a a a a", 0.9) == "degenerate_repeat"
    assert rejection_reason("Xin chào", 0.1, min_confidence=0.35) == "low_confidence"
    assert rejection_reason("Xin chào", 0.9, min_confidence=0.35) is None


def test_confidence_filter_off_by_default():
    """min_confidence=0 nghĩa là tắt hẳn — dùng khi đo WER để không lọc mất mẫu nào."""
    assert rejection_reason("Xin chào", 0.01) is None
    # Thiếu confidence (adapter không tính được) thì không được coi là lý do loại.
    assert rejection_reason("Xin chào", None, min_confidence=0.35) is None
