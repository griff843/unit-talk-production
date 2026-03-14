# Claude OS Ceiling Blueprint

**Version**: 1.0 **Status**: CANONICAL — Active Authority **Sprint**:
SPRINT-CLAUDE-OS-CEILING-BLUEPRINT-CANONICALIZATION **Effective**: 2026-03-14
**Authority Layer**: Architecture

> This document defines what Claude OS is, what it is becoming, where it stops,
> and how it should evolve. It is the authoritative reference for all future
> Claude OS upgrade sprints. Upgrade sprints that contradict this blueprint must
> formally supersede it before proceeding.

---

## 1. Mission

### What Claude OS Is

Claude OS is a **governed execution system** for the Unit Talk platform.

It is not an autonomous AI agent. It is not an unrestricted code-generation
pipeline. It is a structured, rule-enforced, proof-requiring workflow
orchestrator that happens to run on top of an LLM.

Specifically, Claude OS is:

- **Sprint orchestrator** — defines, sequences, and closes sprints with proof
  artifacts
- **Proof-enforcing release workflow** — no completion claim without captured
  evidence
- **Roadmap execution authority consumer** — uses the layer/phase model as its
  execution sequencing source of truth
- **Model router** — selects the right LLM (Sonnet, Opus, or future models) for
  each sprint/task type
- **Status and truth authority assistant** — reads runtime state, CI outputs,
  and database-derived truth rather than making claims from memory
- **Fail-closed enforcement layer** — any violation of governance rules stops
  execution and escalates to a human

### What Claude OS Is Not

- **Not an autonomous agent** — Claude OS does not take unsanctioned action. It
  operates within defined autonomy boundaries (see §8).
- **Not a feature builder** — Claude OS does not add product features
  opportunistically.
- **Not a production operator** — Claude OS does not directly write to
  production databases or deploy services.
- **Not a general-purpose AI platform** — Claude OS is specifically designed for
  the governed, proof-based, roadmap-sequenced development workflow.
  Generalization to other apps is a future concern, not a current one.

---

## 2. Ceiling Vision

### Future-State Capabilities

The intended ceiling for Claude OS — achievable through staged upgrades —
includes the following capabilities.

#### 2.1 Hands-Off Sprint Execution Support

Claude OS should be able to accept a sprint directive, classify it, select the
appropriate model, execute all phases (Plan → Verify → Proof → Closeout), and
produce a complete artifact bundle without human intervention at each phase
boundary, **except at designated human-approval gates** (see §8).

The operator's job shifts from steering each phase to approving gate
transitions.

#### 2.2 Multi-LLM Model Routing

Claude OS should automatically select and invoke the right model for each task
unit. The routing table (see §6) defines the decision logic. The model routing
decision should be:

- recorded in the sprint plan
- auditable in proof artifacts
- overridable by operator directive

#### 2.3 Parallel Workstream Orchestration

Claude OS should support parallel execution across independent lanes (see §5).
Lane outputs are isolated, dependency-gated, and merged only when readiness
gates pass. Parallelism is never allowed to weaken proof requirements.

#### 2.4 Artifact and Proof Bundle Automation

Proof capture should be automatic, not manual. At each phase gate, Claude OS
should:

- capture the required command outputs
- write them to the canonical proof bundle location
- generate the proof inventory file
- fail closed if any required artifact is missing

Manual proof capture (current state) is an intermediate step. The ceiling is
fully automated capture with operator review only.

#### 2.5 Dependency-Aware Lane Management

Claude OS should track which lanes are blocked by which and enforce execution
order. A lane that depends on another lane's output cannot begin until the
dependency lane has passed its readiness gate.

#### 2.6 Merge and Readiness Gate Automation

Claude OS should run the merge readiness checklist (`npm run verify:merge`)
automatically and report a structured gate status. It should never recommend a
merge if any gate is red.

#### 2.7 Status and Roadmap Synchronization

After every sprint closeout, Claude OS should automatically:

