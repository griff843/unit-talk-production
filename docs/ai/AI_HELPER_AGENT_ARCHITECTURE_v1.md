# AI_HELPER_AGENT_ARCHITECTURE_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Define the helper/agent layer that sits above doctrine, MCP truth
surfaces, and skills  
**Purpose:** Formalize the next operating layer of the AI system so sprint
shaping, diagnosis, audits, documentation sync, and prompt composition become
repeatable, governed, and eventually portable across Griff’s broader project
portfolio.

---

# 1. Why this document exists

The AI operating system now has a meaningful foundation:

- doctrine
- routing
- preflight
- handoff structure
- MCP truth layer
- first skill wave
- Skill Wave 2 planning

However, the system still relies too heavily on manual orchestration between
these components.

The missing layer is a formal **helper/agent architecture**.

This layer is intended to sit above the base workflow surfaces and provide
structured operating roles such as:

- deciding the next sprint
- triaging incidents
- auditing architecture
- reviewing intelligence
- bootstrapping new projects
- reconciling documentation
- composing implementation-ready Claude prompts

Without this layer, the AI operating system remains useful but still requires
too much operator reconstruction.

---

# 2. Objective

The objective of the helper/agent layer is to create a governed set of reusable
operating roles that:

- reduce manual workflow overhead
- make architecture and diagnosis work more repeatable
- create cleaner bridges from analysis to implementation
- provide better consistency in sprint selection and issue routing
- improve documentation synchronization after work completes
- establish a portable agent architecture that can later be adapted to other
  projects

---

# 3. Position in the stack

The helper/agent layer sits above the current foundation.

## 3.1 Current stack

### Base workflow foundation

- doctrine
- routing matrix
- preflight
- handoff templates
- context bundle process

### Truth / diagnosis layer

- MCP surfaces
- skills

### Missing orchestration layer

- helpers/agents

## 3.2 Intended role of helpers/agents

Helpers/agents should not replace:

- canonical docs
- implementation work
- runtime verification
- Claude OS closeout discipline

Instead, they should orchestrate and structure the path between those things.

---

# 4. Governing principles

## 4.1 Helpers are operating roles first

These may begin as:

- prompt wrappers
- repeatable procedures
- scripts
- structured flows
- semi-automated logic

They do not need to begin as fully autonomous software agents.

## 4.2 No false autonomy

A helper must not pretend to have:

- runtime truth it does not have
- repo truth it has not checked
- governance authority it does not own

## 4.3 Canonical docs remain the source of truth

Helpers consume and synthesize. They do not replace governed documentation.

## 4.4 Skills remain focused tools

Helpers may call for skill usage, consume skill outputs, or recommend
skill-first paths, but should not collapse all structured skill logic into vague
general behavior.

## 4.5 Portability must be designed in from the start

Each helper must be classified as:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

## 4.6 Start simple, then harden

The first implementation form can be lightweight if:

- the role is clear
- the inputs are explicit
- the outputs are structured
- the follow-on path is governed

---

# 5. Helper/agent model

Each helper/agent should be defined with the following contract.

## 5.1 Required definition fields

- name
- purpose
- primary operator value
- trigger conditions
- required inputs
- optional inputs
- outputs
- likely follow-on actions
- portability classification
- initial implementation form
- future evolution path
- validation scenarios
- non-goals

---

# 6. Proposed helper/agent set

This is the first recommended helper layer.

## 6.1 Sprint Planning Agent

### Purpose

Review roadmap state, status docs, context bundle, recent work, and current gaps
to recommend the next best sprint.

### Why it matters

Sprint selection is one of the highest-leverage recurring decisions. Without a
structured planning layer, next-step selection becomes inconsistent and overly
chat-dependent.

### Primary operator value

- better next-sprint selection
- cleaner sequencing
- more consistent roadmap alignment
- improved handoff readiness

### Trigger conditions

Use when:

- deciding what to do next
- finishing a sprint
- reconciling roadmap vs current state
- choosing among multiple candidate initiatives
- preparing a Claude handoff

### Required inputs

- current roadmap docs
- current status docs
- current context bundle
- recent sprint closeout summary
- known blockers / active gaps
- current work map docs

### Optional inputs

- recent findings
- pressure-test results
- operator priority constraints
- delivery urgency notes

### Outputs

- recommended next sprint
- rationale
- why now vs later
- dependencies
- acceptance focus
- handoff prompt outline or generation-ready structure

### Likely follow-on actions

- Claude handoff generation
- architecture review
- status reconciliation
- backlog update

### Portability classification

**Adapter-Based**

Reason: The planning pattern is reusable, but roadmap sources, phase systems,
status docs, and invariants vary per project.

### Initial implementation form

- governed workflow pattern
- structured planning template
- prompt wrapper

### Future evolution path

