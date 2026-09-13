from __future__ import annotations

import random
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import database
import storage

app = FastAPI(
    title="Bindit API",
    version="0.3.0",
    description="Math practice, accounts, and lightweight progress tracking.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Topic = Literal["addition", "subtraction", "multiplication", "division", "mixed"]


class AnswerRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    student_answer: str = Field(max_length=200)
    correct_answer: str = Field(min_length=1, max_length=200)
    student_id: str = Field(default="anonymous", min_length=1, max_length=100)
    topic: str = Field(default="general", max_length=50)


class AnswerResponse(BaseModel):
    correct: bool
    mistake_type: str | None
    explanation: str
    hint: str | None
    xp_earned: int
    total_xp: int
    streak: int


class NoteContext(BaseModel):
    course: str = ""
    unit: str = ""
    files: list[str] = Field(default_factory=list)
    other_units: list[str] = Field(default_factory=list)
    other_courses: list[str] = Field(default_factory=list)


class QuestionRequest(BaseModel):
    topic: Topic = "mixed"
    difficulty: int = Field(default=1, ge=1, le=3)
    notes: NoteContext | None = None


class QuestionResponse(BaseModel):
    question: str
    correct_answer: str
    topic: str
    difficulty: int


class TopicStat(BaseModel):
    topic: str
    attempts: int
    correct_answers: int
    accuracy: float


class ProgressResponse(BaseModel):
    student_id: str
    total_xp: int
    attempts: int
    correct_answers: int
    accuracy: float
    streak: int
    best_streak: int
    login_streak: int = 0
    best_login_streak: int = 0
    weak_topics: list[str]
    topics: list[TopicStat] = Field(default_factory=list)


class AccountProfileUpdate(BaseModel):
    username: str = Field(pattern=r"^[a-z0-9_]{3,24}$")
    display_name: str = Field(min_length=1, max_length=40)
    guest_id: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_path: str | None = Field(default=None, max_length=500)
    daily_goal: int | None = Field(default=None)


class ProfileResponse(BaseModel):
    student_id: str
    username: str
    display_name: str
    avatar_path: str = ""
    friend_code: str
    daily_goal: int = 20
    total_xp: int = 0
    streak: int = 0
    best_streak: int = 0
    login_streak: int = 0
    best_login_streak: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AccountResponse(BaseModel):
    id: str
    email: str | None = None


class AuthConfigResponse(BaseModel):
    supabase_url: str
    supabase_anon_key: str


class FriendRequestCreate(BaseModel):
    friend_code: str = Field(min_length=4, max_length=12)


class FriendRequestDecision(BaseModel):
    accept: bool


class FriendQuestCreate(BaseModel):
    friend_id: str = Field(min_length=1, max_length=100)
    target_xp: int = Field(default=100, ge=50, le=1000)


def normalize_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def parse_number(value: str) -> Decimal | None:
    cleaned = value.strip().replace(",", "")
    if cleaned.endswith("%"):
        cleaned = cleaned[:-1].strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def truthy_alias(value: str) -> str:
    aliases = {"yes": "true", "y": "true", "true": "true", "no": "false", "n": "false", "false": "false"}
    return aliases.get(normalize_text(value), normalize_text(value))


def file_stem(value: str) -> str:
    text = normalize_text(value)
    if "." in text:
        return text.rsplit(".", 1)[0]
    return text


def answers_match(student_answer: str, correct_answer: str) -> bool:
    student_number = parse_number(student_answer)
    correct_number = parse_number(correct_answer)
    if student_number is not None and correct_number is not None:
        return student_number == correct_number
    if truthy_alias(student_answer) == truthy_alias(correct_answer):
        return True
    if file_stem(student_answer) == file_stem(correct_answer) and file_stem(correct_answer):
        return True
    return normalize_text(student_answer) == normalize_text(correct_answer)


def classify_mistake(student_answer: str, correct_answer: str) -> str:
    if not student_answer.strip():
        return "blank_answer"

    student_number = parse_number(student_answer)
    correct_number = parse_number(correct_answer)
    if student_number is not None and correct_number is not None:
        if student_number == -correct_number:
            return "sign_error"
        if abs(student_number - correct_number) == 1:
            return "off_by_one"
        if correct_number != 0 and student_number * 10 == correct_number:
            return "place_value_error"
        if correct_number != 0 and student_number == correct_number * 10:
            return "place_value_error"
        return "calculation_error"

    return "concept_or_format_error"


def make_hint(question: str, mistake_type: str) -> str:
    hints = {
        "blank_answer": "Start by writing down the numbers and the operation the question asks for.",
        "sign_error": "Check whether the result should be positive or negative.",
        "off_by_one": "Recount once carefully; your answer is only one away.",
        "place_value_error": "Check the decimal point and each number's place value.",
        "calculation_error": "Break the calculation into smaller steps and check each one.",
        "concept_or_format_error": "Try expressing the answer as a single number or a simpler equivalent form.",
    }
    lowered = question.lower()
    if any(word in lowered for word in ("notes", "unit", "course", "file", "deposited")):
        return "Look at the notes you deposited in this unit — the file names, course, and unit are the answers."
    base_hint = hints[mistake_type]
    if "/" in question or "divide" in lowered:
        return base_hint + " Remember: division asks how many equal groups can be made."
    if "*" in question or "×" in question:
        return base_hint + " You can check multiplication with repeated addition."
    return base_hint


def update_progress(student_id: str, topic: str, correct: bool, xp: int) -> dict:
    return database.update_progress(student_id, topic, correct, xp)


def number_range(difficulty: int) -> tuple[int, int]:
    return {1: (1, 10), 2: (10, 50), 3: (25, 150)}[difficulty]


def generate_math_question(topic: Topic, difficulty: int) -> QuestionResponse:
    chosen_topic = random.choice(["addition", "subtraction", "multiplication", "division"]) if topic == "mixed" else topic
    low, high = number_range(difficulty)

    if chosen_topic == "addition":
        a, b = random.randint(low, high), random.randint(low, high)
        question, answer = f"What is {a} + {b}?", a + b
    elif chosen_topic == "subtraction":
        a, b = random.randint(low, high), random.randint(low, high)
        a, b = max(a, b), min(a, b)
        question, answer = f"What is {a} - {b}?", a - b
    elif chosen_topic == "multiplication":
        upper = {1: 10, 2: 15, 3: 25}[difficulty]
        a, b = random.randint(2, upper), random.randint(2, upper)
        question, answer = f"What is {a} × {b}?", a * b
    else:
        divisor = random.randint(2, {1: 10, 2: 15, 3: 25}[difficulty])
        answer = random.randint(2, {1: 10, 2: 20, 3: 40}[difficulty])
        dividend = divisor * answer
        question = f"What is {dividend} ÷ {divisor}?"

    return QuestionResponse(
        question=question,
        correct_answer=str(answer),
        topic=chosen_topic,
        difficulty=difficulty,
    )


def generate_notes_question(notes: NoteContext, difficulty: int) -> QuestionResponse:
    files = [name.strip() for name in notes.files if name.strip()]
    if not files:
        return generate_math_question("mixed", difficulty)

    file_name = random.choice(files)
    unit = notes.unit.strip() or "this unit"
    course = notes.course.strip() or "this course"
    other_units = [name for name in notes.other_units if name.strip() and name.strip() != unit]
    other_courses = [name for name in notes.other_courses if name.strip() and name.strip() != course]

    pool: list[tuple[str, str]] = [
        (f'Which unit holds the notes file “{file_name}”?', unit),
        (f'Which course are the notes “{file_name}” saved in?', course),
        (f'How many note files are deposited in {unit}?', str(len(files))),
        (f'Is “{file_name}” deposited in {unit}? (yes/no)', "yes"),
        (f'Type the name of a notes file in {unit}.', file_name),
    ]
    if other_units:
        wrong_unit = random.choice(other_units)
        pool.append((f'Are the notes “{file_name}” in {wrong_unit}? (yes/no)', "no"))
    if other_courses:
        wrong_course = random.choice(other_courses)
        pool.append((f'Are the notes “{file_name}” from {wrong_course}? (yes/no)', "no"))
    if len(files) > 1 and difficulty >= 2:
        pool.append((f'How many notes besides “{file_name}” are in {unit}?', str(len(files) - 1)))

    question, answer = random.choice(pool)
    return QuestionResponse(question=question, correct_answer=str(answer), topic=unit, difficulty=difficulty)


@app.get("/")
def home():
    return {
        "message": "Bindit backend is running",
        "version": app.version,
        "docs": "/docs",
    }


@app.get("/api/health")
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "healthy"}


