# Pocket Tutor Backend

This service connects the student experience, tutor logic, and progress dashboard through one API.

## Start locally

1. Open a terminal in this folder: `cd backend`
2. Create an environment: `python3 -m venv venv`
3. Activate it: `source venv/bin/activate`
4. Install packages: `pip install -r requirements.txt`
5. Start the API: `uvicorn main:app --reload`

API: http://127.0.0.1:8000
Interactive docs: http://127.0.0.1:8000/docs

## Frontend connection

Use `http://127.0.0.1:8000` as the API base URL. The Vite app in `frontend/` proxies `/api` to this server. CORS also allows localhost:3000 and localhost:5173.

## API contract

### Generate a question

`POST /generate-question`

Request: `{"topic":"mixed","difficulty":1}`

Returns `question`, `correct_answer`, `topic`, and `difficulty`. Topics are addition, subtraction, multiplication, division, or mixed. Difficulty is 1 to 3.

### Analyze an answer

`POST /analyze-answer`

Request: `{"question":"What is 2 + 2?","student_answer":"4","correct_answer":"4","student_id":"student-123","topic":"addition"}`

Returns correctness, mistake type, explanation, hint, XP earned, total XP, and streak.

### Read progress

`GET /progress/{student_id}`

Returns XP, attempts, accuracy, streaks, and weak topics.

### Health check

`GET /health` returns service status.

## Verify changes

Run `python -m unittest -v test_main.py`.

## Current limitation

Progress is stored in memory and resets whenever the backend restarts. Use a shared database before production deployment.