- project-aware planning helper
- backlog-aware next-sprint recommender
- integration into broader AI operating dashboard

### Validation scenarios

- choose next sprint after closeout
- choose next sprint when multiple gaps compete
- reject a flashy sprint in favor of the true blocker

### Non-goals

- final implementation authority
- replacing canonical roadmap docs
- making runtime claims it cannot support

---

## 6.2 Incident Triage Agent

### Purpose

Consume issue statements, skill outputs, context, and known artifacts to
classify incidents and recommend the next diagnostic or corrective path.

### Why it matters

Incidents are expensive when they stay ambiguous. A triage layer reduces wasted
effort by classifying the issue class early.

### Primary operator value

- faster issue classification
- better next action selection
- reduced ambiguity
- better routing to the right diagnostic surface

### Trigger conditions

Use when:

- something did not behave as expected
- root cause is unclear
- multiple plausible failure layers exist
- a symptom may be downstream of another issue
- diagnosis work needs structure

### Required inputs

- issue statement
- expected behavior
- actual behavior
- relevant context bundle inputs
- relevant skill outputs where available
- recent change context

### Optional inputs

- logs
- screenshots
- deployment context
- workflow identifiers
- route/channel metadata

### Outputs

- issue classification
- likely failure layer
- confidence
- recommended next checks
- recommended owner/path

### Likely follow-on actions

- skill-first diagnosis
- implementation fix prompt
- architecture audit
- verification sprint
- doc update

### Portability classification

**Portable Core**, with adapter-aware inputs

Reason: The triage pattern is broadly portable, though the actual evidence
sources will differ per project.

### Initial implementation form

- structured triage template
- prompt wrapper
- skill-consuming incident workflow

### Future evolution path

- central incident intake layer
- helper that chains correct skills automatically
- adapter-based issue classifier

### Validation scenarios

- Discord symptom with upstream cause
- feature appears broken but docs are stale
- runtime symptom caused by mis-sequenced implementation

### Non-goals

- replacing hard evidence
- direct runtime remediation
- pretending all incidents are equally diagnosable from chat alone

---

## 6.3 Architecture Audit Agent

### Purpose

Review docs, boundaries, patterns, and project structure to detect architectural
drift, duplication, layering violations, or contract confusion.

### Why it matters

As systems scale, architecture erosion happens gradually. A defined audit role
helps catch misalignment before it becomes embedded.

### Primary operator value

- identify drift
- flag boundary violations
- reveal duplication or confusion
- shape corrective sprints

### Trigger conditions

Use when:

- planning major work
- after significant architecture changes
- the repo feels misaligned with docs
- boundaries seem blurred
- repeated confusion appears around system ownership

### Required inputs

- current architecture docs
- current roadmap/phase model
- relevant status docs
- repo map / current state docs
- recent change summaries

### Optional inputs

- implementation prompts
- proof bundles
- findings
- repo audit artifacts

### Outputs

- audit summary
- findings by severity
- drift areas
- duplication or overlap areas
- recommended remediation paths

### Likely follow-on actions

- remediation sprint shaping
- doc reconciliation
- contract hardening
- portability reclassification

### Portability classification

**Portable Core**

Reason: The audit pattern is broadly reusable even though the project-specific
boundaries and invariants will be adapter-fed.

### Initial implementation form

- structured architecture review procedure
- prompt wrapper
- checklist-driven audit mode

### Future evolution path

- adapter-based architecture boundary reviewer
- repo-structure-aware auditing assistant

### Validation scenarios

- docs say one thing, repo implies another
- same responsibility appears in multiple places
- project layering is drifting from the roadmap

### Non-goals

- low-level code review replacement
- runtime performance audit
- infrastructure health replacement

---

## 6.4 Intelligence Review Agent

### Purpose

Review intelligence-related artifacts to assess edge quality, scoring coherence,
calibration posture, risk alignment, and strategic decision quality.

### Why it matters

This protects the “brain” of systems like Unit Talk, where the real value is not
just shipping software but preserving decision quality and edge integrity.

### Primary operator value

- clearer intelligence quality review
- better detection of edge erosion
- stronger review discipline around risk/scoring logic

### Trigger conditions

Use when:

- reviewing scoring changes
- reviewing intelligence-related docs or artifacts
- assessing whether model/risk/edge logic is aligned
- deciding whether intelligence systems are becoming stronger or noisier

### Required inputs

- intelligence-related docs
- scoring/risk/calibration artifacts
- relevant audits
- representative result summaries

### Optional inputs

- simulations
- backtests
- performance summaries
- qualitative concerns

### Outputs

- intelligence review summary
- risks / strengths
- likely weak assumptions
- recommended next review or hardening path

### Likely follow-on actions

- scoring-audit
- simulation/backtest follow-up
- factor-contract hardening
- architecture clarification

