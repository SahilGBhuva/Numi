from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Speed-first defaults for interactive study actions. These can still be overridden in Vercel.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash-lite")
OPENROUTER_VISION_MODEL = os.getenv("OPENROUTER_VISION_MODEL", "google/gemini-2.5-flash-lite")
OPENROUTER_TIMEOUT = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "6.5"))
OPENROUTER_VISION_TIMEOUT = float(os.getenv("OPENROUTER_VISION_TIMEOUT_SECONDS", "6.5"))


class AITutorError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _client() -> httpx.Client:
    # Keep one HTTP/2 connection pool alive inside each warm server instance.
    return httpx.Client(
        timeout=httpx.Timeout(OPENROUTER_TIMEOUT, connect=2.5),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50, keepalive_expiry=60.0),
        http2=True,
    )


def _headers() -> dict[str, str]:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise AITutorError("OPENROUTER_API_KEY is not configured")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "bindit",
    }


def _routing() -> dict[str, Any]:
    # Favor low time-to-first-token while avoiding slow-throughput endpoints.
    return {
        "sort": "latency",
        "preferred_max_latency": 1.5,
        "preferred_min_throughput": 100,
        "allow_fallbacks": True,
    }


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


def _post(payload: dict[str, Any], *, timeout: float | None = None) -> dict[str, Any]:
    try:
        response = _client().post(
            OPENROUTER_URL,
            headers=_headers(),
            json=payload,
            timeout=timeout or OPENROUTER_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise AITutorError("OpenRouter request failed") from exc


def _chat_json(*, system_prompt: str, data: dict[str, Any], temperature: float, max_tokens: int) -> dict[str, Any]:
    payload = {
        "model": OPENROUTER_MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "reasoning": {"effort": "none"},
        "response_format": {"type": "json_object"},
        "provider": _routing(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(data, ensure_ascii=False, separators=(",", ":"))},
        ],
    }
    try:
        content = _post(payload)["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AITutorError("OpenRouter returned an unexpected response") from exc
    return _extract_json(content)


def extract_image_notes(*, image_bytes: bytes, content_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": OPENROUTER_VISION_MODEL,
        "temperature": 0,
        "max_tokens": 900,
        "reasoning": {"effort": "none"},
        "provider": _routing(),
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Read this study-note image quickly and accurately. Return only useful readable educational text: headings, facts, equations, labels, and diagram relationships. Preserve meaning, skip decoration, never guess unreadable text.",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{content_type};base64,{encoded}"},
                },
            ],
        }],
    }
    try:
        text = _post(payload, timeout=OPENROUTER_VISION_TIMEOUT)["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AITutorError("Vision model returned an unexpected response") from exc
    if not text:
        raise AITutorError("No readable notes were found in that image")
    return text[:120000]


def extract_pdf_notes(*, pdf_bytes: bytes) -> str:
    encoded = base64.b64encode(pdf_bytes).decode("ascii")
    payload = {
        "model": OPENROUTER_VISION_MODEL,
        "temperature": 0,
        "max_tokens": 1400,
        "reasoning": {"effort": "none"},
        "provider": _routing(),
        "plugins": [{"id": "file-parser", "pdf": {"engine": "mistral-ocr"}}],
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "Read this scanned study PDF. Return only useful readable educational text; never guess unreadable content."},
                {"type": "file", "file": {"filename": "notes.pdf", "file_data": f"data:application/pdf;base64,{encoded}"}},
            ],
        }],
    }
    try:
        text = _post(payload, timeout=max(OPENROUTER_VISION_TIMEOUT, 9))["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AITutorError("PDF OCR returned an unexpected response") from exc
    if not text:
        raise AITutorError("No readable notes were found in that PDF")
    return text[:120000]


def generate_question(
    *,
    course: str,
    unit: str,
    source_labels: list[str],
    focus: str,
    difficulty: int,
    personalization: dict[str, Any],
    source_text: str = "",
) -> dict[str, str]:
    grounded = bool(source_text.strip())
    prompt = (
        "Create ONE concise student short-answer question and a concise grading answer. "
        + (
            "Use only the supplied note excerpt as factual ground truth. "
            if grounded
            else "Use normal course/unit knowledge. "
        )
        + "Match difficulty and student performance. Return only JSON with question, correct_answer, topic."
    )
    result = _chat_json(
        system_prompt=prompt,
        temperature=0.25,
        max_tokens=130,
        data={
            "course": course or "General Studies",
            "unit": unit or "Current Unit",
            "sources": source_labels[:6],
            "notes": source_text[:8000] if grounded else "",
            "focus": focus,
            "difficulty": difficulty,
            "performance": personalization,
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
    source_text: str = "",
) -> list[dict[str, str]]:
    grounded = bool(source_text.strip())
    requested = max(3, min(30, count))
    prompt = (
        "Create high-value, concise retrieval-practice flashcards. Avoid duplicates and trivia. "
        + ("Use only the supplied notes as factual ground truth. " if grounded else "Use normal course/unit knowledge. ")
        + "Return only JSON with cards, each containing front, back, topic."
    )
    result = _chat_json(
        system_prompt=prompt,
        temperature=0.25,
        max_tokens=min(1200, 80 * requested),
        data={
            "course": course or "General Studies",
            "unit": unit or "Current Unit",
            "sources": source_labels[:6],
            "notes": source_text[:8000] if grounded else "",
            "count": requested,
            "performance": personalization,
        },
    )
    if set(result.keys()) != {"cards"} or not isinstance(result["cards"], list):
        raise AITutorError("AI flashcard response did not match the required schema")
    cards: list[dict[str, str]] = []
    for raw in result["cards"]:
        if (
            not isinstance(raw, dict)
            or set(raw.keys()) != {"front", "back", "topic"}
            or not all(isinstance(raw.get(key), str) and raw[key].strip() for key in ("front", "back", "topic"))
        ):
            raise AITutorError("AI returned an invalid flashcard")
        cards.append({key: raw[key].strip() for key in ("front", "back", "topic")})
    if len(cards) < 3:
        raise AITutorError("AI returned too few flashcards")
    return cards[:requested]


def grade_answer(*, question: str, correct_answer: str, student_answer: str, topic: str, difficulty: int) -> dict[str, Any]:
    prompt = (
        "Grade this student answer quickly. Accept equivalent wording and meaningful partial credit. "
        "Keep explanation and hint very short. Return only JSON with correct, score, mistake_type, explanation, hint, misconception."
    )
    result = _chat_json(
        system_prompt=prompt,
        temperature=0,
        max_tokens=160,
        data={
            "topic": topic,
            "difficulty": difficulty,
            "question": question,
            "reference": correct_answer,
            "answer": student_answer,
        },
    )
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
