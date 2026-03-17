# AI_PORTABILITY_MODEL_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Define how the AI operating system is separated into portable core
infrastructure, adapter-based project layers, and Unit Talk-specific logic  
**Purpose:** Establish the canonical portability model so AI workflow assets can
be reused across Griff’s broader project portfolio without copying Unit
Talk-specific architecture into unrelated systems.

---

# 1. Why this document exists

The AI operating system has now advanced beyond a single-project experiment.

We have already built meaningful operating infrastructure around:

- doctrine
- routing
- preflight
- handoff structure
- context workflow
- MCP truth surfaces
- skill planning
- helper/agent architecture
- hook/automation architecture

The next problem is portability.

Without an explicit portability model, future projects risk falling into one of
two bad patterns:

## 1.1 Failure mode A — everything stays trapped inside Unit Talk

In this mode, the AI operating system becomes useful only inside Unit Talk, even
though many parts are broadly reusable.

## 1.2 Failure mode B — Unit Talk gets copied into unrelated projects

In this mode, future projects inherit Unit Talk-specific assumptions, workflows,
and domain logic that do not belong there.

Neither outcome is acceptable.

This document exists to define the model that separates:

- what is reusable everywhere
- what is reusable through project adapters
- what must remain Unit Talk-specific

That model is what allows the AI operating system to scale across Griff’s other
apps and repos without architectural confusion.

---

# 2. Objective

The objective of the portability model is to create a clean, governed framework
that:

- preserves the reusable value already created inside Unit Talk
- prevents accidental spread of Unit Talk-only business logic
- enables future repos to adopt the AI operating system faster
- clarifies what requires project-specific adaptation
- supports helper, hook, and skill portability
- creates the basis for a future reusable AI bootstrap/install path

---

# 3. Core portability principle

Every AI operating-system asset must be classified into one of three layers:

## 3.1 Portable Core

Reusable across projects with little or no project-specific change.

## 3.2 Adapter-Based Layer

Built from a shared pattern, but requires project-specific adapters, prompts,
invariants, docs, or truth sources.

## 3.3 Unit Talk-Specific Layer

Directly tied to Unit Talk domain logic, workflow design, business rules,
intelligence surfaces, or betting-specific operating models.

**Rule:** No future AI operating-system asset should be created or expanded
without explicit classification into one of these three layers.

---

# 4. The portability architecture

The correct architecture is:

## 4.1 Universal workflow engine + project adapters + project-specific domain modules

This means:

### Universal workflow engine

The reusable AI operating system foundation.

### Project adapters

The layer that teaches the reusable operating system how to understand a
specific project.

### Project-specific domain modules

The domain logic, workflows, and review surfaces that are unique to that
project.

This architecture is the preferred portability model because it avoids both
extremes:

- trapping all value inside Unit Talk
- blindly copying Unit Talk into everything else

---

# 5. Layer definitions

## 5.1 Portable Core

Portable Core includes the parts of the AI operating system that should
eventually work across most or all of Griff’s projects.

These are the repeatable workflow and operating patterns that are not inherently
betting-specific or Unit Talk-specific.

### Characteristics

Portable Core assets:

- solve general workflow/orchestration problems
- do not require Unit Talk business logic
- can be reused with minimal modification
- establish common operating discipline
- are strong candidates for future bootstrap/install flows

---

## 5.2 Adapter-Based Layer

Adapter-Based assets use the same core pattern, but need project-specific
inputs.

These are not universal by themselves, but they become reusable when paired with
a project adapter.

### Characteristics

Adapter-Based assets:

- reuse the same workflow shape across projects
- depend on project-specific docs, status sources, invariants, prompts, exports,
  or truth surfaces
- should not be hardcoded to Unit Talk
- should be designed intentionally for adaptation

---

## 5.3 Unit Talk-Specific Layer

Unit Talk-Specific assets are bound directly to the domain, workflows, logic, or
business architecture of Unit Talk.

These should remain in Unit Talk and should not be force-fit into the universal
operating core.

