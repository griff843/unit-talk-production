# Skill: Sprint Plan

## Purpose

Read current Unit Talk truth docs and produce the next best sprint
recommendation: sprint name, goal, rationale, model choice, and a ready-to-paste
implementation prompt. Eliminates guesswork and stale-context planning.

## Invocation

```
/sprint-plan
```

Or with an override hint:

```
/sprint-plan [--force <SPRINT-NAME>] [--audit]
```

- `--force <SPRINT-NAME>` — Skip queue selection; plan the named sprint directly
- `--audit` — Force a truth/audit sprint regardless of queue

---

## Inputs (read in order)

```bash
cat docs/status/CURRENT_SYSTEM_STATUS.md
cat docs/status/PHASE_STATUS.md
cat docs/status/NEXT_5_SPRINTS.md
cat docs/status/DRIFT_REPORT.md

# Also read the most recent sprint closeout if available
ls -t out/sprints/*/*/SPRINT_CLOSEOUT_REPORT.md | head -1
```

Do not proceed until all four status docs are read.

---

## Procedure

### Step 1: Check Status Doc Freshness

```bash
grep "Last Updated" docs/status/CURRENT_SYSTEM_STATUS.md
grep "Last Updated" docs/status/NEXT_5_SPRINTS.md
```

If any canonical status doc was last updated **more than 3 sprints ago**
(roughly 2 weeks), **STOP** — recommend running `/status-sync` for the most
recent sprint before planning. Stale context produces wrong sprint selection.

If the most recent sprint closeout exists but `CURRENT_SYSTEM_STATUS.md` was NOT
updated after it, that is a signal to run `/status-sync` first.

### Step 2: Check for Critical Drift Override

Read `docs/status/DRIFT_REPORT.md`. Count CRITICAL items.

Apply `SELECTION_RULES.md §Critical Override`:

| CRITICAL drift count | Action                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| 0                    | Proceed to Step 3                                                              |
| 1–2                  | Check if NEXT_5_SPRINTS Sprint 1 already addresses it; if yes, proceed         |
| 3+                   | Recommend a truth/audit sprint or the drift-fixing sprint before anything else |

If a CRITICAL drift item is NOT addressed by the current Sprint 1 in
`NEXT_5_SPRINTS.md`, insert it as the recommended next sprint and explain why it
overrides the queue.

### Step 3: Validate Sprint 1 Dependencies

Read Sprint 1 from `NEXT_5_SPRINTS.md`. Check its `Depends On` field.

```bash
# Check if blocking sprints are complete
git tag -l | grep "<DEPENDENCY-SPRINT-NAME>"
```

If the dependency sprint tag does not exist on the remote:

```bash
git ls-remote origin refs/tags/<DEPENDENCY-SPRINT-NAME>
```

If the dependency is NOT complete:

- Do not recommend Sprint 1
- Recommend the blocking dependency sprint instead
- Explain the dependency chain in the output

### Step 4: Assess Sprint Type

Classify the recommended sprint using `SELECTION_RULES.md §Sprint Types`:

| Type             | Characteristics                                             |
| ---------------- | ----------------------------------------------------------- |
| **Fix**          | Restores broken functionality; no new design needed         |
| **Migration**    | Moves code to a new pattern; mechanical, high volume        |
| **Feature**      | New capability; requires design decisions                   |
| **Architecture** | Cross-system structural change; affects multiple services   |
| **Audit/Truth**  | Reads and reconciles system state; output is docs, not code |
| **Activation**   | Enables existing code that is currently disabled            |

This classification drives model selection in Step 5.

### Step 4.5: Run LLM Router (New — COS-006)

After sprint type is classified, run the routing engine to emit a governed
multi-LLM routing plan. This step is required for all sprint planning.

```bash
# From repo root — run the routing engine
npx tsx tools/claude-os/src/cli.ts route \
  --sprint "<SPRINT-NAME>" \
  --type "<sprint-type>" \
  --summary "<one-line sprint summary>" \
  --layer "<Layer N>" \
  --phase "<Phase M — Name>" \
  --orchestration-mode A \
  --output-dir "out/sprints/<SPRINT>/<DATE>"
```

The router will:

1. Classify the sprint into work types (implementation, architecture, audit,
   etc.)
2. Assign the relevant execution lanes (Lane 1–6 per `07-lane-model.md`)
3. Route each lane to the optimal model (Sonnet/Opus/Haiku or external advisory)
4. Recommend a Claude Code instance count (SINGLE/TWO/THREE_INSTANCES)
5. Generate structured prompts for external helper LLMs (Mode B/C only)
6. Write `LLM_ROUTING_DECISION.md` to the sprint output directory

