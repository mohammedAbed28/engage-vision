#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env from the safe template. Add local DB/OpenAI values only if needed."
fi

exec python3 -m uvicorn backend.server:api --host 0.0.0.0 --port 8048

