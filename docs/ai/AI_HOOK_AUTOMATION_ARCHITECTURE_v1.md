# AI_HOOK_AUTOMATION_ARCHITECTURE_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Define the hook and automation layer that connects doctrine, context
workflows, skills, helpers, implementation handoffs, and governance closeout  
**Purpose:** Formalize the missing workflow glue that reduces manual
coordination, improves repeatability, and creates a portable automation pattern
for future projects.

---

# 1. Why this document exists

The AI operating system now has several meaningful layers in place:

- doctrine
- routing
- preflight
- handoff structure
- context workflow
- MCP truth surfaces
- skill planning
- helper/agent planning

What is still missing is the **hook/automation layer**.

This is the layer that determines when important operating actions should
happen, what should trigger them, what artifacts they should produce, and when
the system should escalate work into the correct next workflow.

Without this layer, the operator must still manually remember to:

- refresh context
- generate handoffs
- route completed work to governance closeout
- reconcile sprint outputs
- mark artifacts as reviewable
- bootstrap new projects consistently
- invoke the right skills at the right time

That means the system is structured, but still too manual.

This document exists to define the automation glue that turns the current
operating pattern into a more complete operating system.

---

# 2. Objective

The objective of the hook/automation layer is to create a governed, explicit set
of workflow triggers that:

- reduce manual remembering
- improve operating consistency
- connect architecture → implementation → verification more cleanly
- improve context freshness
- strengthen artifact discipline
- reduce drift after sprint closeout
- enable portability across future repos and apps

---

# 3. Position in the stack

## 3.1 Current stack

### Foundation

- doctrine
- routing matrix
- preflight
- handoff templates
- context bundle workflow

### Analysis surfaces

- MCP truth layer
- skills

### Orchestration layer

- helpers/agents

### Missing automation glue

- hooks / workflow triggers / artifact routing

## 3.2 Role of hooks

Hooks are not meant to replace:

- operator judgment
- canonical docs
- implementation work
- governance verification
- proof bundle requirements

They are meant to connect the workflow stages so the correct next step becomes
more automatic and less memory-dependent.

---

# 4. Governing principles

## 4.1 Hooks must be explicit

Every hook should define:

- trigger
- condition
- action
- outputs
- owner / destination
- portability class

## 4.2 Hooks should reduce remembering, not reduce rigor

A hook should make the right action easier to take, not silently bypass a
required review or governance step.

## 4.3 No hidden automation

Operators should know:

- what triggers the hook
- what it produces
- what it does not do
- whether it is advisory, semi-automated, or automated

## 4.4 Hooks must preserve proof discipline

No hook should claim completion, verification, or governance closure without the
required evidence.

## 4.5 Portability must be classified

Each hook must be classified as:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

## 4.6 Start with the highest-value hooks

Not every possible hook should be built first. Prioritize the hooks that remove
the most friction from daily workflow.

---

# 5. Hook model

Each hook should be defined with the following contract.

## 5.1 Required hook fields

- name
- purpose
- trigger
- preconditions
- action
- outputs
- destination / next stage
- failure mode / fallback
- portability classification
- automation level
- non-goals

## 5.2 Automation levels

### Level 1 — Advisory

The hook recommends or reminds the operator to take an action.

### Level 2 — Semi-automated

The hook prepares artifacts, commands, templates, or routing outputs, but the
operator confirms or executes the next step.

### Level 3 — Automated

The hook performs a defined action automatically under controlled conditions.

**Rule:** Governance-sensitive and behavior-changing actions should begin at
Level 1 or Level 2 unless there is a strong reason to automate further.

---

# 6. Main hook categories

The first recommended hook architecture consists of six categories:

1. Context hooks
2. Workflow handoff hooks
3. Project bootstrap hooks
4. Artifact hooks
5. Skill-routing hooks
6. Governance hooks

---

# 7. Context hooks

## 7.1 Purpose

Context hooks ensure the working context stays fresh enough that ChatGPT,
Claude, and the operator are not making decisions from stale assumptions.

## 7.2 Why they matter

A stale context bundle causes:

- wrong sprint choices
- outdated implementation prompts
- bad assumptions about completion state
- repeated drift across chats
- missed architecture changes

## 7.3 Proposed context hooks

### Hook: context-refresh-after-sprint-close

**Purpose:** Ensure the working context is refreshed after meaningful sprint
completion.

- **Trigger:** Sprint closeout completed
- **Preconditions:** Sprint produced meaningful code/doc/status changes
- **Action:** Recommend or prepare `pnpm ai:context`
- **Outputs:** Refreshed context bundle or explicit reminder to regenerate it
- **Destination:** Planning / next-sprint selection / handoff generation
- **Failure mode:** If skipped, future planning may use stale context
- **Portability classification:** Portable Core
- **Automation level:** Level 2
- **Non-goals:** Claiming sprint closeout is complete by itself

