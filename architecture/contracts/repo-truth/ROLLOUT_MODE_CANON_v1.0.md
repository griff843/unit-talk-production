# ROLLOUT_MODE_CANON_v1.0

**Version:** v1.0 **Phase:** Phase 8 — Rollout Canon **Status:** RATIFIED
**Ratified:** 2026-02-27 (UTC) **Enforcement State:** RATIFIED

---

## 1. Purpose

This contract defines the single authoritative `rollout_mode` closed enum for
Unit Talk enforcement activation. It establishes the canonical allowed mode
matrix per environment and declares the absolute prohibition of SHADOW mode in
production.

No other document may define, duplicate, extend, alias, or partially redefine
rollout mode values.

---

## 2. Scope

### 2.1 In Scope

- Canonical `rollout_mode` enum definition
- Canonical `environment` enum binding (from CONSTITUTION_v1.0)
- Allowed mode matrix per environment
- Mode violation handling rules
- SHADOW prohibition in production

### 2.2 Out of Scope

- Implementation-layer mode switching logic
- Runtime enforcement code
- Database schema for mode storage
- Mode transition timing or scheduling

---

## 3. Rollout Mode Enum (Closed)

### 3.1 Canonical Values

| Code     | Description                                                                 |
| -------- | --------------------------------------------------------------------------- |
| DORMANT  | Enforcement inactive; no policy evaluation occurs                           |
| SHADOW   | Enforcement evaluates but does not affect outbound; logging only            |
| CANARY   | Enforcement active for a restricted target subset; receipts required        |
| ENFORCED | Enforcement fully active; policy violations halt or modify outbound effects |
| LOCKED   | Enforcement immutable; no mode transitions permitted until explicit unlock  |

### 3.2 Enum Closure Declaration

This enum is closed. No additional rollout_mode values are permitted. Any value
not in this enum is UNKNOWN and MUST trigger halt behavior per Section 6.

---

## 4. Environment Enum Binding

### 4.1 Canonical Values (from CONSTITUTION_v1.0 Section 2.3)

| Environment | Purpose                |
| ----------- | ---------------------- |
| dev         | Local development      |
| staging     | Pre-production testing |
| prod        | Production serving     |

### 4.2 Binding Authority

The environment enum is defined in CONSTITUTION_v1.0 and is referenced here by
binding. This contract does NOT define the environment enum; it binds to the
Constitutional definition.

---

## 5. Allowed Mode Matrix

### 5.1 Environment-to-Mode Mapping

| Environment | DORMANT | SHADOW         | CANARY      | ENFORCED    | LOCKED      |
| ----------- | ------- | -------------- | ----------- | ----------- | ----------- |
| dev         | ALLOWED | ALLOWED        | NOT ALLOWED | NOT ALLOWED | NOT ALLOWED |
| staging     | ALLOWED | ALLOWED        | ALLOWED     | NOT ALLOWED | NOT ALLOWED |
| prod        | ALLOWED | **PROHIBITED** | ALLOWED     | ALLOWED     | ALLOWED     |

### 5.2 Prohibition Rules

- **PROD MUST NOT support SHADOW mode.** This is absolute and non-negotiable.
- dev and staging environments MUST NOT run ENFORCED or LOCKED modes.
- CANARY mode MUST NOT be used in dev (no meaningful restriction target).
- LOCKED mode MUST only be available in prod after reaching ENFORCED state.

### 5.3 Matrix Invariants

- The allowed mode matrix is closed and immutable.
- Any mode not marked ALLOWED for an environment is PROHIBITED.
- Prohibited mode activation MUST trigger freeze behavior.
- Matrix modification requires Constitutional amendment (MAJOR version bump).

---

## 6. Violation Handling

### 6.1 SHADOW in PROD Violation

If `environment=prod` AND `rollout_mode=SHADOW`:

1. The system MUST immediately transition to FROZEN state.
2. The freeze MUST be recorded with a canonical `freeze_reason_code` (reference
   FREEZE_REASON_CODE_CANON_v1.0).
3. Outbound distribution MUST halt.
4. The violation MUST be logged in the operational audit log.
5. No auto-recovery is permitted; explicit operator unfreeze is required.

### 6.2 Unknown Mode Handling

If `rollout_mode` is not a value in the Section 3.1 enum:

1. The system MUST treat the mode as UNKNOWN.
2. UNKNOWN MUST halt all outbound effects (fail-closed).
3. UNKNOWN MUST be logged as an integrity violation.
4. UNKNOWN MUST trigger operational alert.

### 6.3 Matrix Violation Handling

If any environment attempts to activate a mode marked NOT ALLOWED or PROHIBITED:

1. The mode transition MUST be rejected.
2. The rejection MUST be logged.
3. If the mode was somehow activated (e.g., configuration corruption), FROZEN
   state MUST be triggered.

---

## 7. Mode Transition Rules

### 7.1 Valid Transitions (per environment)

**dev:**

- DORMANT <-> SHADOW

**staging:**

- DORMANT <-> SHADOW <-> CANARY

**prod:**

- DORMANT -> CANARY -> ENFORCED -> LOCKED
- LOCKED -> ENFORCED (explicit unlock)
- ENFORCED -> CANARY (rollback permitted)
- CANARY -> DORMANT (emergency rollback)

### 7.2 Transition Invariants

- Transitions MUST be recorded in operational audit log.
- Transitions MUST include: `from_mode`, `to_mode`, `environment`, `timestamp`,
  `actor`.
- Invalid transitions MUST be rejected.
- No direct transition to UNKNOWN is permitted; UNKNOWN is a fault state only.

---

## 8. Relationship to Freeze State

### 8.1 Priority Order

When determining operational behavior, the following priority applies:

1. FROZEN (highest priority — overrides all modes)
2. UNKNOWN (second priority — halts outbound)
3. rollout_mode value (standard operation)

### 8.2 Freeze Binding

- FROZEN state MUST halt outbound regardless of rollout_mode.
- UNKNOWN mode MUST behave as if FROZEN for outbound effects.
- DORMANT mode does not conflict with FROZEN; both result in no enforcement.

---

## 9. Audit Sweep Patterns

### 9.1 Absence Patterns (MUST NOT appear)

| Pattern                          | Location          | Meaning                  |
| -------------------------------- | ----------------- | ------------------------ |
| prod with SHADOW as allowed      | Any mode matrix   | SHADOW permitted in prod |
| rollout_mode values outside enum | Any configuration | Enum violation           |
| Environment values outside enum  | Any configuration | Environment violation    |

### 9.2 Presence Patterns (MUST appear)

| Pattern                     | Location                   | Meaning        |
| --------------------------- | -------------------------- | -------------- |
| SHADOW prohibition for prod | Mode matrix definition     | Prod safety    |
| UNKNOWN handling rule       | Violation handling section | Fail-closed    |
| Freeze binding reference    | Relationship section       | Priority model |

---

## 10. Acceptance Criteria (Binary)

| Criterion                                               | Result    |
| ------------------------------------------------------- | --------- |
| rollout_mode enum is closed with exactly 5 values       | PASS/FAIL |
| environment enum binds to CONSTITUTION_v1.0             | PASS/FAIL |
| Allowed mode matrix explicitly prohibits SHADOW in prod | PASS/FAIL |
| SHADOW in prod triggers FROZEN state                    | PASS/FAIL |
| UNKNOWN mode triggers halt (fail-closed)                | PASS/FAIL |
| Mode transitions are logged                             | PASS/FAIL |
| Freeze priority order is defined                        | PASS/FAIL |
| No prod allows shadow anywhere in document              | PASS/FAIL |

**PASS:** All criteria satisfied. **FAIL:** Any criterion not satisfied.

---

## 11. Canonical Binding

This contract binds to:

- **CONSTITUTION_v1.0** — Supreme design-layer authority; environment enum
  source
- **PHASE_5_REPOSITORY_TRUTH_RATIFICATION_v1.0** — Build/runtime separation;
  enforcement boundary
- **PROOF_RECEIPTS_STANDARD_v1.0** — Receipt requirements for mode transitions
- **FREEZE_REASON_CODE_CANON_v1.0** — Canonical freeze codes for violations
- **FAIL_CLOSED_BOOT_SPEC_v1.0** — Fail-closed boot behavior reference

---

## 12. Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

## 13. Final Declaration

Rollout mode is a closed enum. SHADOW mode is absolutely prohibited in
production. Unknown modes halt outbound. FROZEN state overrides all modes. This
contract establishes the rollout mode layer required for enforcement activation.

Failure to comply with this contract invalidates enforcement activation.

---

**End of Document**