### Characteristics

Unit Talk-Specific assets:

- depend on betting-specific logic
- reference Unit Talk workflow contracts directly
- assume Discord-specific delivery structures unique to Unit Talk
- rely on pick lifecycle, scoring, risk, or settlement semantics specific to
  Unit Talk
- should remain local unless intentionally generalized later

---

# 6. Portable Core candidates

The following assets are currently the strongest Portable Core candidates.

## 6.1 Governance / workflow docs

- AI operating doctrine
- task routing matrix
- preflight checklist
- ChatGPT → Claude handoff template
- project setup checklist
- LLM decision playbook
- AI enhancement work map pattern
- future AI bootstrap/install guides

## 6.2 Workflow patterns

- architecture → implementation → verification routing pattern
- context bundle refresh pattern
- sprint planning pattern
- status reconciliation pattern
- artifact reviewability pattern
- proof discipline pattern
- work map / planning doc pattern
- helper/agent contract pattern
- hook contract pattern

## 6.3 Portable helpers / agents

- Prompt Composer Agent
- Project Bootstrap Agent
- Status Sync / Documentation Agent
- Architecture Audit Agent
- Incident Triage Agent (core pattern)
- portions of Sprint Planning Agent pattern

## 6.4 Portable hooks

- architecture-approved → Claude handoff
- implementation-complete → governance closeout
- verification-complete → status sync
- behavior-changing work → closeout path
- diagnosis request → skill-first path
- context refresh after sprint close
- completed analysis → durable repo doc recommendation

---

# 7. Adapter-Based layer candidates

These assets are reusable only when adapted to a specific project.

## 7.1 Project adapters

- project brain/context sources
- project-specific context bundle inputs
- project-specific roadmap and phase models
- project-specific status docs
- project-specific invariants
- project-specific truth sources
- project-specific artifact locations
- project-specific closeout expectations
- project-specific diagnosis evidence sources

## 7.2 Adapter-based helpers

- Sprint Planning Agent
- Intelligence Review Agent
- `agent-health`
- project-specific incident evidence adapters
- project-specific architecture audit inputs

## 7.3 Adapter-based hooks

- context freshness checks tied to project artifacts
- artifact routing tied to repo layout
- phase-sensitive governance hooks
- bootstrap hooks that generate project-specific adapter definitions

## 7.4 Adapter-based skill patterns

These may be reusable in shape but not in raw implementation:

- health-check skills
- architecture-audit skills
- intelligence review skills
- system-state review skills

---

# 8. Unit Talk-specific candidates

These should remain inside Unit Talk unless deliberately generalized later.

## 8.1 Domain workflows

- pick lifecycle specifics
- provider/promotion/settlement specifics
- grading and scoring semantics tied to betting workflows
- CLV, calibration, and risk domain reviews tied to betting intelligence
- Unit Talk-specific workflow registry logic
- Unit Talk-specific Discord operations and delivery logic

## 8.2 Unit Talk-specific skills

- `discord-diagnose` v1
- `scoring-audit` v1
- betting-domain intelligence review prompts
- Unit Talk-specific market/risk/edge review surfaces
- settlement-check concepts tied directly to Unit Talk’s domain architecture

## 8.3 Unit Talk-specific adapters/contracts

- channel IDs and Discord delivery expectations
- betting-specific invariants
- Unit Talk intelligence contracts
- Unit Talk canonical business tables and lifecycle assumptions
- Unit Talk-specific runtime/governance relationships

---

# 9. Portability decision test

Before building or expanding any AI operating-system asset, run this test.

## 9.1 Step 1 — Is this solving a general workflow/orchestration problem?

If yes, default it toward **Portable Core**.

Examples:

- handoff generation
- status reconciliation
- sprint planning pattern
- project bootstrap logic

## 9.2 Step 2 — Is the workflow reusable but dependent on project-specific truth?

If yes, classify it as **Adapter-Based**.

Examples:

- health views
- intelligence reviews
- roadmap-aware sprint planning
- context synthesis tied to project docs

