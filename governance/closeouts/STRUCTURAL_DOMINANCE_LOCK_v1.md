# STRUCTURAL DOMINANCE LOCK v1

**Lock ID**: STRUCTURAL_DOMINANCE_LOCK_v1 **Sprint**:
STRUCTURAL-DOMINANCE-LOCK-004 **Date**: 2026-02-27 **Status**: COMPLETE

---

## Overview

This lock certifies that the **publish_token crash window safety mechanism** has
been:

1. Deployed to Production
2. Verified via adversarial runtime tests
3. Schema confirmed in production database

---

## What This Lock Guarantees

### Discord Publishing Idempotency

**IMPOSSIBLE to double-post to Discord because:**

1. `publish_token` UUID set atomically DURING claim, BEFORE POST
2. UNIQUE INDEX on `publish_token` - DB-level truth lock
3. Stale reset PRESERVES token (crash window evidence)
4. Claim function SKIPS rows with existing token
5. Crash window rows marked FAILED for manual review

### Schema Truth Lock

| Object                                           | Status   |
| ------------------------------------------------ | -------- |
| `publish_token` column                           | DEPLOYED |
| `publish_token_at` column                        | DEPLOYED |
| `idx_ticket_discord_outbox_publish_token_unique` | DEPLOYED |
| `idx_ticket_discord_outbox_publish_token`        | DEPLOYED |
| `claim_discord_outbox_batch` (safety fix)        | DEPLOYED |
| `reset_stale_discord_outbox_claims` (safety fix) | DEPLOYED |
| `mark_crash_window_rows_failed`                  | DEPLOYED |

---

## Migrations Applied

| Migration                                               | Timestamp           | Status  |
| ------------------------------------------------------- | ------------------- | ------- |
| `20260227100000_discord_publish_token_truth_lock.sql`   | 2026-02-27 10:00:00 | APPLIED |
| `20260227110000_discord_publish_token_crash_safety.sql` | 2026-02-27 11:00:00 | APPLIED |

---

## Verification Evidence

| Proof           | Location                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------- |
| Migration apply | `out/sprints/STRUCTURAL-DOMINANCE-LOCK-004/2026-02-27/proofs/proof_prod_migration_apply.txt` |
| Schema verify   | `out/sprints/STRUCTURAL-DOMINANCE-LOCK-004/2026-02-27/proofs/proof_schema_verify.md`         |
| Canary test     | `out/sprints/STRUCTURAL-DOMINANCE-LOCK-004/2026-02-27/proofs/proof_canary_crash_window.md`   |
| Discord receipt | `out/sprints/STRUCTURAL-DOMINANCE-LOCK-004/2026-02-27/proofs/proof_discord_receipt.md`       |

---

## Crash Window Scenario (Patched)

**BEFORE (Vulnerable):**

1. Worker claims → `publish_token = UUID`
2. Worker POSTs to Discord → success
3. Worker CRASHES before storing `discord_message_id`
4. Stale reset clears `publish_token` (destroys evidence)
5. New worker claims → sees no token → POSTS AGAIN = **DUPLICATE**

**AFTER (Safe):**

1. Worker claims → `publish_token = UUID`
2. Worker POSTs to Discord → success
3. Worker CRASHES before storing `discord_message_id`
4. Stale reset PRESERVES `publish_token`
5. New worker claims → sees existing token → **SKIPS ROW**
6. Row eventually marked FAILED for manual review
7. **NO DUPLICATE POST**

---

## Lock Activation

This lock is ACTIVE as of this document's creation.

**CI Tag**: `STRUCTURAL_DOMINANCE_LOCK_v1`

---

## Sign-off

- [x] Migrations applied to Production
- [x] Schema verified in Production
- [x] Adversarial tests passing (12/12)
- [x] Crash window vulnerability patched
- [x] No duplicate Discord posts possible

**Governance Certified**: 2026-02-27