- update `docs/06_status/current_phase.md`
- post a Linear sync comment on the relevant issue
- verify that the sprint tag exists on the remote
- mark the Linear issue Done

This removes the post-sprint manual sync step.

#### 2.8 Project Onboarding Pattern

Claude OS should define a standard onboarding contract for new apps. This
contract specifies what the new app must provide (roadmap docs, canonical table
list, CI gates, lifecycle contracts) and what Claude OS core provides in return
(sprint protocol, proof architecture, model routing, gate automation).

This pattern is defined in the architecture but not implemented until Unit Talk
proves the right abstractions.

---

## 3. Unit Talk First Strategy

### Why Unit Talk Is the Proving Ground

Unit Talk is a production system with real data integrity requirements, a
defined delivery pipeline, financial settlement semantics, and an operational
Discord channel with live users. It is not a toy.

Building and hardening Claude OS inside Unit Talk means:

- Every governance rule is tested against real engineering consequences.
- Proof artifacts are generated for real production work.
- Fail-closed behavior is exercised on actual gate failures.
- Model routing is calibrated against real sprint types (not hypothetical ones).
- Lane parallelism is validated against real dependency chains.

A governance system that works in Unit Talk works in the hardest case. If Claude
OS can enforce single-writer discipline, proof requirements, and layer
sequencing in a production system with live data, it can enforce them anywhere.

### Why Generalization Should Come Later

Premature extraction creates the wrong abstractions. The current Unit Talk
implementation still has domain-specific concerns embedded throughout Claude OS:

- The layer/phase execution model is Unit Talk's roadmap, not a generic roadmap
  model.
- The lifecycle adapter rules are specific to `unified_picks` semantics.
- The Linear issue format matches the Unit Talk workspace.
- The CI gates are Unit Talk-specific commands.

Extracting a "reusable core" before these concerns are fully understood would
produce a core that is either over-fitted to Unit Talk or so generic it provides
no real value.

### The Correct Approach

1. Build the full ceiling capability inside Unit Talk.
2. Identify which parts of Claude OS are purely Unit Talk-specific vs. which
   parts would be identical in any governed engineering project.
3. Draw the Core/Adapter line (see §4) only after that boundary is empirically
   clear.
4. Extract core only when a second real project needs it.

**This principle must be re-affirmed at every Claude OS upgrade sprint.** Any
sprint that proposes premature extraction must be reviewed against this strategy
and rejected if the Unit Talk implementation is not yet proven.

---

## 4. Core vs. Adapter Architecture

### Boundary Definition

Claude OS is logically divided into:

- **Claude OS Core** — the sprint orchestration, proof, gate, and model routing
  machinery that is theoretically reusable across any governed engineering
  project.
- **Unit Talk Adapter** — the domain-specific rules, roadmap model, contracts,
  and tooling that make Claude OS work for Unit Talk specifically.

This separation is **conceptual** today. Physical extraction is a future sprint.

### Claude OS Core (Reusable in Future)

| Capability                          | Description                                                           |
| ----------------------------------- | --------------------------------------------------------------------- |
| Sprint lifecycle protocol           | Plan → Implement → Verify → Proof → Closeout → Commit → Tag → Merge   |
| Proof architecture                  | Required artifacts, inventory format, fail-closed validation          |
| Gate architecture                   | Pre-implementation, post-implementation, pre-merge gates              |
| Model routing rules                 | Sonnet/Opus/Haiku decision matrix by task type                        |
| Lane model                          | Parallel execution lane types, dependency tracking, merge constraints |
| Autonomy boundary framework         | Safe vs. human-approval action classification                         |
| Status freshness checks             | Staleness detection, sync triggers                                    |
| Project onboarding contract         | What an adapter must provide to use Claude OS Core                    |
| Linear/project tracking integration | Issue creation, state sync, cycle management                          |

### Unit Talk Adapter (Domain-Specific)