**Include the router output in the sprint plan output** (under "LLM Routing
Plan" section). The routing decision is part of the sprint artifact bundle.

Authority: `docs/02_architecture/claude_os_multi_llm_orchestration_blueprint.md`

### Step 5: Choose Model

Apply `MODEL_SELECTION.md` rules. Canonical authority:
`docs/02_architecture/claude_os_ceiling_blueprint.md §6`

| Condition                                             | Model      |
| ----------------------------------------------------- | ---------- |
| Status-only read, health check, no reasoning          | **Haiku**  |
| Fix, Migration, Activation sprint                     | **Sonnet** |
| Feature sprint (clear requirements)                   | **Sonnet** |
| Architecture or cross-system design                   | **Opus**   |
| Audit/Truth sprint                                    | **Opus**   |
| Ambiguous requirements needing reasoning              | **Opus**   |
| Large mechanical refactor (> 10 files, clear pattern) | **Sonnet** |

The generated prompt MUST include both:

- `Model: <Sonnet | Opus | Haiku>`
- `Routing: <one sentence justifying the choice>`

A sprint prompt missing either field is malformed and must be regenerated.

### Step 6: Determine Sprint Number

```bash
# Find highest sprint number used
git tag -l "SPRINT-*" | sort -t'-' -k3 -n | tail -1
```

Increment by 1 for the next sprint. If a sprint was pre-assigned a number in
`NEXT_5_SPRINTS.md`, use that.

### Step 7: Find Linear Issue

```bash
# Search for matching Linear issue
# Use mcp__linear__list_issues with query matching sprint name or objective
```

If found: record issue ID (e.g., `UNI-N`) for inclusion in the prompt. If not
found: note "No matching Linear issue — create one before starting."

### Step 8: Generate Sprint Prompt

Use `PROMPT_TEMPLATES.md` to construct the ready-to-paste sprint prompt.

The prompt MUST include:

- Sprint name and number
- Model recommendation and reason
- Objective (one sentence)
- Context block (relevant status, phase, drift items addressed)
- Task list from `NEXT_5_SPRINTS.md`
- Success criteria
- Linear issue reference (if found)
- Governance reminders (session baseline, proof bundle, status sync)

---

## Output Format

```markdown
## Sprint Plan: <SPRINT-NAME-NNN>

**Model**: Sonnet | Opus — <one-sentence reason> **Type**: Fix | Migration |
Feature | Architecture | Audit | Activation **Priority**: P0 | P1 | P2
**Linear**: UNI-N | (no issue — create before starting) **Phase**: Phase N —
<Name> **Depends On**: <sprint tag or "none">

---

### Rationale

<2–3 sentences: why this sprint now, what it unblocks>

---

### LLM Routing Plan

<output of Step 4.5 — paste router output here>

Work type(s): <classification> Instance mode: <SINGLE_INSTANCE | TWO_INSTANCES |
THREE_INSTANCES>

Lane assignments:

- Lane 1 (Implementation) — Claude Sonnet — Claude Code internal
- Lane 3 (Verification) — Claude Sonnet — Claude Code internal
- Lane 4 (Governance/Docs) — Claude Sonnet — Claude Code internal (adjust based
  on actual router output)

External prompts generated: <count>

---

### Ready-to-Paste Prompt

<full implementation prompt — see PROMPT_TEMPLATES.md>

---

### Pre-Sprint Gate

Before starting, confirm:

- [ ] Session baseline run: `pnpm session:baseline`
- [ ] Status docs fresh (Last Updated within 3 sprints)
- [ ] All dependencies complete (tags exist)
- [ ] Linear issue exists and is In Progress
- [ ] Sprint number confirmed unique
- [ ] LLM routing plan run and output included above
- [ ] `LLM_ROUTING_DECISION.md` written to sprint output directory
```

---

## Failure Protocol

| Failure                                     | Action                                 |
| ------------------------------------------- | -------------------------------------- |
| Status docs older than 3 sprints            | STOP — run `/status-sync` first        |
| Dependency sprint not complete              | Recommend dependency sprint instead    |
| No closeout report for last sprint          | Recommend completing last sprint first |
| 3+ CRITICAL drift items unaddressed         | Recommend truth/audit sprint           |
| Linear unavailable                          | Continue; note "Linear sync pending"   |
| Sprint name collision (tag exists)          | Increment sprint number by 1           |
| `--force` sprint name not in NEXT_5_SPRINTS | Accept with warning                    |

---

## Notes

- This skill **reads only** — it makes no changes to docs or code
- Its output is a **recommendation**, not a binding decision
- The operator may override any recommendation with `--force`
- When in doubt between two equally ranked sprints, prefer the one that unblocks
  more
- See `SELECTION_RULES.md` for complete decision logic
- See `MODEL_SELECTION.md` for full Opus/Sonnet reasoning
- See `PROMPT_TEMPLATES.md` for prompt construction
