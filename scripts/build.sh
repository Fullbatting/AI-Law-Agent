#!/usr/bin/env bash
# scripts/build.sh — Package the Electron desktop app (includes backend sources).
#
# Prerequisites:
#   • Node.js ≥ 18 + npm
#   • Python 3.10+
#   • (Optional) PyInstaller – uncomment the pyinstaller section to bundle Python
#
# Usage:
#   ./scripts/build.sh [--win | --mac | --linux]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP_DIR="$REPO_ROOT/desktop"

TARGET="${1:-}"

echo "[build] Installing Node dependencies …"
(cd "$DESKTOP_DIR" && npm install)

# ── Optional: bundle Python backend with PyInstaller ───────────────────────
# Uncomment the block below to produce a standalone backend executable.
# BACKEND_DIR="$REPO_ROOT/backend"
# echo "[build] Bundling Python backend with PyInstaller …"
# pip install pyinstaller
# (cd "$BACKEND_DIR" && pyinstaller --onefile --name backend-server server.py)
# mkdir -p "$DESKTOP_DIR/resources/backend"
# cp "$BACKEND_DIR/dist/backend-server" "$DESKTOP_DIR/resources/backend/"

echo "[build] Building Electron installer …"
case "$TARGET" in
  --win)   (cd "$DESKTOP_DIR" && npm run build:win)   ;;
  --mac)   (cd "$DESKTOP_DIR" && npm run build:mac)   ;;
  --linux) (cd "$DESKTOP_DIR" && npm run build:linux) ;;
  *)       (cd "$DESKTOP_DIR" && npm run build)       ;;
esac

echo "[build] Done! Installer written to dist/"