| Capability                    | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Layer/Phase execution model   | Unit Talk's roadmap authority (`docs/04_roadmap/layer_phase_execution_model.md`)  |
| Single-writer discipline      | `unified_picks` lifecycle adapter enforcement                                     |
| Lifecycle adapter contracts   | `lifecycleInsert`, `lifecycleUpdate`, `atomicClaimForPost`, etc.                  |
| Specific CI gates             | `npm run lifecycle:single-writer -- --strict`, `npm run type-check`, build matrix |
| Supabase schema concerns      | Schema drift detection, type regeneration, migration patterns                     |
| Pick lifecycle states         | SUBMITTED → GRADED → QUEUED → POSTED → SETTLED → RECAP                            |
| Discord delivery contracts    | Outbox pattern, embed contract, worker health                                     |
| Settlement immutability rules | `settlement_result`, `settlement_hash`, `closing_line`                            |
| Unit Talk roadmap phases 0–14 | Phase map, layer sequencing, cross-layer prohibitions                             |

### Interface Contract (Future)

When extraction happens, the adapter must implement:

```
AdapterContract {
  roadmap: LayerPhaseModel
  canonicalTables: TableAuthority[]
  ciGates: GateCommand[]
  lifecycleContracts: LifecycleContract[]
  proofRequirements: ProofRequirement[]
  mergePolicy: MergePolicy
  statusDocs: StatusDocPaths
}
```

Claude OS Core provides sprint orchestration in exchange for this contract. The
adapter owns domain specifics. Core owns execution mechanics.

---

## 5. Lane Model

Parallel lanes allow independent workstreams to proceed simultaneously under
Claude OS governance. A lane is a bounded execution context with its own:

- purpose and scope
- model/tool preference
- allowed output types
- dependency constraints
- readiness gate

### Lane Definitions

#### Lane 1: Implementation

| Field             | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Purpose           | Write code, create migrations, fix tests, activate features |
| Typical Model     | Sonnet (mechanical) / Opus (new contracts)                  |
| Allowed Outputs   | Code diffs, migration files, test updates                   |
| Merge Constraints | Must pass: type-check, build, tests, lifecycle gate         |
| Dependency        | Cannot merge if Audit lane has flagged blocking truth gaps  |
| Parallel With     | Governance/Docs lane, Verification lane                     |
| Not Parallel With | Another Implementation lane on the same files               |

#### Lane 2: Audit / Truth

| Field             | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Purpose           | Read and reconcile system state; produce truth reports and status updates        |
| Typical Model     | Opus                                                                             |
| Allowed Outputs   | Status docs, drift reports, truth reconciliation notes, architecture assessments |
| Merge Constraints | No code changes → no build gate required. Must produce written artifact.         |
| Dependency        | Reads from Implementation lane outputs when applicable                           |
| Parallel With     | Implementation lane (read-only, no conflicts)                                    |
| Not Parallel With | None — reads only                                                                |

#### Lane 3: Verification

| Field             | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Purpose           | Run test suites, CI gates, proof capture                         |
| Typical Model     | Sonnet (scripting) / Haiku (status queries)                      |
| Allowed Outputs   | Proof artifact files (proof\_\*.txt), gate outputs, test results |
| Merge Constraints | Output is input to merge gate; must be non-zero artifact set     |
| Dependency        | Must run after Implementation lane code is complete              |
| Parallel With     | Governance/Docs lane                                             |
| Not Parallel With | Implementation lane (needs stable code to test)                  |

#### Lane 4: Governance / Docs

| Field             | Value                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| Purpose           | Sprint planning, closeout reports, governance doc updates, ADRs, blueprints       |
| Typical Model     | Opus (design/blueprint) / Sonnet (mechanical status updates)                      |
| Allowed Outputs   | Sprint plans, closeout reports, doc updates, ADRs                                 |
| Merge Constraints | Must not contradict existing canonical authority docs without formal supersession |
| Dependency        | Reads sprint outputs from all other lanes                                         |
| Parallel With     | Implementation, Audit, Verification lanes                                         |
| Not Parallel With | None — docs only                                                                  |

#### Lane 5: Operations / Runtime

