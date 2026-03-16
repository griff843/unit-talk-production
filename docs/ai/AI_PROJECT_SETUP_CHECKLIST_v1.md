# AI Project Setup Checklist v1

> **Version**: v1 | **Status**: Active **Last Updated**: 2026-03-15
> **Authority**: `docs/ai/AI_OPERATING_DOCTRINE_v1.md`

---

## Purpose

Define how to configure the ChatGPT project surface for Unit Talk so that
ChatGPT has the right persistent context and the operator can work efficiently
without re-explaining the system on every session.

This checklist applies to the Unit Talk ChatGPT project. It is also designed to
be reusable as the starting point for any project using this AI operating model.

---

## Initial Project Setup

### Step 1: Create the ChatGPT Project

- [ ] Create a new ChatGPT Project named `Unit Talk — [year]`
- [ ] Set the project scope: architecture, sprint planning, incident analysis,
      intelligence review

### Step 2: Set Project Instructions

The project instruction block should cover:

- [ ] **System identity**: what Unit Talk is (sports prediction platform, AI
      routing, pick lifecycle, Claude OS governance)
- [ ] **AI operating model**: Claude Code does implementation; ChatGPT does
      architecture and analysis; Claude OS does governance
- [ ] **Context limitations**: ChatGPT has no live repo access — always wait for
      a context bundle before answering codebase questions
- [ ] **Preferred output format**: implementation prompts using the handoff
      template format (`docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md`)
- [ ] **No speculation without context**: if asked about current system state
      without a context bundle, say so and ask for one

Example instruction block:

```
You are the architecture and reasoning AI for Unit Talk, a sports picks
prediction platform. You have no live repo access. I will paste a context bundle
before asking codebase questions.

Your roles:
- Architecture design and tradeoff analysis
- Sprint shaping and sequencing
- Incident diagnosis (with skill outputs + context bundle provided)
- Intelligence and model review (with context artifacts provided)

You do NOT do:
- File edits (that is Claude Code's job)
- Production debugging without diagnostics provided
- Sprint governance (that is Claude OS's job)

When producing implementation output, use the 10-field handoff format:
Objective, Why It Matters, Scope, Non-Goals, Source of Truth,
Constraints/Invariants, Implementation Tasks, Verification Steps, Output
Format, Success Criteria.

If I ask about the codebase without a context bundle, ask me to run
`pnpm ai:context` first.
```

### Step 3: Pin Reference Documents

Upload or pin the following as persistent project files:

| Document                                | Why Pin It                                                       |
| --------------------------------------- | ---------------------------------------------------------------- |
| `docs/system/UNIT_TALK_SYSTEM_BRAIN.md` | Persistent system overview — replaces ad-hoc system descriptions |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md`   | AI role boundaries — prevents routing confusion                  |
| `docs/ai/AI_TASK_ROUTING_MATRIX_v1.md`  | Quick routing lookup — avoids re-explaining what tool to use     |
| `docs/ai/LLM_DECISION_PLAYBOOK.md`      | Tool roster and model selection rules                            |

> **Refresh cadence for pinned docs**: Refresh `UNIT_TALK_SYSTEM_BRAIN.md`
> whenever a phase or layer milestone completes. Doctrine docs are stable and
> rarely change.

---

## Session Workflow

### Before Every Serious Session

- [ ] Run `pnpm ai:context` from repo root
- [ ] Locate the bundle: `out/ai/context/context_bundle.md`
- [ ] Paste bundle into ChatGPT at the start of the session
- [ ] Confirm ChatGPT acknowledges the current sprint queue and phase position

### When NOT to Paste a Context Bundle

| Task                                 | Context Bundle Needed         |
| ------------------------------------ | ----------------------------- |
| Architecture design / sprint shaping | Yes — always                  |
| Incident analysis                    | Yes — plus skill outputs      |
| Intelligence review                  | Yes — plus skill outputs      |
| General AI operating model questions | No — use pinned docs          |
| Writing a handoff template           | No — ChatGPT knows the format |
| Governance / closeout review         | No — Claude OS handles this   |

---

## Artifacts to Bring Per Task Type

### Architecture / Sprint Shaping

```
pnpm ai:context → out/ai/context/context_bundle.md
docs/status/NEXT_5_SPRINTS.md (paste relevant section)
docs/status/DRIFT_REPORT.md (paste relevant section)
```

### Incident Diagnosis

```
pnpm ai:context → out/ai/context/context_bundle.md
/pipeline-health output (paste raw)
/pick-trace <uuid> output (if specific pick involved)
/slo-report output (if SLO breach)
Explicit problem statement
```

### Intelligence Review

```
pnpm ai:context → out/ai/context/context_bundle.md
/edge-check output (for CLV review)
/slo-report output (for SLO trend)
pnpm strategy:simulate output (for strategy performance)
Calibration outputs from compute_calibration (for model review)
```

### Sprint Plan Review

```
pnpm ai:context → out/ai/context/context_bundle.md
docs/status/NEXT_5_SPRINTS.md Sprint 1 block
Relevant sprint closeout report (if reviewing prior sprint)
```

### Repository Audit

```
pnpm ai:context → out/ai/context/context_bundle.md
docs/ai/prompt-templates/repo-audit.md (template)
Any relevant prior audit findings
```

---

## Refresh and Maintenance

| Trigger                                     | Action                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| Layer or phase milestone completed          | Refresh UNIT_TALK_SYSTEM_BRAIN.md and re-pin           |
| AI Operating Doctrine updated (new version) | Re-pin updated doctrine and routing matrix             |
| New Claude skills added                     | Update LLM_DECISION_PLAYBOOK.md skills table           |
| New prompt templates added                  | No re-pin needed — templates are per-session artifacts |
| Context bundle output format changed        | Re-read bundle before next session                     |

---

## Reuse for Other Projects

This checklist maps cleanly to the Universal AI Kit pattern
(`docs/ai/UNIVERSAL_AI_KIT_PLAN_v1.md`). To adapt for a new project:

1. Replace `UNIT_TALK_SYSTEM_BRAIN.md` with the project's system brain doc
2. Replace the project instructions block with the project-specific context
3. Retain doctrine and routing matrix as universal files (or adapt them)
4. Replace the skill list with the project's MCP skills
5. Keep the session workflow and artifact-by-task-type tables as-is

---

## Related Documents

| Document                                | Purpose                      |
| --------------------------------------- | ---------------------------- |
| `docs/ai/AI_OPERATING_DOCTRINE_v1.md`   | Policy authority             |
| `docs/ai/AI_PREFLIGHT_CHECKLIST_v1.md`  | Per-task preflight           |
| `docs/system/UNIT_TALK_SYSTEM_BRAIN.md` | System brain to pin          |
| `docs/ai/LLM_DECISION_PLAYBOOK.md`      | Tool roster to pin           |
| `scripts/ai/build-context-bundle.mjs`   | Context bundle generator     |
| `docs/ai/UNIVERSAL_AI_KIT_PLAN_v1.md`   | Cross-project generalization |
