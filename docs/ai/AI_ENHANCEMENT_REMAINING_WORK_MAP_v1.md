# AI_ENHANCEMENT_REMAINING_WORK_MAP_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Unit Talk AI enhancement stack, cross-project portability planning,
helper/agent layer, hook/automation layer  
**Purpose:** Define the remaining work required to complete the AI operating
system enhancement stack, formalize what is portable vs project-specific, and
govern the sequencing of future enhancement sprints.

---

# 1. Why this document exists

This document exists to prevent drift in the AI operating system enhancement
effort.

We have already established a meaningful operating foundation for how ChatGPT,
Claude Code, Claude OS, MCP truth layers, and skills work together. However, the
enhancement stack is not complete. The most important unfinished areas are:

- the next skill wave
- the helper/agent layer
- the hook/automation layer
- the portability extraction layer

This document turns those missing pieces into a governed work map so that future
enhancement work is planned intentionally rather than rediscovered across chats.

---

# 2. Objective

The objective of this work map is to ensure the AI operating system evolves into
a structured, reusable, high-leverage operating layer that:

- improves day-to-day execution inside Unit Talk
- reduces manual workflow overhead
- strengthens architecture, diagnosis, and governance loops
- becomes portable across other Griff projects where appropriate
- preserves a clean separation between reusable workflow infrastructure and Unit
  Talk-specific business logic

---

# 3. Governing principle

Every new AI operating-system capability must be classified at design time into
one of the following categories:

## 3.1 Portable Core

Reusable across multiple projects with little or no project-specific change.

## 3.2 Adapter-Based Layer

Built from a common pattern, but requires project-specific adapters, prompts,
invariants, exports, or context.

## 3.3 Unit Talk-Specific Layer

Tied directly to Unit Talk business logic, betting intelligence, Discord
workflows, or Unit Talk-only system contracts.

**Rule:** No new helper, hook, workflow enhancement, or skill proposal should be
added without explicit classification into one of these layers.

---

# 4. Current state summary

## 4.1 What is already done

The following foundational work is already in place.

### Core workflow foundation

- AI operating doctrine
- task routing matrix
- preflight checklist
- ChatGPT → Claude handoff template
- ChatGPT project setup checklist
- universal AI kit planning doc
- LLM decision playbook restored
- ChatGPT Project created and tested
- `pnpm ai:context` workflow validated
- first real sprint run through the full loop

### MCP truth layer

- `mcp-ops`
- `mcp-state`
- `mcp-intelligence`
- `mcp-decision`

### First skill wave

- `pipeline-health`
- `pick-trace`
- `slo-report`
- `edge-check`

### Proven operating workflow

- ChatGPT shapes
- Claude Code implements
- Claude OS verifies and closes
- status docs reconcile

---

# 5. What is still missing

The operating stack is not complete.

The highest-leverage missing areas are:

## 5.1 Next skill wave

The next operator-facing and intelligence-protecting skills have not been
finished.

## 5.2 Helper/agent layer

A formal helper/agent layer above doctrine + MCP + skills has not yet been
defined or built.

## 5.3 Hook/automation layer

The workflow glue that reduces manual coordination and turns the system into a
more automatic operating surface has not yet been defined or implemented.

## 5.4 Portability extraction layer

We have not yet separated the AI operating stack into:

- reusable cross-project infrastructure
- adapter-based project logic
- Unit Talk-only logic

---

# 6. Portability mandate

This enhancement stack must be built with portability in mind from now on.

## 6.1 Mandatory design test

For every enhancement, ask:

### A. Is this workflow/orchestration infrastructure?

If yes, it should default to the **Portable Core** unless a strong reason exists
not to.

### B. Is this the same pattern with project-specific data/contracts?

If yes, it belongs in the **Adapter-Based Layer**.

### C. Is this tied directly to Unit Talk domain logic?

If yes, it stays in the **Unit Talk-Specific Layer**.

## 6.2 Strategic intent

The goal is **not** to copy Unit Talk everywhere.

The goal is to create:

- a reusable AI operating system core
- a project adapter model
- project-specific extensions where needed

This is the preferred portability model:

