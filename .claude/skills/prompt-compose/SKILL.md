# Skill: Prompt Compose

## Purpose

Convert an approved sprint direction or approved architecture decision into a
Claude-ready implementation prompt using the governed handoff template. Enforces
that all required fields — scope, constraints, canonical sources, acceptance
criteria, proof expectations — are present before handing off to Claude Code.

**Portability class:** Portable Core (template and procedure are fully reusable
across projects)

## Invocation

```
/prompt-compose
```

Or with a sprint name hint:

```
/prompt-compose --sprint <SPRINT-NAME>
```

---

## When to Use

Run `/prompt-compose` when:

- Architecture direction has been reviewed and approved
- A sprint was selected via `/sprint-plan` and you're ready to hand it to Claude
  Code
- A remediation path from an audit or incident was approved and needs exact
  implementation guardrails
- A previous implementation attempt drifted or produced rework — the prompt was
  underspecified

**Critical distinction:** `/sprint-plan` selects _which_ sprint to run and
generates a rationale. `/prompt-compose` turns the _approved_ direction into an
implementation-ready prompt that Claude Code can execute without ambiguity.

**Do not skip this step.** Underdetermined prompts are the primary cause of
implementation drift and rework.

---

## Required Inputs (operator must confirm all)

Before generating the prompt, the operator must have ready:

| Input                                       | Source                                                                   | Required?    |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| Approved sprint name / objective            | `/sprint-plan` output or operator decision                               | **Required** |
| Scope: what files/subsystems are in scope   | Sprint plan tasks or architecture decision                               | **Required** |
| Non-goals: what must NOT be touched         | Sprint plan or architecture review                                       | **Required** |
| Source of truth: canonical docs or patterns | Codebase + docs/                                                         | **Required** |
| Constraints / invariants                    | `CLAUDE_EXECUTION_CONTRACT.md`, `docs/SYSTEM_INVARIANTS.md`, `CLAUDE.md` | **Required** |
| Acceptance criteria                         | Sprint plan success criteria                                             | **Required** |
| Verification steps                          | Known test commands, gate commands                                       | **Required** |
| Output format                               | What artifacts are expected                                              | **Required** |

---

## Optional Inputs

- Prior failed attempt summary (if this is a retry)
- Known risk areas or gotchas
- Related recent sprint closeout for context
- Linear issue ID for reference
- LLM routing decision (from `sprint-plan` output)

---

## Procedure

### Step 1: Confirm Approved Direction Exists

Before composing, verify that the sprint or architecture direction being handed
off has been reviewed. Do not compose a prompt for an unreviewed idea.

Ask:

- "Has this sprint direction been selected via `/sprint-plan` or explicitly
  approved by the operator?"
- "Is the scope well-defined enough to bound Claude Code's execution?"
- "Are the non-goals explicit?"

If any of these are unclear, **STOP** and resolve before composing.

### Step 2: Read Canonical Sources

Read the documents that the implementation must respect:

```bash
# Always read these for any sprint prompt
cat docs/status/CURRENT_SYSTEM_STATUS.md    # current system state
cat docs/status/PHASE_STATUS.md             # current phase
cat CLAUDE_EXECUTION_CONTRACT.md            # non-negotiable invariants
```

Read additional sources depending on scope:

```bash
# If touching unified_picks or lifecycle
cat docs/contracts/PICK_LIFECYCLE_CONTRACT.md
cat .claude/rules/03-single-writer-and-idempotency.md

# If touching DB migrations
cat .claude/rules/02-db-migrations.md

# If touching Command Center
# Check existing CC auth pattern and proxy conventions

# If touching agents or API behavior
cat docs/SYSTEM_INVARIANTS.md
```

### Step 3: Extract Current Phase and Layer Context

From `PHASE_STATUS.md`, confirm:

- Which layer/phase this sprint belongs to
- Whether this phase has active blockers

From `NEXT_5_SPRINTS.md` (if available), confirm:

- The sprint is queued or approved
- Dependencies are met

### Step 4: Fill the Handoff Template

Use the template from `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md`.

The filled template is the prompt. Every field is required. A field left blank
or vague is a known ambiguity risk.

