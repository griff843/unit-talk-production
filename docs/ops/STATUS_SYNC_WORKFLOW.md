# STATUS SYNC WORKFLOW

**Owner**: Engineering Team **Effective**: 2026-03-09 **Sprint**:
SPRINT-BUILD-STATUS-SYNC-SKILL **Authority**:
`.claude/skills/status-sync/SKILL.md`

---

## Overview

Every completed sprint MUST produce a status sync. This document explains the
workflow, the files it touches, and how to invoke it.

The goal: **repo truth, sprint truth, and Linear execution state never drift.**

---

## The Three Truth Layers

| Layer           | Location                                  | Authority                          |
| --------------- | ----------------------------------------- | ---------------------------------- |
| Repo truth      | `docs/status/`                            | What the codebase actually does    |
| Sprint truth    | `out/sprints/*/SPRINT_CLOSEOUT_REPORT.md` | What was verified this sprint      |
| Execution truth | Linear (UNI-N issues + cycles)            | What is planned, in progress, done |

All three must agree after every sprint.

---

## When to Run Status Sync

| Event                              | Required?        |
| ---------------------------------- | ---------------- |
| Sprint merged to main              | **YES — always** |
| Subsystem status confirmed changed | YES              |
| Drift item resolved or discovered  | YES              |
| Phase milestone completed          | YES              |
| Sprint planned but not yet started | No               |
| Docs-only or tooling-only sprint   | No               |

---

## Invocation

### Via Skill

```
/status-sync SPRINT-NAME-NNN
```

Claude will run the full 8-step procedure from
`.claude/skills/status-sync/SKILL.md`.

### Manual Checklist (if skill unavailable)

```bash
# 1. Read sprint closeout
cat out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md

# 2. Identify changed subsystems
grep -i "subsystem\|status\|verified\|partial\|broken" out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md

# 3. Update docs (targeted edits only)
#    - docs/status/CURRENT_SYSTEM_STATUS.md  (if subsystem status changed)
#    - docs/status/PHASE_STATUS.md           (if phase % moved ≥5%)
#    - docs/status/NEXT_5_SPRINTS.md         (if top sprint completed)
#    - docs/status/DRIFT_REPORT.md           (if drift resolved or discovered)

# 4. Sync Linear
#    mcp__linear__list_issues query="<SPRINT-NAME>"
#    Move state to Done, post comment

# 5. Verify consistency
grep "Last Updated" docs/status/CURRENT_SYSTEM_STATUS.md
```

---

## Files That May Be Updated

### Always read (never skip)

- `out/sprints/<SPRINT>/<DATE>/SPRINT_CLOSEOUT_REPORT.md`

### Updated conditionally (per UPDATE_RULES.md)

- `docs/status/CURRENT_SYSTEM_STATUS.md` — subsystem rows, infrastructure rows
- `docs/status/PHASE_STATUS.md` — phase %, milestone checkboxes
- `docs/status/NEXT_5_SPRINTS.md` — sprint queue
- `docs/status/DRIFT_REPORT.md` — only on resolved or new drift

### External

- Linear issue state → Done
- Linear issue comment → sync summary

---

## Example: Sprint Completed, Subsystem Fixed

**Sprint**: `SPRINT-SINGLE-WRITER-COMPLETION-115` **Result**: Single-writer gate
now passes with 0 violations, 0 allowlisted

```
/status-sync SPRINT-SINGLE-WRITER-COMPLETION-115
```

**What the skill does:**

1. Reads closeout report
2. Identifies `Lifecycle Adapters` row changed: `PARTIAL → VERIFIED`
3. Updates `CURRENT_SYSTEM_STATUS.md`:
   - Lifecycle Adapters: PARTIAL → VERIFIED
   - Infrastructure: Single-Writer Gate: PASS (with allowlist) → PASS
   - Last Updated: 2026-03-10
