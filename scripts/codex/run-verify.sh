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
#
# MCP suppression:
#   Global MCP servers (playwright, linear) are redirected to fail-fast
#   values via .codex/config.toml. Startup noise is filtered from stdout.
#   Stderr (MCP transport errors) is captured to a temp log and suppressed.
set -euo pipefail

TASK_FILE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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
echo "[CODEX-VERIFY] MCP: suppressed (fail-fast via .codex/config.toml)"
echo "[CODEX-VERIFY] ================================================"
echo ""

# ── Run codex with clean output ──────────────────────────────
# stdout: capture to temp file, then filter MCP startup lines
# stderr: redirect to temp log (MCP transport error messages)

CODEX_OUT=$(mktemp)
CODEX_LOG=$(mktemp)

codex exec -s read-only "$(cat "$TASK_FILE")" \
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
  echo "[CODEX-VERIFY] MCP transport log (suppressed): $CODEX_LOG"
fi

rm -f "$CODEX_OUT"

exit "$EXIT_CODE"
