# RECEIPT_VERIFICATION_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

Defines deterministic verification of successful external delivery.

Delivery is considered valid only if:

- Artifact exists
- Artifact matches intent_fingerprint
- Artifact matches target
- Artifact matches expected author identity
- Receipt stored atomically

No artifact → no delivery.

---

# 2. Core Invariants

| ID     | Invariant                                            |
| ------ | ---------------------------------------------------- |
| RV-001 | No DELIVERED without verified artifact               |
| RV-002 | Fingerprint must match exactly (full SHA256)         |
| RV-003 | Target binding must match stored target_id           |
| RV-004 | Author identity must match policy_version definition |
| RV-005 | Duplicate creation forbidden                         |
| RV-006 | Receipt write atomic with DELIVERED                  |
| RV-007 | Artifact lookup bounded                              |
| RV-008 | Receipt immutable post-DELIVERED                     |

Violation ⇒ FROZEN.

---

# 3. Fingerprint Binding Rule

intent_fingerprint MUST equal full SHA256(payload).

No truncation allowed.

Receipt verification MUST confirm artifact contains full fingerprint in
deterministic location.

Missing fingerprint ⇒ FROZEN.

---

# 4. Artifact Lookup Rules (Bounded)

## 4.1 Normal Delivery Path

Upon successful outbound call:

- receipt_reference captured immediately
- Artifact fetched directly via receipt_reference
- No search required

## 4.2 Crash Recovery Path

If receipt_reference unknown:

Lookup must:

- Be restricted to target_id
- Search only messages created between: created_at ≤ message.timestamp ≤ now_utc
- Match exact full intent_fingerprint
- Stop at first exact match

Unbounded search forbidden.

If multiple matches found ⇒ FROZEN.

---

# 5. Author Identity Binding

Each policy_version MUST define expected_author_identity.

For DISCORD_MESSAGE:

- Message author_id must equal expected_author_identity
- Webhook ID must match target_id

Mismatch ⇒ FROZEN.

---

# 6. Duplicate Detection Ordering

Before any outbound post attempt:

1. Check if state == DELIVERED → exit
2. If crash recovery scenario:
   - Perform bounded lookup
   - If artifact found → transition to DELIVERED
3. If no artifact found → proceed with outbound call

Duplicate artifact creation ⇒ FROZEN.

---

# 7. Atomic Transition Rule

DELIVERED transition requires atomic write of:

- state = DELIVERED
- receipt_reference
- receipt_payload
- receipt_payload_hash
- delivered_at (UTC ≥ created_at)

If crash occurs before commit:

- State remains IN_PROGRESS
- Crash recovery path must execute lookup

---

# 8. Receipt Immutability

Once state == DELIVERED:

The following fields are immutable:

- receipt_reference
- receipt_payload
- receipt_payload_hash
- delivered_at

Modification attempt ⇒ FROZEN.

---

# 9. Timestamp Rules

- delivered_at must be UTC
- delivered_at ≥ created_at
- delivered_at ≥ last_error_at (if present)

Violation ⇒ FROZEN.

---

# 10. Freeze Triggers (Receipt-Specific)

System MUST FROZEN if:

- intent_fingerprint missing
- intent_fingerprint mismatch
- Multiple artifacts match fingerprint
- Author identity mismatch
- target_id mismatch
- receipt fields missing in DELIVERED
- receipt mutated post-delivery
- Artifact found in wrong environment
- receipt lookup exceeds bounded window

---

# 11. Binary Acceptance Criteria

Contract accepted only if:

- Fingerprint format locked (full SHA256)
- Artifact lookup bounded
- Author identity binding defined
- Duplicate detection ordering defined
- Atomic state mutation defined
- Receipt immutability explicit
- Timestamp monotonicity defined
- Freeze triggers exhaustive
- No undefined receipt behavior

Otherwise ⇒ FAIL.

---

# 12. Deterministic Ordering Requirement

Receipt replay and ordering MUST respect deterministic ordering as defined by
OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1.

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

Receipt verification under Clean-Room Doctrine is:

- Artifact-bound
- Full-hash verified
- Target-bound
- Author-bound
- Crash-safe
- Immutable
- Deterministic
- Fail-closed

Delivery is proven, not assumed.
