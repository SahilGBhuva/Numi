from __future__ import annotations

import json
import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "~openai/gpt-sol-latest")


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


def grade_answer(
    *,
    question: str,
    correct_answer: str,
    student_answer: str,
    topic: str,
    difficulty: int,
) -> dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise AITutorError("OPENROUTER_API_KEY is not configured")

    system_prompt = (
        "You are Bindit's tutoring and grading engine. Grade student work carefully and teach, "
        "not just judge. Return ONLY valid JSON with exactly these keys: "
        "correct (boolean), score (integer 0-100), mistake_type (string or null), "
        "explanation (short, student-friendly string), hint (string or null), "
        "misconception (string or null). Be conservative about marking an answer correct. "
        "For exact-answer math, use the supplied correct answer as ground truth. "
        "If the student's answer is wrong, explain the likely issue without revealing more than needed."
    )

    user_prompt = json.dumps(
        {
            "topic": topic,
            "difficulty": difficulty,
            "question": question,
            "correct_answer": correct_answer,
            "student_answer": student_answer,
        },
        ensure_ascii=False,
    )

    payload = {
        "model": OPENROUTER_MODEL,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "bindit",
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(OPENROUTER_URL, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise AITutorError("OpenRouter request failed") from exc

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise AITutorError("OpenRouter returned an unexpected response") from exc

    result = _extract_json(content)
    required = {"correct", "score", "mistake_type", "explanation", "hint", "misconception"}
    if set(result.keys()) != required:
        raise AITutorError("AI response did not match the required schema")

    result["correct"] = bool(result["correct"])
    try:
        result["score"] = max(0, min(100, int(result["score"])))
    except (TypeError, ValueError) as exc:
        raise AITutorError("AI returned an invalid score") from exc

    for key in ("mistake_type", "explanation", "hint", "misconception"):
        if result[key] is not None and not isinstance(result[key], str):
            raise AITutorError(f"AI returned invalid {key}")

    return result
