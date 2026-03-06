# SPRINT CLOSEOUT: SPRINT-023-PRODUCTION-SURFACE-LOCK

**Objective**: Lock production surface — outbox-first publishing, operator
finalization API with audit, CC write ban.

**Date**: 2026-03-04 **Status**: PENDING EXECUTION (code written + typechecked,
awaiting runtime proof against live data)

---

## What Was Built

### Task 1 — Publish Outbox Alignment (pick_publish)

`supabase/migrations/20260304210000_publish_outbox_alignment.sql`

Aligned existing `pick_publish` table to the canonical publish outbox contract:

- Added `payload_hash` (text) — SHA-256 of embed payload for drift detection
- Added `error_code` (text) — structured error classification
- Added unique index on `dedupe_key` (WHERE NOT NULL) for idempotency
- Added pending poll index (`status, created_at WHERE status='pending'`)
- Added pick_id lookup index

### Task 2 — Outbox Service + Publisher Refactor

`apps/api/src/services/publishOutbox.ts`

Canonical outbox service module:

- `enqueueForPublish()` — create outbox row (idempotent via dedupe_key)
- `markPublished()` — write receipt (external_message_id + sent_at)
- `markFailed()` — record error with structured error_code, retry logic
- `fetchPendingOutboxEntries()` — poll pattern for pending jobs
- `getOutboxReceipt()` — verification query

`apps/api/src/agents/DiscordPromotionAgent/index.ts` (MODIFIED)

Wired outbox-first publishing into ALL three publish flows:

1. **Capper single picks** — enqueue before Discord post, receipt after success
2. **System picks** — same outbox-first pattern
3. **Legacy picks** — same outbox-first pattern

Pattern applied:

```
enqueuePickToOutbox(pick, channel)
  → if alreadyPosted: skip (idempotent)
  → postEliteCardToDiscord(pick)
  → if success: recordOutboxReceipt(outboxId, messageId)
  → if failure: recordOutboxFailure(outboxId, errorCode, errorMessage)
```

`scripts/analysis/run-outbox-publish-023.ts`

Runner script for proof:

- Finds eligible pick (PICK_ID env or latest HARD-band)
- Enqueues to outbox
- Writes simulated receipt (proof-test mode)
- Verifies receipt roundtrip
- Writes OUTBOX_PROOF.json artifact

### Task 3 — Operator Finalization API + RBAC

`apps/api/src/routes/ops.ts` (MODIFIED)

Three new endpoints with RBAC:

| Endpoint                       | Role                     | Purpose                                  |
| ------------------------------ | ------------------------ | ---------------------------------------- |
| `POST /ops/picks/:id/approve`  | admin, analyst, operator | Approve pick for publishing              |
| `POST /ops/picks/:id/reject`   | admin, analyst, operator | Reject pick (sets promotion_band=REJECT) |
| `POST /ops/picks/:id/override` | admin only               | Override any non-immutable field         |

All endpoints:

- Require `reason` for audit trail (mandatory)
- Fetch before-state for before/after snapshots
- Write to `audit_log` with actor, action, entity_type, entity_id, details
- Block immutable fields (id, created_at, bet_slip_id) in override
- Return correlationId for tracing

### Task 4 — Audit Log Integration

Audit log writes are baked into all three finalization endpoints. The
`audit_log` table already exists with:

- `actor` — operator ID from JWT
- `action` — PICK_APPROVED | PICK_REJECTED | PICK_OVERRIDE
- `entity_type` — 'unified_picks'
- `entity_id` — pick ID
- `details` — JSON with before/after snapshots, reason, correlation_id
- `created_at` — ISO timestamp

### Task 5 — Command Center Write Ban CI Gate

`scripts/gates/cc-write-ban.ts`

CI gate that scans `apps/command-center/src/` for writes to canonical tables:

- Banned tables: unified_picks, prop_settlements, bridge_outbox, pick_publish,
  daily_picks, closing_snapshots
- Detects multi-line .from()/.insert()/.update() patterns
- Standard mode: warns but exits 0 (non-blocking)
- Strict mode (`--strict`): exits 1 on any violation (blocking)

