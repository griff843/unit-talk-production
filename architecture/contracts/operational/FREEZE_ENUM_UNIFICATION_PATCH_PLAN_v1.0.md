# FREEZE_ENUM_UNIFICATION_PATCH_PLAN_v1.0

**Version:** v1.0  
**Phase:** Phase 4 — Operational Determinism  
**Status:** DESIGN ONLY  
**Strategy:** B — Normalize aggressively (remove suffix variants; single
canonical vocabulary)

---

## 1. Purpose

This patch plan defines the deterministic, design-only steps to eliminate all
`freeze_reason_code` enum drift by:

1. Establishing `FREEZE_REASON_CODE_CANON_v1.0` as the single source of truth.
2. Removing all local `freeze_reason_code` enums from other contracts.
3. Normalizing legacy variants into canonical codes.
4. Updating all references to use canonical codes only.
5. Re-running Phase 4 cluster audit after alignment.

No implementation guidance is permitted in this document.

---

## 2. Canonical Source of Truth

`freeze_reason_code` MUST be defined only in:

- `FREEZE_REASON_CODE_CANON_v1.0`

All other contracts must reference it and must not contain local enum lists.

---

## 3. Documents In Scope

The following Phase 4 contracts MUST be updated to remove local freeze enums and
reference the canon:

1. `FREEZE_AUTHORITY_MODEL_v1.0`
2. `FREEZE_DETECTION_LAW_v1.0`
3. `SLO_REGISTRY_TABLE_v1.0`
4. `COMMAND_CENTER_TRUTH_MODEL_v1.0`
5. `OBSERVABILITY_INVARIANTS_v1.0`
6. `OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1` (ensure freeze entries use canonical
   codes)

---

## 4. Normalization Rules (Aggressive)

### 4.1 Suffix Removal

The following suffix patterns are forbidden:

- `_CRITICAL`
- `_FAIL`
- `_FAILURE_DETECTED`
- `_DETECTED`

All such variants MUST be normalized to the canonical codes in
`FREEZE_REASON_CODE_CANON_v1.0`.

### 4.2 Semantic Preservation

Normalization must preserve meaning:

- Severity and incident tiering are handled by incident classification and SLO
  registry tier fields, not by code suffixes.
- A code name must describe the breach type, not its tier.

### 4.3 No Aliases

Aliases are forbidden.

After alignment:

- Only canonical identifiers may appear anywhere in Phase 4 contracts.

---

## 5. Required Contract Edits (By File)

### 5.1 FREEZE_AUTHORITY_MODEL_v1.0

**Remove:**

- Any locally defined `freeze_reason_code` enum list.

**Add:**

- A reference statement:
  - `freeze_reason_code` values are defined exclusively in
    `FREEZE_REASON_CODE_CANON_v1.0`.

**Normalize:**

- Replace any local/legacy codes with canonical codes (see §6).

---

### 5.2 FREEZE_DETECTION_LAW_v1.0

**Remove:**

- Section defining freeze reason codes as a local closed enum.

**Add:**

- Reference statement binding to `FREEZE_REASON_CODE_CANON_v1.0`.

**Normalize:**

- Ensure every trigger emits a canonical code only (see §6).

---

### 5.3 SLO_REGISTRY_TABLE_v1.0

**Normalize:**

- Every `freeze_reason_code` field value MUST be canonical.

**Remove:**

- Any non-canonical variants.

**Add:**

- Binding rule:
  - Every registry entry `freeze_reason_code` MUST exist in
    `FREEZE_REASON_CODE_CANON_v1.0`.

---

### 5.4 COMMAND_CENTER_TRUTH_MODEL_v1.0

**Add:**

- Audit Binding section:
  - Operational truth MUST be reconstructable from audit replay ordered by
    `(environment, stream_id, seq)` as defined in
    `OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1`.
- Freeze Binding section:
  - Any active freeze with a canonical `freeze_reason_code` MUST force Command
    Center state to `FROZEN`.

**Remove:**

- Any implied ability for Command Center to define freeze codes or interpret
  non-canonical codes.

---

### 5.5 OBSERVABILITY_INVARIANTS_v1.0

**Add:**

- Required observability signal that reports canonical freeze reason:
  - `freeze_reason_code` MUST be one of the canonical values.

**Add:**

- Audit integrity signals required to support `AUDIT_LOG_INTEGRITY_FAIL`
  detection:
  - hash-chain validity
  - seq monotonicity status
  - cross-environment contamination counter
  - clock skew violation counters

No other freeze code definitions permitted.

---

### 5.6 OPERATIONAL_AUDIT_LOG_CONTRACT_v1.1

**Normalize:**

- Any freeze-related audit entry must record `freeze_reason_code` using
  canonical values only.

**Add:**

- Binding statement:
  - Freeze reason codes used in audit events MUST be defined in
    `FREEZE_REASON_CODE_CANON_v1.0`.

---

## 6. Canonical Mapping Table (Legacy → Canonical)

All mappings below are mandatory and exclusive.

| Legacy / Variant Value              | Canonical Value                   |
| ----------------------------------- | --------------------------------- |
| `SLO_FREEZE_BREACH`                 | `HEALTH_SIGNAL_INTEGRITY_FAIL`    |
| `CONSUMER_STALL_CRITICAL`           | `CONSUMER_STALL`                  |
| `RETRY_SATURATION_CRITICAL`         | `RETRY_SATURATION`                |
| `DLQ_SURGE_CRITICAL`                | `DLQ_SURGE`                       |
| `DISCORD_DELIVERY_FAILURE_DETECTED` | `DISCORD_DELIVERY_INTEGRITY_FAIL` |
| `SETTLEMENT_STALL_CRITICAL`         | `SETTLEMENT_STALL`                |
| `AUDIT_LOG_INTEGRITY_FAIL`          | `AUDIT_LOG_INTEGRITY_FAIL`        |
| `HEALTH_SIGNAL_INTEGRITY_FAIL`      | `HEALTH_SIGNAL_INTEGRITY_FAIL`    |
| `UNKNOWN_STATE_TIMEOUT`             | `UNKNOWN_STATE_TIMEOUT`           |
| `COMMAND_CENTER_TRUTH_DIVERGENCE`   | `COMMAND_CENTER_TRUTH_DIVERGENCE` |
| `CROSS_ENV_CONTAMINATION`           | `CROSS_ENV_CONTAMINATION`         |

If any legacy value exists outside this table, Phase 4 determinism is violated.

---

## 7. Drift Elimination Rules

After applying this patch plan:

1. No Phase 4 document may contain a standalone freeze reason enum list.
2. All freeze-related references MUST use canonical identifiers only.
3. Any appearance of a forbidden suffix pattern is an automatic FAIL.
4. Any appearance of a legacy value not in §6 is an automatic FAIL.

---

## 8. Acceptance Criteria (Binary)

PASS only if all are true:

1. `FREEZE_REASON_CODE_CANON_v1.0` exists and is referenced by all in-scope
   documents.
2. No local `freeze_reason_code` enums remain in any in-scope document.
3. All `freeze_reason_code` values in all in-scope documents match canonical
   identifiers exactly.
4. The mapping table in §6 covers every legacy value previously present.
5. Command Center truth model is bound to audit ordering contract and freeze
   canon.
6. Observability invariants include audit integrity signals sufficient to
   support `AUDIT_LOG_INTEGRITY_FAIL`.

FAIL if any condition is not met.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
