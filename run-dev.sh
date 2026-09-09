#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -x "$ROOT/backend/venv/bin/uvicorn" ]; then
  python3 -m venv "$ROOT/backend/venv"
  "$ROOT/backend/venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm install)
fi

"$ROOT/backend/venv/bin/uvicorn" main:app --reload --host 127.0.0.1 --port 8000 --app-dir "$ROOT/backend" &
BACK_PID=$!

(cd "$ROOT/frontend" && npm run dev -- --host 127.0.0.1 --port 5173) &
FRONT_PID=$!

trap 'kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true' INT TERM
wait
