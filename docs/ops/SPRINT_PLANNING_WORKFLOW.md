# SPRINT PLANNING WORKFLOW

**Owner**: Engineering Team **Effective**: 2026-03-09 **Sprint**:
SPRINT-BUILD-CLAUDE-SKILL-SPRINT-PLAN **Authority**:
`.claude/skills/sprint-plan/SKILL.md`

---

## Overview

Every Unit Talk sprint starts from canonical truth, not memory. The
`/sprint-plan` skill reads the four status docs, applies selection rules, and
produces a ready-to-paste implementation prompt — including the right model
choice and Linear issue reference.

The output of `/sprint-plan` is the input to the implementation session.

---

## The Planning Loop

```
/status-sync <LAST-SPRINT>     ← update truth after each sprint
         ↓
/sprint-plan                   ← read truth, select next sprint, generate prompt
         ↓
[paste prompt in new session]  ← implement
         ↓
/sprint-proof-bundle           ← capture verification artifacts
         ↓
/status-sync <NEW-SPRINT>      ← close the loop
```

This is the complete Unit Talk sprint cadence. No step should be skipped.

---

## Invocation

### Standard (read queue, select Sprint 1)

```
/sprint-plan
```

### Force a specific sprint

```
/sprint-plan --force SPRINT-MULTI-BOOK-CONSENSUS
```

### Force an audit sprint

```
/sprint-plan --audit
```

---

## What the Skill Reads

| Doc                                    | What it tells the skill                                                |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `docs/status/CURRENT_SYSTEM_STATUS.md` | Which subsystems are broken/partial/verified right now                 |
| `docs/status/PHASE_STATUS.md`          | Which phase milestones are complete; what's blocking phase advancement |
| `docs/status/NEXT_5_SPRINTS.md`        | The prioritized sprint queue with tasks + success criteria             |
| `docs/status/DRIFT_REPORT.md`          | Active drift items that may override the queue                         |
| Most recent closeout report            | What was just completed and what it unblocked                          |

---

## What the Skill Outputs

1. **Sprint recommendation** — name, type, priority, phase
2. **Rationale** — why this sprint now, what it unblocks
3. **Model choice** — Sonnet or Opus with one-sentence justification
4. **Linear issue** — UNI-N reference if found
5. **Ready-to-paste prompt** — complete implementation brief for Claude Code

---

## Examples

### Example 1: Planning the Next Sprint After a Completed Sprint

**Scenario**: SPRINT-TEST-INFRA-RECOVERY just merged and was synced.
NEXT_5_SPRINTS.md now shows SPRINT-SINGLE-WRITER-COMPLETION at position 1.

```
/sprint-plan
```

**Skill output:**

```markdown
## Sprint Plan: SPRINT-SINGLE-WRITER-COMPLETION-116

Model: Sonnet — mechanical migration of 13 files to a known lifecycle adapter
pattern; no design decisions required.

Type: Migration Priority: P0 Linear: UNI-8 (or equivalent) Phase: Phase 1 —
Structural Dominance Depends On: SPRINT-TEST-INFRA-RECOVERY (tag verified ✅)

### Rationale

Single-writer gate is the #1 architectural invariant. 13 allowlisted violations
have missed their target dates (DRIFT-C3). Completing this sprint eliminates the
largest category of architectural debt and fully enforces lifecycle adapter
discipline. It unblocks SPRINT-PROMOTION-ACTIVATION and all Phase 2 work.

### Ready-to-Paste Prompt

SPRINT — SPRINT-SINGLE-WRITER-COMPLETION-116

Model: Sonnet ...
```

---

### Example 2: Planning After a Blocked Sprint

**Scenario**: SPRINT-PROMOTION-ACTIVATION is Sprint 1 but
SPRINT-SINGLE-WRITER-COMPLETION tag does not exist on remote yet.

```
/sprint-plan
```

**Skill output:**

```markdown
⚠️ SPRINT BLOCKED — SPRINT-PROMOTION-ACTIVATION cannot start

Reason: SPRINT-SINGLE-WRITER-COMPLETION is not complete (tag not found on
remote).

Recommended Next Sprint: SPRINT-SINGLE-WRITER-COMPLETION-116

...

Dependency Chain: SPRINT-PROMOTION-ACTIVATION → requires →
SPRINT-SINGLE-WRITER-COMPLETION
```

