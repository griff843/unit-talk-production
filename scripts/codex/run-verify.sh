#!/usr/bin/env bash
# ============================================================
# Codex Verification / Support Agent Wrapper
# Mode: suggest -- post-change inspection, report generation
# ============================================================
# Usage:
#   bash scripts/codex/run-verify.sh <task-file>
#   bash scripts/codex/run-verify.sh sprint_tasks/codex/publish-visibility.md
#
# Use for: post-implementation checks, visibility verification,
# output inspection, structured report generation.
# Never modifies files.
set -euo pipefail

TASK_FILE="${1:-}"

if [[ -z "$TASK_FILE" ]]; then
  echo "[CODEX-VERIFY] ERROR: task file argument required"
  echo "  Usage: bash scripts/codex/run-verify.sh sprint_tasks/codex/<task>.md"
  exit 1
fi

if [[ ! -f "$TASK_FILE" ]]; then
  echo "[CODEX-VERIFY] ERROR: task file not found: $TASK_FILE"
  echo "  Checked: $TASK_FILE"
  exit 1
fi

echo "[CODEX-VERIFY] ================================================"
echo "[CODEX-VERIFY] Mode: suggest (verification -- no file writes)"
echo "[CODEX-VERIFY] Task: $TASK_FILE"
echo "[CODEX-VERIFY] ================================================"
echo ""

exec codex exec -s read-only -c 'mcp_servers={}' "$(cat "$TASK_FILE")"
