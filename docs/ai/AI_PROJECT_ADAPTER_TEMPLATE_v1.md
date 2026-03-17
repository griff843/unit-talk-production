# AI_PROJECT_ADAPTER_TEMPLATE_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Define the standard project-adapter contract that allows the portable
AI operating core to be applied to different repos and apps  
**Purpose:** Establish the translation layer between the reusable AI operating
system and a specific project’s docs, roadmap, truth sources, artifacts,
constraints, and domain boundaries.

---

# 1. Why this document exists

The portability model and inventory now make one thing clear:

A large portion of the AI operating system is reusable, but not self-sufficient.

It still needs a defined way to understand each project’s:

- canonical docs
- roadmap / phase model
- status surfaces
- truth sources
- artifact structure
- governance path
- domain boundaries
- project-specific skills and review surfaces

That is the role of the **project adapter**.

Without a project adapter, the portable core has no clean way to know:

- what documents matter
- what current state means
- what counts as proof
- what workflows are sensitive
- what is project-local versus reusable
- what helper and hook behavior should adapt

This document defines that adapter contract.

---

# 2. Objective

The objective of the project adapter is to provide a standard way for any
project to tell the AI operating system:

- what this project is
- how it organizes truth
- how work is phased and governed
- where status is tracked
- where artifacts live
- what domain logic is sensitive
- what AI workflow assets should be adapted locally
- what should remain project-specific

The project adapter is the bridge between:

- **Portable Core**
- **Adapter-Based assets**
- **Project-specific domain modules**

---

# 3. Governing principle

The portable AI operating core must never hardcode project truth.

Instead, each project must supply an adapter that defines its own:

- identity
- governing docs
- roadmap model
- status sources
- truth surfaces
- artifacts
- closeout path
- domain-sensitive boundaries

**Rule:** If a reusable helper, hook, or skill needs project-specific knowledge,
that knowledge should live in the project adapter, not inside the portable core.

---

# 4. Role of the project adapter in the architecture

## 4.1 Full model

The intended portability architecture is:

**Portable Core + Project Adapter + Project-Specific Domain Modules**

## 4.2 Responsibilities of each layer

### Portable Core

Provides reusable operating assets such as:

- doctrine patterns
- routing patterns
- preflight patterns
- handoff patterns
- helper patterns
- hook patterns
- bootstrap patterns

### Project Adapter

Provides project-specific translation and configuration such as:

- project identity
- canonical docs
- roadmap model
- status docs
- truth sources
- artifact paths
- governance expectations
- adapter-based helper inputs
- adapter-based hook inputs
- project-sensitive boundaries

### Project-Specific Domain Modules

Contain things that should remain local, such as:

- business logic
- domain workflows
- domain review prompts
- sensitive invariants
- project-specific skills
- project-specific delivery behavior

---

# 5. What a project adapter must define

Every project adapter should define the following sections.

## 5.1 Project identity

This section explains what the project is.

Required fields:

- project name
- short domain summary
- primary purpose
- primary operating surfaces
- risk profile summary
- major delivery or runtime surfaces

### Example questions

- What is this project trying to do?
- What is the main operating surface?
- What kinds of mistakes are expensive here?
- Is this product-facing, ops-facing, intelligence-facing, or
  infrastructure-facing?

---

## 5.2 Canonical documentation map

This section tells the AI operating system which docs matter most.

Required fields:

- canonical roadmap docs
- canonical current-state docs
- canonical architecture docs
- canonical governance docs
- canonical status docs
- doc precedence rules if multiple docs exist

### Example questions

- Which docs should helpers trust first?
- What docs govern sprint alignment?
- What docs define the current architecture truth?
- What docs must be checked before shaping a sprint?

---

## 5.3 Roadmap / phase model

This section defines how the project sequences work.

Required fields:

- current roadmap model
- current active phase/layer
- phase ordering rules
- dependencies or sequencing expectations
- phase-sensitive constraints if applicable

