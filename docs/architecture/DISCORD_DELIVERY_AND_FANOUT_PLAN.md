# Discord Delivery and Fanout Plan

**Sprint**: SPRINT-DISCORD-TRUTH-AND-FANOUT-096 **Status**: Phase A - Planning
**Date**: 2026-02-24 **Author**: Claude (AI Assistant)

---

## Executive Summary

This document defines the canonical Discord posting architecture, identifies the
current failure modes preventing Discord delivery, and outlines a plan to
restore pick posting with settlement fanout and recap generation. All messages
will route through a single canary channel during validation.

---

## 1. Canonical Posting Path

### 1.1 Architecture Overview

There are **two canonical posting paths** in the system:

| Path               | Outbox Table            | Consumer                | Use Case                         |
| ------------------ | ----------------------- | ----------------------- | -------------------------------- |
| **Ticket Path**    | `ticket_discord_outbox` | `DiscordTicketWorker`   | Smart Form submissions (V3)      |
| **Promotion Path** | `unified_picks`         | `DiscordPromotionAgent` | Graded picks with promotion_band |

**Current State**: Neither path is posting to Discord. Root cause: Environment
variables not configured or workers not enabled.

### 1.2 Ticket Path (Recommended Primary Path)

**Source Files:**

- `apps/api/src/consumers/DiscordTicketWorker.ts`
- `supabase/migrations/20260220230001_ticket_discord_outbox_compliant.sql`
- `supabase/migrations/20260221160000_discord_outbox_routing_claim.sql`

**Flow:**

```
Smart Form → POST /api/v3/submit-ticket
          → bridge_outbox (status: pending)
          → BridgeWorker promotes to unified_picks
          → enqueue_ticket_discord_outbox_v2() RPC
          → ticket_discord_outbox (status: pending)
          → DiscordTicketWorker.claimBatch() (status: processing)
          → POST to Discord webhook with ?wait=true
          → Receive message_id (snowflake)
          → releaseClaim() (status: posted, discord_message_id stored)
```

**Key DB Operations:**

- `claim_discord_outbox_batch()` - Atomic claim with SKIP LOCKED
- `release_discord_outbox_claim()` - Mark posted with receipt
- `mark_discord_outbox_failed()` - Mark failed with error
- `reset_stale_discord_outbox_claims()` - Recover hung claims

### 1.3 Promotion Path (Legacy/Parallel)

**Source Files:**

- `apps/api/src/agents/DiscordPromotionAgent/index.ts`
- `apps/api/src/lib/lifecycle/idempotency.ts`

**Flow:**

```
GradingAgent sets promotion_band='HARD' or meta.pick_origin='capper'
          → DiscordPromotionAgent polls unified_picks
          → atomicClaimForPost() (posted_to_discord: false → true)
          → buildPickPresentation() → buildEmbedFromPresentation()
          → POST to Discord webhook with ?wait=true
          → Receive message_id (snowflake)
          → confirmPostWithReceipt() → lifecycleUpdate()
          → persistDiscordReceipt() (meta.discord_receipt set)
```

---

## 2. Idempotency Enforcement

### 2.1 Ticket Discord Outbox

| Guard       | Mechanism                          | Location                         |
| ----------- | ---------------------------------- | -------------------------------- |
| **Insert**  | `ticket_id` UNIQUE constraint      | Migration line 18                |
| **Claim**   | `SELECT FOR UPDATE SKIP LOCKED`    | `claim_discord_outbox_batch()`   |
| **Status**  | Only pending/failed can be claimed | RPC line 228                     |
| **Release** | Atomic status transition           | `release_discord_outbox_claim()` |

**Duplicate Prevention:**

- `ON CONFLICT (ticket_id) DO NOTHING` in enqueue function
- Re-enqueue of same ticket returns existing row without new insert

### 2.2 Unified Picks (Promotion Path)

