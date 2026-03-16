# AI Operating Doctrine v1

> **Version**: v1 | **Status**: Active **Last Updated**: 2026-03-15
> **Authority**: This document governs AI tool routing and collaboration
> standards for Unit Talk. It does not change runtime system invariants,
> application contracts, or production authority boundaries.

---

## Purpose

This document defines the official AI operating model for Unit Talk.

Its purpose is to ensure work is routed through the correct AI systems in the
correct order so that architecture quality, implementation quality, verification
quality, and operator efficiency all improve over time.

This doctrine exists to eliminate:

- ambiguous tool routing
- duplicated reasoning
- wasted prompting
- low-context decisions
- unverifiable implementation loops
- drift between architecture, implementation, and governance

This document is an operating artifact, not a brainstorming note.

---

## Scope

This doctrine governs how work flows through:

- ChatGPT
- Claude Code
- Claude OS
- MCP servers
- Claude skills
- AI context bundle artifacts

It applies to:

- architecture decisions
- implementation work
- incident diagnosis
- governance review
- operator workflows
- intelligence/model review
- workflow/process design

It does not change runtime system invariants, application contracts, or
production authority boundaries. It governs how humans and AI collaborate around
those systems.

---

## Core Principle

Unit Talk uses a multi-AI operating model.

Each AI/tool has a distinct role:

- **ChatGPT** = architecture, audits, reasoning, sprint shaping, high-level
  diagnosis
- **Claude Code** = repo implementation and code modification
- **Claude OS** = governance, proof, verification, closeout, and sprint
  lifecycle enforcement
- **MCP + skills** = structured operational/system truth for diagnostics and
  inspection
- **AI context bundle** = the snapshot bridge that gives ChatGPT structured
  awareness of the current system

The system is strongest when each tool stays in its lane.

---

## Objectives

The objectives of this doctrine are:

1. Route each task to the correct AI/tool first
2. Ensure serious work begins with sufficient context
3. Standardize handoffs between reasoning, implementation, and governance
4. Make the workflow repeatable and low-friction
5. Reduce wrong turns, duplicate work, and re-explanation
6. Create a reusable AI operating standard that can later be adapted to other
   projects

---

## AI System Roles

### 1. ChatGPT

ChatGPT is the architecture and reasoning layer.

Use ChatGPT for:

- architecture design
- roadmap sequencing
- sprint shaping
- workflow design
- intelligence/model review
- system simplification
- tradeoff analysis
- high-level incident diagnosis
- converting complex intent into implementation-ready prompts

ChatGPT should usually be the first stop when:

- the task is ambiguous
- the problem is architectural
- the correct implementation approach is not yet settled
- a diagnosis requires synthesis across multiple systems
- the user wants strategic guidance, not just code edits

ChatGPT should not be treated as the primary repo editor.

> See `docs/ai/LLM_DECISION_PLAYBOOK.md` for the detailed tool routing guide and
> ChatGPT-specific prompt templates.

---

### 2. Claude Code

Claude Code is the implementation layer.

Use Claude Code for:

- code changes
- file creation
- repo edits
- package wiring
- refactors
- controlled implementation tasks
- code-level follow-through on approved architecture

Claude Code should usually be the first stop when:

- the task is already clear
- the implementation path is settled
- a scoped prompt already exists
- the work is primarily in-repo execution

Claude Code should not be used as the first tool for unresolved architectural
ambiguity unless the task is trivial.

---

### 3. Claude OS

Claude OS is the governance and verification layer.

Use Claude OS for:

- sprint lifecycle management
- verification
- proof generation
- closeout
- tags
- findings/backlog automation
- status sync
- controlled progression of sprint state

Claude OS should be invoked whenever work changes system behavior and needs
governed verification.

Claude OS is not a substitute for architecture reasoning or ad-hoc debugging.

> Authority: `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`

---

### 4. MCP + Claude Skills

MCP and Claude skills are the structured truth and diagnostics layer.

Use MCP/skills for:

- health inspection
- pick lifecycle tracing
- SLO inspection
- system state inspection
- structured, repeatable operator diagnostics

The initial skill set includes:

| Skill           | Invocation                | Purpose                                           |
| --------------- | ------------------------- | ------------------------------------------------- |
| Pipeline Health | `/pipeline-health`        | Agent health, outbox depth, SLOs, platform status |
| Pick Trace      | `/pick-trace <uuid>`      | Full lifecycle trace for a single pick            |
| SLO Report      | `/slo-report [--context]` | SLO attainment report with gap analysis           |
| Edge Check      | `/edge-check`             | CLV edge and model calibration audit              |