| Field             | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Purpose           | Monitor production, debug incidents, run runbooks, incident response |
| Typical Model     | Sonnet                                                               |
| Allowed Outputs   | Runbook execution outputs, incident reports, health snapshots        |
| Merge Constraints | No code changes unless explicitly classified as a fix sprint         |
| Dependency        | Reads from current runtime state (not from other lanes)              |
| Parallel With     | All lanes (runtime monitoring is always live)                        |
| Not Parallel With | None                                                                 |

#### Lane 6: Design / Architecture

| Field             | Value                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Purpose           | Contract design, cross-service architecture, new system blueprints           |
| Typical Model     | Opus                                                                         |
| Allowed Outputs   | ADRs, contract specs, architecture blueprints, interface definitions         |
| Merge Constraints | Must be reviewed. Cannot be directly merged as implementation.               |
| Dependency        | Informs Implementation lane; does not depend on it                           |
| Parallel With     | Audit lane (may discover current state constraints)                          |
| Not Parallel With | Implementation lane working on the same contracts (race condition on design) |

### Lane Dependency Rules

1. A lane may not read outputs from another lane until that lane has passed its
   readiness gate.
2. Circular lane dependencies are forbidden.
3. If a lane is blocked by a dependency lane failure, it stops and reports the
   blocker. It does not proceed with assumptions.
4. Lane outputs are recorded in the sprint proof bundle with the lane label.

---

## 6. Model Routing Matrix

Claude OS uses the following decision matrix to select the appropriate model.
This is not a preference — it is a governed decision recorded in the sprint plan
and auditable in proof artifacts.

### Primary Decision Matrix

| Sprint / Task Type                      | Model      | Justification                           |
| --------------------------------------- | ---------- | --------------------------------------- |
| Fix (known error, known fix)            | **Sonnet** | Mechanical; no design judgment required |
| Migration (same pattern, N files)       | **Sonnet** | Repetitive pattern application          |
| Activation (code exists, toggle + wire) | **Sonnet** | Low ambiguity; known paths              |
| Feature (clear spec, defined I/O)       | **Sonnet** | Spec-driven; no architecture decisions  |
| Build fix / CI fix                      | **Sonnet** | Error message → known fix               |
| Docs / status update (known facts)      | **Sonnet** | Transcription, not reasoning            |
| Architecture design (3+ services)       | **Opus**   | Multi-system reasoning required         |
| New contract design                     | **Opus**   | Interface design with tradeoffs         |
| Audit / truth reconciliation            | **Opus**   | Cross-system read + judgment            |
| Ambiguous requirements                  | **Opus**   | Must reason through options             |
| Risk engine / probability logic         | **Opus**   | Mathematical precision + judgment       |
| Status queries / health checks          | **Haiku**  | Read-only, no reasoning                 |
| Simple script generation                | **Haiku**  | Mechanical, known pattern               |

### Escalation Rules

1. If Sonnet produces incorrect output in Phase 2 (Implement) for a sprint
   classified as Sonnet, the sprint may escalate to Opus for that phase only.
   The escalation must be documented in the sprint plan.

2. If a sprint is partially mechanical (Sonnet) and partially architectural
   (Opus), split the sprint into sub-tasks and apply per-task routing.

3. The operator may override any model routing decision with `--model <model>`.
   The override must be noted in the sprint plan with a reason.

### Future Model Slots

The following model slots are reserved for future routing consideration:

| Slot                        | Use Case                                        | Current Status                    |
| --------------------------- | ----------------------------------------------- | --------------------------------- |
| Haiku                       | Status checks, health queries, simple scripting | **Active (use now)**              |
| Sonnet                      | Implementation, migrations, features            | **Active (primary)**              |
| Opus                        | Architecture, audits, design                    | **Active (judgment)**             |
| External Code Review Model  | Security analysis, performance review           | Deferred — define in Phase C      |
| Specialized Reasoning Model | Financial math, probability, CLV                | Deferred — define in Layer 4 work |

---

## 7. Proof and Gate Architecture

Claude OS is fail-closed. No advancement is possible without evidence.

### Gate Hierarchy

