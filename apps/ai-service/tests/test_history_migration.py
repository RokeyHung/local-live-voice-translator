"""Nâng cấp schema của file lịch sử đã có sẵn (adapters/persistence/sqlite.py).

Đây là dữ liệu THẬT của người dùng — biên bản họp không được mất chỉ vì app lên
phiên bản. ``create_all`` bỏ qua bảng đã tồn tại nên nó không bơm được cột mới; test
này dựng đúng file schema v1 rồi mở bằng repository hiện tại.
"""

from __future__ import annotations

import asyncio
import sqlite3
from pathlib import Path

from llvt_ai_service.adapters.persistence.sqlite import SCHEMA_VERSION, SqliteSessionRepository
from llvt_ai_service.domain.enums import AudioSource, Language, UtteranceStatus
from llvt_ai_service.domain.models import Session, Utterance

# Schema v1 — bản trước khi có diarization, chép nguyên trạng (KHÔNG có cột `speaker`).
V1_SCHEMA = """
CREATE TABLE sessions (
    id VARCHAR NOT NULL PRIMARY KEY,
    title VARCHAR NOT NULL,
    mode VARCHAR,
    preset VARCHAR,
    started_at_ms INTEGER NOT NULL,
    ended_at_ms INTEGER
);
CREATE TABLE utterances (
    id VARCHAR NOT NULL PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    source VARCHAR NOT NULL,
    source_language VARCHAR NOT NULL,
    target_language VARCHAR NOT NULL,
    source_text TEXT,
    translated_text TEXT,
    asr_ms INTEGER,
    mt_ms INTEGER,
    tts_ms INTEGER,
    status VARCHAR NOT NULL,
    error VARCHAR,
    started_at_ms INTEGER NOT NULL,
    ended_at_ms INTEGER
);
INSERT INTO sessions VALUES ('s1', 'Họp cũ', 'two_way', 'balanced', 1000, 2000);
INSERT INTO utterances VALUES (
    'u1', 's1', 'microphone', 'vi', 'en', 'xin chào', 'hello',
    10, 20, 30, 'success', NULL, 1100, 1200
);
"""


def _make_v1_db(path: Path) -> None:
    with sqlite3.connect(path) as conn:
        conn.executescript(V1_SCHEMA)


def test_opening_an_old_database_adds_the_column_and_keeps_the_rows(tmp_path: Path):
    db = tmp_path / "history.db"
    _make_v1_db(db)

    repo = SqliteSessionRepository(db)
    try:
        rows = asyncio.run(repo.get_utterances("s1"))
    finally:
        repo.dispose()

    assert [row.source_text for row in rows] == ["xin chào"]
    # Câu cũ không có nhãn người nói, và đó là câu trả lời đúng — không phải lỗi.
    assert rows[0].speaker is None


def test_migration_stamps_the_schema_version(tmp_path: Path):
    db = tmp_path / "history.db"
    _make_v1_db(db)

    repo = SqliteSessionRepository(db)
    repo.dispose()

    with sqlite3.connect(db) as conn:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == SCHEMA_VERSION


def test_reopening_an_already_migrated_database_is_a_no_op(tmp_path: Path):
    """Mở đi mở lại phải chịu được: ALTER TABLE lần hai sẽ ném 'duplicate column'."""
    db = tmp_path / "history.db"
    _make_v1_db(db)

    for _ in range(3):
        repo = SqliteSessionRepository(db)
        repo.dispose()

    repo = SqliteSessionRepository(db)
    try:
        assert len(asyncio.run(repo.get_utterances("s1"))) == 1
    finally:
        repo.dispose()


def test_new_database_stores_and_reads_back_the_speaker_label(tmp_path: Path):
    repo = SqliteSessionRepository(tmp_path / "fresh.db")
    try:
        session = Session(id="s2", started_at_ms=0)
        asyncio.run(repo.save_session(session))
        asyncio.run(
            repo.save_utterance(
                Utterance(
                    id="u2",
                    session_id="s2",
                    source=AudioSource.file,
                    source_language=Language.vi,
                    target_language=Language.en,
                    source_text="xin chào",
                    status=UtteranceStatus.success,
                    speaker="speaker-2",
                )
            )
        )
        rows = asyncio.run(repo.get_utterances("s2"))
    finally:
        repo.dispose()

    assert [row.speaker for row in rows] == ["speaker-2"]