**Universal workflow engine + project adapters + project-specific domain
modules**

---

# 7. Layer classification

## 7.1 Portable Core

These are intended to become reusable across Griff’s broader project portfolio.

### Governance / docs

- AI operating doctrine
- task routing matrix
- preflight checklist
- ChatGPT → Claude handoff template
- project setup checklist
- LLM decision playbook
- universal AI kit planning documents
- AI enhancement work map pattern

### Workflow patterns

- context bundle generation pattern
- repo intelligence snapshot pattern
- repo map generation pattern
- architecture → implementation → verification routing pattern
- sprint closeout reconciliation pattern
- AI artifact folder conventions
- proof bundle conventions
- work intake and sprint shaping pattern

### Reusable helpers / agents

- Sprint Planning Agent
- Incident Triage Agent
- Architecture Audit Agent
- Prompt Composer Agent
- Project Bootstrap Agent
- Status Sync / Documentation Agent

### Reusable hooks

- context refresh hooks
- architecture-approved → handoff-generated hooks
- implementation-complete → governance-closeout hooks
- sprint-closeout → status/context update hooks
- new-repo bootstrap hooks
- artifact-ready → reviewable hooks

---

## 7.2 Adapter-Based Layer

These should use a shared architecture but require per-project implementation.

### Project adapters

- system brain content
- project-specific context bundle inputs
- project-specific MCP configuration
- project-specific skill configuration
- project-specific health/status exports
- project-specific invariants
- project-specific architecture checks
- project-specific diagnosis prompts
- project-specific governance gates
- project-specific artifact scanners

### Project-specific helper tuning

The same helper/agent may exist across projects, but must adapt to:

- current project roadmap
- current phase model
- current architecture docs
- current invariants
- current artifact structure
- current domain risk profile

---

## 7.3 Unit Talk-Specific Layer

These should remain inside Unit Talk and should not be forced into the universal
kit.

### Unit Talk-specific business logic

- pick lifecycle specifics
- scoring/grading specifics
- CLV/calibration/risk analysis specific to betting intelligence
- market resistance logic
- settlement and offer/promotion domain logic
- betting-domain edge review prompts
- Unit Talk workflow registry details
- Unit Talk-only governance contracts
- Discord delivery diagnostics tied to Unit Talk channels and embed flows
- Unit Talk-specific intelligence review surfaces

---

# 8. Remaining work map

## 8.1 Immediate unfinished work

These are the highest-leverage remaining tasks.

### A. ~~Finish Skill Wave 2~~ ✅ COMPLETE (2026-03-16)

> **Wave 2 is complete.** All five Wave 2 skills are operational as SKILL.md
> procedures in `.claude/skills/`. Two additional specialist agents were also
> added to `.claude/agents/`.

