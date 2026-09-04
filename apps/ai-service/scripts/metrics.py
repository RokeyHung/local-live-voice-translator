"""Các độ đo dùng cho phần đánh giá GVHD giao 19/08: WER/CER, BLEU, chrF++, COMET.

Ba quyết định về phương pháp, ghi lại ở đây để lúc bảo vệ giải thích được:

**WER hay CER.** WER đếm lỗi trên chuỗi *từ*, mà tiếng Trung và tiếng Nhật không tách
từ bằng khoảng trắng — chấm WER cho hai thứ tiếng đó là chấm theo cách Whisper tình cờ
chèn dấu cách, không phải theo lỗi thật. Cách làm chuẩn trong ngành (và trong chính bài
báo FLEURS) là dùng **CER** cho zh/ja và **WER** cho vi/en. Bảng kết quả ghi rõ mỗi
dòng đang là chỉ số nào chứ không gộp chung một cột "WER".

**BLEU nào.** BLEU phụ thuộc bộ tách từ, nên hai bài báo cùng nói "BLEU" có thể không so
được với nhau. Ở đây dùng ``sacrebleu`` với tokenizer ``flores200`` — tức **spBLEU**,
đúng độ đo mà bài báo NLLB-200 dùng, nên số của đề tài đặt cạnh số công bố của NLLB là
so sánh được. Một tokenizer duy nhất cho cả 6 chiều cũng khiến 6 con số so được với
nhau. chrF++ đi kèm làm chỉ số phụ vì nó ổn định hơn BLEU trên tập vài trăm câu.

**COMET không nằm trong module này.** ``unbabel-comet`` ghim ``numpy<2`` và
``transformers<5``, xung đột trực tiếp với runtime của dự án (numpy>=2.4, transformers>=5)
nên KHÔNG cài chung venv được. Nó chạy ở môi trường riêng qua ``scripts/eval_comet.py``,
đọc file JSON mà ``eval_mt.py`` xuất ra.

Hạn chế đã biết: chưa chuẩn hoá số và chữ viết tắt (Whisper trả "2019" trong khi câu
tham chiếu có thể ghi "hai nghìn không trăm mười chín"). Việc này làm WER cao hơn thực
tế một chút, và cao đều ở mọi cấu hình nên không ảnh hưởng phần so sánh.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Sequence

from llvt_ai_service.domain.enums import Language

# Ngôn ngữ không tách từ bằng khoảng trắng → chấm theo ký tự.
CHARACTER_LANGUAGES = frozenset({Language.zh, Language.ja})

_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_SPACES = re.compile(r"\s+")


def metric_name(language: Language) -> str:
    return "CER" if language in CHARACTER_LANGUAGES else "WER"


def normalize(text: str, language: Language) -> str:
    """Đưa câu về dạng so sánh được với ``transcription`` của FLEURS.

    FLEURS đã chuẩn hoá sẵn phần tham chiếu (chữ thường, không dấu câu), nên phần việc
    ở đây là đưa đầu ra của Whisper về cùng dạng. Dấu tiếng Việt được GIỮ vì nó mang
    nghĩa; với zh/ja thì bỏ hẳn khoảng trắng vì chỗ Whisper chèn dấu cách là tuỳ hứng.
    """
    text = unicodedata.normalize("NFC", text.strip().casefold())
    text = _SPACES.sub(" ", _PUNCT.sub(" ", text)).strip()
    if language in CHARACTER_LANGUAGES:
        text = text.replace(" ", "")
    return text


def error_rate(references: Sequence[str], hypotheses: Sequence[str], language: Language) -> float:
    """WER (vi/en) hoặc CER (zh/ja) trên toàn bộ tập, tính gộp chứ không lấy trung bình.

    Gộp = tổng số lỗi chia tổng độ dài tham chiếu. Lấy trung bình từng câu sẽ để một câu
    ngắn bị sai nặng kéo lệch cả bảng.
    """
    import jiwer

    refs = [normalize(r, language) for r in references]
    hyps = [normalize(h, language) for h in hypotheses]
    # jiwer bỏ qua cặp có tham chiếu rỗng; lọc trước để hai danh sách luôn khớp nhau.
    pairs = [(r, h) for r, h in zip(refs, hyps) if r]
    if not pairs:
        return 0.0
    refs, hyps = [p[0] for p in pairs], [p[1] for p in pairs]
    if language in CHARACTER_LANGUAGES:
        return float(jiwer.cer(refs, hyps))
    return float(jiwer.wer(refs, hyps))


def bleu(references: Sequence[str], hypotheses: Sequence[str]) -> float:
    """spBLEU — BLEU với tokenizer ``flores200``, giống cách NLLB-200 tự đánh giá."""
    from sacrebleu.metrics import BLEU

    scorer = BLEU(tokenize="flores200")
    return float(scorer.corpus_score(list(hypotheses), [list(references)]).score)


def chrf(references: Sequence[str], hypotheses: Sequence[str]) -> float:
    """chrF++ (n-gram ký tự + 2-gram từ) — ổn định hơn BLEU trên tập nhỏ."""
    from sacrebleu.metrics import CHRF

    scorer = CHRF(word_order=2)
    return float(scorer.corpus_score(list(hypotheses), [list(references)]).score)