### Hook: context-refresh-after-major-doc-change

**Purpose:** Refresh context when architecture or roadmap truth changes
materially.

- **Trigger:** Major roadmap, status, phase, or architecture doc changed
- **Preconditions:** Doc change affects workflow, sequencing, or system truth
- **Action:** Recommend context regeneration
- **Outputs:** Context refresh reminder or prepared command
- **Destination:** Future planning / handoff correctness
- **Portability classification:** Portable Core
- **Automation level:** Level 1
- **Non-goals:** Triggering on every trivial typo/doc edit

### Hook: context-refresh-before-sprint-planning

**Purpose:** Ensure sprint planning uses reasonably current state.

- **Trigger:** Sprint Planning Agent or manual sprint planning starts
- **Preconditions:** Context is stale, missing, or predates meaningful work
- **Action:** Check freshness and recommend refresh
- **Outputs:** Freshness warning / recommended action
- **Destination:** Sprint planning flow
- **Portability classification:** Portable Core
- **Automation level:** Level 1

---

# 8. Workflow handoff hooks

## 8.1 Purpose

Workflow handoff hooks connect the major phases of work:

- architecture
- implementation
- verification
- reconciliation

## 8.2 Why they matter

Without these hooks, transitions are too memory-dependent and handoffs become
inconsistent.

## 8.3 Proposed workflow handoff hooks

### Hook: architecture-approved-to-claude-handoff

**Purpose:** Convert approved architecture into implementation-ready Claude
execution.

- **Trigger:** Architecture direction approved
- **Preconditions:** Scope, constraints, and desired outcome are clear enough
- **Action:** Invoke or recommend Prompt Composer flow
- **Outputs:** Claude-ready execution prompt
- **Destination:** Claude Code implementation
- **Failure mode:** Architecture approved but no governed implementation prompt
  created
- **Portability classification:** Portable Core
- **Automation level:** Level 2

### Hook: implementation-complete-to-governance-closeout

**Purpose:** Route completed implementation into verification and proof
discipline.

- **Trigger:** Implementation reported complete
- **Preconditions:** Code/doc changes exist and need verification
- **Action:** Route to Claude OS verification/closeout path
- **Outputs:** Verification checklist / proof bundle requirement / closeout path
- **Destination:** Governance verification
- **Failure mode:** Work is treated as done without closeout discipline
- **Portability classification:** Portable Core
- **Automation level:** Level 1 initially, Level 2 later

### Hook: verification-complete-to-status-sync

**Purpose:** Ensure verified work is reconciled into status docs and current
state.

- **Trigger:** Verification / closeout completed
- **Preconditions:** Proof artifacts exist
- **Action:** Trigger Status Sync / Documentation flow
- **Outputs:** Reconciliation checklist / suggested status updates
- **Destination:** Current state docs / work maps / handoff continuity
- **Portability classification:** Portable Core
- **Automation level:** Level 2

### Hook: approved-remediation-path-to-sprint-shape

**Purpose:** Turn findings or audits into a structured next sprint.

- **Trigger:** Audit, incident, or verification produces a corrective path
- **Preconditions:** Findings are clear enough to act on
- **Action:** Route into Sprint Planning + Prompt Composer flow
- **Outputs:** Sprint candidate / implementation prompt seed
- **Destination:** Next remediation sprint
- **Portability classification:** Portable Core
- **Automation level:** Level 2

---

# 9. Project bootstrap hooks

## 9.1 Purpose

Bootstrap hooks make it easier to bring the AI operating system into a new repo
or app consistently.

## 9.2 Why they matter

Portability fails when setup remains ad hoc.

## 9.3 Proposed project bootstrap hooks

### Hook: new-project-bootstrap-start

**Purpose:** Start AI operating system setup for a new project.

- **Trigger:** New repo/app is being formalized
- **Preconditions:** Project scope is defined enough to scaffold workflow
- **Action:** Invoke Project Bootstrap Agent flow
- **Outputs:** Baseline docs list, setup steps, adapter requirements
- **Destination:** New project operating layer
- **Portability classification:** Portable Core
- **Automation level:** Level 2

### Hook: bootstrap-to-adapter-definition

**Purpose:** Ensure portability structure is defined during setup.

- **Trigger:** Base operating docs are established
- **Preconditions:** Project identity and domain are known
- **Action:** Create or recommend project adapter definition
- **Outputs:** Adapter requirements list
- **Destination:** Project-specific AI operating setup
- **Portability classification:** Portable Core
- **Automation level:** Level 1

### Hook: bootstrap-to-first-sprint-selection

