from __future__ import annotations

import os
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import (
    Column, Date, DateTime, ForeignKey, Integer, MetaData, String, Table,
    UniqueConstraint, and_, create_engine, delete, inspect, or_, select, update,
)
from sqlalchemy.engine import Engine


load_dotenv(Path(__file__).with_name(".env"))

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
    Column("login_streak", Integer, nullable=False, default=0),
    Column("best_login_streak", Integer, nullable=False, default=0),
    Column("last_login_date", Date),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

topic_progress = Table(
    "topic_progress", metadata,
    Column("student_id", String(100), ForeignKey("student_progress.student_id", ondelete="CASCADE"), primary_key=True),
    Column("topic", String(50), primary_key=True),
    Column("attempts", Integer, nullable=False, default=0),
    Column("correct_answers", Integer, nullable=False, default=0),
)

profiles = Table(
    "profiles", metadata,
    Column("student_id", String(100), ForeignKey("student_progress.student_id", ondelete="CASCADE"), primary_key=True),
    Column("username", String(24), nullable=False, unique=True),
    Column("display_name", String(40), nullable=False),
    Column("avatar_path", String(500), nullable=False, default=""),
    Column("friend_code", String(12), nullable=False, unique=True),
    Column("daily_goal", Integer, nullable=False, default=20),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

friendships = Table(
    "friendships", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("requester_id", String(100), ForeignKey("profiles.student_id", ondelete="CASCADE"), nullable=False),
    Column("recipient_id", String(100), ForeignKey("profiles.student_id", ondelete="CASCADE"), nullable=False),
    Column("status", String(10), nullable=False, default="pending"),
    Column("created_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("requester_id", "recipient_id", name="uq_friend_request_direction"),
)

uploaded_images = Table(
    "uploaded_images", metadata,
    Column("id", String(36), primary_key=True),
    Column("owner_id", String(100), nullable=False, index=True),
    Column("storage_path", String(500), nullable=False, unique=True),
    Column("original_name", String(255), nullable=False),
    Column("content_type", String(100), nullable=False),
    Column("size_bytes", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

progress_claims = Table(
    "progress_claims", metadata,
    Column("guest_id", String(100), primary_key=True),
    Column("account_id", String(100), nullable=False, index=True),
    Column("claimed_at", DateTime(timezone=True), nullable=False),
)


def sqlite_path() -> Path:
    configured_path = os.getenv("POCKET_TUTOR_DB_PATH")
    if configured_path:
        return Path(configured_path)
    if os.getenv("VERCEL"):
        return VERCEL_DB_PATH
    return DEFAULT_DB_PATH


def database_url() -> str:
    if os.getenv("POCKET_TUTOR_DB_PATH"):
        return f"sqlite:///{sqlite_path()}"
    configured_url = os.getenv("DATABASE_URL")
    if not configured_url:
        return f"sqlite:///{sqlite_path()}"

    url = configured_url.strip()
    if url.startswith("DATABASE_URL="):
        url = url.removeprefix("DATABASE_URL=").strip()
    if len(url) >= 2 and url[0] == url[-1] and url[0] in "'\"`":
        url = url[1:-1].strip()
    embedded_url = re.search(
        r"(?:postgres(?:ql)?(?:\+psycopg2|\+psycopg)?|sqlite)://[^\s'\"`]+",
        url,
    )
    if embedded_url:
        url = embedded_url.group(0).rstrip("\\")

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    if ("supabase.co" in url or "supabase.com" in url) and "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


def _uses_supabase_pooler(url: str) -> bool:
    return "pooler.supabase.com" in url or ":6543" in url


@lru_cache(maxsize=1)
def engine() -> Engine:
    url = database_url()
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        connect_args: dict = {}
        if _uses_supabase_pooler(url):
            # PgBouncer transaction mode does not support prepared statements.
            connect_args["prepare_threshold"] = None
        if connect_args:
            kwargs["connect_args"] = connect_args
        if os.getenv("VERCEL"):
            # Keep one connection alive inside a warm serverless instance. The
            # Supabase transaction pooler safely multiplexes these small pools.
            kwargs.update(pool_size=1, max_overflow=1, pool_recycle=300)
    return create_engine(url, **kwargs)


@lru_cache(maxsize=1)
def init_db() -> None:
    """Create/check tables once per warm process instead of on every request."""
    active_engine = engine()
    metadata.create_all(active_engine)
    if active_engine.dialect.name == "postgresql":
        with active_engine.begin() as connection:
            connection.exec_driver_sql("ALTER TABLE progress_claims ENABLE ROW LEVEL SECURITY")
            connection.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_path varchar(500) NOT NULL DEFAULT ''")
            connection.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_goal integer NOT NULL DEFAULT 20")
            connection.exec_driver_sql("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())")
            connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS login_streak integer NOT NULL DEFAULT 0")
            connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS best_login_streak integer NOT NULL DEFAULT 0")
            connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS last_login_date date")
    if active_engine.dialect.name == "sqlite":
        columns = {column["name"] for column in inspect(active_engine).get_columns("student_progress")}
        if "last_active_date" not in columns:
            with active_engine.begin() as connection:
                connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN last_active_date DATE")
                connection.execute(update(student_progress).values(streak=0, best_streak=0))
        columns = {column["name"] for column in inspect(active_engine).get_columns("student_progress")}
        with active_engine.begin() as connection:
            if "login_streak" not in columns:
                connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN login_streak INTEGER NOT NULL DEFAULT 0")
            if "best_login_streak" not in columns:
                connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN best_login_streak INTEGER NOT NULL DEFAULT 0")
            if "last_login_date" not in columns:
                connection.exec_driver_sql("ALTER TABLE student_progress ADD COLUMN last_login_date DATE")
        profile_columns = {column["name"] for column in inspect(active_engine).get_columns("profiles")}
        with active_engine.begin() as connection:
            if "avatar_path" not in profile_columns:
                connection.exec_driver_sql("ALTER TABLE profiles ADD COLUMN avatar_path VARCHAR(500) NOT NULL DEFAULT ''")
            if "daily_goal" not in profile_columns:
                connection.exec_driver_sql("ALTER TABLE profiles ADD COLUMN daily_goal INTEGER NOT NULL DEFAULT 20")
            if "updated_at" not in profile_columns:
                connection.exec_driver_sql("ALTER TABLE profiles ADD COLUMN updated_at DATETIME")
                connection.execute(update(profiles).values(updated_at=datetime.now(timezone.utc)))


def _next_streak(current_streak: int, last_active: date | None, correct: bool, today: date) -> int:
    if not correct or last_active == today:
        return current_streak
    if last_active == today - timedelta(days=1):
        return current_streak + 1
    return 1


def _next_login_streak(current_streak: int, last_login: date | None, today: date) -> int:
    if last_login == today:
        return current_streak
    if last_login == today - timedelta(days=1):
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
                streak=0, best_streak=0, last_active_date=None,
                login_streak=0, best_login_streak=0, last_login_date=None,
                updated_at=now,
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

        updated = connection.execute(
            select(student_progress).where(student_progress.c.student_id == student_id)
        ).mappings().one()
        topics = connection.execute(
            select(topic_progress).where(topic_progress.c.student_id == student_id)
        ).mappings().all()

    return {
        "student_id": updated["student_id"],
        "total_xp": updated["total_xp"],
        "attempts": updated["attempts"],
        "correct_answers": updated["correct_answers"],
        "streak": updated["streak"],
        "best_streak": updated["best_streak"],
        "login_streak": updated.get("login_streak", 0),
        "best_login_streak": updated.get("best_login_streak", 0),
        "topics": {
            row["topic"]: {"attempts": row["attempts"], "correct": row["correct_answers"]}
            for row in topics
        },
    }


def record_daily_login(student_id: str) -> dict:
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
                streak=0, best_streak=0, last_active_date=None,
                login_streak=1, best_login_streak=1, last_login_date=today,
                updated_at=now,
            ))
        elif progress["last_login_date"] != today:
            login_streak = _next_login_streak(
                progress.get("login_streak", 0),
                progress.get("last_login_date"),
                today,
            )
            connection.execute(
                update(student_progress)
                .where(student_progress.c.student_id == student_id)
                .values(
                    login_streak=login_streak,
                    best_login_streak=max(progress.get("best_login_streak", 0), login_streak),
                    last_login_date=today,
                    updated_at=now,
                )
            )
        progress = connection.execute(
            select(student_progress).where(student_progress.c.student_id == student_id)
        ).mappings().one()
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
        "login_streak": progress.get("login_streak", 0),
        "best_login_streak": progress.get("best_login_streak", 0),
        "topics": {
            row["topic"]: {"attempts": row["attempts"], "correct": row["correct_answers"]}
            for row in topics
        },
    }


def save_uploaded_image(
    image_id: str,
    owner_id: str,
    storage_path: str,
    original_name: str,
    content_type: str,
    size_bytes: int,
) -> dict:
    init_db()
    created_at = datetime.now(timezone.utc)
    with engine().begin() as connection:
        connection.execute(uploaded_images.insert().values(
            id=image_id,
            owner_id=owner_id,
            storage_path=storage_path,
            original_name=original_name,
            content_type=content_type,
            size_bytes=size_bytes,
            created_at=created_at,
        ))
    return {
        "id": image_id,
        "owner_id": owner_id,
        "storage_path": storage_path,
        "original_name": original_name,
        "content_type": content_type,
        "size_bytes": size_bytes,
        "created_at": created_at,
    }


def list_uploaded_images(owner_id: str) -> list[dict]:
    init_db()
    with engine().connect() as connection:
        rows = connection.execute(
            select(uploaded_images)
            .where(uploaded_images.c.owner_id == owner_id)
            .order_by(uploaded_images.c.created_at.desc())
        ).mappings().all()
    return [dict(row) for row in rows]


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
        "login_streak": progress.get("login_streak", 0),
        "best_login_streak": progress.get("best_login_streak", 0),
        "topics": {
            row["topic"]: {"attempts": row["attempts"], "correct": row["correct_answers"]}
            for row in topics
        },
    }


