#!/usr/bin/env bash
# ============================================================
# Codex Read-Only Agent Wrapper
# Mode: suggest -- no file modifications, no shell execution
# ============================================================
# Usage:
#   bash scripts/codex/run-readonly.sh <task-file>
#   bash scripts/codex/run-readonly.sh sprint_tasks/codex/repo-scan-agent.md
set -euo pipefail

TASK_FILE="${1:-}"

if [[ -z "$TASK_FILE" ]]; then
  echo "[CODEX-READONLY] ERROR: task file argument required"
  echo "  Usage: bash scripts/codex/run-readonly.sh sprint_tasks/codex/<task>.md"
  exit 1
fi

if [[ ! -f "$TASK_FILE" ]]; then
  echo "[CODEX-READONLY] ERROR: task file not found: $TASK_FILE"
  echo "  Checked: $TASK_FILE"
  exit 1
fi

echo "[CODEX-READONLY] ================================================"
echo "[CODEX-READONLY] Mode: suggest (read-only -- no file writes)"
echo "[CODEX-READONLY] Task: $TASK_FILE"
echo "[CODEX-READONLY] ================================================"
echo ""

exec codex exec -s read-only -c 'mcp_servers={}' "$(cat "$TASK_FILE")"
