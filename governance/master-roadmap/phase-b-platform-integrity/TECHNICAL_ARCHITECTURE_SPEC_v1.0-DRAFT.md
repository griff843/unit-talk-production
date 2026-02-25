# TECHNICAL_ARCHITECTURE_SPEC v1.0-DRAFT (Phase B.1)

This document translates Phase B Platform Integrity doctrine into an enforceable
technical architecture.

It is invariant-first. Tools and implementation details must conform to these
rules.

---

## 1. Architectural Invariants (Non-Negotiable)

- Docker-only production runtime truth.
- Fail-closed boot: missing/invalid required env prevents start.
- Single-writer canonical lifecycle enforcement.
- Deterministic state transitions (no skipped stages, no manual override).
- Settlement immutability after finalization.
- Discord is a rendering surface, never a truth source.
- Billing is entitlement authority, never pick truth authority.
- No silent degradation modes (observability required).

---

## 2. System Topology (High-Level)

Feed → Proposals/Evaluations → Canonical Lifecycle (Single Writer) → Outbox →
Distribution (Discord) ↓ Settlement (Single Writer) ↓ Recap/Archive ↓
Observability/Audit

---

## 3. Service & Agent Boundaries

### 3.1 Canonical Services (Write Authority)

#### A) Lifecycle Service (Single Writer)

Owns:

- Canonical pick lifecycle tables
- All lifecycle state transitions
- Promotion decisions (as the only authority that can promote state)

Hard rule: No other service may mutate canonical lifecycle state.

#### B) Settlement Service/Agent (Single Writer)

Owns:

- Settlement finalization writes
- Settlement immutability enforcement (post-finalization)

Hard rule: Finalized settlement records are immutable.

---

### 3.2 Non-Canonical Agents (No Canonical Writes)

#### C) Feed Agent

- Ingests external provider data
- Writes only to non-canonical ingestion/proposal tables
- Never mutates lifecycle tables

#### D) Scoring Agent

- Computes evaluation metrics
- Writes only to non-canonical evaluation tables
- Never mutates lifecycle tables or settlement tables

#### E) Alert Agent

- Produces Discord payloads from canonical state
- Never mutates canonical state

#### F) Entitlement Sync Service

- Maps billing truth → entitlement truth
- Never mutates canonical pick lifecycle or settlement

---

### 3.3 Distribution Worker

#### G) Outbox Worker (Deterministic Delivery)

- Reads outbox events created by canonical services
- Dispatches to Discord
- Enforces retries, max age, and dead-letter behavior
- Cannot roll back or mutate canonical lifecycle due to delivery failures

Hard rule: Distribution failure never mutates canonical truth.

---

## 4. Data Ownership & Write Privilege Enforcement

### 4.1 Canonical Truth Store

- Canonical truth lives in Postgres (Supabase).

### 4.2 Write Privilege Contract (Required)

- Only Lifecycle Service and Settlement Service have write grants on canonical
  tables.
- All other services are read-only to canonical tables.
- Feed/Scoring write only to non-canonical tables (proposals/evaluations).
- Discord has zero authority over canonical state.

This is enforced by database privileges and validated by audits.

---

## 5. Canonical Lifecycle State Machine (Minimum Definition)

All picks follow deterministic lifecycle stages:

Ingestion → Evaluation → Promotion → Distribution → Settlement → Recap → Archive

Rules:

- Stages cannot be skipped.
- State transitions must be authorized by Lifecycle Service.
- Every transition produces an auditable record and, where relevant, an outbox
  event.

---

## 6. Outbox Event Contract (Minimum Definition)

Every outbox event must contain:

- event_id (unique)
- canonical_reference_id (pick/ticket id)
- event_type
- created_at
- status (pending | processing | sent | failed)
- attempt_count
- last_attempt_at
- idempotency_key

Baseline thresholds (from Phase B):

- max pending age: 2 minutes
- retry cap: 5 attempts
- failure transitions to explicit failed/dead-letter state

Outbox is the only approved dispatch surface.

---

## 7. Observability Contract (Minimum Definition)

All core services must:

- expose a health endpoint/healthcheck
- emit reconciliation logs for their domain
- support proof bundle generation for release candidates

No release proceeds without proof artifacts.

---

## 8. Temporal (Explicit Stance)

Temporal may be used for orchestration of long-running workflows, but:

- Temporal is not a source of canonical truth
- Temporal does not grant write authority outside the single-writer services
- All state mutation still flows through Lifecycle/Settlement services

Temporal usage must not create a second writer surface.

---

## 9. Deployment Topology

- Docker Compose is the runtime source of truth.
- Services are isolated in containers with healthchecks enforced.
- Environment contract is required and fail-closed.

No production-like execution path exists outside Docker.

---

## 10. Failure Domain Rules

- Feed failure cannot corrupt canonical truth.
- Discord failure cannot corrupt canonical truth.
- Billing delay cannot corrupt canonical truth.
- Settlement delay cannot corrupt canonical truth (only delays finalization).

Truth remains stable under partial failures.
