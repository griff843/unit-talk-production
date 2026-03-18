#!/usr/bin/env bash
# ============================================================
# Codex Bounded Write Agent Wrapper
# Mode: auto-edit — file edits allowed, no shell execution
# ============================================================
# Usage:
#   bash scripts/codex/run-write.sh <task-file>
#   bash scripts/codex/run-write.sh sprint_tasks/codex/fix-executor.md
#
# WARNING: This wrapper allows Codex to modify files.
# Task file MUST define precise scope and OUT-OF-SCOPE boundaries.
# Review task file carefully before confirming.
set -euo pipefail

TASK_FILE="${1:-}"

if [[ -z "$TASK_FILE" ]]; then
  echo "[CODEX-WRITE] ERROR: task file argument required"
  echo "  Usage: bash scripts/codex/run-write.sh sprint_tasks/codex/<task>.md"
  exit 1
fi

if [[ ! -f "$TASK_FILE" ]]; then
  echo "[CODEX-WRITE] ERROR: task file not found: $TASK_FILE"
  echo "  Checked: $TASK_FILE"
  exit 1
fi

echo "[CODEX-WRITE] ================================================"
echo "[CODEX-WRITE] Mode: auto-edit (file modifications ALLOWED)"
echo "[CODEX-WRITE] Task: $TASK_FILE"
echo "[CODEX-WRITE] ================================================"
echo ""
echo "Task scope preview (first 10 lines):"
head -10 "$TASK_FILE"
echo ""
echo "[CODEX-WRITE] IMPORTANT: Codex may modify files matching task scope."
echo "[CODEX-WRITE] Verify task boundaries before proceeding."
echo ""
read -r -p "[CODEX-WRITE] Proceed with bounded write execution? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "[CODEX-WRITE] Aborted — no changes made."
  exit 0
fi

echo ""
exec codex exec -s workspace-write "$(cat "$TASK_FILE")"
