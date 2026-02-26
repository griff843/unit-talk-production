# RECEIPT_VERIFICATION_CONTRACT_v1.0.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

This contract defines the deterministic receipt verification model for
confirming successful external delivery of Outbox records.

Receipt verification guarantees:

- Delivery authenticity
- Target binding correctness
- Payload binding correctness
- Idempotent external appearance
- Protection against spoofed or mismatched receipts
- Replay safety under crash recovery

Receipt verification is mandatory for transition to DELIVERED.

No receipt → no delivery.

---

# 2. Core Invariants (Fail-Closed)

| ID     | Invariant                                                   |
| ------ | ----------------------------------------------------------- |
| RV-001 | No delivery without verified receipt                        |
| RV-002 | Receipt must bind to target                                 |
| RV-003 | Receipt must bind to intent_payload                         |
| RV-004 | Receipt verification must be deterministic                  |
| RV-005 | Receipt must be stored atomically with DELIVERED transition |
| RV-006 | Duplicate detection must prevent double-post                |
| RV-007 | No trust in external platform alone                         |
| RV-008 | Any binding mismatch ⇒ FROZEN                               |

Violation ⇒ FROZEN.

---

# 3. Required Receipt Fields

To transition to DELIVERED, the following must be captured:

- receipt_type (closed enum)
- receipt_reference (platform identifier, e.g., message ID)
- receipt_payload (minimal platform response data)
- receipt_payload_hash (SHA256(receipt_payload))
- delivered_at (UTC timestamp)

All must be written atomically with state transition.

---

# 4. receipt_type (Closed Enum)

receipt_type ∈:

- DISCORD_MESSAGE
- FUTURE_PLATFORM (must be explicitly added in new version)

Unknown type ⇒ FROZEN.

---

# 5. Intent Fingerprint Binding

Each intent_payload MUST include:intent_fingerprint

intent_fingerprint MUST equal:payload_hash

(or a single deterministic truncation rule defined globally).

Receipt verification MUST confirm that the external artifact contains the
intent_fingerprint in a deterministic location (e.g., embed footer).

If fingerprint missing or mismatched ⇒ FROZEN.

---

# 6. Target Binding Verification

Receipt must be verified to match:

- target_kind
- target_id
- channel_target (logical)
- policy_version routing outcome

Verification must confirm:

- receipt_reference belongs to the expected target
- message was created in correct channel/webhook
- no cross-environment leakage

If target mismatch detected ⇒ FROZEN.

---

# 7. Duplicate Detection Model

Before posting OR during crash recovery:

Consumer must verify whether a message already exists with:

- Matching intent_fingerprint AND
- Matching target_id

If existing artifact found:

- Do not repost
- Transition to DELIVERED
- Store receipt_reference

If duplicate detected post-creation ⇒ FROZEN.

---

# 8. Crash Recovery Behavior

If crash occurs after external post but before state mutation:

Replay must:

1. Query external platform deterministically
2. Search for intent_fingerprint in target
3. If found:
   - Store receipt_reference
   - Transition to DELIVERED
4. If not found:
   - Proceed with retry logic

Crash must not produce duplicate message.

---

# 9. Receipt Authenticity Requirements

Receipt verification must not rely solely on:

- HTTP 200 status
- API acknowledgment without artifact retrieval

Verification requires artifact confirmation.

For DISCORD_MESSAGE:

- receipt_reference must be parseable as snowflake
- snowflake must correspond to existing message
- message author must match expected bot identity

If any authenticity check fails ⇒ FROZEN.

---

# 10. Atomic State Transition Rule

Transition to DELIVERED requires atomic write of:

- state = DELIVERED
- receipt fields
- delivered_at

Partial state mutation forbidden.

If crash occurs before commit ⇒ record remains IN_PROGRESS.

---

# 11. Replay Consistency Rule

On replay:

- Stored receipt_payload_hash must match recomputed hash
- intent_fingerprint must match stored payload_hash
- target binding must remain identical

Any mismatch ⇒ FROZEN.

---

# 12. Forbidden Behaviors

Strictly forbidden:

- Marking DELIVERED without receipt fields
- Trusting external success code without artifact verification
- Accepting receipt without fingerprint match
- Cross-environment receipt binding
- Modifying receipt fields after DELIVERED
- Skipping duplicate detection
- Allowing multiple receipts for same record

Violation ⇒ FROZEN.

---

# 13. Freeze Triggers (Receipt-Specific)

System MUST FROZEN if:

- intent_fingerprint mismatch
- receipt_reference mismatch with target
- receipt_payload_hash mismatch
- Missing receipt fields on DELIVERED
- Duplicate message detected
- Unknown receipt_type
- Receipt verification skipped
- Message author mismatch
- Cross-environment artifact detected

---

# 14. Binary Acceptance Criteria

Contract accepted only if:

- Receipt fields fully defined
- Fingerprint binding explicit
- Target binding explicit
- Duplicate detection defined
- Crash recovery deterministic
- Atomic transition rule explicit
- Authenticity verification defined
- Freeze triggers exhaustive
- No undefined receipt behavior exists

Otherwise ⇒ FAIL.

---

# 15. Final Declaration

Receipt verification under Clean-Room Doctrine is:

- Deterministic
- Artifact-validated
- Fingerprint-bound
- Target-bound
- Crash-safe
- Idempotent
- Fail-closed

Delivery is not assumed. Delivery is proven.