### Portability classification

**Adapter-Based**

Reason: The review pattern is reusable, but the intelligence subject matter
varies widely by project.

### Initial implementation form

- review framework
- prompt wrapper
- artifact-driven analysis flow

### Future evolution path

- project-specific intelligence reviewer
- quality gate for decision systems

### Validation scenarios

- Unit Talk scoring layer review
- future poker or coaching intelligence review
- detecting when complexity outpaces governance

### Non-goals

- direct model training or model execution
- claiming statistical proof without evidence
- replacing specialized quantitative validation

---

## 6.5 Project Bootstrap Agent

### Purpose

Initialize the AI operating layer for a new repo or app using the portable core
plus a project adapter definition.

### Why it matters

This is the key bridge from Unit Talk-specific success to cross-project
leverage.

### Primary operator value

- faster setup for new projects
- less reinvention
- cleaner portability
- consistent operating foundations

### Trigger conditions

Use when:

- starting a new repo
- formalizing AI workflow in an existing repo
- porting the AI operating system to another app

### Required inputs

- project name
- project purpose
- repo structure
- desired operating scope
- known constraints
- target phase/roadmap model if available

### Optional inputs

- preferred docs structure
- preferred artifact conventions
- known domain invariants
- known model/tooling stack

### Outputs

- baseline AI docs to create
- adapter requirements
- recommended initial skills/helpers/hooks
- setup sequence
- first sprint suggestion

### Likely follow-on actions

- doctrine creation
- routing creation
- preflight setup
- context workflow setup
- portability model instantiation

### Portability classification

**Portable Core**

Reason: This helper is explicitly intended for cross-project reuse.

### Initial implementation form

- setup checklist
- project bootstrap template
- guided prompt flow

### Future evolution path

- scaffold generator
- repo-aware bootstrap workflow
- portable installer path for future apps

### Validation scenarios

- bootstrap a poker project
- bootstrap a Madden tool
- bootstrap an operations repo with a different domain model

### Non-goals

- fully automated repo authoring without operator review
- replacing architecture decisions for the project itself

---

## 6.6 Status Sync / Documentation Agent

### Purpose

Help reconcile post-sprint state so status docs, work maps, and progress
artifacts stay aligned with what was actually completed.

### Why it matters

Documentation drift is one of the most common ways AI operating systems degrade
over time.

### Primary operator value

- cleaner post-sprint reconciliation
- less status drift
- stronger continuity across chats
- more accurate handoffs

### Trigger conditions

Use when:

- a sprint closes
- new AI docs are added
- status docs may be stale
- roadmap alignment needs refresh
- handoff continuity matters

### Required inputs

- sprint closeout summary
- changed docs
- changed status artifacts
- current roadmap / current state docs

### Optional inputs

- git diff summary
- proof bundle summary
- findings / issues created
- next sprint recommendation

### Outputs

- what needs update
- what is already aligned
- recommended edits or follow-up docs
- reconciliation summary

### Likely follow-on actions

- status doc edits
- memory/handoff updates
- next sprint planning
- drift report updates

### Portability classification

**Portable Core**

Reason: The reconciliation pattern is universally useful across projects.

### Initial implementation form

- reconciliation checklist
- structured closeout procedure
- prompt wrapper

### Future evolution path

- post-sprint sync helper
- artifact-aware reconciliation assistant

### Validation scenarios

- sprint changed docs but no status updates
- work map advanced but current state doc lags
- multiple new docs need alignment

### Non-goals

- making undocumented work appear complete
- replacing governed proof requirements
- auto-claiming closure without evidence

---

## 6.7 Prompt Composer Agent

### Purpose

Turn approved architecture or reviewed decisions into Claude-ready execution
prompts that reflect the latest truth sources, constraints, acceptance criteria,
and sequencing.

### Why it matters

Prompt quality is a major multiplier. Bad prompts create drift, rework, and
low-proof implementation.

### Primary operator value

- higher quality Claude handoffs
- more consistent implementation instructions
- fewer missing constraints
- stronger proof-driven execution

### Trigger conditions

Use when:

- architecture has been reviewed and approved
- a sprint needs to be handed to Claude
- a remediation sprint needs exact guardrails
- an audit produced an implementation path

### Required inputs

- approved architecture or decision
- current canonical docs
- current roadmap/phase model
- acceptance criteria
- proof expectations
- repo path / target scope

### Optional inputs

- prior failed attempt summary
- known risk areas
- test commands
- artifact output paths

### Outputs

- implementation-ready prompt
- scope boundaries
- verification expectations
- proof bundle requirements
- closeout constraints

### Likely follow-on actions

- Claude Code execution
- Claude OS verification
- sprint tracking
- status updates after completion

### Portability classification

**Portable Core**

