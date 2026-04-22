"""
Memory Store
============
Persists conversation history per session in SQLite.
Also doubles as the audit log — every query and response is recorded.

Upgrade path: swap SQLite for Postgres by changing DATABASE_URL env var.
For multi-tenant cloud, add a workspace_id column to all tables.
"""
import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = os.getenv("DATABASE_PATH", "/tmp/opsiq.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                query TEXT NOT NULL,
                tools_used TEXT NOT NULL,
                answer_preview TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)


_init_db()


class MemoryStore:
    def get_history(self, session_id: str) -> list[dict]:
        """Load the last 20 messages for a session (keeps context window sane)."""
        with _get_conn() as conn:
            rows = conn.execute(
                """
                SELECT role, content FROM messages
                WHERE session_id = ?
                ORDER BY id DESC LIMIT 20
                """,
                (session_id,),
            ).fetchall()
        # Return in chronological order
        messages = []
        for row in reversed(rows):
            content = row["content"]
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                pass
            messages.append({"role": row["role"], "content": content})
        return messages

    def save_history(self, session_id: str, messages: list[dict]):
        """Persist the full message list for a session."""
        now = datetime.utcnow().isoformat()
        with _get_conn() as conn:
            # Upsert session
            conn.execute(
                """
                INSERT INTO sessions (session_id, created_at, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at
                """,
                (session_id, now, now),
            )
            # Clear existing messages and rewrite (simple, reliable)
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            for msg in messages:
                content = msg["content"]
                if not isinstance(content, str):
                    content = json.dumps(content)
                conn.execute(
                    "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                    (session_id, msg["role"], content, now),
                )

    def log_query(
        self, session_id: str, query: str, tools_used: list[str], answer: str
    ):
        """Append to audit log. Called after every successful query."""
        with _get_conn() as conn:
            conn.execute(
                """
                INSERT INTO audit_log (session_id, query, tools_used, answer_preview, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    query,
                    json.dumps(tools_used),
                    answer[:500],
                    datetime.utcnow().isoformat(),
                ),
            )

    def new_session_id(self) -> str:
        return str(uuid.uuid4())