**Purpose:** Move from setup to meaningful first action.

- **Trigger:** Base operating layer created
- **Preconditions:** Project docs/config exist
- **Action:** Route to Sprint Planning flow
- **Outputs:** Recommended first sprint
- **Destination:** Initial project implementation cycle
- **Portability classification:** Portable Core
- **Automation level:** Level 2

---

# 10. Artifact hooks

## 10.1 Purpose

Artifact hooks ensure outputs from planning, implementation, verification, and
review are routed into the correct artifact locations and remain easy to review.

## 10.2 Why they matter

Without artifact discipline:

- important outputs are lost in chat
- proof bundles become disconnected
- reviewability drops
- future planning loses important context

## 10.3 Proposed artifact hooks

### Hook: sprint-output-to-artifact-location

**Purpose:** Ensure sprint outputs land in a standard artifact location.

- **Trigger:** Sprint or audit generates outputs
- **Preconditions:** Artifact destination pattern exists
- **Action:** Recommend or enforce saving outputs into expected location
- **Outputs:** Organized artifact path
- **Destination:** Repo artifact directory / proof bundle location
- **Portability classification:** Adapter-Based
- **Automation level:** Level 2

### Hook: proof-bundle-to-reviewable-state

**Purpose:** Mark proof outputs as ready for review by the operator.

- **Trigger:** Proof bundle assembled
- **Preconditions:** Required bundle pieces exist
- **Action:** Surface reviewability state
- **Outputs:** Review-ready status / checklist
- **Destination:** Operator review / closeout decision
- **Portability classification:** Portable Core
- **Automation level:** Level 2

### Hook: completed-analysis-to-reference-doc

**Purpose:** Prevent important analysis from dying in chat.

- **Trigger:** Architecture review, audit, or work map reaches stable form
- **Preconditions:** Analysis is durable enough to govern future work
- **Action:** Recommend repo doc or canonical note creation
- **Outputs:** Suggested doc path / artifact creation prompt
- **Destination:** Repo documentation layer
- **Portability classification:** Portable Core
- **Automation level:** Level 1

---

# 11. Skill-routing hooks

## 11.1 Purpose

Skill-routing hooks connect issue/request types to the correct focused skills
before the operator jumps straight into unstructured diagnosis.

## 11.2 Why they matter

Skills lose value if they are never invoked at the right time.

## 11.3 Proposed skill-routing hooks

### Hook: diagnosis-request-to-skill-first-path

**Purpose:** Encourage or require focused skill usage before general diagnosis.

- **Trigger:** User requests diagnosis or issue investigation
- **Preconditions:** A defined skill fits the issue class
- **Action:** Recommend relevant skill(s) first
- **Outputs:** Suggested diagnostic path
- **Destination:** Skill execution / triage flow
- **Portability classification:** Portable Core
- **Automation level:** Level 1

### Hook: discord-issue-to-discord-diagnose

**Purpose:** Route Discord symptoms into the dedicated diagnostic surface.

- **Trigger:** Discord-related issue appears
- **Preconditions:** Issue is materially Discord-facing
- **Action:** Route to `discord-diagnose`
- **Outputs:** Focused diagnostic workflow
- **Destination:** Discord issue triage
- **Portability classification:** Unit Talk-Specific
- **Automation level:** Level 1

### Hook: scoring-review-request-to-scoring-audit

**Purpose:** Route scoring-edge review work into the structured scoring review
surface.

- **Trigger:** Scoring or intelligence review requested
- **Preconditions:** Request is materially about scoring logic / edge quality
- **Action:** Route to `scoring-audit`
- **Outputs:** Focused audit path
- **Destination:** Intelligence protection workflow
- **Portability classification:** Unit Talk-Specific
- **Automation level:** Level 1

### Hook: operator-check-request-to-agent-health

**Purpose:** Route general operating-surface health questions to the right
skill.

- **Trigger:** User asks what is healthy, stale, missing, or next
- **Preconditions:** Request is about operating-system state
- **Action:** Route to `agent-health`
- **Outputs:** Structured operator health review
- **Destination:** Sprint planning / status sync / gap review
- **Portability classification:** Adapter-Based
- **Automation level:** Level 1

---

# 12. Governance hooks

## 12.1 Purpose

Governance hooks ensure the AI operating system preserves proof discipline and
routes sensitive work into the correct verification path.

## 12.2 Why they matter

The system loses rigor if behavior-changing work is allowed to bypass closeout
discipline.

## 12.3 Proposed governance hooks

### Hook: behavior-changing-work-to-closeout-path

**Purpose:** Ensure changes that affect behavior do not stop at implementation.

