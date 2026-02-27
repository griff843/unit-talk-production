# ENFORCEMENT_ACTIVATION_LAW_v1.0

**Version:** v1.0 **Phase:** Phase 8 — Rollout Canon **Status:** RATIFIED
**Ratified:** 2026-02-27 (UTC) **Enforcement State:** RATIFIED

---

## 1. Purpose

This contract defines the activation surfaces for enforcement, establishes the
runtime vs build-time separation for enforcement logic, and declares the
fail-closed priority model for enforcement states. It serves as the design-law
that later enforcement code MUST follow.

---

## 2. Scope

### 2.1 In Scope

- Activation surface definitions (design-level)
- Build-time vs runtime enforcement separation
- Fail-closed priority model
- State override hierarchy
- Enforcement activation invariants

### 2.2 Out of Scope

- Implementation code for enforcement
- Specific enforcement algorithm details
- Database schema for enforcement storage
- CI/CD pipeline implementation details

---

## 3. Activation Surface Definitions

### 3.1 Activation Surface Enum (Closed)

| Code       | Surface             | Description                                               |
| ---------- | ------------------- | --------------------------------------------------------- |
| EA_BOOT    | Boot                | Service startup validation and enforcement initialization |
| EA_BUILD   | Build               | Compile-time and packaging validation                     |
| EA_RUNTIME | Runtime             | Live request/event processing enforcement                 |
| EA_CI      | CI                  | Continuous integration gate enforcement                   |
| EA_WORKER  | Worker              | Background job and agent enforcement                      |
| EA_OUTBOX  | Outbox/Distribution | Outbound message and distribution enforcement             |

### 3.2 Enum Closure Declaration

This enum is closed. No additional activation surface identifiers are permitted.
Any surface not in this enum is invalid and MUST NOT be referenced in
enforcement logic.

---

## 4. Build-Time vs Runtime Separation

### 4.1 Separation Principle

Build-time and runtime enforcement MUST remain distinct per
PHASE_5_REPOSITORY_TRUTH_RATIFICATION_v1.0 (BUILD_RUNTIME_SEPARATION_LAW_v1.0).

### 4.2 Build-Time Enforcement (EA_BUILD, EA_CI)

Build-time enforcement:

- MUST NOT evaluate runtime configuration
- MUST NOT connect to external services
- MUST NOT access production credentials
- MUST be deterministic given source code inputs
- MAY validate static policy definitions
- MAY validate contract structure compliance

### 4.3 Runtime Enforcement (EA_BOOT, EA_RUNTIME, EA_WORKER, EA_OUTBOX)

Runtime enforcement:

- MUST be gated by `rollout_mode` (per ROLLOUT_MODE_CANON_v1.0)
- MUST NOT activate before boot preconditions are satisfied
- MUST respect environment boundaries (no cross-env execution)
- MUST produce audit log entries for enforcement decisions
- MUST NOT run in build contexts

### 4.4 Separation Invariants

| Invariant ID | Statement                                                               |
| ------------ | ----------------------------------------------------------------------- |
| EA-001       | Build-time surfaces MUST NOT evaluate runtime mode configuration        |
| EA-002       | Runtime surfaces MUST NOT activate until boot completes successfully    |
| EA-003       | Enforcement activation MUST be runtime-gated, not build-time determined |
| EA-004       | Production MUST NOT run SHADOW mode regardless of build artifacts       |
| EA-005       | Staging MAY run SHADOW mode; production MUST NOT                        |

---

## 5. Environment Enforcement Rules

### 5.1 Production Enforcement

Production environment enforcement:

- MUST NOT support SHADOW mode (absolute prohibition)
- MUST support DORMANT, CANARY, ENFORCED, LOCKED modes only
- MUST fail-closed on UNKNOWN mode
- MUST freeze on SHADOW mode detection

### 5.2 Staging Enforcement

Staging environment enforcement:

- MAY support SHADOW mode for testing
- MUST support DORMANT, SHADOW, CANARY modes
- MUST NOT support ENFORCED or LOCKED modes
- MUST log all enforcement decisions

### 5.3 Development Enforcement

Development environment enforcement:

- MAY support SHADOW mode for local testing
- MUST support DORMANT, SHADOW modes
- MUST NOT support CANARY, ENFORCED, LOCKED modes
- MAY operate without audit logging

---

## 6. Fail-Closed Priority Model

### 6.1 Priority Order (Highest to Lowest)

| Priority | State    | Effect                                      |
| -------- | -------- | ------------------------------------------- |
| 1        | FROZEN   | All outbound effects MUST halt              |
| 2        | UNKNOWN  | All outbound effects MUST halt              |
| 3        | DORMANT  | Enforcement inactive; normal operation      |
| 4        | SHADOW   | Enforcement logs only; no effect            |
| 5        | CANARY   | Enforcement active for restricted targets   |
| 6        | ENFORCED | Enforcement fully active                    |
| 7        | LOCKED   | Enforcement active; mode changes prohibited |

### 6.2 Priority Resolution Rules

- If FROZEN is active, outbound MUST halt regardless of rollout_mode.
- If rollout_mode is UNKNOWN, outbound MUST halt (treat as FROZEN equivalent for
  outbound).
- FROZEN and UNKNOWN override all other states.
- Priority resolution is deterministic; no ambiguity is permitted.

### 6.3 Distribution Binding

