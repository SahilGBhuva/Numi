from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, delete, select, update

import database

metadata = MetaData()

generated_questions = Table(
    "generated_questions",
    metadata,
    Column("question_id", String(64), primary_key=True),
    Column("student_id", String(100), nullable=False, index=True),
    Column("question", String(500), nullable=False),
    Column("correct_answer", String(200), nullable=False),
    Column("topic", String(50), nullable=False),
    Column("difficulty", Integer, nullable=False),
    Column("completed", Integer, nullable=False, default=0),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


def init_questions() -> None:
    metadata.create_all(database.engine())


def save_question(student_id: str, question: str, correct_answer: str, topic: str, difficulty: int) -> str:
    init_questions()
    question_id = uuid4().hex
    with database.engine().begin() as connection:
        connection.execute(generated_questions.insert().values(
            question_id=question_id,
            student_id=student_id,
            question=question,
            correct_answer=correct_answer,
            topic=topic,
            difficulty=difficulty,
            completed=0,
            created_at=datetime.now(timezone.utc),
        ))
    return question_id


def get_question(student_id: str, question_id: str) -> dict | None:
    init_questions()
    with database.engine().connect() as connection:
        row = connection.execute(
            select(generated_questions).where(
                generated_questions.c.question_id == question_id,
                generated_questions.c.student_id == student_id,
            )
        ).mappings().first()
    return dict(row) if row is not None else None


def complete_question(student_id: str, question_id: str) -> bool:
    init_questions()
    with database.engine().begin() as connection:
        result = connection.execute(
            update(generated_questions)
            .where(
                generated_questions.c.question_id == question_id,
                generated_questions.c.student_id == student_id,
                generated_questions.c.completed == 0,
            )
            .values(completed=1)
        )
    return result.rowcount == 1


def reset_questions() -> None:
    init_questions()
    if database.engine().dialect.name != "sqlite":
        raise RuntimeError("reset_questions is only available for local SQLite databases")
    with database.engine().begin() as connection:
        connection.execute(delete(generated_questions))