| Guard        | Mechanism                                  | Location               |
| ------------ | ------------------------------------------ | ---------------------- |
| **Claim**    | `WHERE posted_to_discord=false`            | `atomicClaimForPost()` |
| **Check**    | `checkPostIdempotency()` before claim      | `idempotency.ts:89`    |
| **Rollback** | `resetPostingOnFailure()` on Discord error | Agent line 816         |

**Snowflake Validation:**

- Regex: `/^\d{17,20}$/` (17-20 digit numeric)
- Rejects stub IDs like "123" or "stub-001"
- Location: `isValidDiscordSnowflake()` at line 764

---

## 3. Retry and Dead-Letter Behavior

### 3.1 Ticket Discord Outbox

| Parameter                 | Value                                                    | Source                               |
| ------------------------- | -------------------------------------------------------- | ------------------------------------ |
| **Max Retries**           | 3                                                        | `BRIDGE_OUTBOX_MAX_RETRIES`          |
| **Stale Claim Threshold** | 60 seconds                                               | `TICKET_DISCORD_STALE_CLAIM_SECONDS` |
| **Error Storage**         | JSON: `{type, message, timestamp, status_code, attempt}` | `mark_discord_outbox_failed()`       |

**Dead-Letter:**

- Rows with `status='failed'` AND `retry_count >= 3` are abandoned
- No automatic cleanup; requires operator intervention
- Query:
  `SELECT * FROM ticket_discord_outbox WHERE status='failed' AND retry_count >= 3`

### 3.2 Unified Picks

| Parameter         | Value                               | Source                    |
| ----------------- | ----------------------------------- | ------------------------- |
| **Auto-Recovery** | `resetPostingOnFailure()`           | Agent line 816            |
| **Retry Window**  | Next polling cycle (30s default)    | Agent config              |
| **Error Audit**   | `audit_log` table with error reason | `resetPostingOnFailure()` |

**Drift Detection:**

- Picks with `posted_to_discord=true` but no `discord_message_id` are "drift"
- Requires `operator_override` role with drift mode to correct

---

## 4. DB Truth Fields

### 4.1 ticket_discord_outbox Table

```sql
CREATE TABLE ticket_discord_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE,           -- Idempotency key
  bet_slip_id TEXT NOT NULL,                -- Correlation ID
  status TEXT CHECK (status IN ('pending', 'processing', 'posted', 'failed')),
  posted_at TIMESTAMPTZ,                    -- When marked posted
  discord_message_id TEXT,                  -- Discord snowflake (17-20 digits)
  discord_channel_id TEXT,                  -- Target channel
  error TEXT,                               -- JSON error details
  retry_count INTEGER DEFAULT 0,            -- Attempt counter
  claimed_at TIMESTAMPTZ,                   -- SPRINT-092 atomic claim
  claimed_by TEXT,                          -- Worker ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 unified_picks Fields

```sql
-- Discord posting fields
posted_to_discord BOOLEAN DEFAULT FALSE,   -- Idempotency guard
promotion_posted_at TIMESTAMPTZ,            -- When posted
discord_message_id TEXT,                    -- Discord snowflake

-- Meta field (JSONB)
meta.discord_receipt: {
  message_id: string,                       -- Discord snowflake
  posted_at: string,                        -- ISO timestamp
  commit_sha: string,                       -- Build provenance
  environment: string,                      -- prod/staging/dev
  ticket_type: string,                      -- single/parlay
  leg_count: number                         -- For parlays
}
```

### 4.3 ops_worker_heartbeats (Observability)

```sql
-- Heartbeat fields for DiscordTicketWorker
worker_id TEXT,
worker_name TEXT,                           -- 'discord-ticket-worker'
status TEXT,                                -- healthy/degraded/stopped
last_error TEXT,
meta: {
  webhook_configured: boolean,
  total_items_processed: number,
  last_successful_post_at: string           -- ISO timestamp
}
```

---

## 5. Canary Routing Configuration

### 5.1 Single Configuration Point

All Discord posting (both paths) routes through **one environment variable**:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
```

**Resolution:**

