# LINEAR SYNC WORKFLOW

**Owner**: Engineering Team **Effective**: 2026-03-09 **Sprint**:
SPRINT-BUILD-CLAUDE-SKILL-LINEAR-SYNC **Authority**:
`.claude/skills/linear-sync/SKILL.md`

---

## Overview

`/linear-sync` mirrors sprint execution state from the canonical repo truth
layer into Linear. It writes to Linear; it never reads from Linear to determine
system truth.

Linear is the execution-tracking mirror for:

- who is working on what
- which cycle a sprint belongs to
- what is blocked by what
- milestone progress across sprints

Linear is **not** the source of truth for:

- subsystem status (→ `docs/status/CURRENT_SYSTEM_STATUS.md`)
- phase progress (→ `docs/status/PHASE_STATUS.md`)
- drift items (→ `docs/status/DRIFT_REPORT.md`)
- sprint queue (→ `docs/status/NEXT_5_SPRINTS.md`)

---

## When to Use Each Mode

| Mode                | When                                                | Invocation                                 |
| ------------------- | --------------------------------------------------- | ------------------------------------------ |
| `sprint-start`      | Sprint branch created, implementation beginning     | `/linear-sync sprint-start SPRINT-NAME`    |
| `sprint-complete`   | Sprint merged, tagged, `/status-sync` done          | `/linear-sync sprint-complete SPRINT-NAME` |
| `blocked`           | Sprint cannot proceed due to dependency or external | `/linear-sync blocked SPRINT-NAME`         |
| `milestone-refresh` | After several sprints complete within a milestone   | `/linear-sync milestone-refresh`           |

---

## Where Linear Sync Fits in the Loop

```
/sprint-plan                ← selects sprint
    ↓
/linear-sync sprint-start   ← marks issue In Progress, assigns cycle
    ↓
[implementation]
    ↓
/sprint-proof-bundle        ← captures evidence
    ↓
sprint:close                ← Claude OS verification
    ↓
git push + tag
    ↓
/status-sync                ← updates docs/status/
    ↓
/linear-sync sprint-complete ← marks Done, posts proof summary
    ↓
/system-status              ← confirms everything aligns
```

---

## Examples

### Example 1: Starting a Sprint

Context: `/sprint-plan` recommended SPRINT-TEST-INFRA-RECOVERY. Branch created.

```
/linear-sync sprint-start SPRINT-TEST-INFRA-RECOVERY
```

Skill:

1. Searches Linear: `query="SPRINT-TEST-INFRA-RECOVERY"`
2. No issue found → creates new issue with title, team, description template
3. Sets state → In Progress
4. Assigns to `me`, current cycle, priority 1 (Urgent / P0)
5. Adds labels: `bug`, `infra`, `sprint`, `P0-urgent`
6. Posts sprint-start comment with tasks and success criteria

Output:

```markdown
## Linear Sync — sprint-start — SPRINT-TEST-INFRA-RECOVERY

**Issue**: UNI-25 — SPRINT-TEST-INFRA-RECOVERY — Restore test suite **State**:
Todo → In Progress **Cycle**: Sprint 030 (current) **Labels**: bug, infra,
sprint, P0-urgent **Comment posted**: ✅

### Sync Summary

Created new issue and marked In Progress. Sprint is P0 — blocks all verification
gates.
```

---

### Example 2: Completing a Sprint

Context: SPRINT-TEST-INFRA-RECOVERY merged to main. Tag on remote.
`/status-sync` already ran. Closeout report exists.

```
/linear-sync sprint-complete SPRINT-TEST-INFRA-RECOVERY
```

Skill:

1. Searches Linear: finds UNI-25
2. Verifies: `git ls-remote origin refs/tags/SPRINT-TEST-INFRA-RECOVERY` → tag
   exists ✅
3. Reads `SPRINT_CLOSEOUT_REPORT.md` — extracts deliverables, status changes,
   drift impact
4. Sets state → Done
5. Posts sprint-complete comment with full proof summary
6. Checks milestone — not milestoned, so no milestone update

Output:

```markdown
## Linear Sync — sprint-complete — SPRINT-TEST-INFRA-RECOVERY

**Issue**: UNI-25 — SPRINT-TEST-INFRA-RECOVERY **State**: In Progress → Done
**Cycle**: Sprint 030 **Comment posted**: ✅

### Sync Summary

Sprint merged + tagged. TypeScript errors resolved (DRIFT-C2). Test pass rate
restored to 92% (DRIFT-C1 resolved). Phase 1 → 80%.
```

---

### Example 3: Blocking a Sprint

Context: SPRINT-PROMOTION-ACTIVATION cannot start because
SPRINT-SINGLE-WRITER-COMPLETION tag is missing.

```
/linear-sync blocked SPRINT-PROMOTION-ACTIVATION
```

Skill:

1. Finds UNI-27 (SPRINT-PROMOTION-ACTIVATION)
2. Finds UNI-26 (SPRINT-SINGLE-WRITER-COMPLETION) as the blocker
3. Sets state → Blocked
4. Sets blockedBy → [UNI-26]
5. Posts blocked comment with reason and unblock criteria

