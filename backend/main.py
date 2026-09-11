from __future__ import annotations

import random
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import database

app = FastAPI(
    title="Pocket Tutor API",
    version="0.2.0",
    description="Math practice, feedback, hints, and lightweight progress tracking.",
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


class ProgressResponse(BaseModel):
    student_id: str
    total_xp: int
    attempts: int
    correct_answers: int
    accuracy: float
    streak: int
    best_streak: int
    weak_topics: list[str]


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
    return QuestionResponse(question=question, correct_answer=str(answer), topic="notes", difficulty=difficulty)


@app.get("/")
def home():
    return {
        "message": "Pocket Tutor backend is running",
        "version": app.version,
        "docs": "/docs",
    }


@app.get("/api/health")
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "healthy"}


@app.post("/api/analyze-answer", response_model=AnswerResponse)
@app.post("/analyze-answer", response_model=AnswerResponse, include_in_schema=False)
def analyze_answer(data: AnswerRequest):
    correct = answers_match(data.student_answer, data.correct_answer)
    mistake_type = None if correct else classify_mistake(data.student_answer, data.correct_answer)
    xp = 10 if correct else 0
    record = update_progress(data.student_id, data.topic, correct, xp)

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
def get_progress(student_id: str):
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
        weak_topics=weak_topics,
    )
