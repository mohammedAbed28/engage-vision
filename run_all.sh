#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

./run_backend.sh &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT INT TERM

echo "Preparing the verified model and local embedding services…"
READY=0
for _attempt in {1..90}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8048/health/v3 >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "The backend stopped during startup. Review the error above."
    exit 1
  fi
  sleep 2
done

if [[ "$READY" -ne 1 ]]; then
  echo "The backend did not become ready within three minutes."
  exit 1
fi

echo "EngageVision API is ready on http://0.0.0.0:8048"
echo "Starting Expo. You can scan the QR when it appears."
./run_frontend.sh
