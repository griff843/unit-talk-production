# Layer / Phase Execution Model

**Version**: 1.0 **Status**: CANONICAL — Active Authority **Authority**: Roadmap
Layer **Sprint**: SPRINT-LAYER-PHASE-EXECUTION-MODEL-CANONICALIZATION
**Effective**: 2026-03-13

> This document is the canonical execution model for Unit Talk roadmap
> sequencing, sprint classification, and Claude OS / Claude Code sprint
> planning. It supersedes any informal layer or phase references in prior
> documentation. No sprint may claim completion of a layer boundary without
> satisfying the criteria defined here.

---

## 1. Purpose

Unit Talk roadmap work is organized into **Layers** and **Phases**.

This document defines:

- the meaning of each Layer
- the set of Phases belonging to each Layer
- the sequencing rules that govern cross-layer execution
- the classification rules that sprint authors and LLM agents must apply
- the authority relationship between this document and Claude OS execution

Sprint planning, status reporting, and Claude OS execution directives **must use
this document as the roadmap execution authority** unless a newer canonical
replacement has been formally ratified and committed to `docs/04_roadmap/`.

---

## 2. Layer Definitions

### Layer 1 — Functional Pick Machine

**Operating meaning**: Core pipelines work. The system can execute a pick
end-to-end: ingestion → scoring → promotion → Discord delivery → settlement. No
Layer 1 exit is possible while any critical pipeline path is broken, undefined,
or untested.

Layer 1 is complete when a production pick can reliably traverse the full
lifecycle without manual intervention and the result is deterministic,
auditable, and recoverable.

### Layer 2 — Production Platform

**Operating meaning**: The production platform is safe to operate. The system is
stable, observable, and provides operators with the controls needed to run it in
production without heroics. Layer 2 is not about features — it is about
operational confidence.

Layer 2 is complete when operators can run the platform, detect problems, and
recover from failure states without requiring engineering escalation for normal
operational events.

### Layer 3 — Product Complete

**Operating meaning**: Workflows are usable. Users and operators have polished
interfaces and efficient workflows. Layer 3 work improves the human experience
of interacting with a system that already functions correctly at Layers 1 and 2.

Layer 3 is complete when the Smart Form, Command Center, and operator tooling
are production-grade and the friction of daily operation is minimized.

### Layer 4 — Syndicate Intelligence

**Operating meaning**: The platform gains competitive analytical advantage. Edge
detection, market resistance analysis, and CLV analytics are operational and
provide actionable intelligence. Layer 4 is only meaningful after Layers 1–3 are
complete, because intelligence built on an unstable or unobservable system
cannot be trusted.

---

## 3. Phase Map

Each Phase belongs to exactly one Layer. The Phase numbering is authoritative.

### Layer 1 — Functional Pick Machine

| Phase | Name                     | Scope                                                                          |
| ----- | ------------------------ | ------------------------------------------------------------------------------ |
| 0     | Governance Lock          | Execution contracts, single-writer discipline, CI gates, Claude OS governance  |
| 1     | Runtime Truth            | Agent health, lifecycle enforcement, idempotency guarantees                    |
| 2     | Data Truth               | Schema canonicalization, type safety, schema drift elimination                 |
| 3     | Distribution Determinism | Discord worker reliability, outbox integrity, delivery proofs                  |
| 4     | Operational Determinism  | Worker health restore, quarantine/dead-letter handling, pipeline observability |
| 5     | Platform Stabilization   | End-to-end E2E verification, smoke tests, shadow mode, fault injection         |

### Layer 2 — Production Platform

| Phase | Name                     | Scope                                                                                      |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------ |
| 6     | Operator Control Plane   | Backend control surface: operator APIs, autopilot mode controls, manual override workflows |
| 7     | Reliability & Monitoring | Alerting, SLO tracking, health dashboards, on-call runbooks                                |
| 8     | Recovery & Replay        | Replay engine production readiness, incident recovery procedures, backup/restore           |

### Layer 3 — Product Complete

