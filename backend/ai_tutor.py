from __future__ import annotations

import json
import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/auto")


class AITutorError(RuntimeError):
    pass


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AITutorError("AI returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise AITutorError("AI returned an invalid response shape")
    return data


def _chat_json(*, system_prompt: str, data: dict[str, Any], temperature: float) -> dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise AITutorError("OPENROUTER_API_KEY is not configured")

    payload = {
        "model": OPENROUTER_MODEL,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(data, ensure_ascii=False)},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "bindit",
    }

    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.post(OPENROUTER_URL, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise AITutorError("OpenRouter request failed") from exc

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise AITutorError("OpenRouter returned an unexpected response") from exc
    return _extract_json(content)


def generate_question(
    *,
    course: str,
    unit: str,
    source_labels: list[str],
    focus: str,
    difficulty: int,
    personalization: dict[str, Any],
) -> dict[str, str]:
    system_prompt = (
        "You are Bindit's expert quiz writer for school learning. You can create high-quality quizzes "
        "for any normal school subject, including mathematics, biology, chemistry, physics, history, "
        "social studies, English, literature, writing, languages, economics, computer science, and similar courses. "
        "Create ONE clear short-answer question suitable for the stated course and unit. The question must test real "
        "subject knowledge, never app metadata. Mix recall, application, conceptual understanding, and reasoning. "
        "Personalize difficulty using the supplied performance data: reinforce weak areas, increase challenge when the "
        "student is consistently strong, and avoid making the question needlessly difficult. The requested difficulty "
        "is 1=foundational, 2=standard, 3=challenge. The 'focus' field is only a preference; if it is a math-operation "
        "label that does not fit the course/unit, ignore it. Source labels are filenames only, not file contents. Never "
        "invent facts from a filename or pretend you read the file. You may use a descriptive filename only as a topic hint. "
        "Write a concise reference answer that can be used as a grading rubric and accepts equivalent correct wording. "
        "Return ONLY valid JSON with exactly these keys: question, correct_answer, topic."
    )
    result = _chat_json(
        system_prompt=system_prompt,
        temperature=0.55,
        data={
            "course": course or "General Studies",
            "unit": unit or "Current Unit",
            "source_labels": source_labels[:20],
            "focus": focus,
            "difficulty": difficulty,
            "student_performance": personalization,
        },
    )
    required = {"question", "correct_answer", "topic"}
    if set(result.keys()) != required or not all(isinstance(result[key], str) and result[key].strip() for key in required):
        raise AITutorError("AI question response did not match the required schema")
    return {key: result[key].strip() for key in required}


def generate_flashcards(
    *,
    course: str,
    unit: str,
    source_labels: list[str],
    count: int,
    personalization: dict[str, Any],
) -> list[dict[str, str]]:
    system_prompt = (
        "You are Bindit's expert flashcard writer for students. Create a compact, high-value flashcard deck for any school "
        "subject: math, science, history, English, literature, languages, economics, computer science, and similar courses. "
        "Cards should prioritize the most important ideas, vocabulary, formulas, cause/effect relationships, examples, and "
        "common misconceptions for the stated course and unit. Personalize the deck using student performance: spend more "
        "cards on weak areas, include retrieval practice from previously weak concepts, and use harder application cards when "
        "the student is strong. Avoid duplicates and trivia. Fronts must be clear prompts; backs must be concise teaching answers. "
        "Source labels are filenames only, not file contents: never claim to know facts from a file you have not actually read. "
        "Return ONLY valid JSON with exactly one key, cards. cards must be an array of objects with exactly: front, back, topic."
    )
    result = _chat_json(
        system_prompt=system_prompt,
        temperature=0.45,
        data={
            "course": course or "General Studies",
            "unit": unit or "Current Unit",
            "source_labels": source_labels[:20],
            "count": max(3, min(30, count)),
            "student_performance": personalization,
        },
    )
    if set(result.keys()) != {"cards"} or not isinstance(result["cards"], list):
        raise AITutorError("AI flashcard response did not match the required schema")

    cards: list[dict[str, str]] = []
    for raw in result["cards"]:
        if not isinstance(raw, dict) or set(raw.keys()) != {"front", "back", "topic"}:
            raise AITutorError("AI returned an invalid flashcard")
        if not all(isinstance(raw[key], str) and raw[key].strip() for key in ("front", "back", "topic")):
            raise AITutorError("AI returned an empty flashcard field")
        cards.append({key: raw[key].strip() for key in ("front", "back", "topic")})

    if len(cards) < 3:
        raise AITutorError("AI returned too few flashcards")
    return cards[: max(3, min(30, count))]


def grade_answer(
    *,
    question: str,
    correct_answer: str,
    student_answer: str,
    topic: str,
    difficulty: int,
) -> dict[str, Any]:
    system_prompt = (
        "You are Bindit's tutoring and grading engine for all school subjects. Grade student work carefully and teach, "
        "not just judge. Treat the supplied correct_answer as a reference answer or rubric, not necessarily wording that "
        "must be copied exactly. Accept semantically equivalent answers and award meaningful partial credit for answers "
        "that show some correct reasoning. For exact-answer math, the supplied correct answer is ground truth. Be conservative "
        "about marking an answer fully correct. If the answer is wrong or incomplete, identify the likely misconception and "
        "give a useful hint without immediately giving away the whole answer. Return ONLY valid JSON with exactly these keys: "
        "correct (boolean), score (integer 0-100), mistake_type (string or null), explanation (short, student-friendly string), "
        "hint (string or null), misconception (string or null)."
    )
    result = _chat_json(
        system_prompt=system_prompt,
        temperature=0.15,
        data={
            "topic": topic,
            "difficulty": difficulty,
            "question": question,
            "correct_answer": correct_answer,
            "student_answer": student_answer,
        },
    )
    required = {"correct", "score", "mistake_type", "explanation", "hint", "misconception"}
    if set(result.keys()) != required:
        raise AITutorError("AI response did not match the required schema")

    if not isinstance(result["correct"], bool):
        raise AITutorError("AI returned an invalid correct value")
    try:
        result["score"] = max(0, min(100, int(result["score"])))
    except (TypeError, ValueError) as exc:
        raise AITutorError("AI returned an invalid score") from exc

    for key in ("mistake_type", "explanation", "hint", "misconception"):
        if result[key] is not None and not isinstance(result[key], str):
            raise AITutorError(f"AI returned invalid {key}")
    if not result["explanation"]:
        raise AITutorError("AI returned an empty explanation")

    return result