---

### Example 3: Planning After a Truth/Audit Sprint

**Scenario**: SPRINT-SYSTEM-TRUTH-AUDIT just completed. The docs/status/ layer
was refreshed. No CRITICAL drift items remain. NEXT_5_SPRINTS.md was updated
with a new queue.

```
/sprint-plan
```

**Skill output:**

- Reads the refreshed status docs
- Finds Sprint 1 unblocked
- Generates a clean implementation sprint prompt
- Notes "Status docs freshly audited — high confidence in selection"

---

### Example 4: CRITICAL Drift Overrides the Queue

**Scenario**: DRIFT_REPORT.md has 3 CRITICAL items. Sprint 1 is
SPRINT-MULTI-BOOK-CONSENSUS, which is a Phase 2 feature. None of the 3 CRITICAL
items are addressed by Sprint 1.

```
/sprint-plan
```

**Skill output:**

```markdown
⚠️ CRITICAL DRIFT OVERRIDE

Reason: 3 CRITICAL drift items are unaddressed by current Sprint 1
(SPRINT-MULTI-BOOK-CONSENSUS).

- DRIFT-C1: Test suite broken (blocks all verification gates)
- DRIFT-C2: TypeScript errors (blocks type-check gate)
- DRIFT-C3: Single-writer migration overdue (architectural invariant violated)

Recommended: SPRINT-TEST-INFRA-RECOVERY (addresses DRIFT-C1 + DRIFT-C2)
Overriding: SPRINT-MULTI-BOOK-CONSENSUS

Rationale: Governance gates must be green before feature sprints can be properly
verified and closed. Fix the infrastructure first.
```

---

## Relationship to Existing sprint_plan.md Skill

The existing `.claude/skills/sprint_plan.md` skill structures the _plan
document_ for a sprint you've already chosen. The new `/sprint-plan` skill
**chooses which sprint to do** and generates the complete prompt to kick it off.

Use them in sequence:

```
/sprint-plan         ← what sprint and why (this skill)
    ↓
[paste generated prompt → implementation]
    ↓
(internally, sprint plan doc is written per sprint_plan.md conventions)
```

They are complementary, not redundant.

---

## Hook Recommendation

### Now: No hooks

`/sprint-plan` is an explicit invocation. It reads only — it cannot accidentally
change anything. Hooking it to run automatically (e.g., after every session
baseline) would add noise to sessions that aren't planning a sprint.

Keep it explicit until the planning loop is habitual (5+ sprint cycles).

### Later: Pair with status-sync as a planning prompt

After the workflow is stable, consider a lightweight post-merge reminder:

```json
// .claude/hooks.json (future)
{
  "post_tool_use": [
    {
      "tool": "Bash",
      "pattern": "git push origin main",
      "message": "Sprint merged. Next steps:\n1. /status-sync <SPRINT-NAME>\n2. /sprint-plan (to select next sprint)"
    }
  ]
}
```

This reminds without automating. The human still reviews and pastes the
generated prompt — which is the correct control point.

**Verdict: Explicit for now. Add reminder hook after 5 sprint cycles.**

---

## Skill Directory

```
.claude/skills/sprint-plan/
├── SKILL.md              # Canonical 8-step procedure (invoke with /sprint-plan)
├── SELECTION_RULES.md    # When to override queue, drift rules, audit trigger, type classification
├── MODEL_SELECTION.md    # Sonnet vs Opus decision rules with examples
└── PROMPT_TEMPLATES.md   # Ready-to-paste prompt templates by sprint type
```

---

## Suggested Workflow (Full Cadence)

```
After merging a sprint:
  1. /sprint-proof-bundle <SPRINT>    (if not already done)
  2. /status-sync <SPRINT>            (update truth + Linear)
  3. /sprint-plan                     (select and generate next sprint)
  4. [paste prompt → new session]     (implement)
  5. repeat
```

The two skills together (`/status-sync` + `/sprint-plan`) form a complete
close-then-open loop. Closing a sprint without opening the next is half a
workflow.