def current_account(authorization: str | None) -> dict:
    return storage.authenticated_user(authorization)


def social_error(error: ValueError) -> HTTPException:
    messages = {
        "username_taken": (409, "That username is already taken"),
        "invalid_daily_goal": (400, "Pick a daily goal of 10, 20, 30, or 50 XP"),
        "friend_not_found": (404, "No learner was found with that friend code"),
        "cannot_friend_self": (400, "You cannot add yourself"),
        "friendship_exists": (409, "You are already friends or a request is pending"),
        "profile_not_found": (400, "Finish setting up your profile first"),
        "request_not_found": (404, "Friend request not found"),
        "request_already_answered": (409, "That friend request was already answered"),
        "invalid_quest_target": (400, "Friend quests must be between 50 and 1000 XP"),
    }
    status, message = messages.get(str(error), (400, "Could not update that profile"))
    return HTTPException(status_code=status, detail=message)


@app.get("/api/auth/me", response_model=AccountResponse)
def get_current_account(authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    return {"id": user["id"], "email": user.get("email")}


@app.get("/api/auth/config", response_model=AuthConfigResponse)
def get_auth_config():
    url, anon_key = storage.public_settings()
    return {"supabase_url": url, "supabase_anon_key": anon_key}


def _topic_stats(record: dict) -> list[TopicStat]:
    stats: list[TopicStat] = []
    for topic, row in record.get("topics", {}).items():
        attempts = row["attempts"]
        correct = row["correct"]
        accuracy = round(correct / attempts * 100, 1) if attempts else 0.0
        stats.append(TopicStat(topic=topic, attempts=attempts, correct_answers=correct, accuracy=accuracy))
    stats.sort(key=lambda item: (-item.attempts, item.topic.lower()))
    return stats


@app.get("/api/account/profile", response_model=ProfileResponse)
def get_account_profile(authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    database.record_daily_login(user["id"])
    profile = database.get_profile(user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Finish setting up your profile")
    progress = database.get_progress(user["id"])
    if progress:
        profile["login_streak"] = progress.get("login_streak", 0)
        profile["best_login_streak"] = progress.get("best_login_streak", 0)
    return profile


@app.put("/api/account/profile", response_model=ProfileResponse)
def update_account_profile(
    data: AccountProfileUpdate,
    authorization: Annotated[str | None, Header()] = None,
):
    user = current_account(authorization)
    try:
        return database.onboard_account(
            user["id"],
            data.username,
            data.display_name.strip(),
            data.guest_id,
            data.avatar_path,
            data.daily_goal,
        )
    except ValueError as error:
        raise social_error(error) from error


@app.get("/api/friends")
def get_friends(authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    return {
        "friends": database.list_friends(user["id"]),
        "requests": database.pending_friend_requests(user["id"]),
        "leaderboard": database.friend_leaderboard(user["id"]),
        "quests": database.active_friend_quests(user["id"]),
    }


@app.post("/api/friends/requests", status_code=201)
def create_friend_request(data: FriendRequestCreate, authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    try:
        return database.send_friend_request(user["id"], data.friend_code.strip())
    except ValueError as error:
        raise social_error(error) from error


@app.post("/api/friends/requests/{request_id}")
def decide_friend_request(request_id: int, data: FriendRequestDecision, authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    try:
        return database.respond_to_friend_request(request_id, user["id"], data.accept)
    except ValueError as error:
        raise social_error(error) from error


@app.delete("/api/friends/{friend_id}")
def delete_friend(friend_id: str, authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    if not database.remove_friend(user["id"], friend_id):
        raise HTTPException(status_code=404, detail="Friend not found")
    return {"deleted": True}


@app.post("/api/friend-quests", status_code=201)
def start_friend_quest(data: FriendQuestCreate, authorization: Annotated[str | None, Header()] = None):
    user = current_account(authorization)
    try:
        return database.create_friend_quest(user["id"], data.friend_id, data.target_xp)
    except ValueError as error:
        raise social_error(error) from error


@app.post("/api/analyze-answer", response_model=AnswerResponse)
@app.post("/analyze-answer", response_model=AnswerResponse, include_in_schema=False)
def analyze_answer(data: AnswerRequest, authorization: Annotated[str | None, Header()] = None):
    student_id = data.student_id
    if authorization:
        student_id = current_account(authorization)["id"]
    correct = answers_match(data.student_answer, data.correct_answer)
    mistake_type = None if correct else classify_mistake(data.student_answer, data.correct_answer)
    xp = 10 if correct else 0
    record = update_progress(student_id, data.topic, correct, xp)

    return AnswerResponse(
        correct=correct,
        mistake_type=mistake_type,
        explanation="Correct! Great work." if correct else "That answer is not correct yet. Use the hint and try again.",
        hint=None if correct else make_hint(data.question, mistake_type),
        xp_earned=xp,
        total_xp=record["total_xp"],
        streak=record["streak"],
    )


@app.post("/api/generate-question", response_model=QuestionResponse)
@app.post("/generate-question", response_model=QuestionResponse, include_in_schema=False)
def generate_question(data: QuestionRequest):
    if data.notes and data.notes.files:
        return generate_notes_question(data.notes, data.difficulty)
    return generate_math_question(data.topic, data.difficulty)


@app.get("/api/progress/{student_id}", response_model=ProgressResponse)
@app.get("/progress/{student_id}", response_model=ProgressResponse, include_in_schema=False)
def get_progress(student_id: str, authorization: Annotated[str | None, Header()] = None):
    if authorization and current_account(authorization)["id"] != student_id:
        raise HTTPException(status_code=403, detail="You can only view your own progress")
    record = database.get_progress(student_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No progress found for this student")
    accuracy = round(record["correct_answers"] / record["attempts"] * 100, 1) if record["attempts"] else 0.0
    weak_topics = [
        topic
        for topic, stats in record["topics"].items()
        if stats["attempts"] >= 2 and stats["correct"] / stats["attempts"] < 0.6
    ]

    return ProgressResponse(
        student_id=student_id,
        total_xp=record["total_xp"],
        attempts=record["attempts"],
        correct_answers=record["correct_answers"],
        accuracy=accuracy,
        streak=record["streak"],
        best_streak=record["best_streak"],
        login_streak=record.get("login_streak", 0),
        best_login_streak=record.get("best_login_streak", 0),
        weak_topics=weak_topics,
        topics=_topic_stats(record),
    )


class DailyLoginRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)


@app.post("/api/daily-login", response_model=ProgressResponse)
@app.post("/daily-login", response_model=ProgressResponse, include_in_schema=False)
def daily_login(data: DailyLoginRequest, authorization: Annotated[str | None, Header()] = None):
    student_id = data.student_id
    if authorization:
        student_id = current_account(authorization)["id"]
    record = database.record_daily_login(student_id)
    accuracy = round(record["correct_answers"] / record["attempts"] * 100, 1) if record["attempts"] else 0.0
    weak_topics = [
        topic
        for topic, stats in record["topics"].items()
        if stats["attempts"] >= 2 and stats["correct"] / stats["attempts"] < 0.6
    ]
    return ProgressResponse(
        student_id=student_id,
        total_xp=record["total_xp"],
        attempts=record["attempts"],
        correct_answers=record["correct_answers"],
        accuracy=accuracy,
        streak=record["streak"],
        best_streak=record["best_streak"],
        login_streak=record.get("login_streak", 0),
        best_login_streak=record.get("best_login_streak", 0),
        weak_topics=weak_topics,
        topics=_topic_stats(record),
    )
