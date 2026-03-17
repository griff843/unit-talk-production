# AI_BOOTSTRAP_SEQUENCE_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Define the standard sequence for bringing the AI operating system
into a repo or app  
**Purpose:** Establish a governed bootstrap path so future projects adopt the AI
operating core in the right order, with clear boundaries between portable
assets, project adapters, and project-specific domain logic.

---

# 1. Why this document exists

The AI operating system now has enough structure that future projects should not
adopt it through improvisation.

We have already defined:

- the remaining enhancement work map
- Skill Wave 2
- the helper/agent layer
- the hook/automation layer
- the portability model
- the portable-core inventory
- the project adapter template
- the Unit Talk adapter instance

What is still missing is the **bootstrap sequence**.

Without a bootstrap sequence, future repo adoption is likely to become:

- inconsistent
- over-manual
- overfit to Unit Talk
- missing critical docs
- unclear about what to install first
- unclear about when project-local logic should appear

This document defines the standard order for introducing the AI operating system
into a project.

---

# 2. Objective

The objective of the bootstrap sequence is to ensure a new repo or app adopts
the AI operating system in a way that is:

- structured
- phase-aware
- portable-core-first
- adapter-driven
- governance-safe
- implementation-ready
- repeatable across Griff’s project portfolio

The bootstrap sequence should help avoid two bad outcomes:

## 2.1 Failure mode A — under-bootstrapped

The project gets some prompts and a few docs, but no real operating system.

## 2.2 Failure mode B — over-copied from Unit Talk

The project inherits Unit Talk-specific assumptions that do not belong there.

---

# 3. Governing principle

A new project should adopt the AI operating system in this order:

1. **Portable Core first**
2. **Project Adapter second**
3. **Project-specific domain surfaces third**
4. **Higher-order helpers, hooks, and skills after the base is stable**

**Rule:** Do not install project-local complexity before the project has:

- a governing doc layer
- a project adapter
- a basic status/truth model
- a closeout path

---

# 4. Bootstrap architecture model

The bootstrap sequence assumes the target project will eventually contain three
layers:

## 4.1 Portable Core

Reusable operating-system assets that should remain cross-project.

## 4.2 Project Adapter

The translation layer that tells the portable core how to interpret this
specific project.

## 4.3 Project-Specific Domain Layer

The local workflows, invariants, logic, diagnostics, and review surfaces that
belong only to that project.

The bootstrap sequence should establish these in order.

---

# 5. Bootstrap phases

The recommended bootstrap sequence has seven phases:

1. Bootstrap intake
2. Portable core foundation
3. Project adapter definition
4. Project truth and status wiring
5. First operating loop enablement
6. Helper/hook/skill tuning
7. Bootstrap validation and first sprint launch

---

# 6. Phase 0 — Bootstrap intake

## 6.1 Purpose

Understand the target project well enough to decide how the AI operating system
should be introduced.

## 6.2 Why it matters

Bad bootstrap starts happen when the AI layer is installed before the project is
understood.

## 6.3 Required outputs

Before bootstrapping, establish:

- project name
- short domain summary
- primary purpose
- current maturity level
- main repo/app surfaces
- highest-risk failure modes
- whether the project already has canonical docs
- whether the project already has a roadmap or phase model
- whether the project already has a closeout discipline
- whether the project already has artifact conventions

## 6.4 Bootstrap intake questions

- What is this project?
- What is the main thing it is trying to do?
- What types of work happen here?
- What mistakes are expensive?
- Is this code-heavy, ops-heavy, product-heavy, intelligence-heavy, or mixed?
- Does it already have real docs, or is the operating layer starting from
  scratch?
- Is there already a build/test/verification path?
- Is this a greenfield project or an existing repo needing retrofit?

## 6.5 Exit criteria

Phase 0 is complete when there is enough clarity to create:

- a project adapter
- a minimal core doc set
- a basic closeout path
- a first sprint recommendation

---

# 7. Phase 1 — Portable Core foundation

## 7.1 Purpose

Install the core reusable operating-system layer before introducing
project-local complexity.

## 7.2 What gets introduced here

The project should receive the baseline Portable Core assets or their
equivalents.

### Minimum foundation set

- AI operating doctrine
- task routing matrix
- preflight checklist
- ChatGPT → Claude handoff template
- project setup checklist
- LLM decision playbook

### Optional early additions

- helper contract pattern
- hook contract pattern
- work map pattern
- prompt-composer conventions
- proof discipline pattern

## 7.3 Why this happens before the adapter

The project needs a stable operating grammar before it starts configuring
project-local meaning.

## 7.4 Exit criteria

Phase 1 is complete when:

- the repo/project has a baseline operating doctrine
- routing is clear enough to separate planning, implementation, and verification
- handoff quality can be standardized
- preflight expectations exist
- the project has a known starting operating model

---

# 8. Phase 2 — Project adapter definition

## 8.1 Purpose

Teach the portable core how to understand the target project.

## 8.2 Required artifact

Create the project adapter using:

- `AI_PROJECT_ADAPTER_TEMPLATE_v1.md`

Naming pattern:

