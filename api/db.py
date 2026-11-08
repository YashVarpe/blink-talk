"""SQLite storage: messages, the single profile row, and an events log. Standard sqlite3, no ORM."""
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from models import Message, Profile, Role

DB_PATH = Path(os.getenv("DB_PATH") or Path(__file__).resolve().parent / "blinktalk.db")

DEMO_PROFILE = Profile(
    name="Sam",
    caregivers=["Maria", "Dr. Lee"],
    needs=["water", "repositioning", "suction", "pain medication"],
    preferences=["prefers tea over coffee", "likes jazz", "watches the evening news"],
    common_phrases=["I love you", "Can you call my daughter?", "I'm tired", "Please wait", "I'm okay"],
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, role TEXT NOT NULL, text TEXT NOT NULL, ts TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events_log (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, ts TEXT NOT NULL);
"""


def now_iso() -> str:
    """UTC ISO 8601 with milliseconds, e.g. 2026-11-08T01:30:00.123Z"""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@contextmanager
def _conn():
    """One short-lived connection per call: safe across threads, fast enough for a local file.
    Commits on success, rolls back on error, always closes."""
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.row_factory = sqlite3.Row
    try:
        with c:
            yield c
    finally:
        c.close()


def init() -> None:
    with _conn() as c:
        c.executescript(SCHEMA)
        c.execute(
            "INSERT OR IGNORE INTO profile (id, data) VALUES (1, ?)",
            (json.dumps(DEMO_PROFILE.json_dict()),),
        )


# ---- messages ---------------------------------------------------------------

def add_message(role: Role, text: str) -> Message:
    msg = Message(id=uuid.uuid4().hex, role=role, text=text, ts=now_iso())
    with _conn() as c:
        c.execute("INSERT INTO messages (id, role, text, ts) VALUES (?, ?, ?, ?)", (msg.id, msg.role, msg.text, msg.ts))
    return msg


def recent_messages(limit: int = 20) -> list[Message]:
    """Newest last."""
    with _conn() as c:
        rows = c.execute(
            "SELECT id, role, text, ts FROM messages ORDER BY ts DESC, rowid DESC LIMIT ?", (limit,)
        ).fetchall()
    return [Message(**dict(r)) for r in reversed(rows)]


# ---- profile ----------------------------------------------------------------

def get_profile() -> Profile:
    with _conn() as c:
        row = c.execute("SELECT data FROM profile WHERE id = 1").fetchone()
    return Profile.model_validate(json.loads(row["data"])) if row else DEMO_PROFILE


def put_profile(p: Profile) -> Profile:
    with _conn() as c:
        c.execute(
            "INSERT INTO profile (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            (json.dumps(p.json_dict()),),
        )
    return p


# ---- events log -------------------------------------------------------------

def log_event(kind: str, data: dict) -> None:
    with _conn() as c:
        c.execute("INSERT INTO events_log (kind, data, ts) VALUES (?, ?, ?)", (kind, json.dumps(data), now_iso()))