| Gate Level              | Trigger                                 | Required Evidence                                       |
| ----------------------- | --------------------------------------- | ------------------------------------------------------- |
| **Pre-Implementation**  | Before Phase 2 starts                   | Session baseline, status freshness, dependency check    |
| **Post-Implementation** | After Phase 2 completes                 | Type-check proof, build proof                           |
| **Post-Verification**   | After Phase 3 completes                 | Test proof, lifecycle gate proof                        |
| **Pre-Merge**           | Before merge to main                    | All proofs present, git status clean, tags exist        |
| **Phase Advancement**   | Before claiming layer/phase complete    | All phase criteria per `layer_phase_execution_model.md` |
| **Layer Advancement**   | Before claiming layer boundary complete | All phases in layer pass their advancement gates        |

### Required Proof Artifacts (Per Sprint)

Every sprint must produce the baseline proof bundle:

```
out/sprints/<SPRINT>/<DATE>/proofs/
├── proof_git_status.txt
├── proof_typecheck*.txt
├── proof_tests.txt             (or scoped lane equivalent)
├── proof_fetch_main.txt
├── proof_rebase_or_merge_main.txt
├── proof_tag_exists.txt
├── proof_git_status_clean.txt
└── proof_proof_inventory.txt   (auto-generated by sprint:close)
```

Lane-specific proofs may be added (e.g., `proof_lifecycle_gate.txt`,
`proof_build_api.txt`) as required by sprint scope.

### Proof Inventory Rule

The `proof_proof_inventory.txt` file is **always generated by tooling**, never
manually. It is the canonical record that all required artifacts are present.

Manual creation of this file constitutes a governance violation and invalidates
the sprint.

### Lane-to-Lane Dependency Proof

When Lane B depends on Lane A's output, Lane B's proof bundle must reference
Lane A's readiness gate output. This creates an auditable dependency chain.

### Phase Advancement Proof

Claiming a phase complete requires a phase advancement proof artifact:

```
out/sprints/<SPRINT>/<DATE>/proofs/proof_phase_advancement_<N>.txt
```

This file must contain:

- Phase number and name
- All criteria from `layer_phase_execution_model.md` §2
- Evidence for each criterion (CI output, proof file references, commit hashes)
- Explicit statement: "Phase N criteria satisfied as of <DATE> by <SPRINT>"

### Fail-Closed Behavior

| Condition                                | Claude OS Action                      |
| ---------------------------------------- | ------------------------------------- |
| Any required proof missing               | STOP. Sprint cannot close.            |
| Any gate exits non-zero                  | STOP. Sprint cannot advance.          |
| Proof inventory not generated by tooling | STOP. Invalidate sprint.              |
| Phase advancement criteria not satisfied | STOP. Cannot claim layer advancement. |
| Pre-merge checklist fails any item       | STOP. No merge recommendation.        |

---

## 8. Autonomy Boundaries

Claude OS operates in two zones: **Automatic Zone** (act without asking) and
**Human-Approval Zone** (stop and ask).

### Automatic Zone — Claude OS May Act Without Asking

These actions are safe, reversible, or read-only:

| Action                                             | Reason                               |
| -------------------------------------------------- | ------------------------------------ |
| Read any file in the repository                    | Read-only                            |
| Run verification commands (type-check, test, gate) | Read-only execution                  |
| Capture proof artifacts to `out/sprints/`          | Local, gitignored                    |
| Update status docs (`docs/06_status/`)             | Low-risk doc update                  |
| Generate sprint plans and closeout reports         | Doc generation, no production impact |
| Update Linear issue state (In Progress, Done)      | Project tracking, reversible         |
| Post Linear comments                               | Informational, reversible            |
| Classify sprint type and recommend model           | Advisory, no action                  |
| Recommend next sprint from roadmap                 | Advisory                             |
| Run session baseline                               | Read-only diagnostic                 |
| Run pre-sprint check gate                          | Read-only gate                       |
| Create sprint directories under `out/`             | Local only                           |
| Write governance docs (non-canonical)              | Doc layer                            |

