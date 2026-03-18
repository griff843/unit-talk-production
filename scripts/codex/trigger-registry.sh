#!/usr/bin/env bash
# ============================================================
# Codex Trigger Registry — Source of Truth
# ============================================================
#
# Maps workflow moments to Codex agents. Consumed by run-trigger.sh.
#
# Format:  register <moment> <trigger-type> <wrapper> <task-file> <description>
#
# Trigger types:
#   auto           — runs immediately, no human confirmation
#   suggest        — prints what would run, requires explicit --run to execute
#   manual-confirm — always prompts for human yes/no before execution
#
# Safety invariant: only read-only/verify wrappers may use "auto".
#                   workspace-write wrappers MUST use "manual-confirm".
# ============================================================

# This file is sourced by run-trigger.sh. It populates TRIGGER_* arrays.
# Do not exec or run commands here — declaration only.

declare -A TRIGGER_TYPE
declare -A TRIGGER_WRAPPER
declare -A TRIGGER_TASK
declare -A TRIGGER_DESC

register() {
  local moment="$1" type="$2" wrapper="$3" task="$4" desc="$5"
  TRIGGER_TYPE["$moment"]="$type"
  TRIGGER_WRAPPER["$moment"]="$wrapper"
  TRIGGER_TASK["$moment"]="$task"
  TRIGGER_DESC["$moment"]="$desc"
}

# ── Trigger Map ─────────────────────────────────────────────

register \
  "diagnosis-start" \
  "auto" \
  "run-readonly.sh" \
  "sprint_tasks/codex/repo-scan-agent.md" \
  "Read-only repo scan: error clusters, schema mismatches, route risks"

register \
  "visibility-check" \
  "auto" \
  "run-verify.sh" \
  "sprint_tasks/codex/publish-visibility.md" \
  "Verify Discord publish path, outbox linkage, CC visibility"

register \
  "implementation-start" \
  "manual-confirm" \
  "run-write.sh" \
  "sprint_tasks/codex/fix-executor.md" \
  "Bounded write: execute mechanical fix from task-file spec"

register \
  "post-implementation-verify" \
  "auto" \
  "run-verify.sh" \
  "sprint_tasks/codex/publish-visibility.md" \
  "Post-change verification of publish visibility chain"

register \
  "sprint-closeout-support" \
  "auto" \
  "run-readonly.sh" \
  "sprint_tasks/codex/repo-scan-agent.md" \
  "Final repo scan before closeout: confirm no new error clusters"
