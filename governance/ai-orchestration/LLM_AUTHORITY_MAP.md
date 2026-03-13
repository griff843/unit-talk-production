# LLM AUTHORITY MAP

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Primary Enforcement Surface: Claude OS

---

## 1. Purpose

Define which model/tool may perform which category of work, and which authority
surfaces are protected from parallel or support-lane modification.

This document exists to prevent:

- model collisions
- architectural drift
- unsafe parallelism
- false ownership
- completion without authority

---

## 2. Core Rule

Not all code is equal.

Some surfaces are operationally critical and must remain under single-writer
control.

Parallel LLM work is allowed only where explicitly permitted.

---

## 3. Model Roles

### GPT-5.4 (ChatGPT)

Role: Chief Architect / Sprint Judge / Status Judge

Allowed to own:

- sprint contracts
- architecture decisions
- standards
- audit framing
- status judgments from evidence
- maturity/rubric evaluation

Not allowed to own:

- direct repo mutation
- implementation claims without evidence
- live repo truth generation

---

### Claude Code

Role: Primary Builder / Protected Surface Implementer

Allowed to own:

- production implementation
- protected authority surface changes
- multi-file refactors
- Claude OS upgrades
- state machine changes
- schema-aligned service logic

Preferred owner for:

- scoring
- settlement
- publish/outbox
- routing/status engine
- contract enforcement

---

### Codex

Role: Parallel Support Executor / Repo Inspector

Allowed to own:

- tests
- CI guard additions
- documentation sync
- low-risk helper tooling
- bounded package cleanup
- repo inspection and factual analysis

Not allowed to own independently:

- protected authority surface redesign
- single-writer state machines
- canonical maturity logic
- governance law changes

---

### Gemini

Role: Large-Context Analyst / External Research Synthesizer

Allowed to own:

- large-scale synthesis
- spec drift analysis
- external pattern research
- comparative architecture analysis

Not allowed to own:

- production code changes
- repo authority surfaces
- system completion claims

---

## 4. Authority Surface Table

| Surface                   | Classification | Primary Owner    | Parallel Allowed | Required Proof                 |
| ------------------------- | -------------- | ---------------- | ---------------: | ------------------------------ |
| Scoring authority         | Protected      | Claude Code      |               No | tests + runtime + status delta |
| Promotion authority       | Protected      | Claude Code      |               No | tests + runtime                |
| Settlement authority      | Protected      | Claude Code      |               No | tests + DB proof               |
| Discord publish authority | Protected      | Claude Code      |               No | runtime + receipt              |
| Outbox state machine      | Protected      | Claude Code      |               No | tests + runtime                |
| Canonical schema contract | Protected      | Claude Code      |               No | schema proof + tests           |
| Env truth contract        | Protected      | Claude Code      |               No | boot/runtime proof             |
| Routing/status engine     | Protected      | Claude Code      |               No | tests + status artifact        |
| Docs                      | Standard       | Claude/Codex     |              Yes | diff                           |
| CI scripts                | Standard       | Codex/Claude     |              Yes | pass log                       |
| Test suites               | Standard       | Codex/Claude     |              Yes | pass log                       |
| Read-only analysis        | Standard       | Codex/Gemini/GPT |              Yes | analysis artifact              |

---

## 5. Parallelism Rules

### Allowed Parallelism

Permitted when all conditions are true:

1. task does not touch a protected authority surface
2. task scope is bounded
3. task output can be validated independently
4. task does not redefine standards or status law

Examples:

- docs updates
- test additions around stable contracts
- CI assertions
- helper scripts
- repo inventory reports

---

### Forbidden Parallelism

Forbidden when any condition is true:

1. task mutates protected state logic
2. task changes state transition semantics
3. task alters canonical schema truth
4. task affects maturity/status judgment engine
5. task changes routing/publish/settlement authority

If forbidden, the task must be owned by Claude Code alone.

---

## 6. Escalation Rules

Escalate to Claude Code if:

- multiple files across protected surfaces are affected
- system invariants are at stake
- runtime behavior changes
- state machines change
- schema alignment is required

Escalate to GPT-5.4 if:

- sprint scope is unclear
- architecture tradeoffs are involved
- maturity/status interpretation is needed
- standards conflict

Escalate to Codex if:

- work is verification-heavy
- support task is isolated
- factual repo analysis is required

Escalate to Gemini if:

- context is too large
- drift analysis spans many artifacts
- external pattern synthesis is useful

---

## 7. Enforcement Requirements

Claude OS must:

- require surface classification before execution
- block conflicting parallel tasks
- record ownership per task
- require elevated proof for protected surfaces
- reject unsupported ownership changes

---

## 8. Failure Conditions

This map is considered violated if:

- Codex changes protected authority logic without Claude ownership
- a task runs without surface classification
- parallel work touches the same protected surface
- a status artifact is produced without authorized evidence

---

## 9. Definition of Correct Operation

The authority model is functioning correctly only when:

- protected surfaces have one builder at a time
- support lanes stay bounded
- all critical changes are proof-gated
- status claims are owned by the correct lane
- model collisions are prevented before execution

10. Authority Freeze Rule

If a sprint is active against a protected surface, no second sprint may begin
touching that surface until the first sprint closes or is explicitly aborted.

---

END
