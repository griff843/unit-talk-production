# CANARY_SCOPE_AND_RECEIPTS_CONTRACT_v1.0

**Version:** v1.0
**Phase:** Phase 8 — Rollout Canon
**Status:** RATIFIED
**Ratified:** 2026-02-27 (UTC)
**Enforcement State:** RATIFIED

---

## 1. Purpose

This contract defines canary blast radius constraints, canary receipt requirements, and canary reversibility rules. Canary mode is a restricted enforcement state that requires explicit target scoping and receipt production.

---

## 2. Scope

### 2.1 In Scope

- Canary target restriction concepts
- Canary receipt minimum set
- Canary reversibility requirements
- Canary-to-ENFORCED promotion criteria
- Canary blast radius constraints

### 2.2 Out of Scope

- Implementation-layer canary routing logic
- Specific target selection algorithms
- Database schema for canary configuration
- Canary percentage or sample rate calculations

---

## 3. Canary Definition

### 3.1 Canary Mode

CANARY mode (per ROLLOUT_MODE_CANON_v1.0) is an enforcement state where:

- Enforcement is active for a restricted target subset
- Full enforcement behavior applies within the subset
- Effects outside the subset are unaffected
- Receipts are required for all canary operations

### 3.2 Canary Purpose

Canary mode exists to:

- Validate enforcement behavior before full rollout
- Limit blast radius of enforcement errors
- Produce evidence of correct enforcement operation
- Enable safe rollback if issues are detected

---

## 4. Canary Target Restriction

### 4.1 Restriction Principle

Canary target restriction MUST be explicit. Implicit targeting (e.g., "random subset") is insufficient. The restriction MUST identify a specific, bounded target set.

### 4.2 Allowed Restriction Types (Closed Concept)

| Restriction Type      | Description                                                |
|-----------------------|------------------------------------------------------------|
| Single Webhook        | Canary applies to exactly one webhook endpoint             |
| Single Channel        | Canary applies to exactly one distribution channel         |
| Single Routing Target | Canary applies to exactly one routing target identifier    |
| Explicit Target Set   | Canary applies to an enumerated set of target identifiers  |

### 4.3 Restriction Requirements

- The restriction MUST be declared before canary activation.
- The restriction MUST be immutable for the duration of the canary period.
- The restriction MUST be recorded in canary configuration.
- Modification of restriction MUST deactivate and re-activate canary mode.

### 4.4 Blast Radius Invariants

| ID      | Invariant Statement                                              |
|---------|------------------------------------------------------------------|
| CR-001  | Canary target MUST be explicitly defined, not implicitly sampled |
| CR-002  | Canary scope MUST be bounded and enumerable                      |
| CR-003  | Canary scope MUST NOT expand without explicit reconfiguration    |
| CR-004  | Canary effects MUST NOT leak to non-canary targets               |

---

## 5. Canary Receipt Requirements

### 5.1 Receipt Binding

Canary mode MUST produce receipt artifacts per PROOF_RECEIPTS_STANDARD_v1.0. Canary receipts are a subset of PR_CONTRACT category.

### 5.2 Receipt Minimum Set

Every canary operation MUST produce a receipt containing:

| Field             | Description                                             |
|-------------------|---------------------------------------------------------|
| receipt_reference | Unique identifier for this receipt                      |
| environment       | Environment where canary is active (staging or prod)    |
| policy_version    | Version of enforcement policy being tested              |
| idempotency_key   | Key ensuring receipt uniqueness for the operation       |
| external_id       | External identifier of affected target (webhook, etc.)  |
| timestamp         | UTC timestamp of receipt generation                     |
| canary_scope_id   | Identifier of the canary scope configuration            |
| enforcement_result| Result of enforcement (PASS, FAIL, SKIP)               |

### 5.3 Receipt Invariants

| ID      | Invariant Statement                                           |
|---------|---------------------------------------------------------------|
| CR-005  | Canary MUST produce receipt for every enforcement decision    |
| CR-006  | Receipt MUST include all minimum set fields                   |
| CR-007  | Receipt MUST be immutable after generation                    |
| CR-008  | Missing receipt MUST invalidate canary operation              |

---

## 6. Canary Reversibility

### 6.1 Reversibility Principle

Canary MUST be reversible. Rollback from canary to DORMANT (or prior state) MUST NOT require data mutation outside allowed surfaces.

### 6.2 Allowed Rollback Surfaces

Canary rollback MAY modify:

- Rollout mode configuration (mode transition)
- Canary scope configuration (scope removal)
- Operational audit log (rollback event recording)

Canary rollback MUST NOT modify:

- Distributed external state (already-sent messages)
- Business data outside canary scope
- Historical receipts (immutable)
- Audit log entries (append-only)

### 6.3 Reversibility Invariants

| ID      | Invariant Statement                                                   |
|---------|-----------------------------------------------------------------------|
| CR-009  | Canary rollback MUST be achievable via mode transition only           |
| CR-010  | Canary rollback MUST NOT require external state mutation              |
| CR-011  | Canary rollback MUST be recorded in operational audit log             |
| CR-012  | Already-executed canary effects are not reversed (forward-only)       |

### 6.4 Rollback vs Revert Clarification

- **Rollback:** Transitioning mode from CANARY to DORMANT or prior state.
- **Revert:** Undoing effects already executed during canary period.

Rollback is permitted and expected. Revert is NOT required and NOT guaranteed. Canary effects that have already occurred (e.g., enforcement on a message) remain in place.

---

## 7. Canary-to-ENFORCED Promotion