### Example questions

- Does the project use layers, phases, milestones, sprints, streams, or another
  model?
- What phase is active right now?
- What work is not allowed to jump ahead?
- What must be verified before advancing?

---

## 5.4 Status surfaces

This section defines where current progress and recent changes are tracked.

Required fields:

- primary current-state docs
- sprint closeout source
- recent changes source
- backlog or findings source if used
- status freshness expectations

### Example questions

- Where should Sprint Planning Agent look first?
- Where should Status Sync Agent reconcile against?
- What source is authoritative for recent completion state?
- How stale is too stale?

---

## 5.5 Truth sources

This section defines what the project uses for operational truth.

Required fields:

- repo truth sources
- artifact truth sources
- runtime truth sources if relevant
- diagnostics surfaces
- model/data truth sources if relevant

### Example questions

- What should the AI operating system read to understand the project?
- What should be treated as soft context vs hard truth?
- What diagnostics surfaces exist?
- What sources are advisory versus canonical?

---

## 5.6 Artifact conventions

This section defines how the project stores proof, outputs, and durable
references.

Required fields:

- proof bundle path conventions
- sprint artifact path conventions
- audit artifact path conventions
- durable docs path conventions
- reviewability expectations

### Example questions

- Where do proof bundles go?
- Where should sprint outputs be saved?
- What should become a repo doc instead of staying in chat?
- What counts as review-ready?

---

## 5.7 Governance / closeout path

This section defines how behavior-changing work gets closed out safely.

Required fields:

- required closeout path
- required evidence expectations
- verification rules
- no-closeout exceptions if any
- ownership of final closure

### Example questions

- What must happen before work is treated as done?
- What counts as proof?
- Who or what verifies?
- Are there different rules for exploratory vs behavior-changing work?

---

## 5.8 Domain-sensitive boundaries

This section tells the portable core what should not be generalized or mutated
casually.

Required fields:

- project-specific sensitive workflows
- project-specific business logic boundaries
- project-local invariants
- project-local delivery semantics
- domains that must remain local

### Example questions

- What logic should never be treated as portable by default?
- What workflows are expensive or dangerous if misunderstood?
- What business or intelligence rules are project-specific?
- What must stay outside the portable core?

---

## 5.9 Adapter-based helper configuration

This section explains how reusable helpers should adapt to the project.

Required fields:

- Sprint Planning Agent inputs
- Incident Triage Agent inputs
- Architecture Audit Agent inputs
- Intelligence Review Agent inputs if relevant
- Status Sync inputs
- Prompt Composer constraints

### Example questions

- Which docs should each helper read first?
- Which helper is most important in this project?
- What should each helper ignore?
- What project-specific constraints must helper outputs respect?

---

## 5.10 Adapter-based hook configuration

This section explains how reusable hooks should behave in this project.

Required fields:

- context refresh triggers
- handoff triggers
- closeout routing triggers
- artifact routing triggers
- phase-sensitive routing triggers
- skill-routing triggers if used

### Example questions

- When should context refresh be recommended?
- What events should trigger handoff creation?
- What should route automatically to closeout?
- What artifact paths should hooks use?

---

## 5.11 Project-specific skill surface

This section documents skills that are local to the project.

Required fields:

- current project-specific skills
- planned project-specific skills
- reasons they are local
- possible future generalization candidates

### Example questions

- Which skills belong only to this project?
- Which skills might later become adapter-based?
- Which skills depend on project-only domain logic?

---

## 5.12 Project-specific constraints and cautions

This section captures special operating realities.

Required fields:

- important constraints
- common failure modes
- common drift risks
- tool constraints
- unsafe assumptions to avoid

### Example questions

- What mistakes recur in this project?
- What kinds of drift happen often?
- What assumptions should helpers or hooks never make?
- What operational cautions matter most?

---

# 6. Standard adapter template

The following is the standard project adapter template format.

---

## 6.1 Template body

