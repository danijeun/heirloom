import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    LargeBinary,
    MetaData,
    Table,
    Text,
    create_engine,
    inspect,
    text,
)


DATABASE_URL = os.environ.get("DATABASE_URL")
DATABASE_PATH = os.environ.get("DATABASE_PATH", "/data/heirloom.db")


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def _build_engine():
    if DATABASE_URL:
        return create_engine(
            _normalize_database_url(DATABASE_URL), future=True, pool_pre_ping=True
        )

    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{DATABASE_PATH}", future=True)


engine = _build_engine()
metadata = MetaData()

artifacts = Table(
    "artifacts",
    metadata,
    Column("id", Text, primary_key=True),
    Column("created_at", Integer, nullable=False),
    Column("image_url", Text),
    Column("original_language_guess", Text),
    Column("transcription_text", Text),
    Column("translation_text", Text),
    Column("claude_model", Text),
    Column("status", Text, nullable=False, server_default=text("'pending'")),
    Column("error_message", Text),
    Column("input_tokens", Integer, nullable=False, server_default=text("0")),
    Column("output_tokens", Integer, nullable=False, server_default=text("0")),
    Column("cost_cents", Integer, nullable=False, server_default=text("0")),
)

spans = Table(
    "spans",
    metadata,
    Column("id", Text, primary_key=True),
    Column("artifact_id", Text, ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False),
    Column("start_char", Integer, nullable=False),
    Column("end_char", Integer, nullable=False),
    Column("text", Text, nullable=False),
    Column("is_uncertain", Integer, nullable=False, server_default=text("0")),
)

audio_clips = Table(
    "audio_clips",
    metadata,
    Column("id", Text, primary_key=True),
    Column("span_id", Text, ForeignKey("spans.id", ondelete="CASCADE"), nullable=False),
    Column("file_path", Text),
    Column("content", LargeBinary),
    Column("mime_type", Text, nullable=False),
    Column("duration_ms", Integer),
    Column("speaker_name", Text),
    Column("created_at", Integer, nullable=False),
)


def init_db() -> None:
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS idx_spans_artifact ON spans(artifact_id)"
        )
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS idx_audio_span ON audio_clips(span_id)"
        )
        _ensure_audio_content_column(conn)


def _ensure_audio_content_column(conn) -> None:
    inspector = inspect(conn)
    column_names = {col["name"] for col in inspector.get_columns("audio_clips")}
    if "content" not in column_names:
        binary_type = "BYTEA" if engine.dialect.name == "postgresql" else "BLOB"
        conn.exec_driver_sql(f"ALTER TABLE audio_clips ADD COLUMN content {binary_type}")
    if "file_path" not in column_names:
        conn.exec_driver_sql("ALTER TABLE audio_clips ADD COLUMN file_path TEXT")


@contextmanager
def conn():
    with engine.begin() as connection:
        yield connection
