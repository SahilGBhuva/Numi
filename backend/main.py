from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class AnswerRequest(BaseModel):
    question: str
    student_answer: str
    correct_answer: str


@app.get("/")
def home():
    return {"message": "GameMath backend is running"}


@app.post("/analyze-answer")
def analyze_answer(data: AnswerRequest):
    is_correct = (
        data.student_answer.strip().lower()
        == data.correct_answer.strip().lower()
    )

    if is_correct:
        return {
            "correct": True,
            "mistake_type": None,
            "explanation": "Correct!",
            "xp_earned": 10
        }

    return {
        "correct": False,
        "mistake_type": "unknown",
        "explanation": "That answer is incorrect. Review the problem and try again.",
        "xp_earned": 0
    }