- **Trigger:** Work changes actual system behavior
- **Preconditions:** Change is not purely exploratory or note-taking
- **Action:** Require governance/verification route
- **Outputs:** Closeout expectation / next step
- **Destination:** Claude OS verification or equivalent
- **Portability classification:** Portable Core
- **Automation level:** Level 1

### Hook: architecture-impacting-work-to-doc-check

**Purpose:** Ensure architecture-affecting work is aligned with current
governing docs.

- **Trigger:** Proposed or completed work alters boundaries, sequencing, or
  ownership
- **Preconditions:** Work is materially architectural
- **Action:** Require architecture doc check or audit path
- **Outputs:** Alignment reminder / review step
- **Destination:** Architecture review / doc reconciliation
- **Portability classification:** Portable Core
- **Automation level:** Level 1

### Hook: phase-sensitive-work-to-roadmap-check

**Purpose:** Prevent phase drift.

- **Trigger:** Work is being planned or executed inside a governed roadmap model
- **Preconditions:** Roadmap/phase sequencing matters
- **Action:** Require current roadmap reference before final shaping
- **Outputs:** Phase alignment step
- **Destination:** Sprint Planning / Prompt Composer
- **Portability classification:** Adapter-Based
- **Automation level:** Level 1

---

# 13. Portability matrix

| Hook Category           | Recommended Classification | Notes                                                     |
| ----------------------- | -------------------------- | --------------------------------------------------------- |
| Context hooks           | Portable Core              | Broadly reusable across projects                          |
| Workflow handoff hooks  | Portable Core              | Fundamental workflow glue                                 |
| Project bootstrap hooks | Portable Core              | Key to cross-project rollout                              |
| Artifact hooks          | Adapter-Based              | Artifact locations and conventions vary                   |
| Skill-routing hooks     | Mixed                      | Some portable, some project-bound                         |
| Governance hooks        | Mixed                      | Core pattern portable, phase/rule details project-adapted |

---

# 14. Recommended implementation order

## 14.1 First

**Workflow handoff hooks**

Reason:

- biggest immediate workflow leverage
- tightest connection to architecture → implementation → verification flow

## 14.2 Second

**Context hooks**

Reason:

- stale context creates major downstream errors

## 14.3 Third

**Governance hooks**

Reason:

- preserve discipline and prevent false closure

## 14.4 Fourth

**Artifact hooks**

Reason:

- improve reviewability and reduce lost outputs

## 14.5 Fifth

**Skill-routing hooks**

Reason:

- become more valuable as the skill surface grows

## 14.6 Sixth

**Project bootstrap hooks**

Reason:

- critical for portability, but strongest after some base hooks are proven

---

# 15. Recommended first implementation set

The highest-value first set is:

1. `architecture-approved-to-claude-handoff`
2. `implementation-complete-to-governance-closeout`
3. `verification-complete-to-status-sync`
4. `context-refresh-after-sprint-close`
5. `behavior-changing-work-to-closeout-path`
6. `diagnosis-request-to-skill-first-path`

These six hooks would remove a large amount of recurring workflow friction.

---

# 16. Acceptance criteria

The hook/automation architecture is considered defined when:

## 16.1 Category completeness

The main categories are clearly defined.

## 16.2 Hook contract clarity

Each priority hook has:

- trigger
- condition
- action
- outputs
- destination
- automation level
- portability classification

## 16.3 Boundary clarity

It is explicit which hooks are:

- advisory
- semi-automated
- automated

## 16.4 Governance safety

No hook design bypasses proof, verification, or closeout requirements.

## 16.5 Portability clarity

Each hook is classified as:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

---

# 17. Risks if this layer is not built

If the hook/automation layer is not built, likely failure modes include:

- too much manual remembering
- stale context during planning
- inconsistent handoff generation
- incomplete routing to closeout
- post-sprint drift
- skill surfaces not being used consistently
- portability remaining conceptual instead of operational

---

# 18. Strategic conclusion

The hook layer is the missing glue between all the other parts of the AI
operating system.

The current system already has:

- doctrine
- skills
- helper plans
- implementation flow
- governance flow

But it still depends too much on the operator remembering when to connect them.

Hooks solve that.

The right model is:

- docs define truth
- skills analyze
- helpers coordinate
- hooks connect workflow stages
- Claude Code implements
- Claude OS verifies and closes

That is the architecture that turns a disciplined operating pattern into an
actual operating system.

---

# 19. Recommended next document chain

After this document, the next artifact should be:

1. `AI_PORTABILITY_MODEL_v1.md`

After that, the next move should be to classify the current AI operating stack
into:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

and then convert the highest-value hooks/helpers/skills into
implementation-ready sprint work.

---

# 20. Version notes

## v1

Initial definition of the hook/automation layer, including:

- hook model
- hook categories
- priority hooks
- automation levels
- portability framing