4. Checks PHASE_STATUS.md — Phase 1 structural milestone resolved (+5%) →
   updates
5. Checks NEXT_5_SPRINTS.md — removes SPRINT-SINGLE-WRITER-COMPLETION from
   position 1
6. Checks DRIFT_REPORT.md — removes "Single-writer migration overdue" (was
   CRITICAL)
7. Linear: UNI-N → Done, posts comment with subsystem and drift summary

---

## Example: Sprint Completed, No Status Change

**Sprint**: `SPRINT-DOCS-CLEANUP-120` **Result**: Removed stale documentation;
no code or architecture changed

```
/status-sync SPRINT-DOCS-CLEANUP-120
```

**What the skill does:**

1. Reads closeout report
2. No subsystem status changes
3. No phase milestone completions
4. No drift items resolved (docs sprint, not a functional fix)
5. NEXT_5_SPRINTS.md — was this sprint in the queue? If yes, remove it
6. Linear: UNI-N → Done, posts comment noting no status doc changes required
7. Exits with: "No docs/status/ updates required for this sprint"

---

## Hook Recommendation

### Now: No hooks required

The skill works well as an explicit invocation after `/sprint-proof-bundle`.
Adding a hook risks false positives (triggering on non-sprint sessions) and adds
complexity before the workflow is proven stable.

### Later: Consider a post-merge hook

Once status sync has been run on 5+ sprints and the workflow is trusted, add a
Claude Code hook that fires after `git push origin main` succeeds:

```json
// .claude/hooks.json (future)
{
  "post_tool_use": [
    {
      "tool": "Bash",
      "pattern": "git push origin main",
      "message": "Sprint merged. Run /status-sync <SPRINT-NAME> to update docs/status/ and Linear."
    }
  ]
}
```

This is a **reminder hook** — it prompts Claude to run the skill, not an
automation that runs it automatically. This preserves human review of what
status changes are being made.

**Verdict: Build the habit first. Add the hook in Sprint 5+.**

---

## Skill Directory

```
.claude/skills/status-sync/
├── SKILL.md              # Canonical skill procedure (invoke with /status-sync)
├── UPDATE_RULES.md       # Decision rules for each doc — consult before editing
└── LINEAR_SYNC_GUIDE.md  # Linear field mapping and state transition rules
```

---

## Follow-On Skills (Recommended Sequence)

After `/status-sync` is complete, the natural next actions are:

| Order | Skill                  | When                                      |
| ----- | ---------------------- | ----------------------------------------- |
| 1     | `/status-sync`         | Immediately after sprint merges           |
| 2     | `/sprint-plan`         | When beginning the next sprint            |
| 3     | `/single-writer-audit` | If this sprint touched lifecycle adapters |
| 4     | `/sprint-verify`       | Before any sprint's PR is opened          |
| 5     | `/sprint-proof-bundle` | Before sprint closeout report is written  |

There is no dedicated `/linear-sync` skill yet. Linear sync is embedded in
`/status-sync` Steps 7–8. If Linear sync becomes complex enough to warrant its
own skill, extract it from `LINEAR_SYNC_GUIDE.md`.

Similarly, there is no `/system-truth-audit` skill yet. If a full cross-layer
audit is needed (repo vs. sprint vs. Linear), that can be built as a dedicated
skill using `docs/status/CANONICAL_DOC_SET.md` as the authority source.

---

## Drift Prevention Contract

By running `/status-sync` after every sprint, Unit Talk enforces:

1. **No phantom VERIFIED claims** — status only advances on proof
2. **No orphaned drift items** — every DRIFT_REPORT entry traces to a sprint
3. **No stale Linear issues** — Done means merged + tagged + synced
4. **No priority surprises** — NEXT_5_SPRINTS always reflects current reality

If this workflow is skipped for 2+ consecutive sprints, treat it as a **MEDIUM**
drift item and run a manual sync before the next sprint begins.