- `apps/api/src/config/discordRouting.ts` - Canonical resolver
- Both `DiscordTicketWorker` and `DiscordPromotionAgent` read from this
- No per-feature hardcoding

### 5.2 Canary Channel Setup

To route ALL messages (picks + recaps) to a single canary channel:

1. Create a test channel in Discord (e.g., `#canary-picks`)
2. Create a webhook for that channel
3. Set environment variable:
   ```bash
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/{canary_webhook}
   DEFAULT_DISCORD_TICKET_CHANNEL_ID={canary_channel_id}
   ```

### 5.3 Required Environment Variables

```bash
# REQUIRED for Discord posting
DISCORD_WEBHOOK_URL=<canary-webhook-url>
DEFAULT_DISCORD_TICKET_CHANNEL_ID=<canary-channel-id>
ENABLE_DISCORD_TICKET_WORKER=true

# OPTIONAL tuning
TICKET_DISCORD_POLL_INTERVAL=10000
TICKET_DISCORD_BATCH_SIZE=10
TICKET_DISCORD_STALE_CLAIM_SECONDS=60
```

### 5.4 Fail-Closed Behavior

If `DEFAULT_DISCORD_TICKET_CHANNEL_ID` is not set:

- `enqueue_ticket_discord_outbox_v2()` creates FAILED row (not PENDING)
- Error: `{type: 'ROUTE_MISSING', message: 'No Discord channel configured...'}`
- No silent fallback; explicit failure

If `DISCORD_WEBHOOK_URL` is not set:

- Workers skip posting with warning log
- No silent retries

---

## 6. Proof Gates for Success

### 6.1 Pre-Post Proof (DB State)

```sql
-- Outbox row in pending state
SELECT id, ticket_id, bet_slip_id, status, created_at
FROM ticket_discord_outbox
WHERE status = 'pending'
ORDER BY created_at DESC LIMIT 1;
```

Expected: Row exists with `status='pending'`

### 6.2 Consumer Log Proof

```
[DiscordTicketWorker] Claimed batch: 1 items
[DiscordTicketWorker] Posting item {id} to webhook...
[DiscordTicketWorker] Discord response: 200 OK
[DiscordTicketWorker] Message ID: 1234567890123456789
```

### 6.3 Discord Webhook Response

```json
{
  "id": "1234567890123456789",
  "type": 0,
  "content": "",
  "channel_id": "1234567890123456780",
  "embeds": [...]
}
```

The `id` field is the Discord snowflake (17-20 digits).

### 6.4 Post-Post Proof (DB State)

```sql
-- Outbox row in posted state with message_id
SELECT id, ticket_id, status, discord_message_id, posted_at, retry_count
FROM ticket_discord_outbox
WHERE status = 'posted'
ORDER BY posted_at DESC LIMIT 1;
```

Expected:

- `status='posted'`
- `discord_message_id` matches snowflake from response
- `posted_at` is set
- `retry_count` shows attempts

### 6.5 Discord Screenshot Proof

Visual confirmation that message appears in Discord with:

- Correct embed formatting
- Team logos (if applicable)
- Pick details (sport, matchup, selection, odds)

### 6.6 Full Proof Checklist

| Proof                | Location                | Validation                                  |
| -------------------- | ----------------------- | ------------------------------------------- |
| Outbox pending row   | `ticket_discord_outbox` | `status='pending'`                          |
| Consumer attempt log | API stdout              | `Posting item...`                           |
| Webhook response     | API stdout              | `200 OK`, snowflake ID                      |
| Outbox posted row    | `ticket_discord_outbox` | `status='posted'`, `discord_message_id` set |
| Discord screenshot   | Canary channel          | Message visible                             |
| Snowflake in DB      | `discord_message_id`    | Matches screenshot message ID               |

**Fail-Closed Rule**: If any proof is missing, the posting is NOT considered
successful.

---

## 7. Settlement Fanout and Recap

### 7.1 Settlement Event Flow

