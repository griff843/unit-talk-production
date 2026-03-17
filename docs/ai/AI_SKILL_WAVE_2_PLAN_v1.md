# AI_SKILL_WAVE_2_PLAN_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Define the second wave of AI operating-system skills to be added
after the initial skill foundation  
**Purpose:** Convert the next highest-value unfinished skills into
execution-ready planning artifacts so they can be implemented intentionally,
validated with real workflows, and classified correctly for future cross-project
portability.

---

# 1. Why this document exists

The first AI skill wave established the initial diagnostic and operating surface
for the Unit Talk AI operating system. That first wave proved the pattern and
validated that skills can act as structured, repeatable operator tools instead
of relying on ad hoc prompting.

However, the most valuable remaining skill layer has not yet been defined in
implementation-ready form.

This document exists to define **Skill Wave 2** as the next concrete execution
layer after the AI enhancement remaining work map. Its purpose is to turn the
next three highest-leverage skills into governed build targets:

- `agent-health`
- `discord-diagnose`
- `scoring-audit`

These skills are prioritized because they most directly improve:

- daily operator visibility
- diagnosis of one of the costliest real-world failure classes
- protection of Unit Talk’s core intelligence edge

---

# 2. Relation to the broader AI enhancement roadmap

This document is a direct child of:

- `AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md`

That work map established that the immediate unfinished work includes:

1. Skill Wave 2
2. helper/agent layer definition
3. hook/automation layer definition
4. portability extraction

This document addresses item **#1**.

Skill Wave 2 should be defined and prioritized **before** helper/agent and hook
architecture are finalized because:

- it creates immediate day-to-day operator leverage
- it clarifies what should remain a skill versus become a helper/agent
- it gives the future helper layer better structured inputs to consume
- it pressure-tests the portability framework with real classifications

---

# 3. Objective

The objective of Skill Wave 2 is to add the next tier of high-value skills that
improve the AI operating surface in three critical areas:

## 3.1 Operator control visibility

Provide a fast, reliable view of what parts of the AI/workflow surface are
healthy, stale, blocked, or misaligned.

## 3.2 Expensive incident diagnosis

Reduce time lost diagnosing Discord-related delivery and workflow issues.

## 3.3 Intelligence protection

Create a structured audit surface around the scoring layer so the system’s edge
logic is not allowed to drift silently.

---

# 4. Selection rationale

The three skills in Wave 2 were selected because they have the strongest
combination of:

- immediate operator usefulness
- frequency of likely usage
- leverage over critical workflows
- ability to reduce confusion and manual effort
- value in pressure-testing the skill model
- importance to Unit Talk’s production integrity

---

# 5. Skill Wave 2 overview

## 5.1 Included skills

### 1. `agent-health`

Primary role:

- operator morning-control view
- helper/agent/workflow health visibility
- surface stale or blocked AI operating conditions

### 2. `discord-diagnose`

Primary role:

- investigate Discord workflow failures and ambiguity
- diagnose delivery issues, missing posts, embed problems, route confusion, or
  expected-vs-actual mismatches

### 3. `scoring-audit`

Primary role:

- review the scoring/intelligence layer for drift, contradictions, weak
  contracts, or auditability gaps
- protect the quality of the core pick machine

---

# 6. Portability framing for Wave 2

Each Wave 2 skill must be explicitly classified as:

- **Portable Core**
- **Adapter-Based**
- **Unit Talk-Specific**

The classification below is the current recommended direction and should be
validated during implementation planning.

## 6.1 Initial recommended classifications

