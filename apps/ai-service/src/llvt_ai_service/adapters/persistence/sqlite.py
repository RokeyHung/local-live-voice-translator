"""Adapter lưu trữ: SQLite (SQLAlchemy Core) — lịch sử phiên nằm trên máy người dùng.

Nội dung lưu theo SPEC 7.11: thời gian, nguồn âm thanh, cặp ngôn ngữ, câu gốc, câu
dịch, thời gian xử lý từng khâu và trạng thái thành công/thất bại. **Không** lưu file
âm thanh.

Dùng SQLAlchemy Core (Table/MetaData) chứ không dùng ORM: hai bảng phẳng, truy vấn
đơn giản, không cần identity map hay lazy loading. Schema do ``create_all`` dựng ngay
khi mở file nên không cần Alembic — cơ sở dữ liệu này chỉ tồn tại trên máy người dùng
và luôn được tạo bởi đúng phiên bản app đang chạy, không có bản triển khai nào phải
migrate. Khi schema đổi ở các đợt sau: bơm cột mới bằng ``PRAGMA user_version``.

Driver pysqlite là blocking, nên mọi câu lệnh chạy qua ``asyncio.to_thread`` để không
chặn event loop của FastAPI.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Sequence

from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    func,
    or_,
    select,
)
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine, Row
from sqlalchemy.exc import OperationalError

from llvt_ai_service.domain.enums import (
    AudioSource,
    Language,
    Preset,
    SessionMode,
    UtteranceStatus,
)
from llvt_ai_service.domain.models import Session, SessionConfig, Utterance
from llvt_ai_service.ports.repository import SessionRepository

metadata = MetaData()

sessions_table = Table(
    "sessions",
    metadata,
    Column("id", String, primary_key=True),
    Column("title", String, nullable=False, default=""),
    Column("mode", String, nullable=True),
    Column("preset", String, nullable=True),
    Column("started_at_ms", Integer, nullable=False, index=True),
    Column("ended_at_ms", Integer, nullable=True),
)

utterances_table = Table(
    "utterances",
    metadata,
    Column("id", String, primary_key=True),
    Column("session_id", String, nullable=False, index=True),
    Column("source", String, nullable=False),
    Column("source_language", String, nullable=False),
    Column("target_language", String, nullable=False),
    Column("source_text", Text, nullable=True),
    Column("translated_text", Text, nullable=True),
    Column("asr_ms", Integer, nullable=True),
    Column("mt_ms", Integer, nullable=True),
    Column("tts_ms", Integer, nullable=True),
    Column("status", String, nullable=False),
    Column("error", String, nullable=True),
    Column("started_at_ms", Integer, nullable=False, index=True),
    Column("ended_at_ms", Integer, nullable=True),
    # Nhãn người nói khi bật diarization ở màn Nhập tệp (`speaker-1`…). NULL với mọi
    # câu của phiên trực tiếp — ở đó "ai nói" đã biết qua `source` (mic hay system).
    Column("speaker", String, nullable=True),
)

# Phiên bản schema, ghi vào `PRAGMA user_version` của chính file SQLite.
#   1 = schema gốc (docs/11)
#   2 = thêm cột `utterances.speaker` (diarization)
SCHEMA_VERSION = 2

# Cột bơm thêm cho từng bậc nâng cấp: (phiên bản đích, câu lệnh ALTER).
#
# Vẫn không dùng Alembic, vì lý do đã ghi ở đầu file: cơ sở dữ liệu này chỉ nằm trên
# máy người dùng, không có bản triển khai nào phải migrate ngược. Nhưng nó là dữ
# liệu THẬT của người ta — lịch sử họp không được mất chỉ vì app lên phiên bản, nên
# `create_all` (bỏ qua bảng đã tồn tại) là chưa đủ khi có thêm cột.
_MIGRATIONS: tuple[tuple[int, str], ...] = (
    (2, "ALTER TABLE utterances ADD COLUMN speaker VARCHAR"),
)


def _row_to_session(row: Row[Any]) -> Session:
    # Cặp ngôn ngữ nằm ở từng utterance (một phiên hai chiều có hai cặp), nên
    # config dựng lại chỉ giữ mode + preset.
    config = (
        SessionConfig(
            mode=SessionMode(row.mode),
            preset=Preset(row.preset) if row.preset else Preset.balanced,
        )
        if row.mode
        else None
    )
    return Session(
        id=row.id,
        config=config,
        started_at_ms=row.started_at_ms,
        ended_at_ms=row.ended_at_ms,
        title=row.title or "",
    )


def _row_to_utterance(row: Row[Any]) -> Utterance:
    return Utterance(
        id=row.id,
        session_id=row.session_id,
        source=AudioSource(row.source),
        source_language=Language(row.source_language),
        target_language=Language(row.target_language),
        source_text=row.source_text,
        translated_text=row.translated_text,
        started_at_ms=row.started_at_ms,
        ended_at_ms=row.ended_at_ms,
        asr_ms=row.asr_ms,
        mt_ms=row.mt_ms,
        tts_ms=row.tts_ms,
        status=UtteranceStatus(row.status),
        error=row.error,
        speaker=row.speaker,
    )


def _migrate(engine: Engine) -> None:
    """Bơm cột cho file SQLite đã có từ phiên bản trước.

    File mới toanh vừa được ``create_all`` dựng thì đã đủ cột, chỉ cần đóng dấu phiên
    bản. File cũ thì chạy lần lượt các bước còn thiếu. ``PRAGMA user_version`` là chỗ
    SQLite dành sẵn cho việc này nên không phải thêm bảng phụ nào.
    """
    with engine.begin() as conn:
        current = int(conn.exec_driver_sql("PRAGMA user_version").scalar() or 0)
        if current == 0:
            # 0 = chưa đóng dấu bao giờ. Có thể là file mới (create_all vừa dựng đủ
            # cột) hoặc file của bản trước khi có đánh phiên bản — cả hai đều đang ở
            # schema v1, nên cứ chạy tiếp các bước từ 2 trở đi.
            current = 1
        for version, statement in _MIGRATIONS:
            if version <= current:
                continue
            try:
                conn.exec_driver_sql(statement)
            except OperationalError as exc:
                # Cột đã có sẵn (file vừa do create_all dựng) là trường hợp bình
                # thường; mọi lỗi khác thì phải nổ ra chứ không nuốt.
                if "duplicate column name" not in str(exc).lower():
                    raise
            current = version
        conn.exec_driver_sql(f"PRAGMA user_version = {SCHEMA_VERSION}")


class SqliteSessionRepository(SessionRepository):
    """Lịch sử phiên lưu trong một file SQLite duy nhất."""

    def __init__(self, db_path: Path | str) -> None:
        self.path = Path(db_path)
        if self.path.parent != Path(""):
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._engine: Engine = create_engine(
            f"sqlite+pysqlite:///{self.path}",
            # Mỗi lệnh chạy trong một thread của to_thread nên connection của pool
            # sẽ đi qua nhiều thread khác nhau — tắt kiểm tra same-thread.
            connect_args={"check_same_thread": False},
        )
        metadata.create_all(self._engine)
        _migrate(self._engine)

    def dispose(self) -> None:
        self._engine.dispose()

    # --- ghi -------------------------------------------------------------

    async def save_session(self, session: Session) -> None:
        await asyncio.to_thread(self._save_session, session)

    def _save_session(self, session: Session) -> None:
        values = {
            "id": session.id,
            "title": session.title,
            "mode": session.config.mode.value if session.config else None,
            "preset": session.config.preset.value if session.config else None,
            "started_at_ms": session.started_at_ms,
            "ended_at_ms": session.ended_at_ms,
        }
        stmt = sqlite_insert(sessions_table).values(**values)
        # Phiên được lưu hai lần (lúc start và lúc stop) nên cần upsert.
        stmt = stmt.on_conflict_do_update(
            index_elements=[sessions_table.c.id],
            set_={k: v for k, v in values.items() if k != "id"},
        )
        with self._engine.begin() as conn:
            conn.execute(stmt)

    async def save_utterance(self, utterance: Utterance) -> None:
        await asyncio.to_thread(self._save_utterance, utterance)

    def _save_utterance(self, utterance: Utterance) -> None:
        values = {
            "id": utterance.id,
            "session_id": utterance.session_id,
            "source": utterance.source.value,
            "source_language": utterance.source_language.value,
            "target_language": utterance.target_language.value,
            "source_text": utterance.source_text,
            "translated_text": utterance.translated_text,
            "asr_ms": utterance.asr_ms,
            "mt_ms": utterance.mt_ms,
            "tts_ms": utterance.tts_ms,
            "status": utterance.status.value,
            "error": utterance.error,
            "started_at_ms": utterance.started_at_ms,
            "ended_at_ms": utterance.ended_at_ms,
            "speaker": utterance.speaker,
        }
        stmt = sqlite_insert(utterances_table).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[utterances_table.c.id],
            set_={k: v for k, v in values.items() if k != "id"},
        )
        with self._engine.begin() as conn:
            conn.execute(stmt)

    # --- đọc -------------------------------------------------------------

    async def get_session(self, session_id: str) -> Session | None:
        return await asyncio.to_thread(self._get_session, session_id)

    def _get_session(self, session_id: str) -> Session | None:
        stmt = select(sessions_table).where(sessions_table.c.id == session_id)
        with self._engine.connect() as conn:
            row = conn.execute(stmt).one_or_none()
        return _row_to_session(row) if row is not None else None

    async def list_sessions(self, query: str | None = None) -> list[Session]:
        return await asyncio.to_thread(self._list_sessions, query)

    def _list_sessions(self, query: str | None) -> list[Session]:
        stmt = select(sessions_table).order_by(sessions_table.c.started_at_ms.desc())
        needle = (query or "").strip()
        if needle:
            # LIKE thay vì FTS5: bộ dữ liệu một máy một người dùng (hàng nghìn câu),
            # đổi lấy schema không cần bảng ảo + trigger đồng bộ.
            pattern = f"%{needle}%"
            matching_ids = select(utterances_table.c.session_id).where(
                or_(
                    utterances_table.c.source_text.ilike(pattern),
                    utterances_table.c.translated_text.ilike(pattern),
                )
            )
            stmt = stmt.where(
                or_(
                    sessions_table.c.title.ilike(pattern),
                    sessions_table.c.id.in_(matching_ids),
                )
            )
        with self._engine.connect() as conn:
            rows: Sequence[Row[Any]] = conn.execute(stmt).all()
        return [_row_to_session(row) for row in rows]

    async def get_utterances(self, session_id: str) -> list[Utterance]:
        return await asyncio.to_thread(self._get_utterances, session_id)

    def _get_utterances(self, session_id: str) -> list[Utterance]:
        stmt = (
            select(utterances_table)
            .where(utterances_table.c.session_id == session_id)
            .order_by(utterances_table.c.started_at_ms.asc())
        )
        with self._engine.connect() as conn:
            rows: Sequence[Row[Any]] = conn.execute(stmt).all()
        return [_row_to_utterance(row) for row in rows]

    async def count_utterances(self, session_id: str) -> int:
        return await asyncio.to_thread(self._count_utterances, session_id)

    def _count_utterances(self, session_id: str) -> int:
        stmt = select(func.count()).where(utterances_table.c.session_id == session_id)
        with self._engine.connect() as conn:
            return int(conn.execute(stmt).scalar() or 0)

    # --- xoá -------------------------------------------------------------

    async def delete_session(self, session_id: str) -> None:
        await asyncio.to_thread(self._delete_session, session_id)

    def _delete_session(self, session_id: str) -> None:
        with self._engine.begin() as conn:
            conn.execute(
                delete(utterances_table).where(utterances_table.c.session_id == session_id)
            )
            conn.execute(delete(sessions_table).where(sessions_table.c.id == session_id))

    async def delete_all_sessions(self) -> None:
        await asyncio.to_thread(self._delete_all_sessions)

    def _delete_all_sessions(self) -> None:
        with self._engine.begin() as conn:
            conn.execute(delete(utterances_table))
            conn.execute(delete(sessions_table))