Reason: This is one of the most portable operating roles in the whole stack.

### Initial implementation form

- governed handoff pattern
- prompt template
- structured generator workflow

### Future evolution path

- project-adapter-aware prompt composer
- sprint-type-specific handoff composer

### Validation scenarios

- generate a frontend sprint prompt
- generate a remediation sprint prompt
- generate a governance hardening prompt

### Non-goals

- deciding whether architecture is correct
- replacing verification
- papering over missing requirements

---

# 7. Recommended implementation order

## 7.1 First

**Prompt Composer Agent**

Reason:

- immediate leverage
- directly improves Claude execution quality
- easiest to use quickly

## 7.2 Second

**Sprint Planning Agent**

Reason:

- strong planning leverage
- improves sequencing and next-step choice

## 7.3 Third

**Status Sync / Documentation Agent**

Reason:

- keeps the operating system from drifting as the helper layer expands

## 7.4 Fourth

**Incident Triage Agent**

Reason:

- becomes stronger after some skill surfaces are defined

## 7.5 Fifth

**Architecture Audit Agent**

Reason:

- high value, but benefits from slightly more mature helper workflow conventions

## 7.6 Sixth

**Project Bootstrap Agent**

Reason:

- critical for portability, but best after the first helper patterns are proven

## 7.7 Seventh

**Intelligence Review Agent**

Reason:

- high-value and important, but more adapter-dependent than the earlier helpers

---

# 8. Helper-to-skill relationship model

Helpers and skills must remain distinct.

## 8.1 Skills

Skills are focused, bounded operating tools.

Examples:

- `agent-health`
- `discord-diagnose`
- `scoring-audit`

## 8.2 Helpers/agents

Helpers orchestrate when and how to use skills, docs, or workflow stages.

Examples:

- Incident Triage Agent recommends `discord-diagnose`
- Sprint Planning Agent recommends the next sprint and a handoff
- Prompt Composer Agent converts the decision into implementation instructions

## 8.3 Rule

Helpers should coordinate. Skills should diagnose or analyze within a narrower
scope.

---

# 9. Portability matrix

| Helper / Agent                    | Classification | Notes                                                    |
| --------------------------------- | -------------- | -------------------------------------------------------- |
| Sprint Planning Agent             | Adapter-Based  | Pattern is reusable; inputs vary by roadmap/status model |
| Incident Triage Agent             | Portable Core  | Broadly reusable, with project-specific evidence inputs  |
| Architecture Audit Agent          | Portable Core  | Strongly portable audit pattern                          |
| Intelligence Review Agent         | Adapter-Based  | Review pattern portable, subject matter varies           |
| Project Bootstrap Agent           | Portable Core  | Explicit cross-project use case                          |
| Status Sync / Documentation Agent | Portable Core  | Universally useful                                       |
| Prompt Composer Agent             | Portable Core  | One of the most reusable helpers                         |

---

# 10. Acceptance criteria

The helper/agent architecture is considered defined when:

## 10.1 Definition complete

Each proposed helper has:

- purpose
- triggers
- inputs
- outputs
- portability classification
- implementation form
- non-goals

## 10.2 Boundary clarity

The distinction between:

- docs
- skills
- helpers
- implementation
- verification

is explicit and stable.

## 10.3 Sequencing clarity

There is a clear recommended order for first implementation.

## 10.4 Portability clarity

Each helper is classified correctly as:

- Portable Core
- Adapter-Based
- Unit Talk-Specific

## 10.5 Follow-on readiness

This doc can directly support:

- helper implementation planning
- hook architecture planning
- portable AI kit extraction later

---

# 11. Risks if this layer is not built

If the helper/agent layer is not built, likely failure modes include:

- too much manual orchestration
- inconsistent next-sprint planning
- weak issue triage discipline
- lower-quality handoff prompts
- documentation drift after sprint closeout
- portability goals staying theoretical
- skills existing without a strong coordinating layer

---

# 12. Strategic conclusion

The helper/agent layer is the next maturity layer of the AI operating system.

The doctrine, skills, MCP surfaces, and handoff patterns established the
foundation. This layer makes that foundation easier to operate consistently.

The correct mental model is:

- docs define truth
- skills provide focused analysis
- helpers coordinate workflow
- Claude Code implements
- Claude OS verifies and closes

This architecture is what turns a good operating pattern into a scalable
operating system.

---

# 13. Recommended next document chain

After this document, the next artifact should be:

1. `AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md`
2. `AI_PORTABILITY_MODEL_v1.md`

That keeps the sequence clean:

- work map
- skill plan
- helper architecture
- hook architecture
- portability extraction

---

# 14. Version notes

## v1

Initial definition of the helper/agent layer, including:

- helper model
- first recommended helper set
- roles and boundaries
- implementation order
- portability classifications
