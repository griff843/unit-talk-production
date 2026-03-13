# Unit Talk Technical Roadmap

Version: 1.0  
Status: Canonical  
Authority: Roadmap Layer

This document defines the technical development roadmap for the Unit Talk
platform.

The roadmap describes the major phases required to evolve the system from its
current state into a fully operational intelligence platform.

Detailed sprint planning occurs separately.

---

# 1. Roadmap Philosophy

The Unit Talk platform must evolve in controlled stages.

Development should follow these principles:

- stabilize core infrastructure first
- establish reliable data pipelines
- enable core intelligence capabilities
- expand analytics and automation
- scale the platform for growth

Each phase builds upon the stability of the previous phase.

---

# 2. Phase 1 — Platform Foundation

Objective:

Establish a stable technical foundation for the system.

Key goals:

- finalize canonical database schema
- ensure Supabase integration is stable
- stabilize ingestion pipelines
- enforce environment configuration rules
- verify build and deployment reliability

Key deliverables:

- stable unified_picks pipeline
- ingestion reliability
- schema validation
- CI/CD verification
- environment integrity checks

---

# 3. Phase 2 — Intelligence Pipeline

Objective:

Implement the full data intelligence pipeline.

Key goals:

- scoring engine implementation
- feature snapshot generation
- edge calculation logic
- promotion engine rules
- alert system implementation

Key deliverables:

- scoring agent functionality
- promotion logic
- alert generation
- historical performance tracking

---

# 4. Phase 3 — Distribution System

Objective:

Deliver insights to users through reliable distribution channels.

Key goals:

- Discord publishing pipeline
- message formatting and embeds
- alert delivery mechanisms
- user-facing pick distribution

Key deliverables:

- Discord outbox system
- Discord worker reliability
- message delivery tracking
- alert messaging infrastructure

---

# 5. Phase 4 — Operational Tools

Objective:

Enable operational visibility and control.

Key goals:

- Command Center functionality
- Smart Form workflows
- system monitoring dashboards
- operational controls

Key deliverables:

- pipeline monitoring tools
- operational dashboards
- manual intervention workflows

---

# 6. Phase 5 — Analytics and Intelligence

Objective:

Leverage historical data to improve system intelligence.

Key goals:

- closing line value tracking
- model evaluation tools
- analytics dashboards
- historical data analysis

Key deliverables:

- analytics pipelines
- reporting tools
- model performance metrics

---

# 7. Phase 6 — Platform Optimization

Objective:

Improve reliability, scalability, and automation.

Key goals:

- performance optimization
- caching improvements
- ingestion efficiency
- alert system refinement
- automated monitoring

Key deliverables:

- optimized ingestion pipelines
- improved system observability
- automated operational safeguards

---

# 8. Phase 7 — Advanced Intelligence

Objective:

Expand the intelligence capabilities of the platform.

Potential capabilities include:

- advanced predictive modeling
- automated edge detection
- market behavior analysis
- personalized insights

These capabilities build on the data foundation established in earlier phases.

---

# 8A. Cross-Cutting Capability — Verification & Simulation

The Verification & Simulation Control Plane is a cross-cutting enabling
capability that spans all phases.

It is not assigned to a single phase. It runs alongside platform development to
provide a safety substrate for evolution.

## Purpose

- prove pipeline behavior deterministically without live provider uptime
- support regression detection as models and rules evolve
- decouple verification from wall-clock time
- enable safe deployment of new models, scoring rules, and autopilot logic

## Phased Rollout

| Phase | Capability                  | Status      | Significance                                          |
| ----- | --------------------------- | ----------- | ----------------------------------------------------- |
| R1    | Mode-safe adapter layer     | COMPLETE    | All pipeline modes share one code path                |
| R2    | Deterministic replay engine | COMPLETE    | Pipeline behavior verifiable from event journal       |
| R3    | Shadow mode                 | IN PROGRESS | Production runs verified in parallel, no side effects |
| R4    | Fault injection             | IN PROGRESS | Resilience verified under controlled failures         |
| R5    | Execution simulation        | DEFERRED    | Synthetic strategy evaluation without production data |

## Relationship to Other Phases

- **Phase 4 (Operational Tools)**: Shadow mode enables safe canary promotion of
  operational workflows.
- **Phase 5 (Analytics)**: Replay infrastructure is the evaluation substrate for
  walk-forward evaluation of scoring models.
- **Phase 6 (Optimization)**: Fault injection validates that optimizations do
  not degrade resilience.
- **Phase 7 (Advanced Intelligence)**: Execution simulation enables strategy
  evaluation without live market risk.

## What Replay Readiness Means

Replay readiness (R2 complete) is a meaningful milestone. It means:

- all production lifecycle events are recordable
- the pipeline can be replayed deterministically from a JSONL event journal
- SHA-256 hash comparison confirms behavioral consistency across runs
- proof bundles are generated automatically for every replay run

Replay readiness enables regression testing of scoring, promotion, and
settlement logic without requiring production data or live provider connections.

## Shadow and Fault Injection as Prerequisites

Before making strong claims about autopilot correctness or model deployment
safety, the following must be in place:

- **Shadow mode** (R3): The pipeline must demonstrate it can run in parallel
  with production without causing side effects. This is the prerequisite for
  canary promotion claims.
- **Fault injection** (R4): The pipeline must demonstrate correct behavior under
  controlled failure scenarios. This validates freeze rules, fail-closed
  defaults, and error handling.

These are not optional optimizations. They are governance prerequisites for
elevating autopilot from LOG_ONLY or CANARY to PROD.

---

# 9. Phase Dependencies

The phases must occur in sequence.

Dependency chain:

foundation ↓ intelligence pipeline ↓ distribution system ↓ operational tools ↓
analytics ↓ optimization ↓ advanced intelligence

Later phases depend on the stability of earlier phases.

---

# 10. Milestone Tracking

Each phase should define measurable milestones.

Milestones may include:

- stable pipeline execution
- reliable message delivery
- successful settlement processing
- analytics report generation

Milestones allow progress to be objectively evaluated.

---

# 11. Production Readiness

Production readiness requires:

- stable ingestion pipelines
- deterministic scoring
- reliable promotion decisions
- verified Discord delivery
- successful settlement workflows

All critical workflows must be observable and auditable.

---

# Summary

The Unit Talk roadmap progresses through the following stages:

1. Platform foundation
2. Intelligence pipeline
3. Distribution system
4. Operational tools
5. Analytics and intelligence
6. Platform optimization
7. Advanced intelligence

Each stage increases the capability and maturity of the platform.