- `AI_PROJECT_ADAPTER_<PROJECT_NAME>_v1.md`

## 8.3 What the adapter must define

At minimum:

- project identity
- canonical docs
- roadmap / phase model
- status surfaces
- truth sources
- governance / closeout path
- domain-sensitive boundaries

At stronger maturity:

- helper tuning
- hook tuning
- skill surface
- artifact conventions
- common failure modes
- project-specific cautions

## 8.4 Why this is critical

Without an adapter:

- helpers start hardcoding project assumptions
- hooks do not know what to route against
- planning drifts
- portable assets start becoming secretly Unit Talk-shaped

## 8.5 Exit criteria

Phase 2 is complete when:

- the project adapter exists
- it is good enough for helpers and hooks to use
- project-local boundaries are explicit
- the portable core no longer needs to infer project truth from chat alone

---

# 9. Phase 3 — Project truth and status wiring

## 9.1 Purpose

Connect the operating system to the project’s actual current-state and truth
surfaces.

## 9.2 What must be wired

The AI operating system should now know:

- what docs are canonical
- what current-state docs matter
- what roadmap docs govern sequencing
- what artifact paths matter
- what proof or verification outputs matter
- what sources should be treated as hard truth vs advisory context

## 9.3 Recommended outputs

This phase should establish or confirm:

- current-state docs
- status freshness expectations
- artifact path expectations
- current sprint closeout source
- any context generation pattern
- any repo intelligence snapshot pattern if needed

## 9.4 Why this matters

Without truth/status wiring:

- the AI layer cannot plan safely
- sprint shaping becomes stale
- documentation sync becomes guesswork
- helper/hook behavior becomes unreliable

## 9.5 Exit criteria

Phase 3 is complete when:

- the project has a usable current-state model
- the AI operating layer knows where truth lives
- closeout outputs can be routed back into status
- planning can occur against fresh enough information

---

# 10. Phase 4 — First operating loop enablement

## 10.1 Purpose

Activate the base architecture → implementation → verification loop in the new
project.

## 10.2 What gets enabled

At minimum:

- architecture / planning work
- Claude handoff generation
- implementation path
- verification / closeout path
- post-closeout reconciliation path

## 10.3 Required operating loop

The project should be able to execute:

**Plan → Implement → Verify → Proof → Reconcile**

Even if the loop is still partially manual.

## 10.4 Minimal capabilities required

- architecture can be shaped cleanly
- a handoff can be generated consistently
- implementation has a defined lane
- verification is not optional for behavior-changing work
- status can be updated after closeout

## 10.5 Exit criteria

Phase 4 is complete when:

- the project can run one real sprint through the full loop
- the loop produces durable outputs
- the operator is not relying entirely on memory to move between stages

---

# 11. Phase 5 — Helper, hook, and skill tuning

## 11.1 Purpose

Now that the base loop exists, begin tuning the operating system to the project
using adapter-aware helpers, hooks, and skills.

## 11.2 What belongs here

### Helper introduction

Prioritize the helpers that provide the most leverage for the project.

Strong default order:

1. Prompt Composer Agent
2. Sprint Planning Agent
3. Status Sync / Documentation Agent
4. Incident Triage Agent
5. Architecture Audit Agent
6. Project Bootstrap Agent
7. Intelligence Review Agent where relevant

### Hook introduction

Strong default order:

1. architecture-approved → handoff
2. implementation-complete → closeout
3. verification-complete → status sync
4. context refresh after sprint close
5. behavior-changing work → closeout path
6. diagnosis request → skill-first path

### Skill introduction

Introduce only the skills that fit the project.

Examples:

- health-check skill
- architecture-boundary-audit
- system-state review skill
- project-local skills where truly needed

## 11.3 Why this phase comes later

Helpers, hooks, and skills should be tuned only after:

- the project adapter exists
- truth/status are wired
- the base loop works

Otherwise they will be overfit or underinformed.

## 11.4 Exit criteria

Phase 5 is complete when:

- at least the highest-value helper(s) are active in defined form
- at least the highest-value hook(s) are defined or used
- the project has its first meaningful skill surface if needed
- the operator is experiencing reduced friction vs pre-bootstrap

---

# 12. Phase 6 — Bootstrap validation and first sprint launch

## 12.1 Purpose

Prove the bootstrap actually works by using it.

## 12.2 Required validation

The project should pass at least one real workflow through the newly installed
operating system.

Recommended validation scenarios:

- choose the next sprint
- generate the handoff
- execute implementation
- route to verification
- reconcile status
- review what drift or friction remains

## 12.3 What should be evaluated

- Did the docs help or create noise?
- Did the adapter provide enough truth?
- Did the handoff quality improve?
- Was verification properly preserved?
- Were statuses updated cleanly?
- Did any helper or hook over-assume project truth?
- Did any Unit Talk assumptions leak into the project?

## 12.4 Exit criteria

Phase 6 is complete when:

- one real sprint has run through the loop
- the bootstrap weaknesses are visible
- the project has a known next refinement step
- the AI operating system is now truly installed, not just documented

---

# 13. Recommended bootstrap quality tiers

## 13.1 Tier 1 — Minimal bootstrap

