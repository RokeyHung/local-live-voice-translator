"""Test NllbTranslator adapter (Tuần 4).

- Logic adapter (mapping model/mã NLLB, normalization, guard, cùng ngôn ngữ, rỗng)
  test bằng backend giả để xác định, không tải model thật.
- Một test tích hợp opt-in chạy NLLB-200 thật; chỉ chạy khi đặt
  ``LLVT_RUN_MT_INTEGRATION=1`` để không tải ~2.4GB model trong CI.
"""

from __future__ import annotations

import asyncio
import os

import pytest

from llvt_ai_service.adapters.mt.nllb import MODEL_MAP, NLLB_CODE, NllbTranslator
from llvt_ai_service.domain.enums import Language


class RecordingBackend:
    """Backend giả ghi lại lời gọi translate và trả text cấu hình sẵn."""

    def __init__(self, out: str = "translated") -> None:
        self._out = out
        self.calls: list[dict[str, str]] = []

    def translate(self, text: str, src_code: str, tgt_code: str) -> str:
        self.calls.append({"text": text, "src": src_code, "tgt": tgt_code})
        return self._out


def _make_mt(out: str = "translated", model: str = "nllb-200-distilled-600M"):
    backend = RecordingBackend(out)
    mt = NllbTranslator(model, models_dir="/tmp/x", loader=lambda _r, _d, _dev: backend)
    return mt, backend


def test_model_name_maps_to_repo_id():
    # Khoá là ĐƯỜNG DẪN THẬT, nên bảng này là danh sách repo app biết chứ không phải
    # một lớp đổi tên: khoá bằng giá trị.
    assert MODEL_MAP["facebook/nllb-200-distilled-600M"] == "facebook/nllb-200-distilled-600M"
    assert MODEL_MAP["facebook/nllb-200-1.3B"] == "facebook/nllb-200-1.3B"
    # Tên lạ giữ nguyên (cho phép truyền thẳng repo/đường dẫn).
    mt = NllbTranslator("some/other-repo", loader=lambda _r, _d, _dev: RecordingBackend())
    assert mt._repo_id == "some/other-repo"


def test_loader_receives_repo_dir_device():
    captured: dict[str, object] = {}

    def loader(repo_id: str, models_dir: str | None, device: str | None):
        captured.update(repo=repo_id, dir=models_dir, device=device)
        return RecordingBackend()

    mt = NllbTranslator(
        "facebook/nllb-200-distilled-600M", models_dir="/models/n", device="cpu", loader=loader
    )
    asyncio.run(mt.load())
    assert captured == {
        "repo": "facebook/nllb-200-distilled-600M",
        "dir": "/models/n",
        "device": "cpu",
    }


def test_translate_passes_correct_nllb_codes():
    mt, backend = _make_mt("xin chào")
    asyncio.run(mt.load())
    out = asyncio.run(mt.translate("hello", Language.en, Language.vi))
    assert backend.calls[0]["src"] == NLLB_CODE[Language.en] == "eng_Latn"
    assert backend.calls[0]["tgt"] == NLLB_CODE[Language.vi] == "vie_Latn"
    assert out.translated_text == "xin chào"
    assert out.source_text == "hello"
    assert out.source_language is Language.en and out.target_language is Language.vi
    assert out.processing_ms is not None and out.processing_ms >= 0


def test_all_six_mvp_directions_use_valid_codes():
    others = [Language.en, Language.ja, Language.zh]
    directions = [(Language.vi, o) for o in others] + [(o, Language.vi) for o in others]
    for src, tgt in directions:
        mt, backend = _make_mt("x")
        asyncio.run(mt.load())
        asyncio.run(mt.translate("một câu", src, tgt))
        assert backend.calls[0]["src"] == NLLB_CODE[src]
        assert backend.calls[0]["tgt"] == NLLB_CODE[tgt]


def test_normalizes_whitespace_before_translate():
    mt, backend = _make_mt("ok")
    asyncio.run(mt.load())
    out = asyncio.run(mt.translate("  hello   world \n", Language.en, Language.vi))
    assert backend.calls[0]["text"] == "hello world"
    assert out.source_text == "hello world"


def test_empty_text_skips_model():
    mt, backend = _make_mt("should-not-be-used")
    asyncio.run(mt.load())
    out = asyncio.run(mt.translate("   \n  ", Language.en, Language.vi))
    assert backend.calls == []  # không gọi model
    assert out.translated_text == ""


def test_same_language_skips_model():
    mt, backend = _make_mt("should-not-be-used")
    asyncio.run(mt.load())
    out = asyncio.run(mt.translate("giữ nguyên", Language.vi, Language.vi))
    assert backend.calls == []
    assert out.translated_text == "giữ nguyên"


def test_translate_before_load_raises_runtime_error():
    mt, _ = _make_mt()
    with pytest.raises(RuntimeError):
        asyncio.run(mt.translate("hello", Language.en, Language.vi))


@pytest.mark.skipif(
    os.environ.get("LLVT_RUN_MT_INTEGRATION") != "1",
    reason="Đặt LLVT_RUN_MT_INTEGRATION=1 để tải + chạy NLLB-200 thật",
)
def test_real_nllb_translates_six_directions():
    """Tích hợp thật: nạp NLLB-200 và dịch sáu chiều MVP; in kết quả để kiểm tra tay."""
    from llvt_ai_service.adapters.mt.nllb import _TransformersNllb

    def real_loader(repo_id: str, models_dir: str | None, device: str | None):
        return _TransformersNllb(repo_id, models_dir, device)

    mt = NllbTranslator("nllb-200-distilled-600M", models_dir="/tmp/llvt-mt-it", loader=real_loader)
    asyncio.run(mt.load())
    samples = {
        (Language.vi, Language.en): "Xin chào, hôm nay bạn khỏe không?",
        (Language.en, Language.vi): "Please confirm this issue.",
        (Language.vi, Language.ja): "Cuộc họp bắt đầu lúc chín giờ sáng.",
        (Language.vi, Language.zh): "Tôi cần một tách cà phê.",
    }
    for (src, tgt), text in samples.items():
        out = asyncio.run(mt.translate(text, src, tgt))
        print(
            f"[{src.value}->{tgt.value}] {text!r} => {out.translated_text!r} ({out.processing_ms}ms)"
        )
        assert isinstance(out.translated_text, str) and out.translated_text
