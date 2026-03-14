# On-Call Runbook

**Sprint**: SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING **Layer/Phase**:
Layer 2 / Phase 7 — Reliability & Monitoring **Date**: 2026-03-14 **Authority**:
Primary runbook for operational incidents

---

## Quick Reference

| Signal                  | Endpoint                                        | Action                           |
| ----------------------- | ----------------------------------------------- | -------------------------------- |
| Platform critical       | `GET /api/health/summary`                       | See `platform_status: CRITICAL`  |
| SLO breach              | `GET /api/slo/status`                           | See `status: BREACH` in `slos[]` |
| Drawdown freeze         | `GET /api/risk/status` → `drawdown.isFreeze`    | Scenario 1                       |
| Discord posting stalled | `GET /api/health` → `outbox.staleAlert`         | Scenario 2                       |
| Risk gate blocking      | `GET /api/risk/decisions`                       | Scenario 3                       |
| Worker heartbeat gap    | `GET /api/health` → `workerHeartbeats[]`        | Scenario 4                       |
| External feed down      | `GET /health/provider` → `dataFreshness.status` | Scenario 5                       |

**Operator API base URL**: `http://api:3000` (internal) or configured `API_URL`
**Auth**: `Authorization: Bearer admin-<ADMIN_TOKEN>`

---

## Scenario 1: Drawdown Freeze Activated

**Trigger**: `GET /api/risk/status` shows `drawdown.isFreeze: true`. No picks
are being promoted. `GET /api/health/summary` shows `platform_status: CRITICAL`.

**What happened**: Daily P&L has breached the `drawdown_freeze_threshold`
configured in `risk_engine_config`. The RiskEngine fail-closed gate is now
blocking all promotions.

### Diagnosis

```bash
# 1. Confirm the freeze
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" $API_URL/api/risk/status | jq '.drawdown'

# 2. Check recent risk decisions for context
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" "$API_URL/api/risk/decisions?severity=high&limit=10"

# 3. Check current drawdown config
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" $API_URL/api/risk/config | jq '.drawdown_freeze_threshold, .drawdown_lookback_days'
```

### Mitigation

```bash
# Option A: Suspend autopilot (no promotions, no gate check) — safest
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "log_only"}' \
  $API_URL/ops/autopilot

# Option B: Temporarily relax the drawdown threshold (use cautiously)
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": -0.20}' \
  "$API_URL/api/risk/config/drawdown_freeze_threshold"
```

### Resolution

1. Investigate the P&L positions that triggered the freeze (check
   `prop_settlements` table)
2. Confirm the drawdown was correctly computed (not a data error)
3. When ready to resume: restore `autopilot_mode` to `canary` or `prod`
4. Monitor drawdown state for the next 30 minutes

```bash
# Restore autopilot
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "canary", "canary_percentage": 20}' \
  $API_URL/ops/autopilot
```

---

## Scenario 2: Discord Posting Failure

**Trigger**: `GET /api/health` shows `outbox.staleAlert: true` with
`pendingCount > 20`. Picks are being promoted but not delivered to Discord. SLO
2 (Discord Posting Success Rate) may be in WARN or BREACH.

**What happened**: The Discord posting pipeline (`pick_publish` outbox →
DiscordPromotionAgent) is stalled. Possible causes: Discord bot offline,
`DISCORD_WEBHOOK_URL` misconfigured, `AUTOPILOT_MODE` not set to `prod`, or
outbox worker crash.

### Diagnosis

```bash
# 1. Check outbox depth
curl $API_URL/api/health | jq '.outbox'

# 2. Check autopilot mode
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" $API_URL/ops/autopilot

# 3. Check Discord bot status (if running as separate container)
docker-compose ps discord-bot
docker-compose logs --tail=50 discord-bot

# 4. Verify env vars (in API container)
docker-compose exec api printenv AUTOPILOT_MODE DISCORD_WEBHOOK_URL PROMOTION_CANARY_PERCENT
```

### Mitigation

```bash
# If AUTOPILOT_MODE is not prod — switch it
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "prod"}' \
  $API_URL/ops/autopilot

# If Discord bot is down — restart it
docker-compose restart discord-bot

# Enable Server Members Intent + Message Content Intent:
# → Discord Developer Portal → Application → Bot → Privileged Gateway Intents
# Then restart discord-bot container
docker-compose restart discord-bot
```

### Resolution

1. Confirm outbox depth is draining (pendingCount decreasing over 5 minutes)
2. Verify SLO 2 returns to OK status within the next polling cycle
3. If individual picks are stuck, manually requeue via override:

```bash
curl -X POST -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "promote", "reason": "Manual requeue — outbox recovery"}' \
  "$API_URL/ops/picks/$PICK_ID/override"
```

---

## Scenario 3: Risk Gate Blocking All Promotions

**Trigger**: GradingAgent is running but no picks appear in `unified_picks`.
`GET /api/risk/decisions` shows all recent decisions as `BLOCKED`.
`GET /api/health/summary` shows `platform_status: CRITICAL`.

**What happened**: The RiskEngine `evaluateForPromotion()` gate is blocking all
picks. Common causes: total Kelly exposure at cap, sport-level or market-type
exposure breach, or correlation limit exceeded.

