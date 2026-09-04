"""Truy cập bộ dữ liệu FLEURS (google/fleurs) cho phần đánh giá — GVHD giao 19/08.

FLEURS là bản *tiếng nói* của benchmark dịch máy FLoRes: 2009 câu **song song n chiều**
được thu âm ở 102 ngôn ngữ. Hai tính chất đó quyết định cách dùng ở đây:

* Mỗi câu có một ``id`` **dùng chung giữa các ngôn ngữ** (chính là id câu của FLoRes).
  Ghép ``id`` giữa hai ngôn ngữ là ra ngay một cặp câu song ngữ → đánh giá MT không cần
  phụ thuộc đầu ra của ASR, đúng như thầy yêu cầu (tách bạch lỗi của từng khối).
* Một ``id`` có NHIỀU bản thu (nhiều người đọc cùng một câu). Với ASR đó là các mẫu
  khác nhau; với MT thì phải khử trùng lặp theo ``id``.

Hai đường lấy dữ liệu, cố ý tách rời vì chênh nhau ba bậc độ lớn:

* :func:`load_text` đọc file ``data/<config>/<split>.tsv`` — vài trăm KB mỗi ngôn ngữ.
  Đủ cho toàn bộ phần đánh giá MT.
* :func:`load_audio` đi qua thư viện ``datasets`` và phải tải parquet có audio —
  khoảng 380–660 MB cho MỘT ngôn ngữ ở split ``test``. Chỉ phần đánh giá ASR và độ trễ
  mới cần tới.

Cột của TSV (định dạng gốc của FLEURS, không có dòng tiêu đề):
``id, file_name, raw_transcription, transcription, char_transcription, num_samples, gender``
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Iterator

from llvt_ai_service.domain.enums import Language

REPO = "google/fleurs"
SAMPLE_RATE = 16000

# Bốn ngôn ngữ của đề tài → tên config trong FLEURS. Tiếng Trung dùng bản phổ thông
# giản thể (cmn_hans_cn) cho khớp với ngôn ngữ đích zho_Hans của NLLB.
LANG_CONFIG: dict[Language, str] = {
    Language.vi: "vi_vn",
    Language.en: "en_us",
    Language.zh: "cmn_hans_cn",
    Language.ja: "ja_jp",
}


@dataclass(frozen=True)
class TextItem:
    """Một câu, không kèm audio."""

    id: int
    # ``transcription``: đã chuẩn hoá (thường, bỏ dấu câu) — đây là đích của ASR.
    normalized: str
    # ``raw_transcription``: văn bản tự nhiên còn dấu câu — đây mới là thứ dùng cho MT.
    raw: str


@dataclass(frozen=True)
class AudioItem:
    """Một bản thu kèm câu chữ đúng."""

    id: int
    file_name: str
    normalized: str
    raw: str
    pcm: bytes  # PCM signed 16-bit mono 16 kHz, đúng định dạng nội bộ của dự án
    duration_s: float


def _tsv_path(language: Language, split: str) -> str:
    return f"data/{LANG_CONFIG[language]}/{split}.tsv"


def load_text(language: Language, split: str = "test") -> dict[int, TextItem]:
    """Toàn bộ câu của một ngôn ngữ, khử trùng lặp theo ``id``.

    Nhiều người đọc cùng một câu → giữ bản thu đầu tiên là đủ, vì phần văn bản của
    chúng giống hệt nhau.
    """
    from huggingface_hub import hf_hub_download

    path = hf_hub_download(REPO, _tsv_path(language, split), repo_type="dataset")
    items: dict[int, TextItem] = {}
    with open(path, encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle, delimiter="\t", quoting=csv.QUOTE_NONE):
            if len(row) < 4:
                continue
            key = int(row[0])
            if key not in items:
                items[key] = TextItem(id=key, normalized=row[3].strip(), raw=row[2].strip())
    return items


def parallel(source: Language, target: Language, split: str = "test") -> list[tuple[str, str]]:
    """Các cặp câu (nguồn, đích) khớp ``id`` — dữ liệu vào cho phần đánh giá MT.

    Trả về văn bản ``raw`` (còn dấu câu, còn hoa thường): NLLB được huấn luyện trên
    văn bản tự nhiên, đưa bản đã chuẩn hoá vào sẽ đo thấp hơn thực tế.
    """
    src = load_text(source, split)
    tgt = load_text(target, split)
    return [(src[key].raw, tgt[key].raw) for key in sorted(src.keys() & tgt.keys())]


def load_audio(
    language: Language, split: str = "test", limit: int | None = None
) -> Iterator[AudioItem]:
    """Bản thu của một ngôn ngữ, đã chuyển sang PCM16 mono 16 kHz.

    Có ``limit`` thì dùng chế độ streaming để chạy thử không phải tải hết vài trăm MB;
    không có ``limit`` thì tải hẳn về cache của ``datasets`` (chạy lại sẽ nhanh).
    """
    import soundfile as sf
    from datasets import Audio, load_dataset

    config = LANG_CONFIG[language]
    streaming = limit is not None
    dataset = load_dataset(REPO, config, split=split, streaming=streaming)
    # decode=False: tự giải mã bằng soundfile để chủ động định dạng và không phụ thuộc
    # backend audio mà `datasets` chọn (đã đổi vài lần giữa các phiên bản).
    dataset = dataset.cast_column("audio", Audio(decode=False))
    if limit is not None:
        dataset = dataset.take(limit)

    for row in dataset:
        blob = row["audio"]["bytes"]
        if blob is None:  # bản tải hẳn về đĩa chỉ đưa đường dẫn
            with open(row["audio"]["path"], "rb") as handle:
                blob = handle.read()
        samples, rate = sf.read(io.BytesIO(blob), dtype="int16", always_2d=False)
        if rate != SAMPLE_RATE:
            raise SystemExit(f"FLEURS {config} có sample rate {rate}, chờ đợi {SAMPLE_RATE}")
        if samples.ndim > 1:
            samples = samples[:, 0]
        yield AudioItem(
            id=int(row["id"]),
            file_name=str(row["path"]),
            normalized=str(row["transcription"]).strip(),
            raw=str(row["raw_transcription"]).strip(),
            pcm=samples.tobytes(),
            duration_s=len(samples) / SAMPLE_RATE,
        )