Output:

```markdown
## Linear Sync — blocked — SPRINT-PROMOTION-ACTIVATION

**Issue**: UNI-27 — SPRINT-PROMOTION-ACTIVATION **State**: Todo → Blocked
**Blocked by**: UNI-26 (SPRINT-SINGLE-WRITER-COMPLETION) **Comment posted**: ✅

### Sync Summary

Cannot start — single-writer sprint must complete first. Tag
SPRINT-SINGLE-WRITER-COMPLETION not on remote.
```

---

### Example 4: Milestone Refresh

Context: Three sprints in the "Phase 1 Completion" milestone finished this
cycle. Operator wants an updated progress snapshot.

```
/linear-sync milestone-refresh
```

Skill:

1. Identifies the project and milestone
2. Lists all issues in the milestone
3. Counts: 5 Done, 1 In Progress, 1 Todo = 5/7 (71%)
4. Posts milestone progress comment to the project

Output:

```markdown
## Linear Sync — milestone-refresh

**Project**: Platform **Milestone**: Phase 1 Completion **Progress**: 5 / 7
(71%) **Target Date**: 2026-03-15 — At Risk

### Completed Since Last Refresh

- UNI-23: SPRINT-LIFECYCLE-ADAPTERS (Done 2026-03-05)
- UNI-24: SPRINT-TEST-INFRA-RECOVERY (Done 2026-03-10)
- UNI-25: SPRINT-SINGLE-WRITER-COMPLETION (Done 2026-03-12)

### Remaining

- UNI-27: SPRINT-PROMOTION-ACTIVATION — In Progress
- UNI-28: SPRINT-OPERATIONAL-OBSERVABILITY — Todo
```

---

## Relationship to /status-sync

`/status-sync` already contains a Linear sync step (Step 7 in the status-sync
SKILL.md). The `/linear-sync` skill is the extracted, dedicated version:

| Capability                | /status-sync Step 7 | /linear-sync                |
| ------------------------- | ------------------- | --------------------------- |
| Move issue to Done        | ✅                  | ✅                          |
| Post sync comment         | ✅ (simple)         | ✅ (structured template)    |
| Move issue to In Progress | ❌                  | ✅ (sprint-start mode)      |
| Mark blocked              | ❌                  | ✅ (blocked mode)           |
| Milestone refresh         | ❌                  | ✅ (milestone-refresh mode) |
| Create missing issues     | ❌                  | ✅                          |
| Cycle assignment          | ❌                  | ✅                          |
| Label management          | ❌                  | ✅                          |

**Recommendation**: Keep both. `/status-sync` does a lightweight "move to Done
and post a comment" as part of the broader truth update. `/linear-sync` is the
full-featured tool when you need to start a sprint, handle blockers, or refresh
milestones.

Over time, `/status-sync` Step 7 can delegate to `/linear-sync sprint-complete`
internally. For now, either path is valid — running both is idempotent (the
second sync will see the issue is already Done and skip the state change).

---

## Future Evolution

### Should this stay a skill?

**Yes, for now.** Skills are the right abstraction for a multi-step,
context-dependent workflow that requires reading repo truth + calling external
APIs. A hook or script cannot make the judgment calls this skill makes (finding
the right issue, determining milestone impact, handling missing data).

### Should parts fold into /status-sync?

The `sprint-complete` mode overlaps with `/status-sync` Step 7. Long term:

- `/status-sync` should call `/linear-sync sprint-complete` as a sub-step
- `/linear-sync` retains `sprint-start`, `blocked`, and `milestone-refresh` as
  standalone modes

This avoids duplication while keeping the modes separate.

### Hook recommendation

After 5+ sprint cycles:

```json
// .claude/hooks.json (future)
{
  "post_tool_use": [
    {
      "tool": "Bash",
      "pattern": "git checkout -b sprint/",
      "message": "Sprint branch created. Run /linear-sync sprint-start <SPRINT-NAME>"
    }
  ]
}
```

A lightweight reminder when a sprint branch is created. Not automation — just a
nudge.

**Verdict: Explicit for now. Reminder hook after 5 cycles.**

---

## Skill Directory

```
.claude/skills/linear-sync/
├── SKILL.md              # 7-step procedure, 4 modes
├── MAPPING_RULES.md      # Field mapping, labels, cycle, milestone, guard rules
└── COMMENT_TEMPLATES.md  # Structured comment formats for each mode
```

---

## Linear Workspace Reference

| Entity          | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| Workspace       | Unit Talk                                                        |
| Team            | Unit Talk (`5aa1b0e9-a5af-43ad-8fb9-040efd4fa255`)               |
| Issue prefix    | `UNI-`                                                           |
| Workflow states | Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate |
| Custom labels   | sprint, infra, P0-urgent, P1-high                                |
| Default labels  | Bug, Improvement, Feature                                        |
