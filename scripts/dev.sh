#!/usr/bin/env bash
# scripts/dev.sh — Start both the Python backend and the Electron app for development.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$REPO_ROOT/backend"
DESKTOP_DIR="$REPO_ROOT/desktop"

# ── Python backend ──────────────────────────────────────────────────────────
if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo "[dev] Creating Python virtual environment in backend/.venv …"
  python3 -m venv "$BACKEND_DIR/.venv"
fi

source "$BACKEND_DIR/.venv/bin/activate"

echo "[dev] Installing Python dependencies …"
pip install --quiet -r "$BACKEND_DIR/requirements.txt"

echo "[dev] Starting Python backend on port 8000 …"
(cd "$BACKEND_DIR" && python server.py) &
BACKEND_PID=$!

# Give the server a moment to start
sleep 2

# ── Electron app ────────────────────────────────────────────────────────────
if [ ! -d "$DESKTOP_DIR/node_modules" ]; then
  echo "[dev] Installing Node dependencies …"
  (cd "$DESKTOP_DIR" && npm install)
fi

echo "[dev] Starting Electron …"
(cd "$DESKTOP_DIR" && npm start)

# Cleanup
kill "$BACKEND_PID" 2>/dev/null || true