| Phase | Name                  | Scope                                                              |
| ----- | --------------------- | ------------------------------------------------------------------ |
| 9     | SmartForm UX          | Smart Form polish, user-facing pick submission workflows           |
| 10    | Command Center UX     | Command Center interface redesign, operator UI, workflow tooling   |
| 11    | Workflow Optimization | Cross-cutting operator efficiency, automation of routine workflows |

### Layer 4 — Syndicate Intelligence

| Phase | Name              | Scope                                                            |
| ----- | ----------------- | ---------------------------------------------------------------- |
| 12    | Edge Detection    | Closing line value analysis, edge identification, backtesting    |
| 13    | Market Resistance | Market behavior analysis, line movement interpretation           |
| 14    | CLV Analytics     | Customer lifetime value, historical model performance, analytics |

---

## 4. Sequencing Rules

The following rules are non-negotiable. They govern sprint planning, status
reporting, and LLM execution directives.

### 4.1 Cross-Layer Sequencing

**Rule**: Lower-layer work must be resolved before upper-layer work is claimed
as complete.

- Layer 1 must be functionally complete before Layer 2 work can be declared
  production-ready.
- Layer 2 must be operationally stable before Layer 3 UX work is prioritized
  over Layer 2 gaps.
- Layers 3 and 4 must not be started if Layer 1 truth gaps remain unresolved.

**Violation**: Proceeding with Layer 3 UX polish while Layer 1 pipeline failures
are open is a sequencing violation. Sprint plans that do this must be flagged.

### 4.2 Platform Stabilization Belongs to Layer 1

Phase 5 (Platform Stabilization) is a **Layer 1 phase**, not an optional polish
step. End-to-end verification, shadow mode, and fault injection are Layer 1
completion criteria. They must not be deferred until after Layer 2 work begins.

### 4.3 Operator Control Plane is Layer 2

Phase 6 (Operator Control Plane) is a **Layer 2 phase**. It concerns the backend
control surface — operator APIs, autopilot mode switching, and manual override
mechanics. It is **not** a UI/UX phase.

### 4.4 Command Center UX is Layer 3

Phase 10 (Command Center UX) is a **Layer 3 phase**. It concerns the frontend
operator interface — layout, interaction design, and workflow tooling. A Command
Center redesign or UX overhaul is always Layer 3, Phase 10.

**Critical distinction**: Phase 6 (Operator Control Plane) and Phase 10 (Command
Center UX) are different concerns at different layers. Phase 6 is the backend
authority; Phase 10 is the frontend surface. Conflating them is a classification
error.

### 4.5 UX Must Not Imply Operational Readiness

Completing Layer 3 UX work (Phases 9–11) does not imply operational readiness.
Operational readiness is governed by Layer 1 and Layer 2 completion. Sprint
reports must not use UX improvements to justify production-ready status claims
if Layer 1 or Layer 2 gaps exist.

### 4.6 No Silent Bypass of Lower-Layer Gaps

Later-layer sprints must not silently bypass unresolved lower-layer truth gaps.

If a Layer 3 or Layer 4 sprint is initiated while a Layer 1 truth gap is open,
the sprint author must explicitly document the gap and its rationale for
deferral. Silent bypass is a governance violation.

### 4.7 Sprint Classification is Mandatory

Every sprint must declare its Layer and Phase in its sprint plan. Status reports
must reference the Layer/Phase classification to provide meaningful context
about what part of the roadmap is being advanced.

Format: `Layer <N> / Phase <M> — <Phase Name>`

Example: `Layer 1 / Phase 4 — Operational Determinism`

---

## 5. Claude OS / LLM Execution Rule

**Claude OS, Claude Code, and any future LLM-driven sprint planning system must
use this document as the roadmap execution authority.**

Specifically:

- Sprint classification must be validated against the Phase Map in Section 3.
- Cross-layer sequencing must be enforced per Section 4.
- Any sprint that claims to advance a layer boundary must satisfy the criteria
  in Section 2 for that layer.
- Status claims (e.g., "Layer 1 complete") require proof artifacts demonstrating
  that all phases in that layer have been completed and verified.
