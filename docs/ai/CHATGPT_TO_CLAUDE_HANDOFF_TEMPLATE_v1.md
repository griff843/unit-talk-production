# ChatGPT → Claude Code Handoff Template v1

> **Version**: v1 | **Status**: Active **Last Updated**: 2026-03-15
> **Authority**: `docs/ai/AI_OPERATING_DOCTRINE_v1.md` §ChatGPT → Claude Code
> Handoff Standard

---

## Purpose

This template standardizes implementation handoffs from ChatGPT reasoning into
Claude Code execution. A well-formed handoff eliminates ambiguity, prevents
scope creep, and gives Claude Code exactly what it needs to implement correctly
on the first attempt.

Use this template whenever ChatGPT produces an implementation recommendation
that will be executed in Claude Code.

---

## When to Use This Template

| Trigger                                                              | Use handoff template? |
| -------------------------------------------------------------------- | --------------------- |
| ChatGPT produced an architecture decision that requires code changes | Yes                   |
| ChatGPT diagnosed an incident and identified a code fix              | Yes                   |
| ChatGPT shaped a sprint and produced a task list                     | Yes                   |
| Simple one-file fix with no architecture ambiguity                   | Optional              |
| Continuing an in-progress sprint (already has context)               | No — use sprint plan  |

---

## Usage Guide

1. **Fill in ChatGPT** — after architecture or diagnosis output, ask ChatGPT to
   populate this template for the implementation it is recommending.
2. **Review before pasting** — check Scope and Non-Goals carefully. Scope creep
   enters here.
3. **Paste into Claude Code** — the filled template becomes the implementation
   prompt.
4. **Claude Code executes** — using the source of truth and constraints defined
   below.
5. **Verify output** — per the Verification Steps and Success Criteria sections.
6. **Route to Claude OS** — if the task changes system behavior, Claude OS
   verification is mandatory before marking complete.

> See
> `docs/ai/AI_OPERATING_DOCTRINE_v1.md §ChatGPT → Claude Code Handoff Standard`
> for the authoritative field list.

---

## Template

Copy the block below. Fill all fields. Do not omit fields — a missing field is a
known ambiguity risk.

```markdown
## Handoff: <SPRINT-NAME or short task description>

**Objective** <One sentence: what must be true when this is done?>

**Why It Matters** <One to two sentences: what breaks or degrades if this is not
done? What does this unlock?>

**Scope** <Explicit boundaries of what is included. Name files, subsystems, or
behaviors that are in scope. Be specific.>

**Non-Goals**
<Explicit boundaries of what is NOT included. Name things that may seem related
but should not be touched.>

**Source of Truth** <The canonical reference Claude Code must consult before
writing code. Usually: a docs file, an existing implementation pattern, a
governance contract, or a specific file path. Name it explicitly.> Example:
`apps/api/src/lib/lifecycle/` (existing pattern),
`docs/contracts/PICK_LIFECYCLE_CONTRACT.md`

**Constraints / Invariants** <Hard rules that cannot be violated. These
typically come from:

- CLAUDE_EXECUTION_CONTRACT.md
- docs/SYSTEM_INVARIANTS.md
- Single-writer policy (CLAUDE.md §4)
- Migration immutability rules (.claude/rules/02-db-migrations.md)> Example:
- All unified_picks writes must use lifecycle adapters
- No direct DB writes outside lifecycle module
- Rollback must be possible for any schema change

**Implementation Tasks** <Numbered, ordered list. Each task should be
completable and verifiable independently.>

1.
2.
3.

**Verification Steps**
<How to confirm the implementation is correct. Include specific commands.>

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] `npm run lifecycle:single-writer -- --strict` passes (if unified_picks
      touched)
- [ ] <task-specific behavioral check>

**Output Format** <What should be delivered: diff, file list, proof artifact,
test result, or a specific document?>

**Success Criteria** <Observable, unambiguous conditions that define "done."
Each must be verifiable without human interpretation.>

- <Criterion 1>
- <Criterion 2>
```

---

## Filled Example

```markdown
## Handoff: SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT

**Objective** Wire the Temporal startWorkflow call in
`apps/command-center/src/app/api/replay/route.ts` and connect replay triggers to
the Command Center UI.

**Why It Matters** The replay endpoint was scaffolded in SPRINT-044 but the
Temporal call is still a TODO. Without this, operators cannot trigger replay
from the CC UI, leaving the replay system non-functional despite being otherwise
complete.

**Scope**

- `apps/command-center/src/app/api/replay/route.ts` — wire startWorkflow
- `apps/command-center/src/app/replay/` — add UI trigger button
- Vitest unit tests for the route handler

**Non-Goals**

- Do not change the Temporal workflow definition itself
- Do not touch other Command Center routes
- Do not add new Temporal workers or activities

**Source of Truth**

- Existing Temporal client usage: `apps/api/src/` (scan for startWorkflow
  pattern)
- Auth context pattern: `apps/command-center/src/lib/auth.ts` (from SPRINT-049)
- Replay route scaffold: `apps/command-center/src/app/api/replay/route.ts`

**Constraints / Invariants**

- Actor identity must come from auth context, not hardcoded
- Route must be protected — unauthenticated requests must be rejected
- Idempotency: same replay params should not start duplicate workflows

**Implementation Tasks**

1. Audit `apps/command-center/src/app/api/replay/route.ts` for the existing TODO
2. Wire `startWorkflow` using the Temporal client (match pattern from apps/api/)
3. Add actor identity from auth context to the workflow input
4. Add a replay trigger button to the Command Center replay page
5. Add vitest unit tests for the route handler

**Verification Steps**

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes (including new vitest tests)
- [ ] Replay API accepts POST with replay params — returns 200 and workflow ID
- [ ] Actor identity appears in workflow input (not hardcoded)
- [ ] Unauthenticated POST returns 401

**Output Format** Code diffs + vitest test file + proof artifacts in
`out/sprints/SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT/<date>/`

**Success Criteria**

- Replay API accepts POST with replay params and starts a Temporal workflow
- Actor identity is sourced from auth context
- UI has a functional trigger button
- All merge gates pass
```

---

## Related Documents

| Document                                  | Purpose                            |
| ----------------------------------------- | ---------------------------------- |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md`     | Handoff standard authority         |
| `docs/ai/AI_TASK_ROUTING_MATRIX_v1.md`    | When to use this handoff           |
| `docs/ai/AI_PREFLIGHT_CHECKLIST_v1.md`    | What to confirm before handing off |
| `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md` | Sprint execution after handoff     |
| `CLAUDE_EXECUTION_CONTRACT.md`            | Non-negotiable invariants          |
