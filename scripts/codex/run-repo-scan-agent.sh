#!/usr/bin/env bash
set -euo pipefail

TASK_FILE="${1:-sprint_tasks/codex/repo-scan-agent.md}"

if [ ! -f "$TASK_FILE" ]; then
  echo "Task file not found: $TASK_FILE"
  exit 1
fi

# Delegate to the standard read-only wrapper
exec bash "$(dirname "$0")/run-readonly.sh" "$TASK_FILE"