## 9.3 Step 3 — Is it directly tied to Unit Talk business logic or betting intelligence?

If yes, keep it **Unit Talk-Specific**.

Examples:

- Discord diagnosis for Unit Talk delivery workflows
- scoring-edge audits for betting intelligence
- pick lifecycle reviews
- settlement-specific checks

---

# 10. Asset classification matrix

## 10.1 Current recommended classification matrix

| Asset                             | Classification                | Notes                                         |
| --------------------------------- | ----------------------------- | --------------------------------------------- |
| AI operating doctrine             | Portable Core                 | Strong universal candidate                    |
| task routing matrix               | Portable Core                 | Broad workflow reuse                          |
| preflight checklist               | Portable Core                 | Reusable discipline layer                     |
| ChatGPT → Claude handoff template | Portable Core                 | Strong cross-project value                    |
| project setup checklist           | Portable Core                 | Core bootstrap asset                          |
| LLM decision playbook             | Portable Core                 | Cross-project operating value                 |
| context bundle pattern            | Portable Core                 | Pattern portable                              |
| project context contents          | Adapter-Based                 | Inputs vary by project                        |
| MCP truth surfaces pattern        | Adapter-Based                 | Same model, different sources                 |
| `pipeline-health` pattern         | Adapter-Based                 | Health checks vary by system                  |
| `pick-trace`                      | Unit Talk-Specific            | Tied to Unit Talk workflow semantics          |
| `slo-report` pattern              | Adapter-Based                 | Reusable where SLOs exist                     |
| `edge-check`                      | Unit Talk-Specific            | Betting-domain logic                          |
| `agent-health`                    | Adapter-Based                 | Same pattern, project-specific health model   |
| `discord-diagnose`                | Unit Talk-Specific            | First version tied to Unit Talk Discord flows |
| `scoring-audit`                   | Unit Talk-Specific            | First version tied to betting intelligence    |
| Sprint Planning Agent             | Adapter-Based                 | Pattern reusable, roadmap inputs vary         |
| Incident Triage Agent             | Portable Core                 | Broad pattern with project evidence adapters  |
| Architecture Audit Agent          | Portable Core                 | Strong universal value                        |
| Intelligence Review Agent         | Adapter-Based                 | Pattern reusable, subject matter varies       |
| Project Bootstrap Agent           | Portable Core                 | Explicitly cross-project                      |
| Status Sync / Documentation Agent | Portable Core                 | Broadly reusable                              |
| Prompt Composer Agent             | Portable Core                 | Very strong portability candidate             |
| workflow handoff hooks            | Portable Core                 | General operating glue                        |
| artifact routing hooks            | Adapter-Based                 | Path conventions vary                         |
| governance closeout hooks         | Portable Core / Adapter-Based | Core pattern portable, details adapted        |
| phase-sensitive hooks             | Adapter-Based                 | Depends on project roadmap model              |

---

# 11. Project adapter model

The adapter model is the key portability bridge.

## 11.1 What a project adapter should define

Every project adapter should eventually define:

- project identity
- domain summary
- roadmap / phase model
- canonical docs
- status docs
- truth sources
- artifact conventions
- closeout path
- project-specific invariants
- project-specific skill candidates
- project-specific helper tuning
- project-specific hook tuning

## 11.2 Why adapters matter

Without adapters, even reusable helpers and hooks become fragile because they do
not know:

- what docs matter
- what counts as “current state”
- what phase model is in use
- what evidence sources exist
- what domain risks are important
- what portability boundary must be respected

## 11.3 Adapter output concept

A project adapter should eventually act as the translation layer that tells the
portable AI operating core:

- what this project is
- how it organizes truth
- what artifacts matter
- what workflows are sensitive
- what should remain project-bound

---

# 12. Portability boundaries

Portability is valuable, but over-porting is dangerous.

## 12.1 Do not over-port domain logic

Not everything should be extracted.

Examples of things that should not be prematurely generalized:

