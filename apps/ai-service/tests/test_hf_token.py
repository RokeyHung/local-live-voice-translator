"""Access token HuggingFace: lưu, gỡ, che khi trả ra, và đưa vào biến `HF_TOKEN`.

Token là **bí mật duy nhất** trong toàn bộ ứng dụng, nên phần lớn test ở đây kiểm
đúng một điều: nó không rò ra ngoài. REST chỉ được trả cờ + đoạn che, file trên đĩa
phải ở quyền 0600, và log không được chứa giá trị.
"""

from __future__ import annotations

import json
import os
import stat
import sys

import pytest
from fastapi.testclient import TestClient

from llvt_ai_service.app import app
from llvt_ai_service.config import runtime_config
from llvt_ai_service.config import settings as settings_module
from llvt_ai_service.config.settings import (
    get_settings,
    hf_token_source,
    mask_token,
    publish_hf_token,
)

TOKEN = "hf_AbCdEfGhIjKlMnOpQrStUvWxYz012345"


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def _put(client: TestClient, **body: object) -> dict:
    response = client.put("/api/config", json={"preset": "balanced", **body})
    assert response.status_code == 200, response.text
    return response.json()


# --- che giá trị ----------------------------------------------------------


def test_mask_keeps_enough_to_recognise_but_not_to_reuse():
    masked = mask_token(TOKEN)
    assert masked == "hf_AbC…2345"
    assert TOKEN not in masked


def test_short_strings_are_masked_entirely():
    # Chuỗi ngắn mà cắt đầu-cuối thì lộ gần hết; che sạch.
    assert mask_token("hf_short") == "•" * len("hf_short")
    assert mask_token("") == ""


# --- lưu / gỡ -------------------------------------------------------------


def test_config_reports_no_token_before_anything_is_saved(client: TestClient):
    body = client.get("/api/config").json()
    assert body["hfTokenSet"] is False
    assert body["hfTokenSource"] == "none"
    assert body["hfTokenHint"] == ""
    assert body["hfTokenEditable"] is True


def test_saving_a_token_never_returns_it_verbatim(client: TestClient):
    body = _put(client, hfToken=TOKEN)

    assert body["hfTokenSet"] is True
    assert body["hfTokenSource"] == "saved"
    assert body["hfTokenHint"] == "hf_AbC…2345"
    # Điều quan trọng nhất của cả file test này.
    assert TOKEN not in json.dumps(body)


def test_saved_token_survives_a_new_request(client: TestClient):
    _put(client, hfToken=TOKEN)
    assert client.get("/api/config").json()["hfTokenSet"] is True


def test_empty_string_removes_the_token(client: TestClient):
    _put(client, hfToken=TOKEN)
    body = _put(client, hfToken="")

    assert body["hfTokenSet"] is False
    assert body["hfTokenSource"] == "none"
    # Gỡ nghĩa là xoá hẳn khỏi file, không phải lưu một chuỗi rỗng.
    assert "hf_token" not in json.loads(runtime_config.CONFIG_PATH.read_text(encoding="utf-8"))


def test_omitting_the_field_leaves_the_token_alone(client: TestClient):
    _put(client, hfToken=TOKEN)
    # Đổi mỗi `historyEnabled` không được vô tình gỡ token.
    body = _put(client, historyEnabled=False)
    assert body["hfTokenSet"] is True


def test_whitespace_around_a_pasted_token_is_trimmed(client: TestClient):
    _put(client, hfToken=f"  {TOKEN}\n")
    assert get_settings().hf_token == TOKEN


# --- quyền file -----------------------------------------------------------


@pytest.mark.skipif(sys.platform == "win32", reason="Windows không có quyền POSIX")
def test_the_settings_file_is_owner_only(client: TestClient):
    _put(client, hfToken=TOKEN)
    mode = stat.S_IMODE(runtime_config.CONFIG_PATH.stat().st_mode)
    assert mode == 0o600, f"file chứa token phải là 0600, đang là {mode:o}"


