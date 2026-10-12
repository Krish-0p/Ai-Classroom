import datetime
import sqlite3
import uuid
from typing import Any

from app import config

DB_PATH = config.STORAGE_DIR / "jobs.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    config.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                error_message TEXT
            )
            """
        )
        conn.commit()


# Ensure DB schema is initialized on module load
init_db()


def create_job(topic: str) -> str:
    job_id = uuid.uuid4().hex
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO jobs (job_id, topic, status, created_at, error_message)
            VALUES (?, ?, ?, ?, NULL)
            """,
            (job_id, topic, "queued", created_at),
        )
        conn.commit()
    return job_id


def update_job(job_id: str, **fields: Any) -> None:
    if not fields:
        return

    # Map legacy 'error' param to 'error_message' if passed
    if "error" in fields and "error_message" not in fields:
        fields["error_message"] = fields.pop("error")

    allowed_cols = {"topic", "status", "error_message"}
    set_clauses = []
    values = []

    for key, val in fields.items():
        if key in allowed_cols:
            set_clauses.append(f"{key} = ?")
            values.append(val)

    if not set_clauses:
        return

    values.append(job_id)
    query = f"UPDATE jobs SET {', '.join(set_clauses)} WHERE job_id = ?"

    with _get_conn() as conn:
        conn.execute(query, values)
        conn.commit()


def get_job(job_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT job_id, topic, status, created_at, error_message FROM jobs WHERE job_id = ?",
            (job_id,),
        ).fetchone()

    if row is None:
        return None

    res = dict(row)
    if res.get("error_message"):
        res["error"] = res["error_message"]
    return res
