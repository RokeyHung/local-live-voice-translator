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
        asr_model="whisper-tiny-q5",
        mt_model="nllb-200-distilled-600M-int8",
    )
    assert config.asr_model == "whisper-tiny-q5"
    assert config.mt_model == "nllb-200-distilled-600M-int8"


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
    # Cả ba backend ASR đều chọn được — không backend nào còn là stub.
    assert set(custom["asrAdapterChoices"]) == {"whisper_cpp", "mlx_whisper", "faster_whisper"}
    assert set(custom["asrModelChoices"]) == {*WHISPER_MODELS, *MLX_MODELS, *FW_MODELS}


def test_saving_choices_survives_and_shows_up_in_config(client: TestClient):
    body = _put(client, customAsrAdapter="mlx_whisper", customAsrModel="mlx-whisper-tiny-q8")

    assert body["custom"]["asrAdapter"] == "mlx_whisper"
    assert body["custom"]["asrModel"] == "mlx-whisper-tiny-q8"
    assert get_settings().custom_asr_model == "mlx-whisper-tiny-q8"
    assert get_preset_config(Preset.custom).asr_model == "mlx-whisper-tiny-q8"


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
    _put(client, customAsrModel="whisper-tiny-q5")
    body = _put(client, customAsrModel="")
    assert body["custom"]["asrModel"] == PRESETS[Preset.balanced].asr_model


def test_omitting_the_fields_leaves_the_choices_alone(client: TestClient):
    _put(client, customAsrModel="whisper-tiny-q5")
    body = _put(client, historyEnabled=False)
    assert body["custom"]["asrModel"] == "whisper-tiny-q5"
