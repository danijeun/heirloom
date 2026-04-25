import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get("DATABASE_PATH", "/data/heirloom.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    image_url TEXT,
    original_language_guess TEXT,
    transcription_text TEXT,
    translation_text TEXT,
    claude_model TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS spans (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    start_char INTEGER NOT NULL,
    end_char INTEGER NOT NULL,
    text TEXT NOT NULL,
    is_uncertain INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spans_artifact ON spans(artifact_id);

CREATE TABLE IF NOT EXISTS audio_clips (
    id TEXT PRIMARY KEY,
    span_id TEXT NOT NULL REFERENCES spans(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    duration_ms INTEGER,
    speaker_name TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audio_span ON audio_clips(span_id);
"""


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as c:
        c.executescript(SCHEMA)
        c.commit()


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()