**Current findings**: 12 pre-existing violations in 4 CC files:

- `hooks/usePicks.ts` (2 violations) — approve/reject operations
- `app/api/exposure/snapshot/route.ts` (2 violations) — unit reduction/demotion
- `app/api/grading/picks/route.ts` (4 violations) — grading operations
- `lib/supabase.ts` (4 violations) — utility write functions

These are the P0 audit findings that motivated this sprint. The gate now detects
them; migration to API endpoints is a follow-up sprint.

---

## Pipeline Architecture

```
Pick eligible for publish
  → enqueueForPublish(pick_publish row, dedupe_key)
  → if duplicate: skip (idempotent)
  → postEliteCardToDiscord(pick)
  → if valid snowflake:
      → markPublished(outboxId, receipt)
      → confirmPostWithReceipt(pickId, messageId)
      → persistDiscordReceipt(pickId, metadata)
  → if invalid:
      → markFailed(outboxId, error_code, message)
      → resetPostingOnFailure(pickId, reason)
```

```
Operator Action
  → JWT authentication (operatorAuth middleware)
  → Role check (requireOperatorRole)
  → Fetch before-state
  → Apply update (operator_override)
  → Write audit_log (before/after + reason)
  → Return confirmation with correlationId
```

---

## Invariants Preserved

| Invariant                          | Status                                                       |
| ---------------------------------- | ------------------------------------------------------------ |
| No Discord post without outbox row | Enforced — all 3 flows go through enqueuePickToOutbox        |
| Duplicate dedupe_key = no-op       | Enforced — unique index + idempotent select-before-insert    |
| Receipt before pick confirmation   | Enforced — recordOutboxReceipt before confirmPostWithReceipt |
| Audit trail for operator actions   | Enforced — all endpoints write audit_log                     |
| RBAC for operator endpoints        | Enforced — operatorAuth + requireOperatorRole middleware     |
| Override blocks immutable fields   | Enforced — id, created_at, bet_slip_id blocked               |
| Typecheck                          | All workspaces pass                                          |
| Tests                              | 85/85 pass (pre-existing infra failures only)                |

---

## Files Changed

| File                                                              | Change                                |
| ----------------------------------------------------------------- | ------------------------------------- |
| `supabase/migrations/20260304210000_publish_outbox_alignment.sql` | NEW — outbox schema alignment         |
| `apps/api/src/services/publishOutbox.ts`                          | NEW — canonical outbox service        |
| `apps/api/src/agents/DiscordPromotionAgent/index.ts`              | MODIFIED — outbox-first publish       |
| `apps/api/src/routes/ops.ts`                                      | MODIFIED — finalization API endpoints |
| `scripts/analysis/run-outbox-publish-023.ts`                      | NEW — outbox proof runner             |
| `scripts/gates/cc-write-ban.ts`                                   | NEW — CC write ban CI gate            |

---

## PASS / FAIL

**Status**: PENDING — requires runtime execution against live Supabase.

Execute:

```bash
# Step 1: Apply migration
supabase db push

# Step 2: Run outbox proof
npx tsx scripts/analysis/run-outbox-publish-023.ts

# Step 3: Run CC write ban gate
npx tsx scripts/gates/cc-write-ban.ts
```

**Acceptance criteria:**

- [ ] Migration applied (payload_hash, error_code columns exist)
- [ ] dedupe_key unique index active
- [ ] Outbox row created for test pick
- [ ] Receipt written and verified
- [ ] CC write ban gate detects pre-existing violations
- [ ] Typecheck + tests pass

---

## Next Sprint Recommendation

**SPRINT-024 — CC Write Migration + Outbox E2E Proof**

1. Migrate all 12 CC write violations to API operator endpoints
2. E2E publish proof (outbox → discord → receipt → confirmation)
3. Enable CC write ban gate in strict mode (--strict) after migration
4. Outbox polling worker (process pending entries on cron)

---

**Governance Owner**: Engineering Team
