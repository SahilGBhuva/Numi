from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from sqlalchemy import (
    Column, Date, DateTime, ForeignKey, Integer, MetaData, String, Table,
    create_engine, delete, inspect, select, update,
)
from sqlalchemy.engine import Engine


DEFAULT_DB_PATH = Path(__file__).with_name("pocket_tutor.db")
VERCEL_DB_PATH = Path("/tmp/pocket_tutor.db")
metadata = MetaData()

student_progress = Table(
    "student_progress", metadata,
    Column("student_id", String(100), primary_key=True),
    Column("total_xp", Integer, nullable=False, default=0),
    Column("attempts", Integer, nullable=False, default=0),
    Column("correct_answers", Integer, nullable=False, default=0),
    Column("streak", Integer, nullable=False, default=0),
    Column("best_streak", Integer, nullable=False, default=0),
    Column("last_active_date", Date),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

topic_progress = Table(
    "topic_progress", metadata,
    Column("student_id", String(100), ForeignKey("student_progress.student_id", ondelete="CASCADE"), primary_key=True),
    Column("topic", String(50), primary_key=True),
    Column("attempts", Integer, nullable=False, default=0),
    Column("correct_answers", Integer, nullable=False, default=0),
)


def sqlite_path() -> Path:
    configured_path = os.getenv("POCKET_TUTOR_DB_PATH")
    if configured_path:
        return Path(configured_path)
    if os.getenv("VERCEL"):
        return VERCEL_DB_PATH
    return DEFAULT_DB_PATH


def database_url() -> str:
    configured_url = os.getenv("DATABASE_URL")
    if configured_url:
        if configured_url.startswith("postgres://"):
            return configured_url.replace("postgres://", "postgresql+psycopg://", 1)
        if configured_url.startswith("postgresql://"):
            return configured_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return configured_url
    return f"sqlite:///{sqlite_path()}"


@lru_cache(maxsize=1)
def engine() -> Engine:
    url = database_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def init_db() -> None:
    active_engine = engine()
    metadata.create_all(active_engine)
    if active_engine.dialect.name == "sqlite":
        columns = {column["name"] for column in inspect(active_engine).get_columns("student_progress")}
        if "last_active_date" not in columns:
            with active_engine.begin() as connection:
                connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN last_active_date DATE")
                connection.execute(update(student_progress).values(streak=0, best_streak=0))


def _next_streak(current_streak: int, last_active: date | None, correct: bool, today: date) -> int:
    if not correct or last_active == today:
        return current_streak
    if last_active == today - timedelta(days=1):
        return current_streak + 1
    return 1


def update_progress(student_id: str, topic: str, correct: bool, xp: int) -> dict:
    init_db()
    today = date.today()
    now = datetime.now(timezone.utc)
    with engine().begin() as connection:
        progress = connection.execute(
            select(student_progress).where(student_progress.c.student_id == student_id)
        ).mappings().first()
        if progress is None:
            connection.execute(student_progress.insert().values(
                student_id=student_id, total_xp=0, attempts=0, correct_answers=0,
                streak=0, best_streak=0, last_active_date=None, updated_at=now,
            ))
            progress = connection.execute(
                select(student_progress).where(student_progress.c.student_id == student_id)
            ).mappings().one()

        streak = _next_streak(progress["streak"], progress["last_active_date"], correct, today)
        connection.execute(
            update(student_progress)
            .where(student_progress.c.student_id == student_id)
            .values(
                total_xp=progress["total_xp"] + xp,
                attempts=progress["attempts"] + 1,
                correct_answers=progress["correct_answers"] + int(correct),
                streak=streak,
                best_streak=max(progress["best_streak"], streak),
                last_active_date=today if correct else progress["last_active_date"],
                updated_at=now,
            )
        )

        topic_record = connection.execute(
            select(topic_progress).where(
                topic_progress.c.student_id == student_id,
                topic_progress.c.topic == topic,
            )
        ).mappings().first()
        if topic_record is None:
            connection.execute(topic_progress.insert().values(
                student_id=student_id, topic=topic, attempts=1,
                correct_answers=int(correct),
            ))
        else:
            connection.execute(
                update(topic_progress)
                .where(
                    topic_progress.c.student_id == student_id,
                    topic_progress.c.topic == topic,
                )
                .values(
                    attempts=topic_record["attempts"] + 1,
                    correct_answers=topic_record["correct_answers"] + int(correct),
                )
            )

    record = get_progress(student_id)
    assert record is not None
    return record


def get_progress(student_id: str) -> dict | None:
    init_db()
    with engine().connect() as connection:
        progress = connection.execute(
            select(student_progress).where(student_progress.c.student_id == student_id)
        ).mappings().first()
        if progress is None:
            return None
        topics = connection.execute(
            select(topic_progress).where(topic_progress.c.student_id == student_id)
        ).mappings().all()

    return {
        "student_id": progress["student_id"],
        "total_xp": progress["total_xp"],
        "attempts": progress["attempts"],
        "correct_answers": progress["correct_answers"],
        "streak": progress["streak"],
        "best_streak": progress["best_streak"],
        "topics": {
            row["topic"]: {"attempts": row["attempts"], "correct": row["correct_answers"]}
            for row in topics
        },
    }


def reset_db() -> None:
    init_db()
    active_engine = engine()
    if active_engine.dialect.name != "sqlite":
        raise RuntimeError("reset_db is only available for local SQLite databases")
    with active_engine.begin() as connection:
        connection.execute(delete(topic_progress))
        connection.execute(delete(student_progress))