MCP/skills should be used before high-level diagnosis when the issue is
primarily about current system state.

> Skill definitions: `.claude/skills/` — see `pipeline-health.md`,
> `pick-trace.md`, `slo-report.md`, `edge-check.md`

---

### 5. AI Context Bundle

The AI context bundle is the visibility bridge for ChatGPT.

The canonical entrypoint is:

```bash
pnpm ai:context
```

This generates `out/ai/context/context_bundle.md` — a structured,
ChatGPT-pasteable snapshot of current repo and system truth including platform
overview, subsystem health, sprint queue, drift summary, and MCP layer state.

The context bundle should be treated as the default preflight input for serious
ChatGPT work.

> Implementation: `scripts/ai/build-context-bundle.mjs`

---

## Task Lanes

All serious work should enter through one of the following lanes.

> **Note**: These are task entry lanes — they govern how a human routes work
> into the AI system. They are distinct from the parallel execution lanes
> defined in `.claude/rules/07-lane-model.md`, which govern internal Claude Code
> sprint parallelism.

### Lane 1 — Architecture Lane

Use when:

- deciding system design
- sequencing roadmap work
- resolving tradeoffs
- designing a new subsystem
- simplifying complexity
- shaping a sprint before implementation

Flow:

1. Run `pnpm ai:context`
2. Bring the latest context bundle to ChatGPT
3. Ask for architecture output, audit output, or sprint shaping
4. Convert the result into a Claude Code implementation prompt if implementation
   is needed
5. Route completed implementation through Claude OS verification

Owner:

- ChatGPT first
- Claude Code second
- Claude OS final

---

### Lane 2 — Diagnosis Lane

Use when:

- a platform issue exists
- a pick behaved unexpectedly
- SLO health is in question
- Discord delivery may be broken
- lifecycle state is unclear
- a live-system issue requires structured diagnosis

Flow:

1. Run the relevant Claude skills first
2. Gather structured outputs
3. Run `pnpm ai:context` if a fresh context bundle is not already available
4. Bring the skill outputs plus context bundle to ChatGPT
5. Ask for diagnosis, likely root cause, and fix strategy
6. If code changes are required, route implementation to Claude Code
7. Verify fixes through Claude OS where appropriate

Owner:

- MCP/skills first
- ChatGPT second
- Claude Code third
- Claude OS final

---

### Lane 3 — Implementation Lane

Use when:

- the work is already clearly defined
- architecture is already settled
- the task is implementation-ready
- only repo execution remains

Flow:

1. Start with a structured implementation prompt
2. Send directly to Claude Code
3. Route the result through Claude OS verification
4. Bring back to ChatGPT only if architectural review or reconciliation is
   needed

Owner:

- Claude Code first
- Claude OS second

---

### Lane 4 — Governance Lane

Use when:

- reviewing sprint proof
- validating closeout quality
- checking compliance with invariants
- deciding whether a sprint is truly complete
- reconciling governance artifacts or status docs

Flow:

1. Gather Claude OS artifacts
2. Bring them to ChatGPT if analytical review is needed
3. Resolve any gaps
4. Close and sync using Claude OS

Owner:

- Claude OS first
- ChatGPT second if needed

---

### Lane 5 — Intelligence Review Lane

Use when:

- reviewing CLV behavior
- checking scoring drift
- evaluating calibration
- reviewing strategy outcomes
- evaluating risk logic
- making data moat or modeling decisions

Flow:

1. Run `pnpm ai:context`
2. Add task-specific intelligence artifacts
3. Use relevant skill outputs if available
4. Ask ChatGPT for model/intelligence analysis
5. Route approved implementation work to Claude Code
6. Verify via Claude OS if system behavior changes

Owner:

- ChatGPT first
- Claude Code second
- Claude OS final

> See `docs/ai/intelligence-reviews/` for structured review procedures: edge
> drift, strategy performance, model calibration.

---

## Mandatory Routing Rules

### Rule 1

If the task is ambiguous, start in ChatGPT.

### Rule 2

If the task is a live-system issue, use MCP/skills first.

### Rule 3

If the task is implementation-ready and well-scoped, go directly to Claude Code.

### Rule 4

If the task changes system behavior, Claude OS verification is mandatory before
calling it complete.

### Rule 5

If the task needs high-quality ChatGPT reasoning, the latest context bundle is
mandatory.

### Rule 6