| Skill / Agent                             | Status         | Sprint                                |
| ----------------------------------------- | -------------- | ------------------------------------- |
| `agent-health`                            | ✅ Operational | SPRINT-058 wave (PR #258, 2026-03-16) |
| `prompt-compose`                          | ✅ Operational | SPRINT-058 wave (PR #258, 2026-03-16) |
| `discord-diagnose`                        | ✅ Operational | SPRINT-058 wave (PR #258, 2026-03-16) |
| `incident-triage`                         | ✅ Operational | SPRINT-059 (2026-03-16)               |
| `scoring-audit`                           | ✅ Operational | SPRINT-059 (2026-03-16)               |
| `intelligence-scoring-specialist` (agent) | ✅ Operational | SPRINT-059 (2026-03-16)               |
| `temporal-workflow-guardian` (agent)      | ✅ Operational | SPRINT-059 (2026-03-16)               |

### B. Define the helper/agent layer

This is unfinished and must be formalized.

Candidate helpers/agents:

#### Sprint Planning Agent

Responsibilities:

- review roadmap, status, current context bundle, and doc state
- propose the next best sprint
- produce a handoff-ready implementation prompt

#### Incident Triage Agent

Responsibilities:

- consume skill outputs and context bundle inputs
- classify incidents by type and severity
- propose next actions and probable routes

#### Architecture Audit Agent

Responsibilities:

- review repo structure, docs, and architectural boundaries
- identify drift, duplication, layering violations, or contract mismatch
- recommend corrective sprint shapes

#### Intelligence Review Agent

Responsibilities:

- review CLV, scoring, calibration, risk, and related intelligence artifacts
- highlight edge erosion, logic inconsistency, or missing auditability
- produce structured intelligence review outputs

#### Project Bootstrap Agent

Responsibilities:

- scaffold the AI operating layer for a new repo/app
- install or generate the baseline doctrine/routing/preflight/handoff structure
- define project adapter requirements

#### Status Sync / Documentation Agent

Responsibilities:

- assist with post-sprint status reconciliation
- help keep status docs, work maps, and progress docs aligned
- reduce documentation drift after implementation work

#### Prompt Composer Agent

Responsibilities:

- convert approved architecture into implementation-ready Claude prompts
- ensure prompts reflect the latest phase model, constraints, and truth sources
- reduce variation in implementation handoff quality

**Important:** These do not all need to begin as fully autonomous code agents.
They can start as:

- workflow templates
- prompt wrappers
- scripts
- structured operating procedures
- governed prompt patterns

But they must be explicitly designed.

### C. Define the hook/automation layer

This is also unfinished and must be formalized.

#### Context hooks

Examples:

- when to regenerate `pnpm ai:context`
- sprint closeout triggers context refresh
- major doc changes trigger context refresh
- significant architecture moves trigger refreshed operating context

#### Workflow hooks

Examples:

- architecture approved → Claude handoff generated
- implementation complete → Claude OS verification route
- sprint closed → update project context and status docs
- completed review → create next-step planning artifact

#### Project bootstrap hooks

Examples:

- new repo/app → scaffold AI operating layer
- initialize project setup checklist
- initialize adapter requirements
- initialize artifact conventions

#### Artifact hooks

Examples:

- sprint output → save into standard AI artifact location
- proof bundle → mark as reviewable
- governance closeout → archive or reconcile outputs

#### Skill usage hooks

Examples:

- diagnosis request → suggest or require correct skills first
- architecture review request → invoke correct review workflow
- intelligence review request → require necessary artifacts and review surface

#### Governance hooks

Examples:

- behavior-changing work requires Claude OS closeout path
- architecture-impacting work requires defined review path
- phase-sensitive work requires canonical roadmap and doc references

These hooks may take the form of:

- scripts
- checklists
- slash-like commands
- automation wrappers
- Claude OS integrations
- reusable repo scaffolds

But they must be designed as first-class components.

---

## 8.2 Important work after the immediate layer

### A. Later skill waves

#### Skill Wave 3

- `temporal-health`
- `schema-drift`
- `architecture-boundary-audit`

#### Skill Wave 4

- `risk-snapshot`
- `settlement-check`
- `market-health`
- `complexity-audit`
- `sprint-queue`

These should follow after Skill Wave 2 and after the helper/hook architecture is
defined.

### B. More pressure testing

The operating system needs more real reps.

Recommended scenario runs:

- next-sprint selection
- incident diagnosis
- architecture audit
- intelligence review
- repo audit
- at least one workflow where skills are mandatory first

Purpose:

- expose friction
- reveal weak spots
- identify missing automation
- determine whether helpers are pulling real weight

### C. Universal AI kit extraction

After the helper/hook/skill layers are validated, extract the reusable core into
a portable cross-project system.

This becomes a formal deliverable, not a side aspiration.

---

# 9. Recommended sequencing

## Phase 1 — Complete the core operating stack

1. finish Skill Wave 2
2. define helper/agent layer
3. define hook/automation layer
4. classify all current AI operating assets as:
   - Portable Core
   - Adapter-Based
   - Unit Talk-Specific

## Phase 2 — Validate with real work

1. run real workflows through the system
2. pressure test incident, architecture, and intelligence paths
3. refine weak areas
4. improve clarity, routing, and operator ergonomics

## Phase 3 — Extract portability

1. separate universal core from Unit Talk adapter layer
2. turn the best helpers, hooks, and conventions into reusable assets
3. define a portable bootstrap/install path for future repos/apps

---

# 10. Priority board

## 10.1 ~~Now~~ ✅ COMPLETE (2026-03-16)

Wave 2 is complete. All items below are done:

- ~~`agent-health`~~ ✅ SPRINT-059 wave
- ~~`discord-diagnose`~~ ✅ SPRINT-059 wave
- ~~`scoring-audit`~~ ✅ SPRINT-059 (2026-03-16)
- ~~`incident-triage`~~ ✅ SPRINT-059 (2026-03-16)
- ~~`prompt-compose`~~ ✅ SPRINT-059 wave
- ~~`intelligence-scoring-specialist` (agent)~~ ✅ SPRINT-059 (2026-03-16)
- ~~`temporal-workflow-guardian` (agent)~~ ✅ SPRINT-059 (2026-03-16)
- define helper/agent layer — partial (prompt-compose operational; full formal
  definition still pending)

## 10.2 Now (Wave 3 — next unfinished wave)

- `temporal-health`
- `schema-drift`
- `architecture-boundary-audit`
- define hook/automation layer formally
- more pressure testing of Wave 2 skills in real workflows
- finalize universal vs adapter-based classification

## 10.3 Later

- Wave 4 skills: `risk-snapshot`, `settlement-check`, `market-health`,
  `complexity-audit`, `sprint-queue`
- extract universal AI kit
- reusable bootstrap flow for future apps
- broaden helper/hook portability across Griff’s project portfolio

---

# 11. Acceptance criteria

## 11.1 Skill Wave 2 is complete when:

- `agent-health`, `discord-diagnose`, and `scoring-audit` are defined
- each has a clear purpose, scope, inputs, outputs, and usage criteria
- each has at least one real scenario run or validation path

## 11.2 Helper/agent layer is complete when:

- the first set of helper/agent definitions exists
- each helper has:
  - purpose
  - trigger conditions
  - inputs
  - outputs
  - portability classification
- the initial implementation form is decided:
  - prompt wrapper
  - procedure
  - script
  - structured agent
  - hybrid

## 11.3 Hook/automation layer is complete when:

- the main hook categories are defined
- triggers and outputs are documented
- hooks are classified into:
  - manual
  - semi-automated
  - automated
- at least the highest-value hooks are chosen for first implementation

## 11.4 Portability extraction is complete when:

- a clean split exists between:
  - Portable Core
  - Adapter-Based Layer
  - Unit Talk-Specific Layer
- the first reusable cross-project bootstrap path exists
- the universal AI kit direction is documented and implementation-ready

---

# 12. Risks if this work is not completed

If this work is not completed, the likely failure modes are:

- drift across chats and sprints
- repeated rediscovery of unfinished work
- over-manual workflow orchestration
- inconsistent handoffs
- poor portability across projects
- helpers/hooks being discussed but never concretely designed
- Unit Talk architecture being copied incorrectly into unrelated apps
- the operating system remaining useful but not fully scalable

---

# 13. Strategic conclusion

The AI operating system foundation is real and valuable, but incomplete.

What is already built is meaningful:

- doctrine
- routing
- preflight
- handoff discipline
- MCP truth layer
- first skill wave
- proven ChatGPT → Claude Code → Claude OS loop

What remains unfinished is equally important:

- helper/agent layer
- hook/automation layer
- portability extraction layer

These are not optional refinements. They are the next maturity layer of the
operating system.

This document should govern the next enhancement sprints so the AI operating
surface becomes:

- stronger inside Unit Talk
- easier to operate day-to-day
- more reliable under real workflow pressure
- portable across Griff’s broader app portfolio through a clean adapter model

---

# 14. Recommended next document chain

After this document, the preferred follow-on artifacts are:

1. `AI_SKILL_WAVE_2_PLAN_v1.md`
2. `AI_HELPER_AGENT_ARCHITECTURE_v1.md`
3. `AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md`
4. `AI_PORTABILITY_MODEL_v1.md`

These documents should refine this work map into execution-ready planning
artifacts.

---

# 15. Version notes

## v1

Initial formalization of the remaining AI enhancement work map, including:

- done vs missing work
- portable vs adapter vs Unit Talk-specific classification
- sequencing
- acceptance criteria
- portability mandate
