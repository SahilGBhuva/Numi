# Bindit

Bindit is a learning platform that helps students connect ideas, organize what they learn, and build consistent study habits. The repo contains a Vite + React frontend, a FastAPI learning API, Supabase authentication, and persistent progress storage.

## Folders

- `frontend/` — Bindit web app built with Vite, React, and TypeScript
- `backend/` — FastAPI API for questions, answers, authentication, and progress

The pieces are connected end-to-end: the React experience requests questions, FastAPI checks answers and awards XP, and the database saves each learner's progress.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

The frontend calls `/api/*` on the same host in production. For local development, copy `frontend/.env.example` to `frontend/.env.local` so those requests go to the FastAPI server on port 8000.

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

Import the repository with the root directory set to `./`. The root `vercel.json` deploys the Vite frontend and FastAPI backend together, routes `/api/*` to FastAPI, and sends every other request to the frontend.

The backend uses PostgreSQL automatically when `DATABASE_URL` is set. Without that variable it falls back to SQLite; on Vercel, the fallback lives in writable `/tmp` storage and may reset when a serverless instance is replaced. Use Supabase/Postgres through `DATABASE_URL` for durable learner progress.

Bindit uses Supabase Auth for account identity, so saved progress can stay attached to the authenticated learner rather than a browser-only identity.