```markdown
# AI*PROJECT_ADAPTER*<PROJECT_NAME>\_v1

**Status:** Draft v1  
**Owner:** <Owner>  
**Project:** <Project Name>  
**Scope:** Project adapter for the AI operating system  
**Purpose:** Define how the portable AI operating core should interpret and
operate within this project.

---

# 1. Project identity

## 1.1 Name

<project name>

## 1.2 Domain summary

<short description>

## 1.3 Primary purpose

<what the project does>

## 1.4 Primary operating surfaces

- <surface 1>
- <surface 2>

## 1.5 Risk profile summary

<what kinds of mistakes are expensive>

---

# 2. Canonical documentation map

## 2.1 Canonical roadmap docs

- <doc path>
- <doc path>

## 2.2 Canonical current-state docs

- <doc path>
- <doc path>

## 2.3 Canonical architecture docs

- <doc path>
- <doc path>

## 2.4 Canonical governance docs

- <doc path>
- <doc path>

## 2.5 Canonical status docs

- <doc path>
- <doc path>

## 2.6 Precedence rules

<which docs win if tension exists>

---

# 3. Roadmap / phase model

## 3.1 Model in use

<layers / phases / milestones / etc.>

## 3.2 Current active phase

<phase name>

## 3.3 Sequencing rules

- <rule>
- <rule>

## 3.4 Advancement requirements

<what must be true before progressing>

---

# 4. Status surfaces

## 4.1 Primary current-state sources

- <doc / artifact>
- <doc / artifact>

## 4.2 Sprint closeout source

<source>

## 4.3 Backlog / findings source

<source>

## 4.4 Freshness expectation

<how recent state should be>

---

# 5. Truth sources

## 5.1 Repo truth sources

- <source>
- <source>

## 5.2 Artifact truth sources

- <source>
- <source>

## 5.3 Runtime / verification truth sources

- <source>
- <source>

## 5.4 Diagnostic truth surfaces

- <surface>
- <surface>

---

# 6. Artifact conventions

## 6.1 Proof bundle conventions

<path / naming / expectations>

## 6.2 Sprint artifact conventions

<path / naming / expectations>

## 6.3 Audit artifact conventions

<path / naming / expectations>

## 6.4 Durable reference doc conventions

<what should become docs>

---

# 7. Governance / closeout path

## 7.1 Required closeout path

<how behavior-changing work closes>

## 7.2 Proof requirements

<what counts as proof>

## 7.3 Verification rules

<what must be checked>

## 7.4 Exceptions

<if any>

---

# 8. Domain-sensitive boundaries

## 8.1 Project-local business/domain logic

- <boundary>
- <boundary>

## 8.2 Project-local invariants

- <invariant>
- <invariant>

## 8.3 Project-local delivery semantics

- <semantic>
- <semantic>

## 8.4 Non-portable areas

- <area>
- <area>

---

# 9. Adapter-based helper configuration

## 9.1 Sprint Planning Agent inputs

<what it should use>

## 9.2 Incident Triage Agent inputs

<what it should use>

## 9.3 Architecture Audit Agent inputs

<what it should use>

## 9.4 Intelligence Review Agent inputs

<what it should use>

## 9.5 Status Sync inputs

<what it should use>

## 9.6 Prompt Composer constraints

<what it must respect>

---

# 10. Adapter-based hook configuration

## 10.1 Context refresh triggers

- <trigger>
- <trigger>

## 10.2 Handoff triggers

- <trigger>
- <trigger>

## 10.3 Closeout routing triggers

- <trigger>
- <trigger>

## 10.4 Artifact routing triggers

- <trigger>
- <trigger>

## 10.5 Phase-sensitive routing triggers

- <trigger>
- <trigger>

## 10.6 Skill-routing triggers

- <trigger>
- <trigger>

---

# 11. Project-specific skill surface

## 11.1 Current project-specific skills

- <skill>
- <skill>

## 11.2 Planned project-specific skills

- <skill>
- <skill>

## 11.3 Possible future generalization candidates

- <candidate>
- <candidate>

---

# 12. Project-specific constraints and cautions

## 12.1 Important constraints

- <constraint>
- <constraint>

## 12.2 Common failure modes

- <failure mode>
- <failure mode>

## 12.3 Common drift risks

- <risk>
- <risk>

## 12.4 Unsafe assumptions to avoid

- <assumption>
- <assumption>

7. Minimal adapter requirements

If a full adapter cannot be completed immediately, the minimum viable adapter
should still define:

project identity

canonical documentation map

roadmap / phase model

status surfaces

truth sources

governance / closeout path

domain-sensitive boundaries

This is the minimum needed for the portable core to operate responsibly.

8. Recommended adapter quality tiers 8.1 Tier 1 — Minimal

Enough information to avoid gross misalignment.

Includes:

project identity

key docs

current phase

status sources

closeout path

domain boundaries

8.2 Tier 2 — Operational

Enough information for helpers and hooks to operate well.

Includes Tier 1 plus:

helper inputs

hook triggers

artifact conventions

skill surface

common constraints

8.3 Tier 3 — Production-grade

Enough information for portability, bootstrap, and reuse across future projects
with minimal confusion.

Includes Tier 2 plus:

strong precedence rules

mature artifact conventions

refined domain boundary language

stable adapter-based helper/hook tuning

explicit future generalization candidates

9. Recommended first adapter instance

The first real adapter instance should be:

AI_PROJECT_ADAPTER_UNIT_TALK_v1.md

Reason:

it is the source project

it has the richest context

it will pressure-test the adapter template

it will reveal what in the portable core is still secretly Unit Talk-shaped

This is the most important immediate follow-on use of this template.

10. Adapter design rules 10.1 Do not bury critical truth in chat

If the adapter depends on it repeatedly, it should be in the adapter doc.

10.2 Do not overfit the adapter to one helper

The adapter serves the whole portable core, not just one workflow.

10.3 Do not pretend local logic is portable

If something is Unit Talk-specific, say so directly.

10.4 Prefer explicitness over elegance

A slightly longer adapter is better than a clever but incomplete one.

10.5 Keep the adapter stable, not noisy

This should not become a dumping ground for every minor note. It should capture
durable project operating truth.

11. Acceptance criteria

This template is considered usable when:

11.1 Coverage

It defines all required adapter sections.

11.2 Portability support

It clearly supports reusable helpers, hooks, and patterns without forcing them
to hardcode project assumptions.

11.3 Boundary clarity

It makes project-local boundaries explicit.

11.4 Bootstrap readiness

It can support future project bootstrap work.

11.5 Immediate usability

It is good enough to be instantiated for Unit Talk next.

12. Risks if this template is not created

If the project adapter template is not formalized, likely failure modes include:

portable helpers hardcoding Unit Talk assumptions

future project setup becoming copy/paste instead of architecture

hooks not knowing what project truth to use

portability staying theoretical

repeated confusion about what belongs in core vs local layers

13. Strategic conclusion

The project adapter is the key portability bridge.

Without it, the portable AI operating core is incomplete. With it, Griff can
begin building a true cross-project AI operating system that:

preserves reusable workflow infrastructure

respects local project truth

avoids contaminating other repos with Unit Talk-only assumptions

enables helpers, hooks, and future bootstrap flows to travel cleanly

This template is the contract that makes that possible.

14. Recommended next moves

After this document, the next best artifacts are:

AI_PROJECT_ADAPTER_UNIT_TALK_v1.md

AI_BOOTSTRAP_SEQUENCE_v1.md

That sequence keeps momentum:

define the adapter template

instantiate it for Unit Talk

define how future projects adopt the system

15. Version notes v1

Initial definition of the project adapter template, including:

required adapter sections

template format

minimum viable adapter rules

quality tiers

design rules

recommended next instances
```
