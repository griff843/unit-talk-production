# UNIT TALK PLATFORM CONSTITUTION

## Version 1.0

Status: Draft Effective Date: TBD Authority: Founder

---

## Document Control

This document defines the prescriptive architectural law governing the Unit Talk
Platform.

This Constitution is binding over all platform code, workflows, agents, and
infrastructure.

If platform implementation conflicts with this Constitution, implementation must
be modified.

This document is version-controlled in Git and may not be modified without:

1. Version increment
2. Decision log entry
3. Amendment log update

---

## Scope

This Constitution governs:

- Platform architecture
- Data architecture
- Event lifecycle
- Intelligence engine
- Risk engine
- Agent governance
- Observability requirements
- Production readiness standards
- Kill conditions

It does not govern organizational compensation or operational structure.  
Those are defined in the Operating Constitution.

---

---

# SECTION I — FOUNDATIONAL LAW

## ARTICLE 1 — PLATFORM IDENTITY

### 1.1 Mission Definition

Unit Talk is a Betting Intelligence Platform.

It is not:

- A pick-selling Discord group
- A hype-based distribution channel
- A personality-driven content brand
- An AI marketing gimmick

It is a deterministic, data-driven decision engine designed to generate
measurable edge, manage risk, and compress research time.

All systems must materially support this objective.

---

### 1.2 Core Optimization Targets

The platform optimizes for:

1. Sustained positive Closing Line Value (CLV)
2. Statistically measurable edge over baseline
3. Deterministic lifecycle execution
4. Risk-adjusted capital preservation
5. Time compression for end users
6. Transparent and reproducible performance reporting

Features that do not improve one or more of these objectives are considered
non-core.

---

## ARTICLE 2 — SYSTEM AUTHORITY

### 2.1 Constitution Supremacy

This Constitution governs all platform implementation.

If code, workflow, or operational behavior conflicts with this document,
implementation must be modified.

The Constitution does not conform to implementation.

---

### 2.2 Single Source of Truth

All authoritative state must originate from:

- Versioned database records
- Immutable snapshots
- Explicit event-driven transitions

Derived state without persisted origin is prohibited.

---

### 2.3 Single Writer Principle

For each canonical lifecycle table:

- Exactly one service may write authoritative records.
- All other services must emit events only.
- Side effects must occur exclusively through outbox processing.

Violations are architectural defects.

---

### 2.4 Outbox Enforcement Rule

No external side effect may occur unless:

1. A persisted database record exists referencing the action.
2. The action has a unique immutable identifier.
3. The external response (e.g., Discord snowflake ID) is persisted.

No message may be sent without database traceability.

---

### 2.5 Deterministic Lifecycle Requirement

Each pick must follow an explicit state machine:

Draft → Submitted → Approved → Promoted → Posted → Settled → Archived

State transitions must:

- Be logged
- Be idempotent
- Be replayable
- Produce identical outcomes on replay

Implicit state is prohibited.