```markdown
## Handoff: <SPRINT-NAME>

**Objective** <One sentence: what must be true when this is done?>

**Why It Matters** <One to two sentences: what breaks or degrades if this is not
done? What does this unlock?>

**Scope** <Explicit list of files, subsystems, or behaviors that are in scope.
Be specific. Name paths where possible.>

**Non-Goals**
<Explicit list of what must NOT be touched. Name things that may seem related
but are out of scope.>

**Source of Truth** <Canonical references Claude Code must consult before
writing code. Name files, contracts, patterns, or directories explicitly.>

**Constraints / Invariants** <Hard rules that cannot be violated. Typically
from:

- CLAUDE_EXECUTION_CONTRACT.md
- docs/SYSTEM_INVARIANTS.md
- Single-writer policy (CLAUDE.md §4)
- Migration rules (.claude/rules/02-db-migrations.md)
- Phase/roadmap sequencing>

**Implementation Tasks** <Numbered, ordered list. Each task completable and
verifiable independently.>

1.
2.
3.

**Verification Steps** <Specific commands to confirm correct implementation.>

- [ ] `npm run type-check` passes
- [ ] `npm run test` passes
- [ ] `npm run lifecycle:single-writer -- --strict` passes (if unified_picks
      touched)
- [ ] <task-specific behavioral check>

**Output Format** <What must be delivered: code diffs, proof artifacts, test
file, specific doc. Include path: `out/sprints/<SPRINT>/<DATE>/`.>

**Success Criteria** <Observable, unambiguous conditions that define "done."
Each verifiable without human interpretation.>

- <Criterion 1>
- <Criterion 2>
```

### Step 5: Quality-Check the Filled Prompt

Before delivering, verify:

- [ ] Objective is a single unambiguous sentence
- [ ] Scope names specific files or subsystems (not "the relevant area")
- [ ] Non-goals explicitly exclude the most common scope-creep candidates
- [ ] Source of Truth names at least one specific file path or contract
- [ ] Constraints include any lifecycle, single-writer, or migration rules that
      apply
- [ ] Tasks are ordered and independently verifiable
- [ ] Verification steps include at minimum: type-check + tests
- [ ] Success criteria are observable without interpretation

If any field fails this check, revise before delivering.

### Step 6: Add Governance Reminders

Append to the prompt:

```markdown
---

**Governance Reminders**

- Run `pnpm session:baseline` before starting
- Run `pnpm pre-sprint-check` to confirm baseline freshness
- Proof artifacts go in `out/sprints/<SPRINT>/<DATE>/`
- Sprint is NOT complete until: committed + tagged + merged to main
- After merge: run `/status-sync <SPRINT-NAME>`
- Linear issue: <UNI-N or "create before starting">
- Layer/Phase: <Layer N / Phase M — Name>
```

### Step 7: Deliver the Prompt

Output the complete filled prompt. The operator pastes it into a new Claude Code
session to begin implementation.

---

## Output Format

The skill outputs one artifact: a complete, ready-to-paste implementation
prompt. It should include:

1. The filled handoff template (all fields)
2. The governance reminders block

No other commentary is needed unless the operator asks for rationale.

---

## Failure Protocol

| Failure                           | Action                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| Approved direction does not exist | STOP — run `/sprint-plan` first                                        |
| Scope cannot be bounded           | STOP — operator must define scope before composing                     |
| Canonical docs unavailable        | Note specifically which docs are missing; compose with explicit caveat |
| Non-goals not definable           | STOP — scope is still ambiguous                                        |
| Sprint prerequisites not met      | Flag in prompt; do not suppress                                        |

---

## Non-Goals

This skill does NOT:

- Decide which sprint to run (use `/sprint-plan`)
- Approve architecture decisions (those must happen before this skill runs)
- Execute implementation (the output is a prompt; Claude Code executes it)
- Replace verification or proof requirements (those are downstream)
- Work without a bounded approved direction

---

## Integration with Claude OS

| This skill uses                                    | Purpose                                             |
| -------------------------------------------------- | --------------------------------------------------- |
| `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Canonical template structure                        |
| `docs/ai/AI_PREFLIGHT_CHECKLIST_v1.md`             | Pre-composition checklist                           |
| `docs/ai/AI_TASK_ROUTING_MATRIX_v1.md`             | Confirms task routing before composing              |
| `CLAUDE_EXECUTION_CONTRACT.md`                     | Non-negotiable constraint source                    |
| `docs/SYSTEM_INVARIANTS.md`                        | System invariant constraint source                  |
| `/sprint-plan`                                     | Natural predecessor — provides the approved sprint  |
| `/status-sync`                                     | Natural successor — runs after the sprint completes |
| `.claude/rules/00-workflow.md`                     | Workflow phase gate reference                       |

---

## Notes

- This skill is the Prompt Composer Agent from the helper architecture docs,
  implemented as an interactive skill procedure — not an autonomous agent
- The output is only as good as the inputs: if the approved direction is vague,
  the prompt will be vague. Do not compose under ambiguity.
- A well-composed prompt eliminates the need for mid-implementation
  clarification and reduces proof failures
- See `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` for the filled example
  (SPRINT-054 replay endpoint) as a quality reference
