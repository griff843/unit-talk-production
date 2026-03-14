# Sprint Plan — Model Selection

> **Canonical Authority**: The routing matrix in this file is governed by
> `docs/02_architecture/claude_os_ceiling_blueprint.md §6`. If this file
> conflicts with that document, the blueprint wins. Update this file to resolve
> any divergence.

## Decision Principle

Choose the **cheapest model that can reliably complete the sprint without
errors**. Haiku for pure read/status work. Sonnet for most implementation work.
Opus when the sprint requires sustained multi-system reasoning or architectural
judgment that Sonnet routinely gets wrong.

---

## Quick Reference

```
Is the sprint purely reading status, querying health, or running a known script?
  → Haiku

Is the sprint primarily writing or moving code to a known pattern?
  → Sonnet

Does the sprint require designing NEW cross-service contracts or
    reasoning about ambiguous architectural tradeoffs?
  → Opus

Is the sprint reading docs, reconciling system state, and updating files?
  → Opus

Does the sprint objective fit in a clear, mechanical task list?
  → Sonnet
```

---

## Haiku — Use When

| Condition                                                | Example                           |
| -------------------------------------------------------- | --------------------------------- |
| Status check only (read current_phase.md, report status) | `/status-sync` read phase         |
| Health endpoint query (no reasoning)                     | agent_health table check          |
| Simple known-pattern script generation                   | bash script from a known template |
| Sprint dependency tag existence check                    | `git ls-remote` check             |
| Single-file read with no cross-system reasoning needed   | read one config file, summarize   |

**Signal**: The task is read-only or purely mechanical with no judgment calls.
If a status check reveals something unexpected, escalate to Sonnet or Opus.

---

## Sonnet — Use When

| Condition                                                     | Example Sprint                  |
| ------------------------------------------------------------- | ------------------------------- |
| Test fix (known errors, known fixes)                          | SPRINT-TEST-INFRA-RECOVERY      |
| Mechanical migration (same pattern, many files)               | SPRINT-SINGLE-WRITER-COMPLETION |
| Feature with clear spec (inputs/outputs defined)              | SPRINT-PROMOTION-ACTIVATION     |
| Script writing or operational tooling                         | any ops/tooling sprint          |
| Documentation generation (from known facts)                   | any docs sprint                 |
| Build fix (clear error → known fix)                           | any CI/build fix                |
| Activation sprint (existing code, toggle a flag + wire it up) | SPRINT-PROMOTION-ACTIVATION     |
| Claude OS governance doc update (mechanical)                  | COS-001, COS-004                |

**Signal**: The task list reads as numbered, concrete steps with no ambiguity
about _how_ each step should be implemented.

---

## Opus — Use When

| Condition                                                     | Example Sprint                          |
| ------------------------------------------------------------- | --------------------------------------- |
| Architecture decision affects 3+ services                     | SPRINT-MULTI-BOOK-CONSENSUS             |
| New contract design (API, lifecycle, schema shape)            | Layer 1/Ph 2 scoring work (Data Truth)  |
| Cross-system reasoning (provider → scoring → promotion chain) | multi-book consensus                    |
| Audit/truth sprint (read + reconcile across large codebase)   | SPRINT-SYSTEM-TRUTH-AUDIT               |
| Sprint has ambiguous requirements needing judgment calls      | any open-ended design                   |
| Sprint involves risk-engine logic or probability math         | Layer 2/Ph 6-7 (Operator + Reliability) |
| Blueprint / ceiling definition sprint                         | SPRINT-CLAUDE-OS-CEILING-BLUEPRINT-\*   |
| The operator explicitly requests maximum quality              | use `--model opus`                      |

**Signal**: The task list has items like "design X", "evaluate Y", "decide how
to handle Z", or the sprint spans multiple packages without a clear mechanical
path.

---

## Edge Cases

### "It's a migration but I'm not sure of the pattern"

→ Use **Opus** for the first instance of this migration type, then switch to
Sonnet for remaining mechanical repetition.

### "It's an audit but the scope is narrow (one file)"

→ Use **Sonnet**. Opus is justified for multi-system audits, not single-file
analysis.

### "It's a feature but the spec is vague"

→ Use **Opus**. Vague requirements + feature work = design reasoning = Opus
territory. Alternatively, clarify the spec first (use Opus for planning, Sonnet
for implementation).

### "The sprint is very long (5+ days estimated)"

→ Use **Opus** for the planning prompt. Break the sprint into smaller units and
re-evaluate model per sub-unit.

### "It's a status check that revealed a problem"

→ Escalate from **Haiku** to **Sonnet** or **Opus** depending on the nature of
the problem. The discovery step is Haiku; the fix sprint is classified normally.

---

## Model Choice in Generated Prompt

The skill MUST include a `Model:` and `Routing:` directive in the generated
prompt header. Both fields are required. A sprint prompt missing either field is
malformed.

```markdown
Model: Sonnet Routing: this sprint is a mechanical migration of 13 files to a
known lifecycle adapter pattern with no design decisions required.
```

```markdown
Model: Opus Routing: this sprint designs new cross-provider contracts across
ingestion, scoring, and promotion layers requiring multi-system architectural
judgment.
```

```markdown
Model: Haiku Routing: status-only read of current_phase.md and agent_health
table; no implementation or reasoning required.
```

The `Routing:` field must be a single sentence that references the sprint type
category from `claude_os_ceiling_blueprint.md §6`. It is the auditable record of
why this model was chosen.

---

## Routing Escalation Protocol

If the selected model fails to complete the sprint cleanly:

| Escalation Trigger                          | Action                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| Sonnet produces incorrect output in Phase 2 | Document failure, escalate to Opus for that phase        |
| Haiku misses a non-obvious status condition | Escalate to Sonnet, re-run status check                  |
| Opus produces over-engineered output        | Scope-reduce the sprint; re-run with tighter constraints |

Escalation must be documented in the sprint plan notes with the original model,
escalation model, and reason.

---

## Current Sprint Queue — Model Assignments

> Note: The table below reflects the active sprint queue. Update when the queue
> changes. See `docs/status/NEXT_5_SPRINTS.md` for the authoritative queue. This
> table is a convenience reference only.

| Sprint                                               | Type       | Model      | Reason                                         |
| ---------------------------------------------------- | ---------- | ---------- | ---------------------------------------------- |
| SPRINT-CLAUDE-OS-CEILING-BLUEPRINT-CANONICALIZATION  | Blueprint  | **Sonnet** | Mechanical doc synthesis from existing context |
| SPRINT-CLAUDE-OS-COS001-MODEL-ROUTING-FORMALIZATION  | Governance | **Sonnet** | Mechanical doc update to known template format |
| SPRINT-RISK-DASHBOARD-MONITORING (Layer 2 / Phase 7) | Feature    | **Sonnet** | Specific endpoints + CI checks; clear spec     |