### Human-Approval Zone — Must Stop and Ask

These actions are irreversible, affect shared systems, or carry governance
authority:

| Action                                       | Why Human Approval Required                             |
| -------------------------------------------- | ------------------------------------------------------- |
| Merge branch to main                         | Irreversible until reverted; affects shared history     |
| Push tags to remote                          | Permanent record; affects CI and audit trail            |
| Run database migrations                      | Affects production data; potentially irreversible       |
| Write to `unified_picks` (any path)          | Single-writer contract; must go through adapters        |
| Supersede or modify canonical authority docs | Changes governance rules for all future sprints         |
| Claim a layer boundary complete              | High-stakes roadmap decision with evidence requirements |
| Increase Claude OS autonomy level            | Changes the boundary that this section defines          |
| Delete branches or tags                      | Irreversible history action                             |
| Deploy to production                         | Affects live users                                      |
| Add a new gate exemption                     | Weakens enforcement; requires justification             |
| Spend >2 hours on a blocked path             | Cost; better to escalate                                |

### Boundary Enforcement

These boundaries are not soft guidelines. Claude OS must evaluate every proposed
action against this matrix before executing.

If an action falls in the Human-Approval Zone and no explicit approval has been
given in the current session, Claude OS must:

1. State what action it wants to take
2. State why it requires human approval
3. Ask for explicit authorization
4. Not proceed until authorization is given

Authorization given in one session does NOT carry forward to the next session
unless it is codified in `CLAUDE.md` or a canonical rule file.

---

## 9. Upgrade Roadmap

Claude OS upgrades follow a staged roadmap. Each phase has a clear precondition,
goal, and output. Phases must be executed in order unless the preconditions for
a later phase are independently satisfied.

### Phase A: Blueprint / Canonicalization ← CURRENT

**Sprint**: SPRINT-CLAUDE-OS-CEILING-BLUEPRINT-CANONICALIZATION **Goal**: Define
the ceiling, architecture, and upgrade path in a canonical document. No
implementation. **Output**: This document
(`docs/02_architecture/claude_os_ceiling_blueprint.md`) **Precondition**: Layer
1 complete (achieved 2026-03-14) **Unlocks**: Phase B

### Phase B: Core Authority and Routing Upgrades

**Goal**: Formalize the model routing decision into a machine-readable config;
automate Linear sync at sprint closeout; add model routing field to sprint plan
template. **Key Deliverables**:

- Model routing decision captured in sprint plan front-matter (not just prose)
- Automated Linear sync step in `npm run sprint:close`
- `MODEL_SELECTION.md` updated to reflect this blueprint's routing matrix

**Precondition**: Phase A complete **Unlocks**: Phase C

### Phase C: Lane and Parallelism Upgrades

**Goal**: Formalize the lane model; enable independent branch-per-lane workflow;
define lane dependency tracking. **Key Deliverables**:

- Lane model defined in `.claude/rules/` (enforce lane discipline)
- Lane dependency notation in sprint plans
- Parallel lane branch convention (`sprint/<name>-lane-<N>`)
- Lane merge protocol (dependency gates before integration)

**Precondition**: Phase B complete; at least 2 real sprints using Phase B
routing **Unlocks**: Phase D

### Phase D: Artifact and Proof Automation

**Goal**: Remove manual proof capture. All gate outputs are automatically
captured and routed to proof bundle. **Key Deliverables**:

- `npm run sprint:close` automatically captures all required proofs
- Proof inventory generated without manual step
- Verification lane runs and captures output in one command
- Phase advancement proof template auto-populated

**Precondition**: Phase C complete **Unlocks**: Phase E

### Phase E: Hands-Off Workflow Enhancements

**Goal**: Minimize human intervention at phase boundaries. Session baseline runs
automatically on session start. Pre-sprint check gate runs before Phase 2.
Post-sprint status sync runs automatically at closeout. **Key Deliverables**:

- Session baseline auto-runs on `claude` session start (hook or wrapper)
- Pre-sprint gate enforced before any Phase 2 code change
- Status sync (docs + Linear) runs as part of `sprint:close`
- Operator only needs to approve merge and phase advancement claims

**Precondition**: Phase D complete; operator comfort with automation level
**Unlocks**: Phase F

### Phase F: Core/Adapter Extraction

**Goal**: Extract Claude OS Core into a reusable framework. Define the Adapter
contract. Prove that Unit Talk can use Core + Adapter and produce identical
behavior to the monolithic Claude OS. **Key Deliverables**:

- `claude-os-core/` package (or repo) with core capabilities
- `unit-talk-adapter/` with Unit Talk-specific rules and config
- Adapter contract documented and enforced
- At least one other app piloting Claude OS Core

**Precondition**: Phase E complete; second real project identified and ready
**Unlocks**: Multi-app Claude OS

---

## 10. Immediate Backlog

These are the highest-value Claude OS upgrade sprints to execute immediately
after this blueprint is canonicalized, in priority order.

### COS-001: Model Routing Formalization

**Type**: Governance / Documentation **Layer**: Claude OS Upgrade **Goal**: Add
model routing front-matter to all sprint plan templates. Update
`MODEL_SELECTION.md` to reference this blueprint's routing matrix. Ensure every
generated sprint plan includes an explicit model decision with one-line
justification. **Value**: Eliminates ad-hoc model selection; creates auditable
routing history **Size**: Small (1 sprint)

### COS-002: Linear Sync Automation

**Type**: Automation / Tooling **Layer**: Claude OS Upgrade **Goal**: Wire
Linear sync (issue state → Done, comment posted) into `npm run sprint:close` as
an automatic step. **Value**: Eliminates manual post-sprint sync; keeps Linear
accurate **Size**: Medium (1 sprint)

### COS-003: Phase Advancement Proof Template

**Type**: Governance / Documentation **Layer**: Claude OS Upgrade **Goal**:
Create a standard phase advancement proof template and wire it into the sprint
close process for sprints that claim phase completion. **Value**: Formalizes
layer boundary claims; prevents undocumented layer advancement **Size**: Small
(1 sprint)

### COS-004: Lane Model Rules File

**Type**: Governance / Documentation **Layer**: Claude OS Upgrade (Phase C
prerequisite) **Goal**: Add `.claude/rules/07-lane-model.md` defining lane
types, allowed outputs, dependency constraints, and merge rules from this
blueprint. **Value**: Makes lane model enforceable and discoverable **Size**:
Small (1 sprint)

### COS-005: Session Baseline Auto-Trigger

**Type**: Automation / Tooling **Layer**: Claude OS Upgrade (Phase E
prerequisite) **Goal**: Configure a pre-session hook (or wrapper script) that
automatically runs `pnpm session:baseline` and writes the summary before any
sprint Phase 2 can begin. **Value**: Eliminates "forgot to run baseline"
failures; ensures truth-first execution **Size**: Medium (1 sprint)

---

## Document Authority Chain

This document sits within the Unit Talk canonical docs hierarchy:

| Document                                                  | Authority                                         |
| --------------------------------------------------------- | ------------------------------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`                            | Hard law — non-negotiable invariants              |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`                   | Sprint execution mechanics                        |
| `docs/04_roadmap/layer_phase_execution_model.md`          | Roadmap sequencing authority                      |
| **`docs/02_architecture/claude_os_ceiling_blueprint.md`** | **Claude OS evolution authority — this document** |
| `.claude/rules/*.md`                                      | Modular rule enforcement                          |
| `.claude/agents/*.md`                                     | Agent role definitions                            |
| `.claude/skills/*.md`                                     | Repeatable procedures                             |

This document governs **what Claude OS should become and how it should be
upgraded**. It does not override execution mechanics (Execution Contract) or
sprint sequencing (Governance Contract).

---

_Governance Owner: Engineering Team_ _Ratified: 2026-03-14_ _Next review: On
Phase A completion verification, or at Layer 2 / Phase 7 milestone_