### 7.1 Promotion Criteria

Before promoting from CANARY to ENFORCED, the following MUST be verified:

| Criterion                                         | Verification Method              |
|---------------------------------------------------|----------------------------------|
| Canary period duration met                        | Timestamp comparison             |
| No canary enforcement failures detected           | Receipt analysis                 |
| Receipt completeness verified                     | Receipt count vs operation count |
| Canary scope functioned correctly                 | Scope boundary verification      |
| No FROZEN or UNKNOWN states during canary         | State history check              |

### 7.2 Promotion Process (Design-Level)

Promotion from CANARY to ENFORCED:

1. Collect all canary receipts for the canary period.
2. Verify all promotion criteria are satisfied.
3. Record promotion decision in operational audit log.
4. Transition rollout_mode from CANARY to ENFORCED.
5. Generate promotion receipt.

### 7.3 Promotion Invariants

| ID      | Invariant Statement                                                |
|---------|--------------------------------------------------------------------|
| CR-013  | Promotion MUST NOT occur if any promotion criterion fails          |
| CR-014  | Promotion MUST be recorded with complete receipt evidence          |
| CR-015  | Promotion MUST NOT skip canary period (no direct DORMANT->ENFORCED)|

---

## 8. Canary in Environment Context

### 8.1 Environment Rules

| Environment | Canary Permitted | Notes                                    |
|-------------|------------------|------------------------------------------|
| dev         | NOT PERMITTED    | No meaningful restriction target in dev  |
| staging     | PERMITTED        | Testing canary behavior                  |
| prod        | PERMITTED        | Production canary rollout                |

### 8.2 SHADOW Prohibition Reminder

Per ROLLOUT_MODE_CANON_v1.0, SHADOW mode is PROHIBITED in prod. Canary is NOT a substitute for SHADOW. Canary applies full enforcement to a restricted subset; SHADOW applies no enforcement but logs.

---

## 9. Audit Sweep Patterns

### 9.1 Absence Patterns (MUST NOT appear)

| Pattern | Location | Meaning |
|---------|----------|---------|
| Implicit canary targeting | Target restriction | Unbounded canary scope |
| Canary without receipts | Receipt requirements | Missing accountability |
| Canary revert requirement | Reversibility | Over-promising rollback |

### 9.2 Presence Patterns (MUST appear)

| Pattern | Location | Meaning |
|---------|----------|---------|
| Explicit target restriction | Section 4 | Bounded canary scope |
| Receipt minimum set | Section 5 | Receipt completeness |
| Reversibility via mode transition | Section 6 | Safe rollback path |
| Promotion criteria | Section 7 | Controlled escalation |

---

## 10. Acceptance Criteria (Binary)

| Criterion | Result |
|-----------|--------|
| Canary target restriction is explicit (not implicit) | PASS/FAIL |
| Allowed restriction types are defined | PASS/FAIL |
| Receipt minimum set includes all 8 required fields | PASS/FAIL |
| Receipts bind to PROOF_RECEIPTS_STANDARD_v1.0 | PASS/FAIL |
| Reversibility via mode transition is documented | PASS/FAIL |
| Rollback does not require external state mutation | PASS/FAIL |
| Promotion criteria are defined | PASS/FAIL |
| SHADOW prohibition in prod is referenced | PASS/FAIL |

**PASS:** All criteria satisfied.
**FAIL:** Any criterion not satisfied.

---

## 11. Invariant Registry (Closed)

| ID      | Invariant Statement                                                   |
|---------|-----------------------------------------------------------------------|
| CR-001  | Canary target MUST be explicitly defined, not implicitly sampled      |
| CR-002  | Canary scope MUST be bounded and enumerable                           |
| CR-003  | Canary scope MUST NOT expand without explicit reconfiguration         |
| CR-004  | Canary effects MUST NOT leak to non-canary targets                    |
| CR-005  | Canary MUST produce receipt for every enforcement decision            |
| CR-006  | Receipt MUST include all minimum set fields                           |
| CR-007  | Receipt MUST be immutable after generation                            |
| CR-008  | Missing receipt MUST invalidate canary operation                      |
| CR-009  | Canary rollback MUST be achievable via mode transition only           |
| CR-010  | Canary rollback MUST NOT require external state mutation              |
| CR-011  | Canary rollback MUST be recorded in operational audit log             |
| CR-012  | Already-executed canary effects are not reversed (forward-only)       |
| CR-013  | Promotion MUST NOT occur if any promotion criterion fails             |
| CR-014  | Promotion MUST be recorded with complete receipt evidence             |
| CR-015  | Promotion MUST NOT skip canary period (no direct DORMANT->ENFORCED)   |

---

## 12. Canonical Binding

This contract binds to:

- **CONSTITUTION_v1.0** — Supreme design-layer authority; environment definitions
- **ROLLOUT_MODE_CANON_v1.0** — Canary mode definition and allowed matrix
- **PROOF_RECEIPTS_STANDARD_v1.0** — Receipt format and storage requirements
- **ENFORCEMENT_ACTIVATION_LAW_v1.0** — Enforcement surface and priority model
- **OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1** — Audit log format for canary events

---

## 13. Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

## 14. Final Declaration

Canary mode requires explicit target restriction, complete receipts, and mode-based reversibility. Canary is not SHADOW. Production SHADOW is prohibited; production CANARY is permitted. This contract establishes the canary scope and receipts layer required for rollout canon compliance.

Failure to comply with this contract invalidates canary mode operations.

---

**End of Document**
