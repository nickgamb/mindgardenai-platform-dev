#!/usr/bin/env bash

export OLLAMA_HOST="http://ollama:11434"
export OLLAMA_BASE_URL="http://ollama:11434"
echo 'export OLLAMA_HOST=http://ollama:11434' >> ~/.bashrc
echo 'export OLLAMA_BASE_URL=http://ollama:11434' >> ~/.bashrc
source ~/.bashrc

set -euo pipefail

# Preflight checks
if ! command -v python3 >/dev/null; then
  echo "python3 not found!"
  exit 1
fi
if ! python3 -c "import uvicorn" 2>/dev/null; then
  echo "uvicorn not installed!"
  exit 1
fi
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "fastapi not installed!"
  exit 1
fi

export WEBUI_SECRET_KEY="uQw7v9Jk2sX4pL8eT1zR6bN3cV5yH0aQ"S

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "$SCRIPT_DIR" || exit 1

if [[ "${WEB_LOADER_ENGINE,,}" == "playwright" ]]; then
    if [[ -z "${PLAYWRIGHT_WS_URL}" ]]; then
        playwright install chromium
        playwright install-deps chromium
    fi
    python -c "import nltk; nltk.download('punkt_tab')"
fi

if [ -n "${WEBUI_SECRET_KEY_FILE:-}" ]; then
    KEY_FILE="${WEBUI_SECRET_KEY_FILE}"
else
    KEY_FILE=".webui_secret_key"
fi

PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
if test "$WEBUI_SECRET_KEY $WEBUI_JWT_SECRET_KEY" = " "; then
  if ! [ -e "$KEY_FILE" ]; then
    echo $(head -c 12 /dev/random | base64) > "$KEY_FILE"
  fi
  WEBUI_SECRET_KEY=$(cat "$KEY_FILE")
fi

if [[ "${USE_OLLAMA_DOCKER,,}" == "true" ]]; then
    ollama serve &
fi

if [[ "${USE_CUDA_DOCKER,,}" == "true" ]]; then
  export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-}:/usr/local/lib/python3.11/site-packages/torch/lib:/usr/local/lib/python3.11/site-packages/nvidia/cudnn/lib"
fi

if [ -n "${SPACE_ID:-}" ]; then
  if [ -n "$ADMIN_USER_EMAIL" ] && [ -n "$ADMIN_USER_PASSWORD" ]; then
    export WEBUI_SECRET_KEY="$WEBUI_SECRET_KEY"
    uvicorn open_webui.main:app --host "$HOST" --port "$PORT" --forwarded-allow-ips '*' &
    webui_pid=$!
    while ! curl -s http://localhost:8080/health > /dev/null; do
      sleep 1
    done
    curl \
      -X POST "http://localhost:8080/api/v1/auths/signup" \
      -H "accept: application/json" \
      -H "Content-Type: application/json" \
      -d "{ \"email\": \"${ADMIN_USER_EMAIL}\", \"password\": \"${ADMIN_USER_PASSWORD}\", \"name\": \"Admin\" }"
    kill $webui_pid
  fi
  export WEBUI_URL=${SPACE_HOST}
fi

export WEBUI_SECRET_KEY="$WEBUI_SECRET_KEY"
PYTHON_CMD=$(command -v python3 || command -v python)
UVICORN_CMD=("$PYTHON_CMD" -m uvicorn open_webui.main:app --host "$HOST" --port "$PORT" --forwarded-allow-ips '*' --workers "${UVICORN_WORKERS:-1}")

exec "${UVICORN_CMD[@]}"