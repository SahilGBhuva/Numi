# bindet Backend

This service connects the bindet student experience, learning logic, authentication, and progress tracking through one API.

## Start locally

1. Open a terminal in this folder: `cd backend`
2. Create an environment: `python3 -m venv venv`
3. Activate it: `source venv/bin/activate`
4. Install packages: `pip install -r requirements.txt`
5. Start the API: `uvicorn main:app --reload`

API: http://127.0.0.1:8000
Interactive docs: http://127.0.0.1:8000/docs

## Frontend connection

Use `http://127.0.0.1:8000` as the API base URL. For Vite, copy `.env.example` to `.env.local` and set `VITE_API_URL`. Local apps on ports 3000 and 5173 are allowed by CORS.

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

## Data storage

Student XP, attempts, streaks, accuracy, and topic performance are stored in `backend/bindit.db` when using the local SQLite fallback. The database is created automatically and is ignored by Git. Set `BINDIT_DB_PATH` to use a different local database path; the old `POCKET_TUTOR_DB_PATH` name remains supported for compatibility.

SQLite is useful for local development. For production, use hosted PostgreSQL or Supabase through `DATABASE_URL` so progress persists across Vercel instances.