# --- biến môi trường ------------------------------------------------------


def test_saved_token_is_published_so_every_hf_library_sees_it(client: TestClient):
    _put(client, hfToken=TOKEN)
    # transformers (NLLB), snapshot_download (MLX) và pyannote đều đọc biến này.
    assert os.environ.get("HF_TOKEN") == TOKEN


def test_removing_the_token_clears_the_environment_variable(client: TestClient):
    _put(client, hfToken=TOKEN)
    _put(client, hfToken="")
    assert "HF_TOKEN" not in os.environ


def test_env_token_wins_and_locks_the_field(monkeypatch: pytest.MonkeyPatch):
    """`LLVT_HF_TOKEN` là chủ ý của người chạy service — app không được ghi đè."""
    monkeypatch.setenv("LLVT_HF_TOKEN", TOKEN)
    get_settings.cache_clear()

    with TestClient(app) as client:
        body = client.get("/api/config").json()
        assert body["hfTokenSource"] == "env"
        assert body["hfTokenEditable"] is False

        rejected = client.put("/api/config", json={"preset": "balanced", "hfToken": "hf_other"})
        assert rejected.status_code == 409
        assert "LLVT_HF_TOKEN" in rejected.json()["detail"]


def test_an_already_exported_hf_token_is_recognised(monkeypatch: pytest.MonkeyPatch):
    """Người dùng đã `export HF_TOKEN=` từ trước thì app phải thấy, không bắt nhập lại."""
    monkeypatch.setattr(settings_module, "_INHERITED_HF_TOKEN", TOKEN)
    get_settings.cache_clear()

    with TestClient(app) as client:
        body = client.get("/api/config").json()

    assert body["hfTokenSet"] is True
    assert body["hfTokenSource"] == "inherited"
    assert hf_token_source() == "inherited"


def test_publishing_restores_the_inherited_value_instead_of_wiping_it(
    monkeypatch: pytest.MonkeyPatch,
):
    """Xoá token trong app không được xoá nhầm biến người dùng tự export."""
    monkeypatch.setattr(settings_module, "_INHERITED_HF_TOKEN", "hf_theirs")
    monkeypatch.setenv("HF_TOKEN", TOKEN)
    get_settings.cache_clear()

    publish_hf_token()

    assert os.environ["HF_TOKEN"] == "hf_theirs"


# --- kiểm tra token -------------------------------------------------------


def test_verify_reports_the_account_name(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "whoami", lambda token: {"name": "rokey"})
    response = client.post("/api/hf/verify", json={"token": TOKEN})

    assert response.status_code == 200
    assert response.json() == {"ok": True, "user": "rokey", "error": ""}


def test_a_bad_token_is_a_200_with_a_reason_not_an_http_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    # Token sai là kết quả bình thường của việc kiểm tra, không phải request hỏng —
    # giao diện hiện được lý do mà không phải bắt mã lỗi HTTP.
    import huggingface_hub

    def boom(token: str) -> dict:
        raise RuntimeError("401 Client Error: Invalid credentials")

    monkeypatch.setattr(huggingface_hub, "whoami", boom)
    response = client.post("/api/hf/verify", json={"token": "hf_wrong"})

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "401" in body["error"]


def test_verify_without_any_token_says_so(client: TestClient):
    response = client.post("/api/hf/verify", json={})
    assert response.json() == {"ok": False, "user": "", "error": "Chưa có token nào để kiểm tra."}


def test_verify_falls_back_to_the_saved_token(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    import huggingface_hub

    seen: list[str] = []

    def spy(token: str) -> dict:
        seen.append(token)
        return {"name": "rokey"}

    monkeypatch.setattr(huggingface_hub, "whoami", spy)
    _put(client, hfToken=TOKEN)
    client.post("/api/hf/verify", json={})

    assert seen == [TOKEN]
