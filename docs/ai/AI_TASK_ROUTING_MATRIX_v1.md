# AI Task Routing Matrix v1

> **Version**: v1 | **Status**: Active draft pending repo ratification **Last
> Updated**: 2026-03-15 **Authority**: `docs/ai/AI_OPERATING_DOCTRINE_v1.md`

---

## Purpose

This document is the quick-reference routing companion to
`docs/ai/AI_OPERATING_DOCTRINE_v1.md`.

Its purpose is to help the operator determine, quickly and consistently, which
AI/tool should handle a task first, what context is required, and what the
expected downstream flow should be.

This matrix is intended for day-to-day execution speed. If the doctrine is the
policy layer, this matrix is the operational lookup layer.

---

## How To Use This Matrix

For any serious task:

1. Identify the closest matching task type
2. Start with the recommended first tool
3. Gather the required context/artifacts
4. Follow the downstream path
5. Ensure Claude OS verification is used where required

If a task is ambiguous or spans multiple categories, default to ChatGPT first.

---

## Routing Matrix

| Task Type                           | Typical Examples                                                                 | First Tool             | Required Context Before Starting                                                  | Downstream Flow                                                        | Claude OS Required                     |
| ----------------------------------- | -------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| Architecture Design                 | subsystem design, platform refactor, boundary decisions, scaling approach        | ChatGPT                | Fresh `pnpm ai:context` bundle                                                    | ChatGPT → Claude Code → Claude OS                                      | Yes                                    |
| Sprint Shaping / Sequencing         | next sprint selection, roadmap tradeoffs, execution ordering                     | ChatGPT                | Fresh context bundle, relevant status docs                                        | ChatGPT → Claude Code if implementation follows → Claude OS            | Usually                                |
| Workflow / Process Design           | AI workflow, operator process, handoff flow, governance improvements             | ChatGPT                | Fresh context bundle, relevant workflow docs                                      | ChatGPT → Claude Code if docs/scripts change → Claude OS               | Yes if repo/process artifacts change   |
| Repo Implementation                 | scoped code change, clear refactor, file creation, package wiring                | Claude Code            | Structured implementation prompt, source of truth, constraints                    | Claude Code → Claude OS                                                | Yes                                    |
| Live System Diagnosis               | health issue, backlog, stuck state, platform degradation                         | MCP / Claude Skills    | Relevant skill outputs first; fresh context bundle if diagnosis is escalated      | Skills/MCP → ChatGPT → Claude Code if fix required → Claude OS         | Yes if code/process changes            |
| Pick Lifecycle Diagnosis            | unexpected pick state, settlement confusion, posting ambiguity                   | MCP / Claude Skills    | `/pick-trace`, related skill output, fresh context if needed                      | Skills/MCP → ChatGPT → Claude Code if fix required → Claude OS         | Yes if behavior changes                |
| SLO / Reliability Review            | breach review, health degradation, service quality analysis                      | MCP / Claude Skills    | `/slo-report`, `/pipeline-health`, fresh context if needed                        | Skills/MCP → ChatGPT → Claude Code if remediation required → Claude OS | Yes if changes land                    |
| Discord Delivery Diagnosis          | posting failures, outbox backlog, routing problems                               | MCP / Claude Skills    | Relevant delivery/health skills, context bundle if escalation needed              | Skills/MCP → ChatGPT → Claude Code → Claude OS                         | Yes                                    |
| Intelligence / Model Review         | CLV analysis, calibration review, scoring drift, strategy performance            | ChatGPT                | Fresh context bundle, relevant intelligence artifacts, skill outputs if available | ChatGPT → Claude Code if changes approved → Claude OS                  | Yes if implementation changes behavior |
| Governance / Sprint Closeout Review | proof review, closeout quality, invariant compliance, ratification review        | Claude OS              | Sprint artifacts, proof bundle, closeout docs                                     | Claude OS → ChatGPT if analytical review is needed                     | Yes                                    |
| Prompt / Handoff Design             | Claude prompt shaping, implementation prompt refinement, reusable task templates | ChatGPT                | Fresh context bundle if repo-specific; doctrine/playbook if workflow-related      | ChatGPT → Claude Code if prompt/template files are updated → Claude OS | Yes if repo artifacts change           |
| Documentation Architecture          | canonical docs, doctrine updates, system brain changes, repo operating docs      | ChatGPT                | Fresh context bundle, source-of-truth docs                                        | ChatGPT → Claude Code → Claude OS                                      | Yes                                    |
| Small Low-Risk Mechanical Task      | obvious wording tweak, tiny doc correction, straightforward low-risk edit        | Claude Code or ChatGPT | Minimal context, but source of truth still required                               | Direct execution → Claude OS only if governed artifact changes         | Sometimes                              |

> `pnpm ai:context` generates `out/ai/context/context_bundle.md` — the standard
> preflight input for all ChatGPT rows. See
> `scripts/ai/build-context-bundle.mjs`.

---

## Default Rules

### Rule 1

If you are not sure which row applies, start with ChatGPT.

### Rule 2

If the issue is about current system state, start with MCP/skills.

### Rule 3

If the task is already implementation-ready, start with Claude Code.

### Rule 4

If sprint proof, verification, or closeout quality is the question, start with
Claude OS.

### Rule 5

If architecture or strategy quality matters, use a fresh context bundle first.

---

## Required Artifacts By Task Family

### Architecture / Planning

- `pnpm ai:context`
- relevant roadmap/status docs
- any current architecture constraints

### Diagnosis

- relevant skill outputs first (`.claude/skills/pipeline-health.md`,
  `pick-trace.md`, `slo-report.md`, `edge-check.md`)
- fresh context bundle if diagnosis requires synthesis
- explicit problem statement

### Implementation

- structured implementation prompt
- source of truth
- constraints / invariants
- verification expectations

### Governance

- sprint artifacts
- proof bundle
- closeout documents
- relevant contracts (`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`,
  `CLAUDE_EXECUTION_CONTRACT.md`)

### Intelligence Review

- fresh context bundle
- model/intelligence artifacts
- calibration / CLV / risk outputs if available

---

## Escalation Rules

### Escalate to ChatGPT when:

- the diagnosis is no longer mechanical
- multiple subsystems are involved
- tradeoffs need to be evaluated
- the implementation path is unclear
- the problem touches architecture, workflow, or long-term maintainability

### Escalate to Claude Code when:

- the fix is implementation-ready
- the required files and constraints are known
- the task is clearly scoped

### Escalate to Claude OS when:

- behavior changed
- verification is needed
- proof is required
- sprint state is changing
- closeout or ratification is needed

---

## Anti-Patterns

Avoid these routing mistakes:

- starting in Claude Code for unresolved architecture questions
- starting in ChatGPT for a live-system issue without skill outputs
- treating implementation as complete before Claude OS verification
- asking for strategy/model guidance without a fresh context bundle
- mixing diagnosis, implementation, and governance into one vague request

---

## Practical Shortcut

Use this mental model:

- **Static reasoning** → context bundle → ChatGPT
- **Dynamic system truth** → MCP/skills first
- **Scoped repo execution** → Claude Code
- **Verification / proof / closeout** → Claude OS

---

## Related Documents

| Document                                           | Purpose                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md`              | Official policy layer for AI workflow                   |
| `docs/ai/LLM_DECISION_PLAYBOOK.md`                 | Role definitions and high-level AI responsibility split |
| `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Standard implementation handoff shape                   |
| `docs/ai/AI_PREFLIGHT_CHECKLIST_v1.md`             | Pre-task checklist                                      |
| `docs/ai/prompt-templates/`                        | Reusable prompt patterns                                |
