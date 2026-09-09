# GameMath

Group repo for Pocket Tutor: a FastAPI backend and a Vite React frontend.

## Run both together

From the repo root:

```bash
chmod +x run-dev.sh
./run-dev.sh
```

Then open:

- Frontend: http://127.0.0.1:5173
- API docs: http://127.0.0.1:8000/docs

The Vite app proxies `/api` to the FastAPI server, so the homepage can generate and check math questions.

## Folders

- `frontend/` — Vite + React + TypeScript
- `backend/` — FastAPI (questions, answers, progress)

## Frontend only

```bash
cd frontend
npm install
npm run dev
```

## Backend only

See `backend/README.md`.