Use when:

- the project is early
- the repo is light
- the goal is to establish basic operating discipline quickly

Must include:

- portable-core minimum docs
- minimal project adapter
- basic closeout path
- one real sprint through the loop

## 13.2 Tier 2 — Operational bootstrap

Use when:

- the project has meaningful ongoing work
- coordination quality matters
- repeated sprint shaping is expected

Includes Tier 1 plus:

- stronger adapter
- status/truth wiring
- first helpers
- first hooks
- first durable artifact conventions

## 13.3 Tier 3 — Production-grade bootstrap

Use when:

- the project is becoming a real operating surface
- governance, portability, and repeatability matter heavily

Includes Tier 2 plus:

- stable helper layer
- stable hook layer
- first meaningful skill layer
- refined artifact routing
- explicit portability boundaries
- post-bootstrap refinement backlog

---

# 14. Recommended default order of artifact creation

For most projects, this is the cleanest initial sequence.

## 14.1 First wave

1. AI operating doctrine
2. task routing matrix
3. preflight checklist
4. ChatGPT → Claude handoff template
5. project setup checklist
6. LLM decision playbook

## 14.2 Second wave

7. project adapter
8. current-state/status reference docs if missing
9. artifact/output conventions
10. basic closeout path

## 14.3 Third wave

11. helper architecture usage
12. first hooks
13. first project-fit skills
14. first operating-loop validation sprint

---

# 15. What should not happen during bootstrap

## 15.1 Do not start with project-local skills

Project-local skills should not come before:

- the adapter
- truth wiring
- the base operating loop

## 15.2 Do not copy Unit Talk blindly

A new project should not inherit:

- Unit Talk-specific phases
- betting-specific logic
- Discord-specific semantics
- pick-machine assumptions

unless that project genuinely shares those boundaries.

## 15.3 Do not overbuild before first validation

Do not create a giant helper/hook stack before proving the base loop works.

## 15.4 Do not treat docs alone as bootstrap completion

Bootstrap is not complete until at least one real sprint has used the system.

---

# 16. Bootstrap decision matrix

## 16.1 If the project is new and lightly structured

Start with:

- Tier 1 bootstrap
- minimal adapter
- one validation sprint

## 16.2 If the project already has complexity but weak governance

Start with:

- Portable Core docs
- project adapter
- status/truth wiring
- Prompt Composer + Status Sync as first helpers
- governance hooks early

## 16.3 If the project is already mature and operationally heavy

Start with:

- full adapter
- artifact conventions
- closeout discipline
- Sprint Planning + Prompt Composer + Incident Triage
- workflow handoff hooks early

---

# 17. Recommended first non-Unit Talk pilot profile

A good pilot project should be:

- real enough to pressure-test the system
- different enough from Unit Talk to expose hidden assumptions
- important enough that better workflow quality matters

Good candidates:

- poker project
- Madden tool
- another ops-heavy application
- a structured coaching/project repo

The first pilot should not be chosen purely because it is easy. It should be
chosen because it reveals whether the portable core is genuinely portable.

---

# 18. Acceptance criteria

The bootstrap sequence is considered usable when:

## 18.1 Sequence clarity

The order of introduction is explicit.

## 18.2 Boundary clarity

It is clear what belongs to:

- Portable Core
- Project Adapter
- Project-Specific Domain Layer

## 18.3 Operational realism

The sequence requires a real validation sprint, not just document creation.

## 18.4 Governance safety

The sequence does not allow behavior-changing work to bypass closeout.

## 18.5 Portability support

The sequence can be reused across future repos without forcing Unit Talk
assumptions into them.

---

# 19. Risks if this sequence is not followed

If the bootstrap sequence is not followed, likely failure modes include:

- random doc creation with no operating order
- helpers and hooks hardcoding project assumptions too early
- stale planning because truth/status never got wired
- false portability through copy/paste
- project-local skills appearing before the project has a stable operating core
- no real validation of whether the operating system actually works in the new
  repo

---

# 20. Strategic conclusion

The bootstrap sequence is what turns the AI operating system from a set of good
documents into a repeatable installation path.

The correct order is:

- establish the Portable Core
- define the Project Adapter
- wire truth and status
- enable the base operating loop
- tune helpers/hooks/skills
- validate with real work

That order protects portability, reduces drift, and prevents future projects
from becoming either under-bootstrapped or secretly Unit Talk-shaped.

---

# 21. Recommended next moves

After this document, the next strongest moves are:

1. use this sequence to evaluate whether Unit Talk itself is fully bootstrapped
2. pick the first non-Unit Talk pilot
3. create that project’s adapter
4. run a Tier 1 or Tier 2 bootstrap using this sequence
5. document what broke, what generalized well, and what still depends too
   heavily on Unit Talk

A strong follow-on doc would be:

- `AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md`

Or, if you want to go directly into application:

- first non-Unit Talk project adapter doc

---

# 22. Version notes

## v1

Initial definition of the AI bootstrap sequence, including:

- bootstrap phases
- sequencing rules
- quality tiers
- artifact creation order
- failure-mode prevention
- validation requirements
