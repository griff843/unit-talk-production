# Autopilot Rollout Runbook

**Phase 7: Evidence-Based Autopilot Promotion**

This runbook documents the procedures for safely rolling out autopilot from
LOG_ONLY to PROD mode using evidence-based promotion gates.

## Overview

Autopilot controls all side effects (Discord posts, notifications, webhooks).
The rollout follows a strict progression:

```
OFF → LOG_ONLY → CANARY → PROD
```

Each transition requires passing evidence-based gates.

## Mode Definitions

| Mode      | Side Effects | Use Case                                        |
| --------- | ------------ | ----------------------------------------------- |
| OFF       | Blocked      | Development, testing, emergency shutdown        |
| LOG_ONLY  | Blocked      | Production evaluation, evidence collection      |
| CANARY    | Percentage   | Gradual rollout, A/B testing                    |
| PROD      | Allowed      | Full production operation                       |

## Rollout Procedures

### Step 1: OFF → LOG_ONLY

**Prerequisites:**
- AutopilotGuard deployed and initialized
- Database tables created (autopilot_decisions, autopilot_metrics_hourly)
- Metrics workflow running

**Procedure:**

```bash
# Via Command Center API
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"mode": "log_only"}'

# Or via Supabase RPC
SELECT set_autopilot_mode('log_only', 'operator@unit.talk');
```

**Verification:**
```bash
# Check mode is LOG_ONLY
curl http://localhost:3001/api/admin/autopilot?view=config

# Verify decisions are being logged
SELECT COUNT(*) FROM autopilot_decisions WHERE mode = 'log_only';

# Verify NO side effects are occurring
# Check Discord - no new posts should appear
# Check agent logs for "LOG_ONLY" rejection reasons
```

**Expected Behavior:**
- All side effect requests are REJECTED with reason "LOG_ONLY"
- Every decision is logged to autopilot_decisions
- Metrics are computed hourly
- Zero side effects should occur

### Step 2: LOG_ONLY → CANARY (Gate 1)

**Gate 1 Requirements:**
| Metric               | Threshold    |
| -------------------- | ------------ |
| Window               | 7 days       |
| Minimum picks        | 500          |
| Proxy accuracy       | ≥95%         |
| False positive rate  | <2%          |

**Check Gate Status:**

```bash
# Via API
curl http://localhost:3001/api/admin/autopilot?view=gates

# Via SQL
SELECT * FROM autopilot_gate_snapshots
WHERE gate_id = 'gate1'
ORDER BY evaluated_at DESC
LIMIT 1;
```

**If Gate 1 PASSES:**

```bash
# Set mode to CANARY with initial percentage
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"mode": "canary", "canary_percentage": 10}'
```

**Verification:**
```bash
# Verify mode is CANARY
curl http://localhost:3001/api/admin/autopilot?view=config

# Verify ~10% of decisions are ALLOW
SELECT
  decision,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM autopilot_decisions
WHERE mode = 'canary' AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY decision;

# Verify canary routing is deterministic
# Same context_hash should always route to same bucket
SELECT context_hash, canary_bucket, decision
FROM autopilot_decisions
WHERE canary_routed = true
ORDER BY created_at DESC
LIMIT 20;
```

**Gradually Increase Canary Percentage:**

```bash
# Increase to 25%
curl -X PUT http://localhost:3001/api/admin/autopilot/config \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"canary_percentage": 25}'

# Monitor for issues, then increase to 50%
curl -X PUT http://localhost:3001/api/admin/autopilot/config \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"canary_percentage": 50}'
```

### Step 3: CANARY → PROD (Gate 2)

**Gate 2 Requirements:**
| Metric               | Threshold    |
| -------------------- | ------------ |
| Window               | 3 days       |
| Minimum picks        | 200          |
| Proxy accuracy       | ≥98%         |
| False positive rate  | <1%          |

**Check Gate Status:**

```bash
curl http://localhost:3001/api/admin/autopilot?view=gates

SELECT * FROM autopilot_gate_snapshots
WHERE gate_id = 'gate2'
ORDER BY evaluated_at DESC
LIMIT 1;
```

**If Gate 2 PASSES (TWO-STEP CONFIRMATION REQUIRED):**

```bash
# Step 1: Request PROD mode
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"mode": "prod"}'

# Response will indicate pending confirmation
# {"status": "pending_confirmation", "expires_at": "..."}

# Step 2: Confirm within 5 minutes
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"mode": "prod", "confirm": true}'
```

