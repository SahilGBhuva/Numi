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

Use `http://127.0.0.1:8000` as the API base URL. For Vite, copy
`.env.example` to `.env.local` and set `VITE_API_URL`. Local apps on ports
3000 and 5173 are allowed by CORS.

## API contract

### Generate a question

`POST /api/generate-question`

Request: `{"topic":"mixed","difficulty":1}`

Returns `question`, `correct_answer`, `topic`, and `difficulty`. Topics are addition, subtraction, multiplication, division, or mixed. Difficulty is 1 to 3.

### Analyze an answer

`POST /api/analyze-answer`

Request: `{"question":"What is 2 + 2?","student_answer":"4","correct_answer":"4","student_id":"student-123","topic":"addition"}`

Returns correctness, mistake type, explanation, hint, XP earned, total XP, and streak.

### Read progress

`GET /api/progress/{student_id}`

Returns XP, attempts, accuracy, streaks, and weak topics.

### Health check

`GET /api/health` returns service status.

### Friend profiles and streak leaderboard

`POST /api/profiles` creates a profile and returns its unique friend code.

`POST /api/friends/requests` sends a request using that friend code.

`GET /api/friends/{student_id}/requests` lists incoming pending requests.

`PATCH /api/friends/requests/{request_id}` accepts or declines a request. The
body contains `recipient_id` and `accept`.

`GET /api/friends/{student_id}/leaderboard` returns the learner and accepted
friends ordered by XP, including streak and active-today status.

Browser student IDs are suitable for the current prototype. These routes must
use authenticated account IDs before Numi allows untrusted public signups.

## Verify changes

Run `python -m unittest -v test_main.py`.

## Data storage

Student profiles, friendships, XP, attempts, streaks, accuracy, and topic
performance use SQLAlchemy. Set `DATABASE_URL` to a hosted PostgreSQL connection
string for durable production storage. Without it, the backend uses
`backend/pocket_tutor.db` locally or temporary `/tmp` storage on Vercel. Set
`POCKET_TUTOR_DB_PATH` to use a different local SQLite file.

For Supabase, copy `.env.example` to `.env`, use the transaction pooler URI
(port 6543) on Vercel, and run `supabase/schema.sql` in the SQL Editor. See the
root README for the full checklist.
