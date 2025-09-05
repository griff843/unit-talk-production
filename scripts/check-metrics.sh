#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-staging}"
API_HOST="${API_HOST:-localhost}"
API_METRICS_PORT="${API_METRICS_PORT:-9464}"

echo "> Checking Prometheus metrics endpoint (${ENVIRONMENT})..."
if curl -fsS "http://${API_HOST}:${API_METRICS_PORT}/metrics" | head -n 5; then
  echo "OK: Metrics endpoint reachable"
else
  echo "ERROR: Metrics endpoint not reachable" >&2
  exit 1
fi