```
SettlementAgent.settle(pickId, result)
  → lifecycleSettle() with writerRole='settler'
  → manual_settle_pick() RPC
  → INSERT INTO events (event_type='PICK_SETTLED', ...)
  → OpsEventConsumer polls events table
  → Marks PICK_SETTLED as processed
  → Emits RECAP_REQUESTED event (idempotent by date)
  → RecapAgent processes RECAP_REQUESTED
  → RecapService calculates stats
  → RecapFormatter builds Discord embed
  → POST recap to canary channel
```

### 7.2 Required Environment Variables for Recap

```bash
ENABLE_OPS_EVENT_CONSUMERS=true
OPS_EVENT_POLL_INTERVAL=15000
MICRO_RECAP=false  # Set true for real-time ROI monitoring
```

### 7.3 Idempotency on Settlement Fanout

| Level            | Key                            | Prevention                 |
| ---------------- | ------------------------------ | -------------------------- |
| Event emission   | `PICK_SETTLED:{settlement_id}` | Unique insert              |
| Recap trigger    | `RECAP_REQUESTED:daily:{date}` | One recap per day          |
| Settlement write | `settlement_version` counter   | Version conflict detection |

**Double-Settlement Guard:**

- `settlement_frozen=true` after settlement
- Trigger `prevent_direct_settlement_update()` blocks modifications
- Re-settling same pick returns existing settlement, no new event

### 7.4 Recap Proof Requirements

| Proof                 | Location        | Validation                        |
| --------------------- | --------------- | --------------------------------- |
| PICK_SETTLED event    | `events` table  | Event exists with correct pick_id |
| RECAP_REQUESTED event | `events` table  | Idempotency key matches date      |
| Recap embed           | Canary channel  | Summary shows settled pick        |
| No duplicate rollup   | `unified_picks` | Only one settlement record        |
| No duplicate recap    | Canary channel  | Only one recap message per date   |

---

## 8. Implementation Plan (Phase B)

### 8.1 Restore Pick Delivery

**Steps:**

1. Verify environment variables are set:
   - `DISCORD_WEBHOOK_URL` → canary webhook
   - `DEFAULT_DISCORD_TICKET_CHANNEL_ID` → canary channel ID
   - `ENABLE_DISCORD_TICKET_WORKER=true`

2. Start DiscordTicketWorker:
   - Verify worker appears in process list
   - Check heartbeat in `ops_worker_heartbeats`

3. Submit test pick via Smart Form:
   - Use Playwright to submit pick
   - Capture `bet_slip_id` and `ticket_id`

4. Verify outbox progression:
   - Query `ticket_discord_outbox` for pending → posted transition
   - Verify `discord_message_id` is valid snowflake

5. Verify Discord delivery:
   - Screenshot canary channel
   - Confirm embed format (team logos, odds, etc.)

### 8.2 Add Settlement Fanout + Recap

**Steps:**

1. Enable OpsEventConsumer:
   - Set `ENABLE_OPS_EVENT_CONSUMERS=true`

2. Settle the test pick via Command Center:
   - Use Playwright to click WIN/LOSS
   - Capture settlement timestamp

3. Verify event chain:
   - Query `events` for PICK_SETTLED
   - Query `events` for RECAP_REQUESTED

4. Verify recap generation:
   - Check RecapAgent logs
   - Screenshot canary channel for recap embed

5. Verify idempotency:
   - Attempt to re-settle same pick
   - Confirm no duplicate events or recap

---

## 9. Verification Protocol (Phase C)

### 9.1 E2E Test Sequence

```
1. Reset: Truncate lifecycle tables (use ops-reset-dev-lifecycle.mjs)
2. Submit: One manual pick via Smart Form UI (Playwright)
3. Verify: Pick appears in Command Center
4. Check: ticket_discord_outbox shows posted status
5. Screenshot: Pick embed in canary Discord channel
6. Settle: Mark pick as WIN via Command Center
7. Check: PICK_SETTLED and RECAP_REQUESTED events exist
8. Screenshot: Recap embed in canary Discord channel
9. Verify: No duplicates on retry
```

### 9.2 Proof Artifacts