- This document remains authoritative until a newer version is formally
  committed to `docs/04_roadmap/` with `Status: CANONICAL — Active Authority`
  and a ratification note superseding this version.

LLM agents must not infer layer or phase assignments from informal references in
sprint names, commit messages, or status documents. The Phase Map in Section 3
is the single source of truth for phase-to-layer assignment.

---

## 6. Practical Classification Examples

The following examples illustrate correct phase classification.

| Work Item                                        | Layer | Phase | Rationale                                                          |
| ------------------------------------------------ | ----- | ----- | ------------------------------------------------------------------ |
| Discord worker health restore                    | 1     | 4     | Operational determinism — pipeline reliability, not UX             |
| Quarantine / dead-letter row handling            | 1     | 4     | Same — worker fault tolerance is Layer 1 pipeline work             |
| E2E smoke test suite creation                    | 1     | 5     | Platform stabilization — verifying end-to-end pipeline correctness |
| Shadow mode + fault injection framework          | 1     | 5     | Platform stabilization prerequisite for Layer 2 claims             |
| Operator control plane architecture              | 2     | 6     | Backend control surface — operator APIs, autopilot mode controls   |
| Autopilot mode switch (LOG_ONLY → CANARY → PROD) | 2     | 6     | Operator control, not UI                                           |
| SLO dashboards and alerting                      | 2     | 7     | Reliability & monitoring                                           |
| Replay engine for incident recovery              | 2     | 8     | Recovery & replay — production safety                              |
| Smart Form UX improvements                       | 3     | 9     | Product UX — only after Layer 1/2 stability                        |
| Command Center redesign / UX overhaul            | 3     | 10    | Frontend operator UI — Layer 3, never Layer 2                      |
| Operator workflow automation                     | 3     | 11    | Workflow optimization — reduces friction of running the platform   |
| Backtesting / closing line value analysis        | 4     | 12    | Edge detection — requires stable Layer 1 pipeline data             |
| Market resistance / line movement analysis       | 4     | 13    | Intelligence — requires verified historical data from Layer 1      |
| CLV analytics and model performance metrics      | 4     | 14    | Analytics intelligence — terminal layer                            |

---

## 7. Cross-Cutting Capabilities

Some capabilities span multiple layers. They are not assigned to a single phase
but must be noted in sprint plans that depend on them.

### Verification & Simulation Control Plane (R1–R5)

The Verification & Simulation Control Plane is a Layer 1 enabler that supports
Layer 1 Phase 5 completion and Layer 2 Phase 8 reliability.

| Milestone | Capability                  | Layer Relevance                     |
| --------- | --------------------------- | ----------------------------------- |
| R1        | Mode-safe adapter layer     | Layer 1 / Phase 1 (Runtime Truth)   |
| R2        | Deterministic replay engine | Layer 1 / Phase 5 (Stabilization)   |
| R3        | Shadow mode                 | Layer 1 / Phase 5 (Stabilization)   |
| R4        | Fault injection             | Layer 1 / Phase 5 (Stabilization)   |
| R5        | Execution simulation        | Layer 4 / Phase 12 (Edge Detection) |

Shadow mode (R3) and fault injection (R4) are prerequisites for advancing
autopilot beyond `LOG_ONLY`. They are not optional stabilization work.

---

## 8. Document Authority Chain

| Document                                             | Authority Role                              |
| ---------------------------------------------------- | ------------------------------------------- |
| `CLAUDE_EXECUTION_CONTRACT.md`                       | Hard law — non-negotiable invariants        |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`              | Sprint execution rules                      |
| **`docs/04_roadmap/layer_phase_execution_model.md`** | **Roadmap execution model — this document** |
| `docs/04_roadmap/technical_roadmap.md`               | High-level roadmap narrative                |
| `docs/04_roadmap/release_strategy.md`                | Deployment and release practices            |

This document governs **phase classification and layer sequencing**. The
Execution Contract and Governance Contract govern **sprint execution
mechanics**. Both must be satisfied simultaneously.

---

_Governance Owner: Engineering Team_ _Ratified: 2026-03-13_ _Next review: on
major layer boundary completion_
