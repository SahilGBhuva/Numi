from __future__ import annotations

import os
import sqlite3
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).with_name("pocket_tutor.db")
VERCEL_DB_PATH = Path("/tmp/pocket_tutor.db")


def db_path() -> Path:
    configured_path = os.getenv("POCKET_TUTOR_DB_PATH")
    if configured_path:
        return Path(configured_path)
    if os.getenv("VERCEL"):
        return VERCEL_DB_PATH
    return DEFAULT_DB_PATH


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(db_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS student_progress (
                student_id TEXT PRIMARY KEY,
                total_xp INTEGER NOT NULL DEFAULT 0,
                attempts INTEGER NOT NULL DEFAULT 0,
                correct_answers INTEGER NOT NULL DEFAULT 0,
                streak INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS topic_progress (
                student_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                correct_answers INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (student_id, topic),
                FOREIGN KEY (student_id) REFERENCES student_progress(student_id)
                    ON DELETE CASCADE
            );
            """
        )


def update_progress(student_id: str, topic: str, correct: bool, xp: int) -> dict:
    init_db()
    with connect() as connection:
        connection.execute(
            "INSERT OR IGNORE INTO student_progress (student_id) VALUES (?)",
            (student_id,),
        )
        connection.execute(
            """
            UPDATE student_progress
            SET total_xp = total_xp + ?,
                attempts = attempts + 1,
                correct_answers = correct_answers + ?,
                streak = CASE WHEN ? THEN streak + 1 ELSE 0 END,
                best_streak = CASE
                    WHEN ? AND streak + 1 > best_streak THEN streak + 1
                    ELSE best_streak
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
            """,
            (xp, int(correct), int(correct), int(correct), student_id),
        )
        connection.execute(
            """
            INSERT INTO topic_progress (student_id, topic, attempts, correct_answers)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(student_id, topic) DO UPDATE SET
                attempts = attempts + 1,
                correct_answers = correct_answers + excluded.correct_answers
            """,
            (student_id, topic, int(correct)),
        )
    record = get_progress(student_id)
    assert record is not None
    return record


def get_progress(student_id: str) -> dict | None:
    init_db()
    with connect() as connection:
        progress = connection.execute(
            "SELECT * FROM student_progress WHERE student_id = ?",
            (student_id,),
        ).fetchone()
        if progress is None:
            return None
        topics = connection.execute(
            "SELECT topic, attempts, correct_answers FROM topic_progress WHERE student_id = ?",
            (student_id,),
        ).fetchall()

    return {
        "student_id": progress["student_id"],
        "total_xp": progress["total_xp"],
        "attempts": progress["attempts"],
        "correct_answers": progress["correct_answers"],
        "streak": progress["streak"],
        "best_streak": progress["best_streak"],
        "topics": {
            row["topic"]: {
                "attempts": row["attempts"],
                "correct": row["correct_answers"],
            }
            for row in topics
        },
    }


def reset_db() -> None:
    path = db_path()
    if path.exists():
        path.unlink()
    init_db()
