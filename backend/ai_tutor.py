from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Override in Vercel when you want to pin a specific fast model. Auto keeps broad subject coverage.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/auto")
OPENROUTER_TIMEOUT = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "12"))


class AITutorError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _client() -> httpx.Client:
    # Reuse TCP/TLS connections instead of creating a new client for every quiz action.
    return httpx.Client(
        timeout=httpx.Timeout(OPENROUTER_TIMEOUT, connect=4.0),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50, keepalive_expiry=30.0),
        http2=True,
    )


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


def _chat_json(
    *,
    system_prompt: str,
    data: dict[str, Any],
    temperature: float,
    max_tokens: int,
) -> dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise AITutorError("OPENROUTER_API_KEY is not configured")

    payload = {
        "model": OPENROUTER_MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        # User-facing study actions care much more about responsiveness than cheapest routing.
        "provider": {"sort": "latency", "allow_fallbacks": True},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(data, ensure_ascii=False, separators=(",", ":"))},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "bindit",
    }

    try:
        response = _client().post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise AITutorError("OpenRouter request failed") from exc

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise AITutorError("OpenRouter returned an unexpected response") from exc
    return _extract_json(content)


def generate_question(*, course: str, unit: str, source_labels: list[str], focus: str, difficulty: int, personalization: dict[str, Any]) -> dict[str, str]:
    system_prompt = (
        "You are Bindit's fast expert quiz writer for any school subject. Create ONE excellent, concise short-answer question "
        "for the course/unit. Test useful knowledge or reasoning, not trivia. Personalize from performance: reinforce weak areas "
        "and challenge strong students. Difficulty: 1 foundational, 2 standard, 3 challenge. Ignore an irrelevant math focus. "
        "Filenames are hints only; never pretend you read them. Keep the reference answer concise and accept equivalent wording. "
        "Return ONLY JSON: {\"question\":string,\"correct_answer\":string,\"topic\":string}."
    )
    result = _chat_json(system_prompt=system_prompt, temperature=0.4, max_tokens=220, data={
        "course": course or "General Studies", "unit": unit or "Current Unit", "sources": source_labels[:10],
        "focus": focus, "difficulty": difficulty, "performance": personalization,
    })
    required = {"question", "correct_answer", "topic"}
    if set(result.keys()) != required or not all(isinstance(result[key], str) and result[key].strip() for key in required):
        raise AITutorError("AI question response did not match the required schema")
    return {key: result[key].strip() for key in required}


def generate_flashcards(*, course: str, unit: str, source_labels: list[str], count: int, personalization: dict[str, Any]) -> list[dict[str, str]]:
    system_prompt = (
        "You are Bindit's expert flashcard writer for any school subject. Make high-value retrieval-practice cards covering core "
        "ideas, vocabulary, formulas, cause/effect, applications, and misconceptions. Spend more cards on weak areas and make "
        "strong students apply ideas. Avoid duplicates/trivia. Filenames are hints only. Keep backs concise. "
        "Return ONLY JSON {\"cards\":[{\"front\":string,\"back\":string,\"topic\":string}]}."
    )
    requested = max(3, min(30, count))
    result = _chat_json(system_prompt=system_prompt, temperature=0.35, max_tokens=min(1800, 110 * requested), data={
        "course": course or "General Studies", "unit": unit or "Current Unit", "sources": source_labels[:10],
        "count": requested, "performance": personalization,
    })
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
    return cards[:requested]


def grade_answer(*, question: str, correct_answer: str, student_answer: str, topic: str, difficulty: int) -> dict[str, Any]:
    system_prompt = (
        "You are Bindit's fast school tutor/grader. Use the reference answer as a rubric; accept equivalent wording and meaningful "
        "partial credit. Exact-answer math uses the reference as ground truth. Be conservative about fully correct. If wrong, give "
        "a brief explanation, likely misconception, and a useful hint without giving everything away. Be concise. Return ONLY JSON "
        "with keys correct:boolean, score:0-100 integer, mistake_type:string|null, explanation:string, hint:string|null, misconception:string|null."
    )
    result = _chat_json(system_prompt=system_prompt, temperature=0.05, max_tokens=260, data={
        "topic": topic, "difficulty": difficulty, "question": question,
        "reference": correct_answer, "answer": student_answer,
    })
    required = {"correct", "score", "mistake_type", "explanation", "hint", "misconception"}
    if set(result.keys()) != required or not isinstance(result["correct"], bool):
        raise AITutorError("AI response did not match the required schema")
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
