# AI Preflight Checklist v1

> **Version**: v1 | **Status**: Active **Last Updated**: 2026-03-15
> **Authority**: `docs/ai/AI_OPERATING_DOCTRINE_v1.md` §Preflight Standard

---

## Purpose

Answer five questions before every serious AI task. Skipping this is the leading
cause of wrong-tool routing, wasted prompts, and low-context implementation
errors.

---

## The Five Preflight Questions

Answer these for every task before routing to any AI tool:

| #   | Question                                            | If Yes                                                           |
| --- | --------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Which task lane applies?                            | Identify from table below                                        |
| 2   | Is a fresh context bundle required?                 | Run `pnpm ai:context` before starting                            |
| 3   | Are skill outputs required?                         | Run relevant MCP skills first                                    |
| 4   | Is this architecture-first or implementation-ready? | Architecture-first → ChatGPT; Implementation-ready → Claude Code |
| 5   | Will Claude OS verification be required at the end? | Yes if behavior, contracts, or sprint state changes              |

---

## Task Lane Reference

| Lane                | Use When                                                   | First Tool                               |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Architecture        | Unresolved design, tradeoff, or sprint shaping             | ChatGPT + context bundle                 |
| Diagnosis           | Live issue, unexpected pick state, SLO or delivery failure | MCP skills first                         |
| Implementation      | Task is clear, scoped, implementation-ready                | Claude Code                              |
| Governance          | Sprint proof review, closeout, invariant compliance        | Claude OS                                |
| Intelligence Review | CLV drift, calibration, strategy performance               | ChatGPT + context bundle + skill outputs |

> Full lane definitions: `docs/ai/AI_OPERATING_DOCTRINE_v1.md §Task Lanes`

---

## Checklist by Task Type

### Architecture / Sprint Shaping

Before starting:

- [ ] Run `pnpm ai:context` — generate a fresh context bundle
- [ ] Confirm status docs are up to date (check `Last Updated` in
      `docs/status/CURRENT_SYSTEM_STATUS.md`)
- [ ] Identify the relevant roadmap position (Layer/Phase from
      `docs/06_status/current_phase.md`)
- [ ] Define the specific architecture question or tradeoff to resolve
- [ ] Load context bundle into ChatGPT before prompting
- [ ] Use the appropriate prompt template:
      `docs/ai/prompt-templates/architecture-audit.md` or
      `docs/ai/prompt-templates/sprint-plan-review.md`
- [ ] Do NOT start in Claude Code — architecture ambiguity must be resolved
      first

---

### Diagnosis

Before starting:

- [ ] Run the relevant Claude skill(s) first:
  - `/pipeline-health` — agent health, outbox depth, SLOs, platform status
  - `/pick-trace <uuid>` — lifecycle trace for a specific pick
  - `/slo-report [--context]` — SLO attainment with gap analysis
  - `/edge-check` — CLV edge and model calibration
- [ ] Gather the skill output before escalating to ChatGPT
- [ ] Define the explicit problem statement before escalating
- [ ] Run `pnpm ai:context` if diagnosis requires multi-subsystem synthesis
- [ ] If a fix is identified, create a scoped handoff before routing to Claude
      Code (see `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md`)
- [ ] Do NOT start in ChatGPT without skill outputs for live-system issues

---

### Implementation

Before starting:

- [ ] Confirm the implementation path is settled — no unresolved architecture
      questions
- [ ] Identify the source of truth (file, contract, or pattern to follow)
- [ ] Identify constraints and invariants:
  - Single-writer discipline (`CLAUDE.md §4`)
  - Lifecycle adapter requirement (if touching `unified_picks`)
  - Migration rollback requirement (`.claude/rules/02-db-migrations.md`)
  - Non-negotiable invariants (`CLAUDE_EXECUTION_CONTRACT.md`)
- [ ] Confirm the sprint is the next in the governed queue
      (`docs/status/NEXT_5_SPRINTS.md`)
- [ ] Run `pnpm session:baseline` before any code changes
- [ ] Confirm all dependencies (prior sprints) are complete — tags exist
- [ ] Identify the verification plan (which gates must pass)
- [ ] Claude OS verification is required if behavior changes

---

### Governance / Sprint Closeout

Before starting:

- [ ] Gather sprint artifacts (proof bundle, closeout report, diff summary)
- [ ] Locate the relevant governance contracts:
  - `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`
  - `CLAUDE_EXECUTION_CONTRACT.md`
- [ ] Confirm proof artifacts are in `out/sprints/<SPRINT>/<DATE>/`
- [ ] Run Claude OS for verification, tagging, and closeout
- [ ] Bring artifacts to ChatGPT only if analytical review is needed (rare)

---

### Intelligence Review

Before starting:

- [ ] Run `pnpm ai:context` — generate a fresh context bundle
- [ ] Run the relevant intelligence skill output (if available):
  - `/edge-check` for CLV edge drift
  - `/slo-report` for SLO attainment
- [ ] Identify the specific intelligence question:
  - Edge drift? → `docs/ai/intelligence-reviews/edge-drift-review.md`
  - Strategy performance? →
    `docs/ai/intelligence-reviews/strategy-performance-review.md`
  - Model calibration? →
    `docs/ai/intelligence-reviews/model-calibration-check.md`
- [ ] Load context bundle + skill outputs into ChatGPT
- [ ] If analysis produces code changes: fill the handoff template before
      routing to Claude Code
- [ ] Claude OS verification required if scoring or strategy behavior changes

---

## Minimum Standards by Context Bundle Requirement

| Task                          | Context Bundle | Skill Outputs  |
| ----------------------------- | -------------- | -------------- |
| Architecture / Sprint Shaping | Required       | Optional       |
| High-level incident diagnosis | Required       | Required first |
| Intelligence review           | Required       | Recommended    |
| Implementation (clear spec)   | Not required   | Not required   |
| Governance / closeout         | Not required   | Not required   |
| Live platform diagnostic      | Not required   | Required       |

---

## Anti-Patterns to Catch at Preflight

- Starting Claude Code before architecture ambiguity is resolved
- Starting ChatGPT without a context bundle for codebase questions
- Skipping skill outputs for live-system issues
- Starting implementation without checking sprint queue order
- Marking work done without Claude OS verification when behavior changed

---

## Related Documents

| Document                                           | Purpose                            |
| -------------------------------------------------- | ---------------------------------- |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md`              | Preflight standard authority       |
| `docs/ai/AI_TASK_ROUTING_MATRIX_v1.md`             | Quick routing lookup               |
| `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Handoff format after ChatGPT phase |
| `docs/ai/LLM_DECISION_PLAYBOOK.md`                 | Which tool does what               |
| `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md`          | Sprint execution template          |