If the task concerns system state, pick lifecycle, SLOs, or delivery, include
skill outputs in addition to the context bundle.

### Rule 7

No serious architecture or roadmap decision should rely on memory alone when
`pnpm ai:context` is available.

### Rule 8

Reasoning, implementation, governance, and diagnostics should remain separated
unless a task is intentionally small and low-risk.

---

## Preflight Standard

Before serious work begins, the operator should determine:

1. Which task lane applies
2. Whether a fresh context bundle is required
3. Whether skill outputs are required
4. Whether the task is architecture-first or implementation-ready
5. Whether Claude OS verification will be required at the end

Minimum standards:

### For ChatGPT architecture/audit work

- fresh context bundle (`pnpm ai:context`)
- clear task definition
- supporting artifacts if relevant

### For diagnosis work

- relevant skill outputs first
- fresh context bundle if needed
- explicit problem statement

### For implementation work

- scoped prompt
- source of truth identified
- constraints/invariants identified
- verification plan identified

---

## ChatGPT → Claude Code Handoff Standard

Any implementation handoff originating from ChatGPT should include:

1. Objective
2. Why it matters
3. Scope
4. Non-goals
5. Source of truth
6. Constraints / invariants
7. Exact implementation tasks
8. Verification steps
9. Output format
10. Success criteria

This reduces ambiguity and improves implementation quality.

> Concrete prompt templates that implement this standard:
> `docs/ai/prompt-templates/architecture-audit.md`,
> `docs/ai/prompt-templates/sprint-plan-review.md`,
> `docs/ai/prompt-templates/incident-analysis.md`

---

## Verification and Closeout Standard

Claude OS should be used whenever the work:

- modifies behavior
- changes contracts
- affects lifecycle logic
- affects production-facing workflows
- materially changes operator tooling
- advances sprint status

Work is not complete merely because code was written. Work is complete when:

- implementation is landed
- verification is run
- proof is produced
- status is reconciled
- closeout is governed

> Authority: `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` |
> `CLAUDE_EXECUTION_CONTRACT.md`

---

## Anti-Patterns

The following are anti-patterns under this doctrine:

- asking Claude Code to solve unresolved architecture ambiguity first
- asking ChatGPT for high-confidence architectural guidance without current
  context
- skipping skill-based diagnostics for live-system issues
- treating implementation as "done" before Claude OS verification
- mixing reasoning, implementation, and governance into one vague prompt
- making roadmap decisions from memory when the context bundle is available
- allowing AI tools to drift outside their role boundaries without justification

---

## Operating Standard

The standard Unit Talk flow is:

```
Intent
→ classify task lane
→ gather required context and/or skill outputs
→ route to the correct AI/tool first
→ perform implementation only after reasoning is settled
→ verify and close through Claude OS
→ preserve artifacts for future reasoning
```

This is the official AI operating model for Unit Talk until superseded by a
later version.

---

## Future Evolution

This doctrine is intended to become the foundation for a reusable cross-project
AI operating framework.

Unit Talk is the first governed implementation.

Later versions should extract:

- universal routing rules
- universal handoff contracts
- universal context bundle standards
- universal AI preflight patterns
- project adapter requirements

That future work should be documented separately in the Universal AI Kit
planning documents.

---

## Related Documents

| Document                                | Role                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `docs/ai/LLM_DECISION_PLAYBOOK.md`      | Detailed tool routing guide with decision flow and anti-patterns                  |
| `docs/system/UNIT_TALK_SYSTEM_BRAIN.md` | AI-facing canonical repo summary — paste into context bundle                      |
| `docs/ai/prompt-templates/`             | Concrete ChatGPT prompt templates for architecture, sprints, incidents, audits    |
| `docs/ai/intelligence-reviews/`         | Structured review procedures: edge drift, strategy performance, model calibration |
| `.claude/skills/pipeline-health.md`     | MCP skill — platform health snapshot                                              |
| `.claude/skills/pick-trace.md`          | MCP skill — pick lifecycle trace                                                  |
| `.claude/skills/slo-report.md`          | MCP skill — SLO attainment report                                                 |
| `.claude/skills/edge-check.md`          | MCP skill — CLV edge and calibration check                                        |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` | Sprint execution rules — Claude OS authority                                      |
| `CLAUDE_EXECUTION_CONTRACT.md`          | Non-negotiable AI execution invariants                                            |
| `.claude/rules/07-lane-model.md`        | Internal Claude Code parallel execution lanes (distinct from task lanes above)    |

---

## Status

**Version**: v1 **Status**: Active
