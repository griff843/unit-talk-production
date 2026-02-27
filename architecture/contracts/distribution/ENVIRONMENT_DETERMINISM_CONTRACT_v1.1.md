# ENVIRONMENT_DETERMINISM_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

Defines deterministic environment isolation and identity guarantees across:

- PROD
- STAGING
- DEV

Ensures no cross-environment routing, receipts, targets, or policy execution.

---

# 2. Core Invariants (Fail-Closed)

| ID      | Invariant                                         |
| ------- | ------------------------------------------------- |
| ENV-001 | Environment identity is explicit and required     |
| ENV-002 | Runtime env identity has a single source of truth |
| ENV-003 | Outbox env is immutable post-insert               |
| ENV-004 | Routing and idempotency are env-bound             |
| ENV-005 | Targets are unique per env (kind+id)              |
| ENV-006 | Receipts must bind to same env target set         |
| ENV-007 | Policy execution is env-bound                     |
| ENV-008 | Freeze is env-scoped only (closed set)            |
| ENV-009 | Supersession is same-env only                     |

Violation ⇒ FROZEN.

---

# 3. Environment Field Requirements (Outbox)

Every Outbox record MUST include:

- env ∈ {PROD, STAGING, DEV}

env MUST be immutable post-insert.

Missing env ⇒ FROZEN.

---

# 4. Runtime Environment Identity (Single Source of Truth)

The Consumer runtime MUST have an explicit environment identity value.

This identity MUST come from a single authoritative deployment manifest input
(not ad-hoc inference).

Rules:

- Consumer refuses to start if runtime env identity is missing.
- Consumer refuses to start if runtime env identity is not one of {PROD,
  STAGING, DEV}.
- Consumer refuses to process any record where record.env ≠ runtime env
  identity.

No other mechanism for env identity is permitted.

---

# 5. Target Isolation (Deterministic)

Targets are unique per environment.

“Same target” is defined as:

(target_kind, target_id)

Rules:

- A (target_kind, target_id) pair MUST NOT appear in more than one environment’s
  policy target lists.
- Target uniqueness is proven by policy content hash binding: policy_hash
  commits the full target list.

Cross-environment reuse ⇒ FROZEN.

---

# 6. Routing + Idempotency Environment Binding

env MUST be included in:

- routing_key computation
- idempotency_key computation
- policy resolution

Any mismatch between stored env and computed env usage ⇒ FROZEN.

---

# 7. Receipt Environment Binding

Receipt verification MUST confirm that:

- Artifact was created within the record’s target (kind+id)
- Target (kind+id) belongs to the same environment policy target list for that
  policy_version

Artifact found in target belonging to a different env ⇒ FROZEN.

---

# 8. Policy Environment Binding

policy_version resolution MUST be environment-bound.

A policy_version used for a record must be executed only within the record.env
runtime.

If policy resolved under different env runtime ⇒ FROZEN.

---

# 9. Freeze Scope (Closed Set)

Freeze is strictly scoped per environment.

Global freeze is not part of Phase 3 distribution determinism and is forbidden
here.

If freeze triggers in PROD:

- Only PROD processing halts.

---

# 10. Supersession Rules (Same-Env Only)

Supersession is defined as:

A new Outbox intent that references an older Outbox record via
supersedes_outbox_id.

Rules:

- Supersession MUST occur only within the same env.
- superseding_record.env must equal original_record.env
- Cross-environment “re-creation” is not supersession and must not use
  supersedes_outbox_id.

Cross-env supersession ⇒ FROZEN.

---

# 11. Drift Detection (Environment-Specific)

System MUST FROZEN if:

- record.env mutated
- runtime env identity missing
- runtime env identity ≠ record.env during processing
- (target_kind, target_id) appears in multiple env policy target lists
- receipt target belongs to different env policy list
- routing_key/idempotency_key computed without env

---

# 12. Binary Acceptance Criteria

Contract accepted only if:

- Outbox env explicit and immutable
- Runtime env identity single source of truth
- Consumer refuses mismatched env records
- Targets unique per env by (kind+id)
- Policy hash binds target list
- Routing/idempotency env-bound
- Receipt env-bound
- Freeze scope closed and env-only
- Supersession same-env only

Otherwise ⇒ FAIL.

---

# 13. Canonical Binding

- CONSTITUTION_v1.0 (supreme design-layer authority)
- OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1 (deterministic ordering and integrity)
- FREEZE_DETECTION_LAW_v1.1 (freeze trigger law)
- FREEZE_AUTHORITY_MODEL_v1.1 (freeze authority)
- FREEZE_REASON_CODE_CANON_v1.0 (canonical freeze enum authority)
- SLO_REGISTRY_TABLE_v1.1 (threshold authority)
- UNKNOWN_STATE_POLICY_v1.1 (unknown-state gating and escalation)

---

# 14. Final Declaration

Environment determinism is:

- Explicit
- Immutable
- Policy-bound
- Target-isolated
- Receipt-bound
- Freeze-scoped per env
- Fail-closed

No inference. No leakage. No ambiguity.
