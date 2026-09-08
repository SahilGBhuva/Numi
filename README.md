# GameMath

Group repo for Pocket Tutor: a FastAPI backend and a Vite React frontend.

## Folders

- `frontend/` — Vite + React + TypeScript study app
- `backend/` — FastAPI API (questions, answers, progress)

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
