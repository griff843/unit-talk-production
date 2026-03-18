#!/usr/bin/env bash
# ============================================================
# Codex Generic Task Dispatcher
# Routes to the correct wrapper based on task file mode header.
# ============================================================
# Usage:
#   bash scripts/codex/run-codex-task.sh sprint_tasks/codex/<task>.md
#
# The task file must contain a line:
#   **Mode**: read-only | bounded-write | verify
# This script reads that line and delegates to the right wrapper.
set -euo pipefail

TASK_FILE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$TASK_FILE" ]]; then
  echo "[CODEX] ERROR: task file argument required"
  echo "  Usage: bash scripts/codex/run-codex-task.sh sprint_tasks/codex/<task>.md"
  exit 1
fi

if [[ ! -f "$TASK_FILE" ]]; then
  echo "[CODEX] ERROR: task file not found: $TASK_FILE"
  exit 1
fi

# Extract Mode from task file
MODE=$(grep -i '^\*\*Mode\*\*:' "$TASK_FILE" | head -1 | sed 's/\*\*Mode\*\*://i' | xargs || echo "")

if [[ -z "$MODE" ]]; then
  echo "[CODEX] ERROR: task file missing **Mode** field."
  echo "  Add one of: **Mode**: read-only | bounded-write | verify"
  exit 1
fi

case "$MODE" in
  read-only)
    exec bash "$SCRIPT_DIR/run-readonly.sh" "$TASK_FILE"
    ;;
  bounded-write)
    exec bash "$SCRIPT_DIR/run-write.sh" "$TASK_FILE"
    ;;
  verify)
    exec bash "$SCRIPT_DIR/run-verify.sh" "$TASK_FILE"
    ;;
  *)
    echo "[CODEX] ERROR: unknown mode '$MODE' in task file."
    echo "  Valid modes: read-only | bounded-write | verify"
    exit 1
    ;;
esac
