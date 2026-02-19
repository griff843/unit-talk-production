# FULL-CHAIN-STAGING-GAUNTLET-041 — EXECUTION PLAN

**Sprint:** FULL-CHAIN-STAGING-GAUNTLET-041
**Phase:** PLAN ONLY
**Date:** 2026-02-18
**Objective:** Battle-test the full pipeline: Submit → Promote → Post → Settle

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Data Strategy](#test-data-strategy)
3. [Scenario Matrix](#scenario-matrix)
4. [Detailed Scenarios](#detailed-scenarios)
5. [Proof Artifact Checklist](#proof-artifact-checklist)
6. [Stop Conditions](#stop-conditions)
7. [File List](#file-list)

---

## Prerequisites

### Environment Setup Commands

```bash
# 1. Start full Docker stack
docker-compose up -d postgres redis temporal temporal-admin-tools

# 2. Verify services are healthy
docker-compose ps
curl http://localhost:3001/health  # API health
curl http://localhost:3002/health  # Smart Form health (if applicable)

# 3. Start API in development mode (with hot reload)
cd apps/api && npm run dev

# 4. Start Temporal worker (separate terminal)
cd apps/api && npm run worker:start

# 5. Verify Temporal connection
temporal workflow list --namespace default

# 6. Reset test database state (STAGING ONLY)
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  DELETE FROM unified_picks WHERE source = 'GAUNTLET_TEST';
  DELETE FROM bridge_outbox WHERE metadata->>'test_suite' = 'GAUNTLET_041';
"
```

### Required Environment Variables

```bash
# .env.local overrides for staging
SUPABASE_URL=<staging-url>
SUPABASE_SERVICE_ROLE_KEY=<staging-key>
DISCORD_WEBHOOK_URL=<test-channel-webhook>
DISCORD_BOT_TOKEN=<bot-token>
TEMPORAL_ADDRESS=localhost:7233
ENABLE_DISCORD_POSTING=true
```

---

## Test Data Strategy

### Deterministic Pick Generation

All test picks follow this naming convention for traceability:

```
bet_slip_id: GAUNTLET-041-<SCENARIO>-<TIMESTAMP>
source: GAUNTLET_TEST
```

### Test Pick Templates

#### Single Pick Template
```json
{
  "bet_slip_id": "GAUNTLET-041-SINGLE-{timestamp}",
  "source": "GAUNTLET_TEST",
  "sport": "NBA",
  "league": "NBA",
  "matchup": "Lakers vs Celtics",
  "pick_type": "player_prop",
  "player_name": "LeBron James",
  "stat_category": "points",
  "line": 25.5,
  "direction": "over",
  "odds": -110,
  "stake": 100,
  "potential_payout": 190.91,
  "confidence_score": 0.75,
  "rationale": "GAUNTLET TEST: Single pick happy path",
  "game_date": "2026-02-19",
  "game_time": "19:30:00"
}
```

#### Parlay Template (3-leg)
```json
{
  "bet_slip_id": "GAUNTLET-041-PARLAY-{timestamp}",
  "source": "GAUNTLET_TEST",
  "is_parlay": true,
  "parlay_id": "GAUNTLET-041-PARLAY-{timestamp}",
  "legs": [
    {
      "sport": "NBA",
      "matchup": "Lakers vs Celtics",
      "pick_type": "player_prop",
      "player_name": "LeBron James",
      "stat_category": "points",
      "line": 25.5,
      "direction": "over"
    },
    {
      "sport": "NBA",
      "matchup": "Warriors vs Suns",
      "pick_type": "player_prop",
      "player_name": "Stephen Curry",
      "stat_category": "three_pointers",
      "line": 4.5,
      "direction": "over"
    },
    {
      "sport": "NBA",
      "matchup": "Bucks vs Heat",
      "pick_type": "spread",
      "team": "Bucks",
      "line": -5.5,
      "direction": "cover"
    }
  ],
  "combined_odds": 450,
  "stake": 50,
  "potential_payout": 275
}
```

---

## Scenario Matrix

| # | Scenario | Pipeline Stage | Expected Outcome | Idempotency Check |
|---|----------|----------------|------------------|-------------------|
| 1 | Happy Path (Single) | Full | SETTLED | N/A |
| 2 | Happy Path (Parlay) | Full | SETTLED (all legs) | N/A |
| 3 | Duplicate Submit | Submit | 2nd rejected, 1st preserved | checkSubmitIdempotency |
| 4 | Duplicate Post | Post | 2nd no-op, receipt unchanged | atomicClaimForPost |
| 5 | Duplicate Settle | Settle | 2nd no-op, result unchanged | atomicClaimForSettle |
| 6 | Out-of-Order (Post before Promote) | Post | BLOCKED | Lifecycle guard |
| 7 | Failure Recovery | Post | Retry succeeds | claim_expires_at |
| 8 | Discord Receipt Verification | Post | message_id populated | N/A |
| 9 | Backfill Replay Safety | Promote | No duplicates created | bet_slip_id dedup |
| 10 | Drift Detection | All | Discrepancies logged | reconciliation query |

---

## Detailed Scenarios

### Scenario 1: Happy Path — Single Pick

**Objective:** Verify full pipeline flow for a single pick.

#### Commands

```bash
# Step 1: Submit via Smart Form Bridge (simulate)
curl -X POST http://localhost:3001/api/ops/inject-pick \
  -H "Content-Type: application/json" \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{
    "bet_slip_id": "GAUNTLET-041-SINGLE-001",
    "source": "GAUNTLET_TEST",
    "sport": "NBA",
    "matchup": "Lakers vs Celtics",
    "pick_type": "player_prop",
    "player_name": "LeBron James",
    "stat_category": "points",
    "line": 25.5,
    "direction": "over",
    "odds": -110,
    "stake": 100
  }'

# Step 2: Verify submission in database
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT id, bet_slip_id, lifecycle_stage, posted_at, settled_at
  FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-SINGLE-001';
"

# Step 3: Trigger promotion (GradingAgent)
curl -X POST http://localhost:3001/api/ops/trigger-grading \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id-from-step-2>"]}'

# Step 4: Verify QUEUED status
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT lifecycle_stage, queued_at, grade, confidence_score
  FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-SINGLE-001';
"

# Step 5: Trigger posting (DiscordPromotionAgent)
curl -X POST http://localhost:3001/api/ops/trigger-posting \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id-from-step-2>"]}'

# Step 6: Verify POSTED status + Discord receipt
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT lifecycle_stage, posted_at, discord_message_id, discord_channel_id
  FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-SINGLE-001';
"

# Step 7: Simulate settlement (manual or wait for game)
curl -X POST http://localhost:3001/api/ops/trigger-settlement \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id-from-step-2>"], "result": "win", "actual_value": 28}'

# Step 8: Verify SETTLED status
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT lifecycle_stage, settled_at, settlement_result, actual_stat_value
  FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-SINGLE-001';
"
```

#### Expected Outputs

| Step | Field | Expected Value |
|------|-------|----------------|
| 2 | lifecycle_stage | SUBMITTED |
| 4 | lifecycle_stage | QUEUED |
| 4 | grade | A-D (any valid grade) |
| 6 | lifecycle_stage | POSTED |
| 6 | discord_message_id | Non-null snowflake |
| 8 | lifecycle_stage | SETTLED |
| 8 | settlement_result | win |

#### Proof Files

```
proofs/
├── proof_s1_submit_response.json
├── proof_s1_submitted_state.txt
├── proof_s1_queued_state.txt
├── proof_s1_posted_state.txt
├── proof_s1_discord_receipt.txt
├── proof_s1_settled_state.txt
```

---

### Scenario 2: Happy Path — Parlay (3-leg)

**Objective:** Verify parlay all-or-nothing posting semantics.

#### Commands

```bash
# Step 1: Submit parlay via bridge
curl -X POST http://localhost:3001/api/ops/inject-parlay \
  -H "Content-Type: application/json" \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{
    "parlay_id": "GAUNTLET-041-PARLAY-001",
    "source": "GAUNTLET_TEST",
    "legs": [
      {"player_name": "LeBron James", "stat_category": "points", "line": 25.5, "direction": "over"},
      {"player_name": "Stephen Curry", "stat_category": "three_pointers", "line": 4.5, "direction": "over"},
      {"team": "Bucks", "pick_type": "spread", "line": -5.5, "direction": "cover"}
    ],
    "combined_odds": 450,
    "stake": 50
  }'

# Step 2: Verify all legs created with same parlay_id
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT id, parlay_id, leg_index, lifecycle_stage
  FROM unified_picks
  WHERE parlay_id = 'GAUNTLET-041-PARLAY-001'
  ORDER BY leg_index;
"

# Step 3: Trigger grading for all legs
curl -X POST http://localhost:3001/api/ops/trigger-grading \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"parlay_id": "GAUNTLET-041-PARLAY-001"}'

# Step 4: Trigger atomic parlay posting
curl -X POST http://localhost:3001/api/ops/trigger-parlay-posting \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"parlay_id": "GAUNTLET-041-PARLAY-001"}'

# Step 5: Verify ALL legs posted atomically (same discord_message_id)
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT leg_index, lifecycle_stage, posted_at, discord_message_id
  FROM unified_picks
  WHERE parlay_id = 'GAUNTLET-041-PARLAY-001'
  ORDER BY leg_index;
"

# Step 6: Settle all legs (simulate mixed results)
curl -X POST http://localhost:3001/api/ops/trigger-parlay-settlement \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{
    "parlay_id": "GAUNTLET-041-PARLAY-001",
    "leg_results": [
      {"leg_index": 0, "result": "win", "actual_value": 28},
      {"leg_index": 1, "result": "loss", "actual_value": 3},
      {"leg_index": 2, "result": "win", "actual_value": null}
    ]
  }'

# Step 7: Verify parlay outcome (loss due to leg 2)
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT leg_index, settlement_result, actual_stat_value, parlay_outcome
  FROM unified_picks
  WHERE parlay_id = 'GAUNTLET-041-PARLAY-001'
  ORDER BY leg_index;
"
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| Leg count | 3 |
| All legs same discord_message_id | TRUE |
| All legs posted_at within 1 second | TRUE |
| Parlay outcome after 1 leg loss | LOSS |

#### Proof Files

```
proofs/
├── proof_s2_parlay_created.txt
├── proof_s2_legs_queued.txt
├── proof_s2_atomic_post_verify.txt
├── proof_s2_settlement_results.txt
```

---

### Scenario 3: Duplicate Submit

**Objective:** Verify `checkSubmitIdempotency()` rejects duplicate bet_slip_id.

#### Commands

```bash
# Step 1: First submission (should succeed)
curl -X POST http://localhost:3001/api/ops/inject-pick \
  -H "Content-Type: application/json" \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"bet_slip_id": "GAUNTLET-041-DUP-SUBMIT-001", "source": "GAUNTLET_TEST", ...}'

# Capture response -> proof_s3_first_submit.json

# Step 2: Duplicate submission (same bet_slip_id)
curl -X POST http://localhost:3001/api/ops/inject-pick \
  -H "Content-Type: application/json" \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"bet_slip_id": "GAUNTLET-041-DUP-SUBMIT-001", "source": "GAUNTLET_TEST", ...}'

# Capture response -> proof_s3_dup_submit_rejected.json

# Step 3: Verify only ONE record exists
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT COUNT(*) as count FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-DUP-SUBMIT-001';
"
```

#### Expected Outputs

| Step | Expected |
|------|----------|
| First submit | HTTP 201, id returned |
| Duplicate submit | HTTP 409 CONFLICT or idempotent 200 with original id |
| Record count | 1 |

#### Proof Files

```
proofs/
├── proof_s3_first_submit.json
├── proof_s3_dup_submit_rejected.json
├── proof_s3_single_record_verify.txt
```

---

### Scenario 4: Duplicate Post

**Objective:** Verify `atomicClaimForPost()` prevents double-posting.

#### Commands

```bash
# Setup: Create and queue a pick
curl -X POST http://localhost:3001/api/ops/inject-pick \
  -d '{"bet_slip_id": "GAUNTLET-041-DUP-POST-001", ...}'
curl -X POST http://localhost:3001/api/ops/trigger-grading \
  -d '{"pick_ids": ["<id>"]}'

# Step 1: First post attempt
curl -X POST http://localhost:3001/api/ops/trigger-posting \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id>"]}'

# Capture discord_message_id
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT discord_message_id, posted_at FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-DUP-POST-001';
" > proof_s4_first_post.txt

# Step 2: Duplicate post attempt (immediately after)
curl -X POST http://localhost:3001/api/ops/trigger-posting \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id>"]}'

# Capture response and verify no change
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT discord_message_id, posted_at FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-DUP-POST-001';
" > proof_s4_dup_post_noop.txt

# Step 3: Verify Discord channel has only ONE message
# (Manual or via Discord API check)
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| First post | discord_message_id populated |
| Duplicate post | Same discord_message_id (no change) |
| Discord message count | 1 |

#### Proof Files

```
proofs/
├── proof_s4_first_post.txt
├── proof_s4_dup_post_noop.txt
├── proof_s4_discord_single_message.png (screenshot)
```

---

### Scenario 5: Duplicate Settle

**Objective:** Verify `atomicClaimForSettle()` prevents double-settlement.

#### Commands

```bash
# Setup: Create, queue, and post a pick
# ... (abbreviated)

# Step 1: First settlement
curl -X POST http://localhost:3001/api/ops/trigger-settlement \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id>"], "result": "win", "actual_value": 28}'

docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT settlement_result, settled_at, actual_stat_value
  FROM unified_picks WHERE bet_slip_id = 'GAUNTLET-041-DUP-SETTLE-001';
" > proof_s5_first_settle.txt

# Step 2: Duplicate settlement with DIFFERENT result
curl -X POST http://localhost:3001/api/ops/trigger-settlement \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id>"], "result": "loss", "actual_value": 20}'

docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT settlement_result, settled_at, actual_stat_value
  FROM unified_picks WHERE bet_slip_id = 'GAUNTLET-041-DUP-SETTLE-001';
" > proof_s5_dup_settle_noop.txt
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| First settle | settlement_result = 'win' |
| After duplicate | settlement_result STILL 'win' (immutable) |
| settled_at | Unchanged |

#### Proof Files

```
proofs/
├── proof_s5_first_settle.txt
├── proof_s5_dup_settle_noop.txt
```

---

### Scenario 6: Out-of-Order — Post Before Promote

**Objective:** Verify lifecycle guards block invalid transitions.

#### Commands

```bash
# Step 1: Submit a pick (lifecycle_stage = SUBMITTED)
curl -X POST http://localhost:3001/api/ops/inject-pick \
  -d '{"bet_slip_id": "GAUNTLET-041-OOO-001", ...}'

# Step 2: Attempt to POST directly (skip QUEUED)
curl -X POST http://localhost:3001/api/ops/trigger-posting \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id>"], "force": false}'

# Capture error response -> proof_s6_post_blocked.json

# Step 3: Verify lifecycle_stage unchanged
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT lifecycle_stage, posted_at FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-OOO-001';
"
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| Post attempt | HTTP 400 or 409, error: "Invalid lifecycle transition" |
| lifecycle_stage | SUBMITTED (unchanged) |
| posted_at | NULL |

#### Proof Files

```
proofs/
├── proof_s6_submit_state.txt
├── proof_s6_post_blocked.json
├── proof_s6_state_unchanged.txt
```

---

### Scenario 7: Failure Recovery — Claim Expiry

**Objective:** Verify `claim_expires_at` allows retry after transient failure.

#### Commands

```bash
# Step 1: Create and queue a pick
curl -X POST http://localhost:3001/api/ops/inject-pick -d '...'
curl -X POST http://localhost:3001/api/ops/trigger-grading -d '...'

# Step 2: Simulate claim acquisition then failure
# (This requires modifying Discord webhook to fail temporarily)
# Set DISCORD_WEBHOOK_URL to invalid URL, then trigger posting

# Step 3: Check claim state
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT lifecycle_stage, claim_acquired_at, claim_expires_at, post_attempt_count
  FROM unified_picks WHERE bet_slip_id = 'GAUNTLET-041-RETRY-001';
" > proof_s7_claim_state.txt

# Step 4: Wait for claim to expire (default: 60 seconds)
sleep 65

# Step 5: Fix webhook and retry
# Set DISCORD_WEBHOOK_URL back to valid URL
curl -X POST http://localhost:3001/api/ops/trigger-posting \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"pick_ids": ["<id>"]}'

# Step 6: Verify successful post
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT lifecycle_stage, posted_at, discord_message_id, post_attempt_count
  FROM unified_picks WHERE bet_slip_id = 'GAUNTLET-041-RETRY-001';
" > proof_s7_retry_success.txt
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| After failure | lifecycle_stage = QUEUED, claim_expires_at in past |
| After retry | lifecycle_stage = POSTED |
| post_attempt_count | 2 |

#### Proof Files

```
proofs/
├── proof_s7_claim_state.txt
├── proof_s7_retry_success.txt
```

---

### Scenario 8: Discord Receipt Verification

**Objective:** Verify posted picks have valid Discord receipts.

#### Commands

```bash
# Step 1: Query all POSTED picks from gauntlet
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT id, bet_slip_id, discord_message_id, discord_channel_id, posted_at
  FROM unified_picks
  WHERE source = 'GAUNTLET_TEST' AND lifecycle_stage = 'POSTED'
  ORDER BY posted_at;
" > proof_s8_posted_picks.txt

# Step 2: Verify each message exists in Discord
# For each discord_message_id, verify via Discord API:
curl -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
  "https://discord.com/api/v10/channels/<channel_id>/messages/<message_id>"

# Step 3: Compare embed content with pick data
# (Manual verification or automated diff)
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| All POSTED picks | Have non-null discord_message_id |
| Discord API response | HTTP 200 for each message |
| Embed content | Matches pick data |

#### Proof Files

```
proofs/
├── proof_s8_posted_picks.txt
├── proof_s8_discord_messages_verified.json
├── screenshots/s8_discord_message_*.png
```

---

### Scenario 9: Backfill Replay Safety

**Objective:** Verify promotion backfill doesn't create duplicates.

#### Commands

```bash
# Step 1: Create picks via normal flow
curl -X POST http://localhost:3001/api/ops/inject-pick \
  -d '{"bet_slip_id": "GAUNTLET-041-BACKFILL-001", ...}'

# Verify exists
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT COUNT(*) FROM unified_picks
  WHERE bet_slip_id = 'GAUNTLET-041-BACKFILL-001';
"

# Step 2: Run backfill/replay operation
curl -X POST http://localhost:3001/api/ops/replay-grading \
  -H "X-Ops-Token: $OPS_TOKEN" \
  -d '{"date_range": "2026-02-18", "source": "GAUNTLET_TEST"}'

# Step 3: Verify NO duplicates created
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  SELECT bet_slip_id, COUNT(*) as count
  FROM unified_picks
  WHERE source = 'GAUNTLET_TEST'
  GROUP BY bet_slip_id
  HAVING COUNT(*) > 1;
" > proof_s9_no_duplicates.txt
```

#### Expected Outputs

| Check | Expected |
|-------|----------|
| Duplicate query | 0 rows |
| Total record count | Same before/after replay |

#### Proof Files

```
proofs/
├── proof_s9_before_replay_count.txt
├── proof_s9_replay_response.json
├── proof_s9_no_duplicates.txt
```

---

### Scenario 10: Drift Detection

**Objective:** Verify reconciliation detects discrepancies.

#### Commands

```bash
# Step 1: Run reconciliation report
curl -X GET "http://localhost:3001/api/ops/reconciliation-report?source=GAUNTLET_TEST" \
  -H "X-Ops-Token: $OPS_TOKEN" \
  > proof_s10_reconciliation.json

# Step 2: Check for specific drift conditions
docker-compose exec postgres psql -U postgres -d unit_talk_staging -c "
  -- Picks stuck in QUEUED > 1 hour
  SELECT id, bet_slip_id, queued_at, NOW() - queued_at as age
  FROM unified_picks
  WHERE lifecycle_stage = 'QUEUED'
    AND queued_at < NOW() - INTERVAL '1 hour';

  -- POSTED picks without Discord receipt
  SELECT id, bet_slip_id, posted_at
  FROM unified_picks
  WHERE lifecycle_stage = 'POSTED'
    AND discord_message_id IS NULL;

  -- SETTLED picks without settlement_result
  SELECT id, bet_slip_id, settled_at
  FROM unified_picks
  WHERE lifecycle_stage = 'SETTLED'
    AND settlement_result IS NULL;
" > proof_s10_drift_queries.txt
```

#### Expected Outputs

| Check | Expected (healthy state) |
|-------|--------------------------|
| Stuck QUEUED | 0 rows |
| POSTED without receipt | 0 rows |
| SETTLED without result | 0 rows |

#### Proof Files

```
proofs/
├── proof_s10_reconciliation.json
├── proof_s10_drift_queries.txt
```

---

## Proof Artifact Checklist

All proof files must be captured under:
```
out/sprints/FULL-CHAIN-STAGING-GAUNTLET-041/2026-02-18/proofs/
```

### Required Proofs

| Scenario | Required Files | Captured? |
|----------|----------------|-----------|
| S1 | proof_s1_*.txt/json | [ ] |
| S2 | proof_s2_*.txt | [ ] |
| S3 | proof_s3_*.txt/json | [ ] |
| S4 | proof_s4_*.txt/png | [ ] |
| S5 | proof_s5_*.txt | [ ] |
| S6 | proof_s6_*.txt/json | [ ] |
| S7 | proof_s7_*.txt | [ ] |
| S8 | proof_s8_*.txt/json/png | [ ] |
| S9 | proof_s9_*.txt/json | [ ] |
| S10 | proof_s10_*.txt/json | [ ] |

### Final Verification Proofs

```
proofs/
├── proof_final_typecheck.txt
├── proof_final_tests.txt
├── proof_final_git_status.txt
└── proof_final_clean_state.txt
```

---

## Stop Conditions

### PASS Criteria

All of the following must be true:

1. **S1-S2**: Full pipeline completes for single + parlay
2. **S3-S5**: All idempotency checks prevent duplicates
3. **S6**: Out-of-order blocked with clear error
4. **S7**: Retry succeeds after claim expiry
5. **S8**: 100% of POSTED picks have valid Discord receipts
6. **S9**: Zero duplicate records after replay
7. **S10**: Zero drift conditions in reconciliation
8. **Clean state**: `npm run type-check` passes
9. **Tests pass**: `npm run test:unit` passes

### FAIL Criteria

Stop immediately if ANY of the following occur:

| Condition | Action |
|-----------|--------|
| Duplicate record created | STOP - investigate idempotency failure |
| Data corruption (wrong lifecycle_stage) | STOP - investigate guard failure |
| Discord double-post | STOP - investigate atomic claim |
| Settlement overwrite | STOP - investigate immutability guard |
| TypeScript errors | STOP - fix before continuing |
| Test failures | STOP - investigate regression |

### Escalation Path

If FAIL condition encountered:
1. Capture full state: `proof_failure_state.txt`
2. Capture relevant logs: `proof_failure_logs.txt`
3. Create incident ticket with scenario number
4. Do NOT proceed to next scenario

---

## File List

### Files to Create/Modify

None for PLAN phase. Implementation will require:

```
apps/api/src/routes/ops.ts              # Add gauntlet endpoints
apps/api/src/scripts/ops/gauntlet.ts    # Test runner script
out/sprints/FULL-CHAIN-STAGING-GAUNTLET-041/2026-02-18/
├── GAUNTLET_PLAN.md                    # This document
├── proofs/                             # All proof artifacts
└── SPRINT_CLOSEOUT_REPORT.md           # Final report
```

### Files to Read (reference only)

```
apps/api/src/lib/lifecycle/adapters.ts      # Lifecycle adapters
apps/api/src/lib/lifecycle/types.ts         # Type definitions
apps/api/src/services/SmartFormBridge.ts    # Submit flow
apps/api/src/agents/GradingAgent/           # Promote flow
apps/api/src/agents/DiscordPromotionAgent/  # Post flow
apps/api/src/agents/SettlementAgent/        # Settle flow
docs/contracts/PICK_LIFECYCLE_CONTRACT.md   # Lifecycle spec
```

---

## Appendix: API Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/ops/inject-pick | POST | Create test pick |
| /api/ops/inject-parlay | POST | Create test parlay |
| /api/ops/trigger-grading | POST | Force grading |
| /api/ops/trigger-posting | POST | Force posting |
| /api/ops/trigger-parlay-posting | POST | Atomic parlay post |
| /api/ops/trigger-settlement | POST | Force settlement |
| /api/ops/trigger-parlay-settlement | POST | Parlay settlement |
| /api/ops/replay-grading | POST | Backfill replay |
| /api/ops/reconciliation-report | GET | Drift detection |

---

**Plan Author:** Claude Code
**Sprint:** FULL-CHAIN-STAGING-GAUNTLET-041
**Status:** PLAN COMPLETE — AWAITING APPROVAL