All proofs saved to:
`out/sprints/SPRINT-DISCORD-TRUTH-AND-FANOUT-096/<date>/proofs/`

| File                          | Content                                 |
| ----------------------------- | --------------------------------------- |
| `proof_outbox_pending.txt`    | Outbox row before posting               |
| `proof_outbox_posted.txt`     | Outbox row after posting                |
| `proof_discord_pick.png`      | Screenshot of pick in Discord           |
| `proof_settlement_events.txt` | PICK_SETTLED and RECAP_REQUESTED events |
| `proof_discord_recap.png`     | Screenshot of recap in Discord          |
| `proof_idempotency.txt`       | Retry attempt showing no duplicates     |

---

## 10. Risk Assessment

| Risk                        | Likelihood | Impact | Mitigation                         |
| --------------------------- | ---------- | ------ | ---------------------------------- |
| Webhook URL misconfigured   | Medium     | High   | Validate URL format before posting |
| Worker not starting         | Medium     | High   | Check ENABLE_DISCORD_TICKET_WORKER |
| Rate limiting by Discord    | Low        | Medium | Batch processing with delays       |
| Stale claims blocking queue | Low        | Medium | Auto-reset after 60 seconds        |
| Event consumer not polling  | Medium     | High   | Check ENABLE_OPS_EVENT_CONSUMERS   |

---

## 11. Rollback Plan

If Discord posting causes issues:

1. **Immediate**: Set `ENABLE_DISCORD_TICKET_WORKER=false` to stop posting
2. **Queue Recovery**: Failed items remain in outbox for later retry
3. **Manual Fix**: Use Supabase dashboard to update outbox status
4. **Full Rollback**: No schema changes required; config-only

---

## 12. Success Criteria

Phase B is complete when:

- [ ] One pick successfully posted to canary Discord channel
- [ ] `discord_message_id` stored as valid snowflake in DB
- [ ] Pick settlement triggers PICK_SETTLED event
- [ ] Recap posts to canary channel after settlement
- [ ] Re-settlement does not duplicate posts or recaps

Phase C is complete when:

- [ ] All proof artifacts generated
- [ ] Screenshots confirm visual correctness
- [ ] DB queries confirm data integrity
- [ ] Idempotency verified with retry test

---

## Appendix A: Key File References

| File                                                 | Purpose                   |
| ---------------------------------------------------- | ------------------------- |
| `apps/api/src/consumers/DiscordTicketWorker.ts`      | Ticket posting worker     |
| `apps/api/src/agents/DiscordPromotionAgent/index.ts` | Promotion posting agent   |
| `apps/api/src/config/discordRouting.ts`              | Routing configuration     |
| `apps/api/src/lib/lifecycle/idempotency.ts`          | Idempotency guards        |
| `apps/api/src/consumers/OpsEventConsumer.ts`         | Settlement event consumer |
| `apps/api/src/agents/RecapAgent/index.ts`            | Recap orchestration       |
| `apps/api/src/agents/RecapAgent/recapService.ts`     | Recap data processing     |
| `supabase/migrations/20260220230001_*.sql`           | Outbox schema             |
| `supabase/migrations/20260221160000_*.sql`           | Routing + claim RPCs      |

---

## Appendix B: Environment Variable Reference

```bash
# REQUIRED
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DEFAULT_DISCORD_TICKET_CHANNEL_ID=1234567890123456789
ENABLE_DISCORD_TICKET_WORKER=true

# OPTIONAL (with defaults)
TICKET_DISCORD_POLL_INTERVAL=10000          # 10 seconds
TICKET_DISCORD_BATCH_SIZE=10                # 10 items per cycle
TICKET_DISCORD_STALE_CLAIM_SECONDS=60       # 60 second claim timeout

# FOR RECAP/FANOUT
ENABLE_OPS_EVENT_CONSUMERS=true
OPS_EVENT_POLL_INTERVAL=15000               # 15 seconds
```

---

**Document Status**: Ready for Review **Next Step**: Obtain approval, then
proceed to Phase B Implementation
