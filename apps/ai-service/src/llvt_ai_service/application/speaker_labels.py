"""Gán nhãn người nói cho một đoạn VAD, từ danh sách lượt nói của diarization.

Đây là chỗ hai cách cắt âm thanh gặp nhau, và chúng KHÔNG trùng nhau: VAD cắt theo
khoảng lặng (một câu), diarization cắt theo giọng (một lượt nói, có thể gồm nhiều
câu, và có thể chồng lấn khi hai người nói đè lên nhau). Nên không thể tra theo mốc
bắt đầu — phải hỏi "trong khoảng thời gian của câu này, ai chiếm nhiều thời lượng
nhất".

Hàm thuần, không phụ thuộc model nào: nhờ vậy quy tắc gán nhãn kiểm thử được mà
không cần tải pyannote về.
"""

from __future__ import annotations

from llvt_ai_service.domain.models import SpeakerTurn

# Phần đoạn phải được một người chiếm thì mới dám gắn tên người đó. Dưới ngưỡng này
# nghĩa là câu rơi vào chỗ giao nhau/chuyển lượt, gắn đại một cái tên sẽ sai nhiều
# hơn đúng — thà để trống (giao diện hiện "—") còn hơn khẳng định nhầm.
MIN_OVERLAP_RATIO = 0.25


def overlap_ms(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    """Số mili-giây hai khoảng thời gian chồng lên nhau (0 nếu rời nhau)."""
    return max(0, min(a_end, b_end) - max(a_start, b_start))


def label_for(
    started_at_ms: int,
    ended_at_ms: int,
    turns: list[SpeakerTurn],
    *,
    min_ratio: float = MIN_OVERLAP_RATIO,
) -> str | None:
    """Người nói chiếm nhiều thời lượng nhất trong ``[started_at_ms, ended_at_ms)``.

    Trả None khi không ai chiếm đủ ``min_ratio`` độ dài đoạn — kể cả khi danh sách
    lượt nói rỗng, hoặc khi đoạn có độ dài 0.
    """
    duration = ended_at_ms - started_at_ms
    if duration <= 0 or not turns:
        return None

    totals: dict[str, int] = {}
    for turn in turns:
        shared = overlap_ms(started_at_ms, ended_at_ms, turn.started_at_ms, turn.ended_at_ms)
        if shared > 0:
            totals[turn.speaker] = totals.get(turn.speaker, 0) + shared
    if not totals:
        return None

    # Hoà nhau thì lấy nhãn nhỏ nhất theo thứ tự chữ: kết quả phải tất định để hai
    # lần chạy cùng một tệp cho ra cùng một bản ghi.
    speaker = min(totals, key=lambda name: (-totals[name], name))
    return speaker if totals[speaker] >= duration * min_ratio else None


def rename_by_first_appearance(turns: list[SpeakerTurn]) -> dict[str, str]:
    """Đổi ``SPEAKER_xx`` của model thành ``speaker-1, speaker-2, …`` theo thứ tự nói.

    Model đánh số theo thứ tự cụm nội bộ của nó, nên người lên tiếng đầu tiên trong
    tệp hoàn toàn có thể mang nhãn ``SPEAKER_03``. Với người đọc bản ghi thì đó là số
    vô nghĩa; đánh lại theo lúc ai nói trước mới khớp với cái họ nghe thấy.

    Vẫn là **mã**, không phải chữ hiển thị: câu "Người nói 1" / "Speaker 1" do giao
    diện tự dựng theo ngôn ngữ đang chọn. Service không được quyết hộ, nếu không bản
    ghi tiếng Việt sẽ nằm cứng trong lịch sử của người dùng giao diện tiếng Anh.
    """
    mapping: dict[str, str] = {}
    for turn in sorted(turns, key=lambda t: (t.started_at_ms, t.speaker)):
        if turn.speaker not in mapping:
            mapping[turn.speaker] = f"speaker-{len(mapping) + 1}"
    return mapping