def create_profile(student_id: str, username: str, display_name: str) -> dict:
    init_db()
    now = datetime.now(timezone.utc)
    with engine().begin() as connection:
        if connection.execute(select(profiles).where(profiles.c.student_id == student_id)).first():
            raise ValueError("profile_exists")
        if connection.execute(select(profiles).where(profiles.c.username == username)).first():
            raise ValueError("username_taken")
        if not connection.execute(select(student_progress).where(student_progress.c.student_id == student_id)).first():
            connection.execute(student_progress.insert().values(
                student_id=student_id, total_xp=0, attempts=0, correct_answers=0,
                streak=0, best_streak=0, last_active_date=None,
                login_streak=0, best_login_streak=0, last_login_date=None,
                updated_at=now,
            ))
        friend_code = ""
        while not friend_code:
            candidate = secrets.token_hex(4).upper()
            if not connection.execute(select(profiles).where(profiles.c.friend_code == candidate)).first():
                friend_code = candidate
        connection.execute(profiles.insert().values(
            student_id=student_id, username=username, display_name=display_name,
            avatar_path="", friend_code=friend_code, daily_goal=20,
            created_at=now, updated_at=now,
        ))
    return get_profile(student_id)


def get_profile(student_id: str) -> dict | None:
    init_db()
    with engine().connect() as connection:
        row = connection.execute(
            select(profiles, student_progress.c.total_xp, student_progress.c.streak, student_progress.c.best_streak)
            .join(student_progress, profiles.c.student_id == student_progress.c.student_id)
            .where(profiles.c.student_id == student_id)
        ).mappings().first()
    if row is None:
        return None
    return {
        "student_id": row["student_id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "avatar_path": row["avatar_path"] or "",
        "friend_code": row["friend_code"],
        "daily_goal": row["daily_goal"] or 20,
        "total_xp": row["total_xp"],
        "streak": row["streak"],
        "best_streak": row["best_streak"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


DAILY_GOALS = {10, 20, 30, 50}


def onboard_account(
    account_id: str,
    username: str,
    display_name: str,
    guest_id: str | None = None,
    avatar_path: str | None = None,
    daily_goal: int | None = None,
) -> dict:
    """Create/update an account profile and claim one guest history exactly once."""
    init_db()
    now = datetime.now(timezone.utc)
    if daily_goal is not None and daily_goal not in DAILY_GOALS:
        raise ValueError("invalid_daily_goal")
    with engine().begin() as connection:
        account_progress = connection.execute(
            select(student_progress).where(student_progress.c.student_id == account_id)
        ).mappings().first()
        if account_progress is None:
            connection.execute(student_progress.insert().values(
                student_id=account_id, total_xp=0, attempts=0, correct_answers=0,
                streak=0, best_streak=0, last_active_date=None, updated_at=now,
            ))
            account_progress = connection.execute(
                select(student_progress).where(student_progress.c.student_id == account_id)
            ).mappings().one()

        if guest_id and guest_id != account_id:
            already_claimed = connection.execute(
                select(progress_claims).where(progress_claims.c.guest_id == guest_id)
            ).first()
            guest_has_account = connection.execute(
                select(profiles.c.student_id).where(profiles.c.student_id == guest_id)
            ).first()
            guest_progress = connection.execute(
                select(student_progress).where(student_progress.c.student_id == guest_id)
            ).mappings().first()
            if not already_claimed and guest_has_account is None and guest_progress is not None:
                latest_active = max(
                    filter(None, [account_progress["last_active_date"], guest_progress["last_active_date"]]),
                    default=None,
                )
                connection.execute(
                    update(student_progress)
                    .where(student_progress.c.student_id == account_id)
                    .values(
                        total_xp=account_progress["total_xp"] + guest_progress["total_xp"],
                        attempts=account_progress["attempts"] + guest_progress["attempts"],
                        correct_answers=account_progress["correct_answers"] + guest_progress["correct_answers"],
                        streak=max(account_progress["streak"], guest_progress["streak"]),
                        best_streak=max(account_progress["best_streak"], guest_progress["best_streak"]),
                        last_active_date=latest_active,
                        updated_at=now,
                    )
                )
                guest_topics = connection.execute(
                    select(topic_progress).where(topic_progress.c.student_id == guest_id)
                ).mappings().all()
                for guest_topic in guest_topics:
                    account_topic = connection.execute(select(topic_progress).where(
                        topic_progress.c.student_id == account_id,
                        topic_progress.c.topic == guest_topic["topic"],
                    )).mappings().first()
                    if account_topic:
                        connection.execute(update(topic_progress).where(
                            topic_progress.c.student_id == account_id,
                            topic_progress.c.topic == guest_topic["topic"],
                        ).values(
                            attempts=account_topic["attempts"] + guest_topic["attempts"],
                            correct_answers=account_topic["correct_answers"] + guest_topic["correct_answers"],
                        ))
                    else:
                        connection.execute(topic_progress.insert().values(
                            student_id=account_id, topic=guest_topic["topic"],
                            attempts=guest_topic["attempts"], correct_answers=guest_topic["correct_answers"],
                        ))
                connection.execute(progress_claims.insert().values(
                    guest_id=guest_id, account_id=account_id, claimed_at=now,
                ))

        username_owner = connection.execute(
            select(profiles.c.student_id).where(profiles.c.username == username)
        ).scalar_one_or_none()
        if username_owner and username_owner != account_id:
            raise ValueError("username_taken")
        profile = connection.execute(
            select(profiles).where(profiles.c.student_id == account_id)
        ).mappings().first()
        if profile:
            values = {"username": username, "display_name": display_name, "updated_at": now}
            if avatar_path is not None:
                values["avatar_path"] = avatar_path
            if daily_goal is not None:
                values["daily_goal"] = daily_goal
            connection.execute(update(profiles).where(profiles.c.student_id == account_id).values(**values))
        else:
            friend_code = ""
            while not friend_code:
                candidate = secrets.token_hex(4).upper()
                if not connection.execute(select(profiles).where(profiles.c.friend_code == candidate)).first():
                    friend_code = candidate
            connection.execute(profiles.insert().values(
                student_id=account_id, username=username, display_name=display_name,
                avatar_path=avatar_path or "", friend_code=friend_code,
                daily_goal=daily_goal or 20, created_at=now, updated_at=now,
            ))
    return get_profile(account_id)


def send_friend_request(requester_id: str, friend_code: str) -> dict:
    init_db()
    with engine().begin() as connection:
        recipient = connection.execute(
            select(profiles).where(profiles.c.friend_code == friend_code.upper())
        ).mappings().first()
        if recipient is None:
            raise ValueError("friend_not_found")
        recipient_id = recipient["student_id"]
        if requester_id == recipient_id:
            raise ValueError("cannot_friend_self")
        if not connection.execute(select(profiles).where(profiles.c.student_id == requester_id)).first():
            raise ValueError("profile_not_found")
        existing = connection.execute(select(friendships).where(or_(
            and_(friendships.c.requester_id == requester_id, friendships.c.recipient_id == recipient_id),
            and_(friendships.c.requester_id == recipient_id, friendships.c.recipient_id == requester_id),
        ))).mappings().first()
        if existing:
            raise ValueError("friendship_exists")
        result = connection.execute(friendships.insert().values(
            requester_id=requester_id, recipient_id=recipient_id,
            status="pending", created_at=datetime.now(timezone.utc),
        ))
        request_id = result.inserted_primary_key[0]
    return {"request_id": request_id, "status": "pending", "friend": dict(recipient)}


def respond_to_friend_request(request_id: int, recipient_id: str, accept: bool) -> dict:
    init_db()
    with engine().begin() as connection:
        request = connection.execute(select(friendships).where(
            friendships.c.id == request_id,
            friendships.c.recipient_id == recipient_id,
        )).mappings().first()
        if request is None:
            raise ValueError("request_not_found")
        if request["status"] != "pending":
            raise ValueError("request_already_answered")
        status = "accepted" if accept else "declined"
        connection.execute(update(friendships).where(friendships.c.id == request_id).values(status=status))
    return {"request_id": request_id, "status": status}


def pending_friend_requests(student_id: str) -> list[dict]:
    init_db()
    requester = profiles.alias("requester")
    with engine().connect() as connection:
        rows = connection.execute(
            select(
                friendships.c.id.label("request_id"), friendships.c.created_at,
                requester.c.username, requester.c.display_name,
            ).join(requester, friendships.c.requester_id == requester.c.student_id)
            .where(friendships.c.recipient_id == student_id, friendships.c.status == "pending")
            .order_by(friendships.c.created_at.desc())
        ).mappings().all()
    return [dict(row) for row in rows]


def friend_leaderboard(student_id: str) -> list[dict]:
    init_db()
    with engine().connect() as connection:
        accepted = connection.execute(select(friendships).where(
            friendships.c.status == "accepted",
            or_(friendships.c.requester_id == student_id, friendships.c.recipient_id == student_id),
        )).mappings().all()
        friend_ids = {
            row["recipient_id"] if row["requester_id"] == student_id else row["requester_id"]
            for row in accepted
        }
        friend_ids.add(student_id)
        rows = connection.execute(
            select(
                profiles.c.student_id, profiles.c.username, profiles.c.display_name,
                student_progress.c.total_xp, student_progress.c.streak,
                student_progress.c.last_active_date,
            ).join(student_progress, profiles.c.student_id == student_progress.c.student_id)
            .where(profiles.c.student_id.in_(friend_ids))
            .order_by(student_progress.c.total_xp.desc(), profiles.c.username.asc())
        ).mappings().all()
    today = date.today()
    return [
        {
            "student_id": row["student_id"], "username": row["username"],
            "display_name": row["display_name"], "total_xp": row["total_xp"],
            "streak": row["streak"], "active_today": row["last_active_date"] == today,
        }
        for row in rows
    ]


def reset_db() -> None:
    init_db()
    active_engine = engine()
    if active_engine.dialect.name != "sqlite":
        raise RuntimeError("reset_db is only available for local SQLite databases")
    with active_engine.begin() as connection:
        connection.execute(delete(uploaded_images))
        connection.execute(delete(friendships))
        connection.execute(delete(profiles))
        connection.execute(delete(progress_claims))
        connection.execute(delete(topic_progress))
        connection.execute(delete(student_progress))
