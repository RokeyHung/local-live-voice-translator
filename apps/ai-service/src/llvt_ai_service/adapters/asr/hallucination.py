"""Lọc câu "ma" do Whisper sinh ra trên đoạn không có giọng nói.

Biên bản GVHD 19/08 mục 4.1: ở những đoạn người dùng không nói gì, Whisper vẫn sinh
text — thường là mấy câu chào kênh YouTube, vì dữ liệu huấn luyện của nó có rất nhiều
phụ đề video. Ngưỡng ``no_speech_thold`` của whisper.cpp chặn được phần lớn nhưng
không phải tất cả, nên còn một lớp lọc ở phía Python.

Ba dấu hiệu, độc lập nhau:

1. **Câu quen mặt.** Danh sách ``PHANTOM_PHRASES`` chỉ chứa những câu DÀI và ĐẶC TRƯNG
   (tên kênh, "Amara.org", "ご視聴ありがとうございました"...). Cố tình KHÔNG đưa vào
   những câu ngắn kiểu "Cảm ơn." / "Thank you." — trong ứng dụng phiên dịch đó là câu
   nói thật, chặn nhầm còn tệ hơn để lọt.
2. **Lặp thoái hoá.** Giải mã bị kẹt vòng lặp sinh ra một cụm lặp đi lặp lại.
3. **Độ tin cậy thấp.** Trung bình nhân xác suất token dưới ngưỡng.

Module này thuần hàm, không phụ thuộc runtime ASR nào, nên cả whisper.cpp lẫn
faster-whisper (khi làm) đều dùng lại được.
"""

from __future__ import annotations

import re
import unicodedata

# Câu ma đã gặp trong thực tế / được cộng đồng Whisper ghi nhận. Gom chung mọi ngôn
# ngữ vì Whisper hoàn toàn có thể nhả một câu tiếng Anh giữa phiên tiếng Việt.
PHANTOM_PHRASES: tuple[str, ...] = (
    # en
    "thanks for watching",
    "thank you for watching",
    "please subscribe to my channel",
    "subtitles by the amara org community",
    "subtitles by the amaraorg community",
    "amara org community",
    "transcription by castingwords",
    "like and subscribe",
    "dont forget to subscribe",
    # vi
    "hay subscribe cho kenh ghien mi go",
    "ghien mi go",
    "cam on cac ban da theo doi",
    "hen gap lai cac ban o video tiep theo",
    "dang ky kenh de khong bo lo video moi",
    # ja
    "ご視聴ありがとうございました",
    "ご視聴ありがとうございます",
    "チャンネル登録お願いします",
    "最後までご視聴いただきありがとうございました",
    # zh
    "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目",
    "明镜与点点栏目",
    "字幕由amara org社区提供",
    "请订阅我的频道",
    "感谢您的收看",
)

# Ký hiệu phi-lời-nói mà Whisper hay chèn: [Music], (applause), ♪♪♪, 【拍手】...
_NON_SPEECH = re.compile(r"[\[\(（【♪][^\]\)）】♪]*[\]\)）】♪]|[♪〜~]+")
_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_SPACES = re.compile(r"\s+")

# Chuỗi càng dài thì kiểm tra lặp càng tốn; câu thật không bao giờ dài tới mức này.
_MAX_TOKENS = 400


def strip_non_speech(text: str) -> str:
    """Bỏ các nhãn phi-lời-nói và khoảng trắng thừa."""
    return _SPACES.sub(" ", _NON_SPEECH.sub(" ", text)).strip()


def normalize(text: str) -> str:
    """Chuẩn hoá để so khớp: bỏ dấu (chỉ với chữ Latin), bỏ dấu câu, gộp khoảng trắng.

    Chữ Hán/Kana không bị bỏ dấu vì ``NFD`` không tách chúng ra — đúng như mong muốn.
    """
    text = strip_non_speech(text).casefold()
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return _SPACES.sub(" ", _PUNCT.sub(" ", stripped)).strip()


def _tokens(normalized: str) -> list[str]:
    parts = normalized.split()
    # Tiếng Trung/Nhật không tách từ bằng khoảng trắng → so theo ký tự.
    if len(parts) <= 1 and len(normalized) > 6:
        return list(normalized.replace(" ", ""))[:_MAX_TOKENS]
    return parts[:_MAX_TOKENS]


# Mẫu dài tới mức này thì chỉ cần XUẤT HIỆN là đủ kết luận — không ai vô tình nói
# trúng nguyên văn "please subscribe to my channel" giữa cuộc họp. Mẫu ngắn hơn phải
# chiếm được ít nhất nửa câu mới tính, để "Thank you." thật không bị chặn nhầm.
_DISTINCTIVE_LEN = 24


def is_phantom(text: str) -> bool:
    """Câu khớp một mẫu ma đã biết, và mẫu đó đủ đặc trưng hoặc chiếm phần lớn câu."""
    norm = normalize(text)
    if not norm:
        return False
    for phrase in PHANTOM_PHRASES:
        key = normalize(phrase)
        if not key or key not in norm:
            continue
        if len(key) >= _DISTINCTIVE_LEN or len(key) * 2 >= len(norm):
            return True
    return False


def is_degenerate(text: str, *, min_repeats: int = 3, min_coverage: float = 0.6) -> bool:
    """Bắt vòng lặp giải mã: một cụm 1–4 token lặp liên tiếp và chiếm gần hết câu."""
    tokens = _tokens(normalize(text))
    total = len(tokens)
    if total < min_repeats:
        return False
    for size in range(1, 5):
        if total < min_repeats * size:
            break
        for start in range(total - size + 1):
            gram = tokens[start : start + size]
            repeats, cursor = 1, start + size
            while cursor + size <= total and tokens[cursor : cursor + size] == gram:
                repeats += 1
                cursor += size
            if repeats >= min_repeats and repeats * size >= min_coverage * total:
                return True
    return False


def rejection_reason(
    text: str, confidence: float | None, *, min_confidence: float = 0.0
) -> str | None:
    """Lý do nên bỏ câu này, hoặc ``None`` nếu câu dùng được.

    Trả về chuỗi (không phải bool) để log/metric nói được vì sao — lúc bảo vệ cần giải
    thích đúng bản chất kỹ thuật chứ không phải "app tự lọc".
    """
    if not strip_non_speech(text):
        return "empty"
    if is_phantom(text):
        return "phantom_phrase"
    if is_degenerate(text):
        return "degenerate_repeat"
    if min_confidence > 0 and confidence is not None and confidence < min_confidence:
        return "low_confidence"
    return None
