"""Đường đọc audio FLEURS — chỗ đã làm hỏng cả bảng đánh giá ASR mà không ném lỗi.

Audio FLEURS là WAV **float 32-bit**. Đọc nó bằng `soundfile.read(dtype="int16")`
trông rất hợp lý, nhưng libsndfile khi đọc file float thành số nguyên thì mặc định
KHÔNG nhân thang: mọi mẫu trong [-1, 1] bị cắt thẳng xuống 0. Whisper được cho nghe
im lặng, trả chuỗi rỗng, và bảng WER in ra đúng 100% cho cả bốn ngôn ngữ — trông y
như một kết quả thật.

Test này không chạm mạng: nó dựng đúng định dạng file mà FLEURS dùng.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import fleurs  # noqa: E402


def test_float_samples_scale_to_the_full_int16_range():
    tin_hieu = np.array([-1.0, -0.5, 0.0, 0.5, 1.0], dtype=np.float32)

    pcm = fleurs.to_pcm16(tin_hieu)

    assert pcm.dtype == np.int16
    assert pcm.tolist() == [-32767, -16384, 0, 16384, 32767]


def test_quiet_speech_does_not_collapse_to_silence():
    """Đây chính là ca hỏng thật: mẫu nhỏ nhưng KHÔNG phải im lặng."""
    tin_hieu = np.full(1000, 0.02, dtype=np.float32)

    pcm = fleurs.to_pcm16(tin_hieu)

    assert pcm.any(), "tín hiệu nhỏ bị làm thành im lặng — đúng lỗi đã xảy ra"
    assert int(np.abs(pcm).max()) == 655


def test_values_beyond_the_range_are_clipped_not_wrapped():
    """Tràn số trong int16 sẽ đổi DẤU — nghe ra tiếng rè chứ không phải to hơn."""
    tin_hieu = np.array([1.5, -1.5], dtype=np.float32)

    pcm = fleurs.to_pcm16(tin_hieu)

    assert pcm.tolist() == [32767, -32768]


def test_a_float_wav_read_as_int16_would_have_been_all_zeros():
    """Khoá lại chính hành vi của thư viện đã gây ra lỗi.

    Nếu một bản libsndfile sau này đổi mặc định thì test này hỏng — và đó là tin tốt:
    nó nhắc xem lại chỗ chuyển đổi thay vì để nó âm thầm đúng vì lý do khác.
    """
    soundfile = pytest.importorskip("soundfile")
    tin_hieu = np.sin(np.linspace(0, 20, 1600)).astype(np.float32) * 0.5
    buf = io.BytesIO()
    soundfile.write(buf, tin_hieu, 16000, format="WAV", subtype="FLOAT")

    buf.seek(0)
    doc_int16, _ = soundfile.read(buf, dtype="int16", always_2d=False)
    buf.seek(0)
    doc_float, _ = soundfile.read(buf, dtype="float32", always_2d=False)

    assert not doc_int16.any(), "đọc thẳng int16 phải ra toàn số 0 — lý do phải tự nhân thang"
    assert fleurs.to_pcm16(doc_float).any()
