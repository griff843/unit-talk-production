#!/usr/bin/env bash
# ============================================================
# Codex Trigger Runner
# ============================================================
#
# Invokes Codex agents by workflow moment name.
# Reads trigger-registry.sh for the moment→agent mapping.
#
# Usage:
#   bash scripts/codex/run-trigger.sh <workflow-moment>
#   bash scripts/codex/run-trigger.sh diagnosis-start
#   bash scripts/codex/run-trigger.sh visibility-check
#   bash scripts/codex/run-trigger.sh implementation-start
#   bash scripts/codex/run-trigger.sh --list
#
# Trigger types:
#   auto           — runs immediately
#   suggest        — prints what would run; pass --run to execute
#   manual-confirm — prompts for yes/no (enforced for write tasks)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY="$SCRIPT_DIR/trigger-registry.sh"

# ── Load registry ──────────────────────────────────────────

if [[ ! -f "$REGISTRY" ]]; then
  echo "[TRIGGER] FATAL: trigger-registry.sh not found at $REGISTRY"
  exit 1
fi

# shellcheck source=trigger-registry.sh
source "$REGISTRY"

# ── Arguments ──────────────────────────────────────────────

MOMENT="${1:-}"
FLAG="${2:-}"

# ── --list: print all registered triggers ──────────────────

if [[ "$MOMENT" == "--list" ]]; then
  echo ""
  echo "Codex Trigger Registry"
  echo "======================"
  echo ""
  printf "  %-28s %-16s %-18s %s\n" "MOMENT" "TYPE" "WRAPPER" "DESCRIPTION"
  printf "  %-28s %-16s %-18s %s\n" "------" "----" "-------" "-----------"
  for key in "${!TRIGGER_TYPE[@]}"; do
    printf "  %-28s %-16s %-18s %s\n" \
      "$key" \
      "${TRIGGER_TYPE[$key]}" \
      "${TRIGGER_WRAPPER[$key]}" \
      "${TRIGGER_DESC[$key]}"
  done
  echo ""
  exit 0
fi

# ── Validate moment ────────────────────────────────────────

if [[ -z "$MOMENT" ]]; then
  echo "[TRIGGER] ERROR: workflow moment required"
  echo ""
  echo "  Usage: bash scripts/codex/run-trigger.sh <moment>"
  echo "  List:  bash scripts/codex/run-trigger.sh --list"
  echo ""
  echo "  Known moments: ${!TRIGGER_TYPE[*]}"
  exit 1
fi

if [[ -z "${TRIGGER_TYPE[$MOMENT]+x}" ]]; then
  echo "[TRIGGER] FAIL: unknown workflow moment '$MOMENT'"
  echo ""
  echo "  Known moments: ${!TRIGGER_TYPE[*]}"
  echo "  Use --list for details."
  exit 1
fi

# ── Resolve trigger ────────────────────────────────────────

TYPE="${TRIGGER_TYPE[$MOMENT]}"
WRAPPER="${TRIGGER_WRAPPER[$MOMENT]}"
TASK="${TRIGGER_TASK[$MOMENT]}"
DESC="${TRIGGER_DESC[$MOMENT]}"
WRAPPER_PATH="$SCRIPT_DIR/$WRAPPER"
TASK_PATH="$REPO_ROOT/$TASK"

echo ""
echo "[TRIGGER] ================================================"
echo "[TRIGGER] Moment:  $MOMENT"
echo "[TRIGGER] Type:    $TYPE"
echo "[TRIGGER] Wrapper: $WRAPPER"
echo "[TRIGGER] Task:    $TASK"
echo "[TRIGGER] Desc:    $DESC"
echo "[TRIGGER] ================================================"

# ── Validate wrapper and task file ─────────────────────────

if [[ ! -f "$WRAPPER_PATH" ]]; then
  echo "[TRIGGER] FATAL: wrapper not found: $WRAPPER_PATH"
  exit 1
fi

if [[ ! -f "$TASK_PATH" ]]; then
  echo "[TRIGGER] FATAL: task file not found: $TASK_PATH"
  exit 1
fi

# ── Safety: prevent auto triggers on write wrappers ────────

if [[ "$TYPE" == "auto" && "$WRAPPER" == "run-write.sh" ]]; then
  echo "[TRIGGER] SAFETY BLOCK: auto trigger on write wrapper is forbidden."
  echo "  Write tasks must use manual-confirm or suggest type."
  echo "  Fix trigger-registry.sh to correct this misconfiguration."
  exit 1
fi

# ── Execute based on trigger type ──────────────────────────

case "$TYPE" in
  auto)
    echo ""
    echo "[TRIGGER] Auto-executing (read-only/verify mode)..."
    echo ""
    exec bash "$WRAPPER_PATH" "$TASK_PATH"
    ;;

  suggest)
    echo ""
    echo "[TRIGGER] Suggested trigger. To execute, re-run with --run:"
    echo "  bash scripts/codex/run-trigger.sh $MOMENT --run"
    echo ""
    if [[ "$FLAG" == "--run" ]]; then
      echo "[TRIGGER] --run flag detected. Executing..."
      echo ""
      exec bash "$WRAPPER_PATH" "$TASK_PATH"
    fi
    exit 0
    ;;

  manual-confirm)
    echo ""
    echo "[TRIGGER] This trigger requires explicit confirmation."
    echo "[TRIGGER] Task scope preview:"
    echo ""
    head -20 "$TASK_PATH"
    echo ""
    read -r -p "[TRIGGER] Execute this Codex task? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "[TRIGGER] Aborted — no execution."
      exit 0
    fi
    echo ""
    echo "[TRIGGER] Confirmed. Delegating to $WRAPPER..."
    echo ""
    # For write wrappers, the wrapper itself also has a confirmation gate.
    # That's intentional — double confirmation for write tasks.
    exec bash "$WRAPPER_PATH" "$TASK_PATH"
    ;;

  *)
    echo "[TRIGGER] FATAL: unknown trigger type '$TYPE' for moment '$MOMENT'"
    echo "  Valid types: auto, suggest, manual-confirm"
    exit 1
    ;;
esac