**Verification:**
```bash
# Verify mode is PROD
curl http://localhost:3001/api/admin/autopilot?view=config

# Verify side effects are occurring
# Check Discord for new posts
# Check agent logs for "ALLOW" decisions

# Monitor audit log
SELECT * FROM audit_log
WHERE action = 'AUTOPILOT_MODE_CHANGE'
ORDER BY created_at DESC
LIMIT 5;
```

## Emergency Procedures

### Emergency Stop (PROD/CANARY → LOG_ONLY)

```bash
# Via API
curl -X POST http://localhost:3001/api/admin/autopilot/actions \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"action": "emergency_stop", "params": {"reason": "Unexpected behavior observed"}}'

# Via SQL (if API unavailable)
SELECT record_autopilot_demotion(
  'prod',
  'log_only',
  'manual_emergency',
  '{"reason": "Emergency stop via SQL"}'::jsonb,
  'operator@unit.talk'
);
```

### Clear Pending PROD Confirmation

```bash
curl -X POST http://localhost:3001/api/admin/autopilot/actions \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"action": "clear_pending"}'
```

### Roll Back Mode

```bash
# Roll back to LOG_ONLY
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"mode": "log_only"}'

# Roll back to OFF (complete shutdown)
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: operator@unit.talk" \
  -d '{"mode": "off"}'
```

## Verification Procedures

### Confirm LOG_ONLY = Zero Side Effects

1. Set mode to LOG_ONLY
2. Wait for agent activity (at least 10 decisions logged)
3. Verify:

```sql
-- All decisions should be REJECT
SELECT decision, COUNT(*)
FROM autopilot_decisions
WHERE mode = 'log_only' AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY decision;

-- Should return:
-- REJECT | <count>
-- No ALLOW decisions should exist
```

4. Check Discord channels - no new posts should appear
5. Check notification logs - no notifications sent

### Validate Canary Routing Correctness

1. Set mode to CANARY with 50%
2. Run determinism test:

```sql
-- Same context_hash should always route to same bucket
SELECT
  context_hash,
  MIN(canary_bucket) as min_bucket,
  MAX(canary_bucket) as max_bucket,
  COUNT(*) as occurrences
FROM autopilot_decisions
WHERE canary_routed = true
GROUP BY context_hash
HAVING MIN(canary_bucket) != MAX(canary_bucket);

-- Should return 0 rows (all hashes route consistently)
```

### Interpret Gate Dashboards

Gate status meanings:
- **PASS**: All thresholds met, ready for promotion
- **WARN**: Close to threshold, monitor closely
- **FAIL**: Below threshold, cannot promote

Check reasons array for specific failures:
```sql
SELECT gate_id, status, reasons, evaluated_at
FROM autopilot_gate_snapshots
ORDER BY evaluated_at DESC
LIMIT 5;
```

## Monitoring

### Key Metrics to Watch

1. **Approval Rate**: Should be stable once in PROD
2. **Unknown Rate**: Spike indicates evaluation errors
3. **Latency p95**: Should stay under 100ms
4. **Canary Volume**: Should match configured percentage

### Dashboard Locations

- Command Center: `/dashboard/autopilot`
- Supabase: Query `autopilot_metrics_hourly` table
- API: `GET /api/admin/autopilot?view=dashboard`

### Alert Thresholds

| Metric            | Warning    | Critical   | Action               |
| ----------------- | ---------- | ---------- | -------------------- |
| Unknown rate      | >5%        | >10%       | Auto-demotion        |
| Latency p95       | >100ms     | >500ms     | Investigate          |
| Error spike       | >5/min     | >10/min    | Auto-demotion        |
| Accuracy drop     | <95%       | <90%       | Auto-demotion        |

## Troubleshooting

### "No valid pending PROD request"
The 5-minute confirmation window expired. Request again and confirm promptly.

### High Unknown Rate
Check AutopilotGuard logs for evaluation errors. Common causes:
- Database connection issues
- Invalid context data
- Missing required fields

### Canary Not Allowing Any Requests
Verify canary_percentage is set:
```sql
SELECT canary_percentage FROM autopilot_mode_config;
```

### Mode Not Changing
Check audit log for failures:
```sql
SELECT * FROM audit_log
WHERE action LIKE 'AUTOPILOT%'
ORDER BY created_at DESC
LIMIT 10;
```

## Contacts

- **On-Call**: #ops-oncall Slack channel
- **Escalation**: Platform Engineering Team
- **Emergency**: Use emergency_stop action immediately

---

**Document Owner**: Platform Engineering
**Last Updated**: 2026-01-18
**Review Schedule**: Monthly
