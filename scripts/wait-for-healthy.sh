#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/health}"
TIMEOUT="${TIMEOUT:-120}"
SLEEP="${SLEEP:-5}"

elapsed=0
echo "> Waiting for health: ${API_URL} (timeout=${TIMEOUT}s)"
while [ $elapsed -lt $TIMEOUT ]; do
  if curl -fsS "$API_URL" >/dev/null; then
    echo "OK: Service healthy"
    exit 0
  fi
  sleep "$SLEEP"
  elapsed=$((elapsed + SLEEP))
  echo "... still waiting (${elapsed}s)"
done

echo "ERROR: Service did not become healthy in ${TIMEOUT}s" >&2
exit 1

