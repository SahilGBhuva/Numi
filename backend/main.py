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


class QuestionRequest(BaseModel):
    topic: Topic = "mixed"
    difficulty: int = Field(default=1, ge=1, le=3)


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


def answers_match(student_answer: str, correct_answer: str) -> bool:
    student_number = parse_number(student_answer)
    correct_number = parse_number(correct_answer)
    if student_number is not None and correct_number is not None:
        return student_number == correct_number
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
    base_hint = hints[mistake_type]
    if "/" in question or "divide" in question.lower():
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


@app.get("/")
def home():
    return {
        "message": "Pocket Tutor backend is running",
        "version": app.version,
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/analyze-answer", response_model=AnswerResponse)
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


@app.post("/generate-question", response_model=QuestionResponse)
def generate_question(data: QuestionRequest):
    return generate_math_question(data.topic, data.difficulty)


@app.get("/progress/{student_id}", response_model=ProgressResponse)
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
