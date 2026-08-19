#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR/frontend"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created frontend/.env. The Firebase client configuration is already included."
fi

if [[ ! -d node_modules ]]; then
  npm ci
fi

# Clear Metro's cache so the phone never reopens a stale pre-transfer bundle.
exec npm start -- --clear --lan
