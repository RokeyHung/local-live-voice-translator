"""Preset `custom` — người dùng tự chọn model cho từng khâu (SPEC 3.1).

Điểm dễ sai: preset `custom` KHÔNG phải một bộ model cố định, nó đọc lựa chọn đã lưu
mỗi lần dựng. Khâu nào chưa chọn thì lấy theo Balanced, để ô "Tự chọn" mở lần đầu ra
một cấu hình chạy được chứ không phải biểu mẫu trống.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.adapters.asr.faster_whisper import MODEL_MAP as FW_MODELS
from llvt_ai_service.adapters.asr.mlx_whisper import MODEL_MAP as MLX_MODELS
from llvt_ai_service.adapters.asr.whisper_cpp import MODEL_MAP as WHISPER_MODELS
from llvt_ai_service.application.model_manager import available_asr_adapters
from llvt_ai_service.config.presets import PRESETS, custom_config, get_preset_config
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Preset


@pytest.fixture
def client() -> TestClient:
    from llvt_ai_service.app import app

    with TestClient(app) as test_client:
        yield test_client


def _put(client: TestClient, **body: object) -> dict:
    response = client.put("/api/config", json={"preset": "balanced", **body})
    assert response.status_code == 200, response.text
    return response.json()


# --- dựng cấu hình --------------------------------------------------------


def test_empty_choices_fall_back_to_balanced():
    balanced = PRESETS[Preset.balanced]
    config = custom_config()
    assert config.asr_adapter == balanced.asr_adapter
    assert config.asr_model == balanced.asr_model
    assert config.mt_model == balanced.mt_model


def test_choosing_a_runtime_picks_that_runtime_s_equivalent_model():
    # Đổi mỗi adapter mà không chọn model: phải lấy model MLX tương đương của
    # Balanced, chứ không giữ tên GGML mà MLX không hiểu.
    config = custom_config(asr_adapter="mlx_whisper")
    assert config.asr_adapter == "mlx_whisper"
    assert config.asr_model in MLX_MODELS


def test_explicit_choices_win():
    config = custom_config(
        asr_adapter="whisper_cpp",
        asr_model="ggml-tiny-q5_1.bin",
        mt_model="facebook/nllb-200-1.3B",
    )
    assert config.asr_model == "ggml-tiny-q5_1.bin"
    assert config.mt_model == "facebook/nllb-200-1.3B"


def test_custom_has_no_alternatives_left_to_resolve():
    # Đã chỉ đích danh adapter + model thì không còn "mức tương đương" nào nữa.
    assert custom_config(asr_adapter="mlx_whisper").asr_alternatives == {}


def test_vad_thresholds_come_from_balanced():
    assert custom_config().vad == PRESETS[Preset.balanced].vad


# --- qua REST -------------------------------------------------------------


def test_custom_is_offered_as_a_preset(client: TestClient):
    body = client.get("/api/config").json()
    assert "custom" in body["availablePresets"]


def test_config_exposes_the_real_choices_not_a_hand_written_list(client: TestClient):
    custom = client.get("/api/config").json()["custom"]
    # So với `available_asr_adapters()` chứ không phải ba tên viết cứng: MLX và
    # faster-whisper là extra tuỳ chọn, nên tập này đổi theo môi trường đang chạy
    # test. Viết cứng thì bài test thành sai ở đúng chỗ nó cần đúng nhất — môi
    # trường chỉ có phụ thuộc lõi, tức bản đóng gói mặc định.
    assert set(custom["asrAdapterChoices"]) == set(available_asr_adapters())
    # Model liệt kê theo TỪNG runtime, không gộp: ba runtime dùng ba định dạng khác
    # nhau nên không có model nào dùng chung được.
    per_runtime = {
        "whisper_cpp": WHISPER_MODELS,
        "mlx_whisper": MLX_MODELS,
        "faster_whisper": FW_MODELS,
    }
    for adapter in custom["asrAdapterChoices"]:
        assert set(custom["asrModelChoices"][adapter]) == set(per_runtime[adapter])
    # Runtime không cài được thì không có mặt trong bảng model — nếu còn, giao diện
    # vẫn vẽ ra một danh sách model bấm vào là lỗi.
    assert set(custom["asrModelChoices"]) == set(custom["asrAdapterChoices"])


# --- runtime tuỳ chọn không có trong môi trường ----------------------------
#
# Bản đóng gói có thể được dựng không kèm MLX/faster-whisper (tools/bundle_service.sh
# mặc định chỉ lấy phụ thuộc lõi). Ba bài dưới đây giả lập đúng môi trường đó bằng
# cách nói rằng không import được gói nào cả.


@pytest.fixture
def core_only(monkeypatch: pytest.MonkeyPatch):
    """Môi trường chỉ có phụ thuộc lõi: whisper.cpp có, hai runtime kia không."""
    import llvt_ai_service.api.config as config_api
    import llvt_ai_service.application.model_manager as mm

    monkeypatch.setattr(mm, "available_asr_adapters", lambda: ["whisper_cpp"])
    monkeypatch.setattr(config_api, "available_asr_adapters", lambda: ["whisper_cpp"])


def test_only_installed_runtimes_are_offered(client: TestClient, core_only):
    custom = client.get("/api/config").json()["custom"]
    assert custom["asrAdapterChoices"] == ["whisper_cpp"]
    assert set(custom["asrModelChoices"]) == {"whisper_cpp"}


def test_a_saved_runtime_that_is_not_installed_falls_back(client: TestClient, core_only):
    """settings.json mang từ máy phát triển sang bản đóng gói không được làm hỏng app.

    Đây là lỗi đã gặp thật: máy phát triển lưu `custom_asr_adapter=mlx_whisper`, bản
    cài macOS gói không kèm MLX, và chọn preset Custom là "Nạp model thất bại".
    """
    from llvt_ai_service.config import runtime_config
    from llvt_ai_service.config.settings import reload_settings

    runtime_config.save(custom_asr_adapter="mlx_whisper")
    reload_settings()

    custom = client.get("/api/config").json()["custom"]
    assert custom["asrAdapter"] == "whisper_cpp"
    assert custom["asrModel"] in set(WHISPER_MODELS)


def test_choosing_a_runtime_that_is_not_installed_is_rejected(client: TestClient, core_only):
    response = client.put(
        "/api/config", json={"preset": "balanced", "customAsrAdapter": "mlx_whisper"}
    )
    assert response.status_code == 400
    # Thông báo phải nói tên gói còn thiếu, không chỉ "thất bại".
    assert "mlx_audio" in response.json()["detail"]


def test_saving_choices_survives_and_shows_up_in_config(client: TestClient):
    body = _put(
        client, customAsrAdapter="mlx_whisper", customAsrModel="mlx-community/whisper-tiny-asr-8bit"
    )

    assert body["custom"]["asrAdapter"] == "mlx_whisper"
    assert body["custom"]["asrModel"] == "mlx-community/whisper-tiny-asr-8bit"
    assert get_settings().custom_asr_model == "mlx-community/whisper-tiny-asr-8bit"
    assert get_preset_config(Preset.custom).asr_model == "mlx-community/whisper-tiny-asr-8bit"


def test_a_model_from_the_wrong_runtime_is_refused(client: TestClient):
    """Chọn mlx_whisper + một file GGML từng lưu được rồi ném 500 lúc nạp.

    MLX đi hỏi HuggingFace một repo tên `ggml-....bin` → 404. Người dùng chỉ thấy
    "chọn model không ăn thua" mà không biết vì sao, nên phải chặn ngay lúc lưu.
    """
    _put(client, customAsrAdapter="mlx_whisper")
    response = client.put(
        "/api/config", json={"preset": "balanced", "customAsrModel": "ggml-tiny-q5_1.bin"}
    )

    assert response.status_code == 400
    assert "không chạy được trên runtime" in response.json()["detail"]


def test_switching_runtime_resets_a_model_that_no_longer_fits(client: TestClient):
    """Đổi mỗi runtime mà giữ model cũ cũng ra tổ hợp hỏng — trả về mặc định."""
    _put(client, customAsrAdapter="whisper_cpp", customAsrModel="ggml-tiny-q5_1.bin")
    body = _put(client, customAsrAdapter="mlx_whisper")

    assert body["custom"]["asrAdapter"] == "mlx_whisper"
    assert body["custom"]["asrModel"] in MLX_MODELS


def test_choices_are_validated_against_the_registry(client: TestClient):
    bad_adapter = client.put(
        "/api/config", json={"preset": "balanced", "customAsrAdapter": "khong-co-that"}
    )
    assert bad_adapter.status_code == 400

    bad_model = client.put(
        "/api/config", json={"preset": "balanced", "customAsrModel": "khong-co-that"}
    )
    assert bad_model.status_code == 400

    bad_mt = client.put("/api/config", json={"preset": "balanced", "customMtModel": "gpt-4"})
    assert bad_mt.status_code == 400


def test_an_empty_string_resets_one_stage_to_the_default(client: TestClient):
    _put(client, customAsrModel="ggml-tiny-q5_1.bin")
    body = _put(client, customAsrModel="")
    assert body["custom"]["asrModel"] == PRESETS[Preset.balanced].asr_model


def test_omitting_the_fields_leaves_the_choices_alone(client: TestClient):
    _put(client, customAsrModel="ggml-tiny-q5_1.bin")
    body = _put(client, historyEnabled=False)
    assert body["custom"]["asrModel"] == "ggml-tiny-q5_1.bin"
