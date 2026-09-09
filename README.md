# GameMath

Group repo for Pocket Tutor: a polished Vite React learning experience, a
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