### Diagnosis

```bash
# 1. See recent blocked decisions
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  "$API_URL/api/risk/decisions?severity=high&limit=10" | jq '.decisions[].blocked_reasons'

# 2. Check current exposure state
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" $API_URL/api/risk/status | jq '.exposure'

# 3. Check current config limits
curl -H "Authorization: Bearer admin-$ADMIN_TOKEN" $API_URL/api/risk/config
```

### Mitigation

```bash
# Option A: Temporarily raise total Kelly limit (if blocking reason is total exposure)
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": 0.5}' \
  "$API_URL/api/risk/config/total_kelly_high"

# Option B: Switch to log_only mode to bypass gate temporarily
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "log_only"}' \
  $API_URL/ops/autopilot
```

### Resolution

1. Identify which dimension is breached (total/event/sport/market_type)
2. Wait for existing positions to settle (exposure decreases naturally as picks
   settle)
3. Or: manually reject low-conviction picks to reduce exposure:

```bash
curl -X POST -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "reject", "reason": "Manual exposure reduction — risk gate recovery"}' \
  "$API_URL/ops/picks/$PICK_ID/override"
```

4. Restore config and autopilot mode when exposure normalizes.

---

## Scenario 4: Worker Heartbeat Gap

**Trigger**: `GET /api/health` shows `workerHeartbeats[].status: stale` or
`missing` for `temporal-worker`. Worker is not reporting heartbeats.

**What happened**: The Temporal worker process has crashed, lost connectivity to
Temporal server, or been OOM-killed. Without a healthy worker, Temporal
workflows (promotion pipeline, recaps, alerts) do not execute.

### Diagnosis

```bash
# 1. Check heartbeat status
curl $API_URL/api/health | jq '.workerHeartbeats'

# 2. Check API container logs for crash
docker-compose logs --tail=100 api | grep -i "error\|crash\|killed\|temporal"

# 3. Check Docker container status
docker-compose ps api
docker stats api --no-stream
```

### Mitigation

```bash
# Restart the API container (restarts the Temporal worker with it)
docker-compose restart api

# If OOM: increase memory limit in docker-compose.yml, then restart
docker-compose up -d api
```

### Resolution

1. Confirm heartbeat resumes: `GET /api/health` →
   `workerHeartbeats[].status: healthy`
2. Confirm Temporal workflow history shows no stuck workflows
3. If workflows were in progress during crash: check `unified_picks` for picks
   stuck in `SUBMITTED` state

```bash
# Check for stuck picks
SELECT id, lifecycle_stage, created_at FROM unified_picks
WHERE lifecycle_stage = 'SUBMITTED'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

---

## Scenario 5: External Feed Down

**Trigger**: `GET /health/provider` shows `dataFreshness.status: critical` or
`stale`. GradingAgent is not receiving new data from SGO or OddsAPI. No new
`provider_offers` rows in the last 30 minutes.

**What happened**: One or both external data providers (SGO, OddsAPI) are
unreachable or returning errors. This is an external dependency failure — no
local code fix is possible.

### Diagnosis

```bash
# 1. Check provider health
curl $API_URL/health/provider | jq '.dataFreshness, .providers'

# 2. Check last ingestion time
# In DB: SELECT MAX(snapshot_at) FROM provider_offers;

# 3. Check FeedAgent logs for HTTP errors
docker-compose logs --tail=100 api | grep -i "sgo\|odds\|feed\|503\|timeout"
```

### Mitigation

This is an **external failure** — no immediate local fix is available.

1. **Monitor provider status pages** for SGO and OddsAPI outage announcements
2. **No manual intervention needed in the pick pipeline** — GradingAgent will
   automatically process picks when feed data resumes
3. **If feed is down for > 2 hours**: Consider pausing autopilot to prevent
   scoring against stale data:

```bash
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "log_only"}' \
  $API_URL/ops/autopilot
```

### Resolution

1. When provider feed resumes: `GET /health/provider` →
   `dataFreshness.status: fresh`
2. GradingAgent will automatically process backlog from `provider_offers`
3. Restore autopilot if it was paused:

```bash
curl -X PUT -H "Authorization: Bearer admin-$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "canary", "canary_percentage": 20}' \
  $API_URL/ops/autopilot
```

4. Monitor `GET /api/slo/status` — SLO 3 (grading latency) may temporarily
   degrade as backlog clears.

---

## Related Runbooks

- **Autopilot rollout**: `docs/ops/AUTOPILOT_ROLLOUT_RUNBOOK.md`
- **Go-live procedures**: `docs/ops/GO_LIVE_RUNBOOK.md`
- **E2E replay**: `docs/ops/RUNBOOK_E2E_REPLAY_AND_SHADOW_v1.md`
- **Local development**: `docs/ops/RUNBOOK_LOCAL.md`
- **Autopilot freeze matrix**: `docs/ops/AUTOPILOT_FREEZE_MATRIX.md`

## See Also

- SLO definitions: `docs/ops/SLO_DEFINITIONS.md`
- Control knobs: `docs/ops/CONTROL_KNOBS_INVENTORY.md`
- Operator API: `PUT /ops/autopilot`, `POST /ops/picks/:id/override`,
  `PUT /api/risk/config/:key`
