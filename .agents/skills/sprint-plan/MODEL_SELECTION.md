# Sprint Plan — Model Selection

## Decision Principle

Choose the **cheapest model that can reliably complete the sprint without
errors**. Sonnet is faster and sufficient for most implementation work. Opus is
justified when the sprint requires sustained multi-system reasoning or
architectural judgment that Sonnet routinely gets wrong.

---

## Quick Reference

```
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

**Signal**: The task list in `NEXT_5_SPRINTS.md` reads as numbered, concrete
steps with no ambiguity about _how_ each step should be implemented.

---

## Opus — Use When

| Condition                                                     | Example Sprint              |
| ------------------------------------------------------------- | --------------------------- |
| Architecture decision affects 3+ services                     | SPRINT-MULTI-BOOK-CONSENSUS |
| New contract design (API, lifecycle, schema shape)            | any Phase 2 scoring work    |
| Cross-system reasoning (provider → scoring → promotion chain) | multi-book consensus        |
| Audit/truth sprint (read + reconcile across large codebase)   | SPRINT-SYSTEM-TRUTH-AUDIT   |
| Sprint has ambiguous requirements needing judgment calls      | any open-ended design       |
| Sprint involves risk-engine logic or probability math         | Phase 3 sprints             |
| The operator explicitly requests maximum quality              | use `--model opus`          |

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

---

## Model Choice in Generated Prompt

The skill MUST include a model directive in the generated prompt header:

```markdown
Model: Sonnet
```

or

```markdown
Model: Opus
```

And a one-sentence justification:

```markdown
Model: Sonnet — this sprint is a mechanical migration of 13 files to a known
lifecycle adapter pattern with no design decisions required.
```

```markdown
Model: Opus — this sprint designs new cross-provider contracts across ingestion,
scoring, and promotion layers requiring multi-system architectural judgment.
```

---

## Current Sprint Queue — Model Assignments (as of 2026-03-09)

| Sprint                           | Type         | Model      | Reason                                  |
| -------------------------------- | ------------ | ---------- | --------------------------------------- |
| SPRINT-TEST-INFRA-RECOVERY       | Fix          | **Sonnet** | Known errors, known fixes, mechanical   |
| SPRINT-SINGLE-WRITER-COMPLETION  | Migration    | **Sonnet** | Same adapter pattern, 13 files          |
| SPRINT-PROMOTION-ACTIVATION      | Activation   | **Sonnet** | Code exists, wire + validate            |
| SPRINT-MULTI-BOOK-CONSENSUS      | Architecture | **Opus**   | New provider contracts + scoring design |
| SPRINT-OPERATIONAL-OBSERVABILITY | Feature      | **Sonnet** | Specific endpoints and CI checks        |