- betting intelligence assumptions
- Unit Talk-specific Discord channel logic
- scoring semantics tied to Unit Talk’s edge machine
- workflow registry contracts unique to Unit Talk

## 12.2 Do not hardcode Unit Talk into reusable helpers

If a helper is intended to become reusable, it must not assume:

- Unit Talk doc names only
- Unit Talk phases only
- Unit Talk artifact paths only
- Unit Talk channel semantics only

These belong in adapters.

## 12.3 Do not create fake portability

A thing is not portable merely because it was copied into another repo. It is
portable when:

- its reusable core is clear
- its project-specific inputs are isolated
- its adapter requirements are explicit

---

# 13. Recommended extraction strategy

Portability should be extracted in stages.

## 13.1 Stage 1 — Classification

Classify current assets into:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

## 13.2 Stage 2 — Boundary cleanup

Cleanly separate:

- reusable patterns
- project adapter requirements
- Unit Talk-only logic

## 13.3 Stage 3 — Bootstrap-ready packaging

Turn the strongest Portable Core assets into:

- reusable docs
- reusable templates
- reusable helper definitions
- reusable hook definitions
- reusable setup flow

## 13.4 Stage 4 — First non-Unit Talk pilot

Apply the model to a second project.

Good pilot candidates:

- poker project
- Madden tool
- another operations-heavy app

This is the real portability proof.

---

# 14. Recommended initial portability priorities

The first things that should be treated as portability priorities are:

## 14.1 Highest priority

- Prompt Composer Agent
- Project Bootstrap Agent
- Status Sync / Documentation Agent
- handoff templates
- preflight
- routing
- doctrine pattern
- context workflow pattern

## 14.2 Second priority

- Sprint Planning Agent
- Incident Triage Agent
- Architecture Audit Agent
- workflow handoff hooks
- context hooks

## 14.3 Later priority

- generalized health surfaces
- generalized intelligence review surfaces
- broader reusable skill framework
- portable install/bootstrap scaffolding

---

# 15. Acceptance criteria

The portability model is considered defined when:

## 15.1 Classification clarity

The three-layer model is explicit and stable:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

## 15.2 Asset clarity

A first classification matrix exists for the major current assets.

## 15.3 Adapter clarity

The concept of a project adapter is clearly defined.

## 15.4 Boundary clarity

The repo and future planning can distinguish:

- what should be extracted
- what should be adapted
- what should stay local to Unit Talk

## 15.5 Actionability

This document can guide future:

- sprint shaping
- helper design
- skill design
- bootstrap design
- portability extraction work

---

# 16. Risks if this model is not defined

If the portability model is not defined, likely failure modes include:

- Unit Talk becoming a dead-end container for reusable work
- accidental spread of Unit Talk-specific assumptions into other apps
- fake portability through copy/paste
- helpers and hooks becoming harder to reuse later
- new projects re-solving the same workflow problems from scratch
- architecture confusion about what belongs where

---

# 17. Strategic conclusion

The AI operating system is now mature enough that portability must be designed
deliberately.

The correct model is not:

- “keep everything in Unit Talk”
- “copy Unit Talk everywhere”

The correct model is:

**Portable Core + Project Adapters + Project-Specific Domain Modules**

That architecture preserves what is truly reusable, isolates what must adapt,
and protects what should remain local to Unit Talk.

This is the model that gives Griff a real cross-project AI operating system
instead of a collection of chat-era patterns tied to one repo.

---

# 18. Recommended next moves after this doc

After this document, the next best moves are:

1. create a concrete classification pass for the current AI stack
2. choose the first helper/hook assets to make portability-ready
3. define the project adapter template
4. identify the first non-Unit Talk project pilot

A good immediate follow-on artifact would be:

- `AI_PROJECT_ADAPTER_TEMPLATE_v1.md`

After that:

- `AI_PORTABLE_CORE_INVENTORY_v1.md`

---

# 19. Version notes

## v1

Initial definition of the AI portability model, including:

- three-layer portability architecture
- classification rules
- adapter model
- asset classification matrix
- extraction strategy
