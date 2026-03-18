#!/usr/bin/env bash
# ============================================================
# Codex Bounded Write Agent Wrapper
# Mode: auto-edit -- file edits allowed, no shell execution
# ============================================================
# Usage:
#   bash scripts/codex/run-write.sh <task-file>
#   bash scripts/codex/run-write.sh sprint_tasks/codex/fix-executor.md
#
# WARNING: This wrapper allows Codex to modify files.
# Task file MUST define precise scope and OUT-OF-SCOPE boundaries.
# Review task file carefully before confirming.
#
# MCP suppression:
#   Global MCP servers (playwright, linear) are redirected to fail-fast
#   values via .codex/config.toml. Startup noise is filtered from stdout.
#   Stderr (MCP transport errors) is captured to a temp log and suppressed.
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

# -- Validate task file completeness ---------------------------

PLACEHOLDERS=$(grep -c '<FILL IN:' "$TASK_FILE" || true)
FILL_COMMENTS=$(grep -c '<!-- Fill in' "$TASK_FILE" || true)
TOTAL_PLACEHOLDERS=$((PLACEHOLDERS + FILL_COMMENTS))

if [[ "$TOTAL_PLACEHOLDERS" -gt 0 ]]; then
  echo "[CODEX-WRITE] BLOCKED: task file contains $TOTAL_PLACEHOLDERS unfilled placeholder(s)."
  echo ""
  echo "  Placeholders found:"
  grep -n '<FILL IN:' "$TASK_FILE" | sed 's/^/    /' || true
  grep -n '<!-- Fill in' "$TASK_FILE" | sed 's/^/    /' || true
  echo ""
  echo "  A bounded-write task file must be fully specified before execution."
  echo "  Fill in all <FILL IN: ...> fields and remove template comments."
  exit 1
fi

# -- Confirmation gate -----------------------------------------

echo "[CODEX-WRITE] ================================================"
echo "[CODEX-WRITE] Mode: auto-edit (file modifications ALLOWED)"
echo "[CODEX-WRITE] Task: $TASK_FILE"
echo "[CODEX-WRITE] MCP: suppressed (fail-fast via .codex/config.toml)"
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
  echo "[CODEX-WRITE] Aborted -- no changes made."
  exit 0
fi

echo ""

# ── Run codex with clean output ──────────────────────────────
# stdout: capture to temp file, then filter MCP startup lines
# stderr: redirect to temp log (MCP transport error messages)

CODEX_OUT=$(mktemp)
CODEX_LOG=$(mktemp)

codex exec -s workspace-write "$(cat "$TASK_FILE")" \
  >"$CODEX_OUT" \
  2>"$CODEX_LOG" \
  || true

EXIT_CODE=$?

# Filter known MCP startup preamble lines from output
# Pattern: "mcp: <name> starting|ready|failed|..." and "mcp startup: ..."
sed -E '/^mcp: /d; /^mcp startup:/d' "$CODEX_OUT"

# If MCP log has content, note its location for debugging
if [[ -s "$CODEX_LOG" ]]; then
  echo ""
  echo "[CODEX-WRITE] MCP transport log (suppressed): $CODEX_LOG"
fi

rm -f "$CODEX_OUT"

exit "$EXIT_CODE"
