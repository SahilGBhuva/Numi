# Numi

Group repo for numi: a polished Vite React learning experience, a
FastAPI tutoring API, and persistent SQLite progress storage.

## Folders

- `frontend/` — Vite + React + TypeScript study app
- `backend/` — FastAPI API (questions, answers, progress)

The three parts are connected end-to-end: the React lesson requests a question,
FastAPI checks the answer and awards XP, and SQLite saves the learner's progress.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

The frontend calls `/api/*` on the same host in production. For local
development, copy `frontend/.env.example` to `frontend/.env.local` so those
requests go to the FastAPI server on port 8000.

## Backend

See `backend/README.md`. Short version:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API: http://127.0.0.1:8000  
Docs: http://127.0.0.1:8000/docs

## Vercel deployment

Import the repository with the root directory set to `./`. The root
`vercel.json` deploys the Vite frontend and FastAPI backend together, routes
`/api/*` to FastAPI, and sends every other request to the frontend.

The backend uses PostgreSQL automatically when `DATABASE_URL` is set. Without
that variable it falls back to SQLite; on Vercel, the fallback lives in writable
`/tmp` storage and may reset when a serverless instance is replaced. Connect a
hosted Postgres database and expose its connection string as `DATABASE_URL` for
durable learner progress.

Each browser receives a random learner ID stored in local storage, so visitors
do not share the same progress record. Authentication can replace that browser
identity later without changing the progress API.