Outbound effects (distribution) MUST respect this priority model:

- FROZEN or UNKNOWN state MUST halt outbox consumption.
- FROZEN or UNKNOWN state MUST halt external API calls.
- FROZEN or UNKNOWN state MUST halt webhook delivery.
- This binding is conceptual and does not modify distribution contract
  implementation.

---

## 7. Enforcement Activation Invariants

### 7.1 Invariant Registry (Closed)

| ID     | Invariant Statement                                                       |
| ------ | ------------------------------------------------------------------------- |
| EA-001 | Build-time surfaces MUST NOT evaluate runtime mode configuration          |
| EA-002 | Runtime surfaces MUST NOT activate until boot completes successfully      |
| EA-003 | Enforcement activation MUST be runtime-gated, not build-time determined   |
| EA-004 | Production MUST NOT run SHADOW mode regardless of build artifacts         |
| EA-005 | Staging MAY run SHADOW mode; production MUST NOT                          |
| EA-006 | FROZEN state MUST override all rollout modes for outbound effects         |
| EA-007 | UNKNOWN mode MUST trigger halt behavior equivalent to FROZEN for outbound |
| EA-008 | Mode transitions MUST be recorded in operational audit log                |
| EA-009 | Enforcement decisions MUST be traceable to policy version                 |
| EA-010 | No enforcement surface may bypass fail-closed priority                    |

### 7.2 Invariant Closure

This invariant list is closed. Addition of new invariants requires version
increment (MINOR for clarification, MAJOR for substantive change).

---

## 8. Boot Enforcement Surface (EA_BOOT)

### 8.1 Boot Preconditions

Before enforcement activates at boot:

- Configuration MUST be validated per FAIL_CLOSED_BOOT_SPEC_v1.0.
- Environment MUST be identified (dev, staging, prod).
- Rollout mode MUST be determined from configuration.
- Mode MUST be validated against allowed matrix.

### 8.2 Boot Failure Handling

If boot preconditions fail:

- Service MUST NOT start.
- Failure MUST be logged with exit code.
- Enforcement MUST NOT activate in partial state.

---

## 9. Outbox/Distribution Enforcement Surface (EA_OUTBOX)

### 9.1 Distribution Gate

The outbox/distribution surface is the final enforcement gate before external
effects:

- Outbound messages MUST respect rollout_mode.
- FROZEN state MUST halt distribution.
- UNKNOWN mode MUST halt distribution.
- SHADOW mode MUST log but not affect distribution (staging only; prod
  prohibited).

### 9.2 Distribution Determinism

Distribution enforcement:

- MUST produce consistent results given identical inputs and state.
- MUST NOT introduce non-determinism.
- MUST record decisions in audit log.

---

## 10. Audit Sweep Patterns

### 10.1 Absence Patterns (MUST NOT appear)

| Pattern                             | Location          | Meaning                  |
| ----------------------------------- | ----------------- | ------------------------ |
| Production supporting SHADOW        | Environment rules | SHADOW in prod violation |
| Build-time mode evaluation          | Build surface     | Separation violation     |
| Enforcement without boot completion | Runtime surface   | Activation violation     |

### 10.2 Presence Patterns (MUST appear)

| Pattern                          | Location           | Meaning                |
| -------------------------------- | ------------------ | ---------------------- |
| EA-001 through EA-010 invariants | Invariant registry | Complete invariant set |
| FROZEN > UNKNOWN priority        | Priority model     | Fail-closed hierarchy  |
| prod MUST NOT SHADOW             | Environment rules  | Production safety      |

---

## 11. Acceptance Criteria (Binary)

| Criterion                                               | Result    |
| ------------------------------------------------------- | --------- |
| Activation surface enum is closed with exactly 6 values | PASS/FAIL |
| Build-time vs runtime separation is explicit            | PASS/FAIL |
| Production cannot run SHADOW mode (stated explicitly)   | PASS/FAIL |
| Staging may run SHADOW mode (stated explicitly)         | PASS/FAIL |
| Fail-closed priority defined with FROZEN > UNKNOWN      | PASS/FAIL |
| FROZEN/UNKNOWN halt outbound (distribution binding)     | PASS/FAIL |
| Invariants EA-001 through EA-010 are defined            | PASS/FAIL |
| Boot preconditions reference FAIL_CLOSED_BOOT_SPEC      | PASS/FAIL |

**PASS:** All criteria satisfied. **FAIL:** Any criterion not satisfied.

---

## 12. Canonical Binding

This contract binds to:

- **CONSTITUTION_v1.0** — Supreme design-layer authority; environment
  definitions
- **ROLLOUT_MODE_CANON_v1.0** — Canonical rollout mode enum and allowed matrix
- **PHASE_5_REPOSITORY_TRUTH_RATIFICATION_v1.0** — Build/runtime separation law
- **BUILD_RUNTIME_SEPARATION_LAW_v1.0** — Build vs runtime boundary definitions
- **FAIL_CLOSED_BOOT_SPEC_v1.0** — Boot precondition specification

---

## 13. Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

## 14. Final Declaration

Enforcement activation is runtime-gated. Build-time and runtime surfaces are
distinct. Production cannot run SHADOW mode. FROZEN and UNKNOWN states override
all modes for outbound effects. This contract establishes the enforcement
activation layer required for rollout canon compliance.

Failure to comply with this contract invalidates enforcement activation.

---

**End of Document**