| Skill              | Recommended Classification                         | Why                                                                                                                                                    |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agent-health`     | Adapter-Based                                      | The pattern is reusable across projects, but health signals, monitored components, and status exports will vary by project                             |
| `discord-diagnose` | Unit Talk-Specific with possible adapter evolution | The diagnosis pattern may later generalize to “delivery-channel-diagnose,” but the first implementation is tightly tied to Unit Talk Discord workflows |
| `scoring-audit`    | Unit Talk-Specific with reusable review pattern    | The audit workflow pattern may be portable, but the actual logic is tied directly to Unit Talk’s betting intelligence system                           |

---

# 7. Skill specification template

Each Wave 2 skill must be defined with the same internal planning structure.

Required fields:

- purpose
- why it matters
- primary operator
- trigger conditions
- required inputs
- optional inputs
- outputs
- likely follow-on actions
- portability class
- implementation form
- validation scenarios
- non-goals / exclusions

This document uses that structure below.

---

# 8. Skill 1 — `agent-health`

## 8.1 Purpose

`agent-health` provides a structured operator-facing view of the health of the
AI operating layer, including whether major workflows, helpers, or supporting
process surfaces appear healthy, stale, incomplete, or blocked.

This skill is intended to become the operator’s fast “morning control”
diagnostic surface.

## 8.2 Why it matters

As the AI operating system grows more layered, the operator needs a quick way to
answer questions like:

- what parts of the AI operating layer are functioning normally?
- what parts look stale or unmaintained?
- what pieces are incomplete or missing?
- what should be the first review target before starting work?
- is the operating layer aligned with the current roadmap and docs?

Without this, the operator is forced to reconstruct state manually from multiple
docs, repo areas, and recent chat context.

## 8.3 Primary operator value

- immediate status awareness
- reduced startup friction
- faster sprint selection
- easier recognition of stale or incomplete workflow layers
- stronger daily confidence in the operating surface

## 8.4 Trigger conditions

Use `agent-health` when:

- beginning a work session
- preparing to choose the next sprint
- after a sequence of enhancement changes
- after documentation changes that may affect AI workflow behavior
- when the operator suspects the operating surface is drifting
- when a helper/skill/hook layer has been partially defined but not reconciled

## 8.5 Required inputs

Potential required inputs include:

- latest AI enhancement work map
- current status docs
- current roadmap docs
- current AI docs under `docs/ai/`
- current context bundle summary
- known skill list
- known helper/agent list
- known hook list
- most recent sprint closeout summary

## 8.6 Optional inputs

- current repo inventory snapshot
- list of recent AI-related commits
- outstanding findings or backlog items
- current portability classification table
- active sprint plan if one exists

## 8.7 Outputs

The skill should output a structured health summary that includes:

### A. Overall state

- healthy
- partially healthy
- degraded
- incomplete
- drifting

### B. Section-by-section status

Example areas:

- doctrine
- routing
- preflight
- handoff templates
- context bundle workflow
- skill layer
- helper/agent layer
- hook/automation layer
- portability extraction
- documentation alignment

### C. Gaps / stale areas

- missing components
- outdated docs
- partially defined work
- misaligned sections
- likely next fixes

### D. Recommended next actions

- review
- define
- implement
- reconcile
- retire
- pressure test

## 8.8 Likely follow-on actions

`agent-health` should often lead to:

- sprint planning
- status reconciliation
- missing doc definition
- helper architecture work
- hook definition work
- targeted diagnosis
- portability classification review

## 8.9 Portability class

**Recommended:** Adapter-Based

Reason: The concept is highly reusable across projects, but each project will
define health using different:

- components
- docs
- status sources
- invariants
- exports
- workflow architecture

## 8.10 Implementation form

Recommended first form:

- skill spec + governed operating pattern

Possible later form:

- structured helper
- dashboard-like health synthesizer
- automated status summarizer using project adapters

## 8.11 Validation scenarios

`agent-health` is considered initially validated when it can correctly support
scenarios such as:

1. **Start-of-day operator check**
   - identify what is healthy
   - identify what is missing
   - recommend the next best planning target

2. **Post-sprint reconciliation**
   - recognize what changed
   - surface any unreconciled docs or workflow gaps

3. **Operating surface audit**
   - detect that a work map exists but helper/hook architecture is still
     undefined

## 8.12 Non-goals

This skill should not:

- replace full architecture audits
- decide implementation details for all missing areas
- act as a repo-wide code health audit
- claim runtime health of systems it cannot verify directly

---

# 9. Skill 2 — `discord-diagnose`

## 9.1 Purpose

`discord-diagnose` is a structured skill for diagnosing Discord-related workflow
failures, inconsistencies, and ambiguities inside Unit Talk.

It should help answer:

- why a Discord outcome did not happen as expected
- whether the issue is configuration, routing, permissions, content generation,
  workflow logic, environment mismatch, or expectation mismatch
- what the most likely next diagnostic or corrective step is

## 9.2 Why it matters

Discord is one of the most visible and operationally expensive surfaces in Unit
Talk.

When Discord workflows fail, uncertainty is often high because the failure may
involve:

- missing triggers
- wrong channel routes
- role/permission issues
- embed generation issues
- message formatting issues
- wrong expectations about source-of-truth behavior
- stale configuration
- app/runtime mismatch
- upstream workflow failures presenting as Discord failures

A consistent diagnosis skill reduces time wasted in ambiguity.

## 9.3 Primary operator value

- faster diagnosis of Discord failures
- reduced guesswork
- more repeatable incident handling
- more precise routing to the right next tool/person/workflow
- less confusion between Discord symptom and upstream root cause

## 9.4 Trigger conditions

Use `discord-diagnose` when:

- a Discord post did not appear
- a message posted to the wrong place
- an embed looks wrong or incomplete
- a command flow behaves unexpectedly
- a role-gated experience does not match expectations
- onboarding DMs do not behave correctly
- alerts or recaps fail to deliver as expected
- the symptom appears Discord-related but the actual root cause is uncertain

## 9.5 Required inputs

Potential required inputs include:

- expected behavior statement
- actual observed behavior
- relevant channel / route / role / command / workflow context
- related sprint or feature context
- recent status or incident context
- known source system involved (bot/app/agent/workflow)
- any relevant logs, outputs, or artifact summaries if available

## 9.6 Optional inputs

- Discord channel IDs
- message type or command name
- embed expectations
- screenshots or examples
- related workflow registry reference
- known permissions or role assumptions
- recent deployment/change context

## 9.7 Outputs

The skill should produce:

### A. Diagnosis summary

- likely issue class
- confidence level
- suspected failure layer

### B. Failure class categorization

Examples:

- routing/config issue
- permission/role issue
- upstream workflow issue
- content generation issue
- environment mismatch
- stale deployment/state issue
- expectation mismatch
- incomplete feature wiring

### C. Priority next checks

Ordered by likely value.

### D. Likely owner or next path

Examples:

- architecture review
- implementation follow-up
- runtime verification
- Discord configuration review
- route/permission audit
- upstream workflow inspection

## 9.8 Likely follow-on actions

`discord-diagnose` should often lead to:

- implementation prompt creation
- runtime inspection
- route/permission audit
- status doc update
- Discord workflow hardening
- upstream agent/workflow diagnosis

## 9.9 Portability class

**Recommended:** Unit Talk-Specific for v1

Reason: The current diagnosis surface is tightly tied to:

- Unit Talk’s Discord workflows
- specific channel structures
- role-gated delivery patterns
- bot/app integrations
- Unit Talk notification and embed expectations

Possible future evolution: This may later become a broader adapter-based skill
such as:

- `delivery-diagnose`
- `channel-diagnose`
- `notification-diagnose`

But v1 should remain Unit Talk-specific.

## 9.10 Implementation form

Recommended first form:

- Unit Talk-specific skill spec with structured diagnosis flow

Possible later form:

- adapter-based delivery diagnosis helper
- issue classification workflow wrapper
- incident triage agent input surface

## 9.11 Validation scenarios

`discord-diagnose` is initially validated when it can help diagnose scenarios
like:

1. **Message missing**
   - expected alert/recap/post did not appear

2. **Wrong destination**
   - content posted to the wrong channel/thread/group

3. **Role mismatch**
   - onboarding or gated flow did not respect the expected role path

4. **Bad embed/content symptom**
   - message is present, but missing fields, formatting, metadata, or expected
     structure

5. **Discord symptom caused by upstream issue**
   - the actual cause is not Discord configuration, but workflow failure
     elsewhere

## 9.12 Non-goals

This skill should not:

- directly mutate Discord state
- pretend it has runtime visibility it does not actually have
- replace end-to-end implementation verification
- substitute for actual evidence when logs/artifacts are required

---

# 10. Skill 3 — `scoring-audit`

## 10.1 Purpose

`scoring-audit` provides a structured review surface for Unit Talk’s scoring and
edge-evaluation layer. Its goal is to identify drift, inconsistency, unprotected
assumptions, weak auditability, or logic contradictions that could degrade the
quality of the core pick machine.

## 10.2 Why it matters

The scoring layer is one of the highest-value parts of Unit Talk.

If scoring logic drifts, becomes inconsistent, or loses clear auditability, the
platform risks:

- edge erosion
- false confidence
- poor downstream selection quality
- hidden logic contradictions
- weakened trust in the pick machine
- reduced ability to evolve intelligence cleanly

This skill is meant to protect the integrity of the intelligence core before
problems become deeply embedded.

## 10.3 Primary operator value

- structured review of the intelligence layer
- better detection of logic drift
- clearer scoring/governance confidence
- faster identification of weak assumptions
- support for future intelligence reviews and upgrades

## 10.4 Trigger conditions

Use `scoring-audit` when:

- scoring logic changes are proposed
- a scoring sprint completes
- confidence or edge logic feels unclear
- downstream pick quality appears inconsistent
- an intelligence review is needed
- new factors are added or removed
- risk/scoring/edge relationships may be misaligned
- documentation and implementation appear out of sync

## 10.5 Required inputs

Potential required inputs include:

- current scoring docs/specs
- current feature/factor definitions
- current intelligence-related status docs
- relevant audits or proof bundles
- scoring change summaries
- any canonical invariants affecting scoring
- representative examples of current scoring behavior if available

## 10.6 Optional inputs

- calibration artifacts
- CLV-related artifacts
- factor weighting rationale
- risk model summaries
- recent scoring disputes/questions
- historical review notes
- comparison artifacts across scoring versions

## 10.7 Outputs

The skill should output:

### A. Audit summary

- overall confidence in the scoring layer
- key concerns
- key strengths
- most urgent review targets

### B. Finding categories

Examples:

- unclear factor contract
- weighting inconsistency
- documentation drift
- weak auditability
- hidden coupling
- logic contradiction
- missing invariants
- unverifiable assumptions
- unclear downstream interpretation

### C. Recommendations

Examples:

- document
- refactor
- verify
- harden
- reconcile
- simulate
- test
- isolate

### D. Suggested next action type

Examples:

- scoring sprint
- architecture audit
- intelligence review
- contract hardening
- simulation or backtest review
- doc reconciliation

## 10.8 Likely follow-on actions

`scoring-audit` should often lead to:

- intelligence review work
- scoring-layer hardening
- documentation reconciliation
- factor contract clarification
- simulation or backtesting follow-up
- risk/scoring alignment review

## 10.9 Portability class

**Recommended:** Unit Talk-Specific with reusable review pattern

Reason: The review method is reusable, but the actual subject matter is tied to:

- Unit Talk scoring factors
- Unit Talk edge logic
- betting-specific intelligence assumptions
- Unit Talk risk/scoring architecture
- Unit Talk invariants and proof expectations

## 10.10 Implementation form

Recommended first form:

- Unit Talk-specific skill spec with structured review checklist

Possible later form:

- intelligence review helper input
- audit composer for scoring/risk systems
- project-adapted scoring/review framework for other domains

## 10.11 Validation scenarios

`scoring-audit` is initially validated when it can support scenarios like:

1. **Post-change audit**
   - evaluate a scoring-related change for drift risk or auditability weakness

2. **Spec vs implementation concern**
   - identify when scoring docs and current implementation intent appear
     misaligned

3. **Confidence in intelligence layer**
   - provide a structured review of whether the scoring system remains
     explainable and governed

4. **Expansion pressure**
   - review whether added complexity is strengthening the system or creating
     untracked fragility

## 10.12 Non-goals

This skill should not:

- replace a full quantitative validation pipeline
- claim statistical truth without supporting evidence
- become a catch-all review for the entire Unit Talk architecture
- mutate scoring logic directly

---

# 11. Recommended implementation order

Wave 2 should be implemented in the following order:

## 11.1 First — `agent-health`

Reason:

- highest general operator leverage
- broadest daily usefulness
- helps orient the rest of the operating surface
- useful before helper/hook design expands

## 11.2 Second — `discord-diagnose`

Reason:

- attacks a real-world expensive issue class
- likely to be used often
- improves operational confidence on a visible system surface

## 11.3 Third — `scoring-audit`

Reason:

- highest importance to the intelligence edge
- benefits from a slightly more mature operating/documentation surface
- likely best after `agent-health` clarifies current AI/system state

---

# 12. Recommended build sequence

## Phase A — Define

For each skill:

- finalize purpose
- finalize inputs/outputs
- finalize trigger conditions
- finalize portability class
- define validation scenarios

## Phase B — Implement initial form

Possible forms:

- documented skill spec
- prompt wrapper
- governed operating flow
- scripted helper
- hybrid pattern

The first implementation does not need to be fully automated if the structure is
clear and repeatable.

## Phase C — Validate with real work

Run each skill against at least one realistic scenario.

## Phase D — Reconcile

Update:

- status docs
- skill inventory
- portability classification
- next-wave planning

---

# 13. Acceptance criteria

Skill Wave 2 is considered complete when:

## 13.1 Definition criteria

Each skill has:

- clear purpose
- trigger conditions
- required inputs
- outputs
- follow-on actions
- portability classification
- implementation form decision
- non-goals

## 13.2 Validation criteria

Each skill has been used or pressure-tested in at least one realistic scenario.

## 13.3 Governance criteria

Wave 2 is reflected in:

- relevant AI docs
- current skill inventory
- status reconciliation artifacts
- future planning docs where needed

## 13.4 Portability criteria

Each skill has been explicitly classified as:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

and the classification rationale is documented.

---

# 14. Risks if Wave 2 is not completed

If Skill Wave 2 is not completed, the likely consequences are:

- operator startup remains more manual than necessary
- Discord diagnosis remains ambiguous and expensive
- scoring review stays too informal
- future helper/agent design lacks structured inputs
- the AI operating system remains useful but incomplete
- portability extraction gets delayed because the next true skill tier was never
  locked

---

# 15. Strategic conclusion

Skill Wave 2 is the correct next execution step after the remaining work map.

It is the bridge between:

- foundational operating doctrine
- first proof of skill-driven workflows
- the future helper/agent layer
- the future hook/automation layer
- the long-term portable AI operating system

These three skills were chosen because together they strengthen:

- operator control
- production diagnosis
- intelligence protection

That makes Wave 2 the highest-leverage next addition to the AI operating stack.

---

# 16. Recommended next document chain

After Skill Wave 2 is locked, the preferred next documents are:

1. `AI_HELPER_AGENT_ARCHITECTURE_v1.md`
2. `AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md`
3. `AI_PORTABILITY_MODEL_v1.md`

That sequence should preserve the right progression:

- skills first
- helper architecture second
- automation glue third
- portability extraction fourth

---

# 17. Version notes

## v1

Initial formal definition of AI Skill Wave 2, covering:

- rationale
- included skills
- structured specifications
- sequencing
- acceptance criteria
- portability framing
