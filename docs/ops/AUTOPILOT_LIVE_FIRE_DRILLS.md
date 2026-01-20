# Autopilot Live Fire Drills

**Phase 7: Emergency Response Training**

This document contains scripted drills for testing autopilot emergency
procedures. Run these drills quarterly to ensure operational readiness.

## Pre-Drill Checklist

- [ ] Notify team of drill schedule
- [ ] Ensure monitoring dashboards are accessible
- [ ] Have runbook open for reference
- [ ] Prepare rollback commands
- [ ] Document drill start time

## Drill 1: Discord Outage → Circuit Breaker → Demotion

**Scenario**: Discord API becomes unavailable, causing circuit breaker to open.

**Expected Behavior**: Autopilot should detect elevated error rate and demote
from CANARY/PROD to LOG_ONLY automatically.

### Execution Steps

1. **Setup** (in test environment):
```bash
# Ensure autopilot is in CANARY mode with 50%
curl -X POST http://localhost:3001/api/admin/autopilot \
  -H "Content-Type: application/json" \
  -H "x-user-id: drill-operator" \
  -d '{"mode": "canary", "canary_percentage": 50}'
```

2. **Simulate Discord Outage**:
```bash
# Block Discord API (test environment only!)
# Option A: Update environment variable
export DISCORD_API_URL=http://localhost:9999  # Non-existent

# Option B: Use circuit breaker test endpoint
curl -X POST http://localhost:3000/api/test/circuit-breaker/trip \
  -H "Content-Type: application/json" \
  -d '{"service": "discord"}'
```

3. **Trigger Side Effects**:
```bash
# Generate Discord post attempts
# These should fail and trigger error tracking
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/test/trigger-publish \
    -H "Content-Type: application/json" \
    -d '{"pick_id": "drill-pick-'$i'"}'
  sleep 1
done
```

4. **Verify Automatic Demotion**:
```bash
# Check mode should now be LOG_ONLY
curl http://localhost:3001/api/admin/autopilot?view=config

# Check demotion event was recorded
curl http://localhost:3001/api/admin/autopilot?view=demotions

# Verify in database
SELECT * FROM autopilot_demotion_events
WHERE trigger_type = 'evaluation_error_spike'
ORDER BY demoted_at DESC
LIMIT 1;
```

5. **Verify Evidence**:
```sql
-- Check error decisions were logged
SELECT decision, reason, COUNT(*)
FROM autopilot_decisions
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY decision, reason;

-- Audit log should show demotion
SELECT * FROM audit_log
WHERE action = 'AUTOPILOT_DEMOTION'
ORDER BY created_at DESC
LIMIT 1;
```

### Success Criteria
- [ ] Demotion occurred within 2 minutes of first errors
- [ ] Mode changed to LOG_ONLY
- [ ] Demotion event recorded with correct trigger_type
- [ ] Audit log entry created
- [ ] No side effects occurred after demotion

### Recovery
```bash
# Restore Discord API access
export DISCORD_API_URL=https://discord.com/api

# Reset circuit breaker
curl -X POST http://localhost:3000/api/test/circuit-breaker/reset \
  -d '{"service": "discord"}'

# Return to LOG_ONLY for evidence collection
curl -X POST http://localhost:3001/api/admin/autopilot \
  -d '{"mode": "log_only"}'
```

---

## Drill 2: Supabase Latency Spike → SLO FAIL → Demotion

**Scenario**: Database latency exceeds SLO thresholds, causing SLO FAIL status.

**Expected Behavior**: Autopilot should detect SLO failure and demote to
LOG_ONLY.

### Execution Steps

1. **Setup**:
```bash
# Ensure autopilot is in PROD mode
curl -X POST http://localhost:3001/api/admin/autopilot \
  -d '{"mode": "prod", "confirm": true}'
```

2. **Simulate Database Latency**:
```bash
# Add artificial delay to database queries (test env only)
# Option A: Database-level delay
SELECT pg_sleep(2);  -- In query path

# Option B: Use test delay injection
curl -X POST http://localhost:3000/api/test/inject-latency \
  -d '{"service": "supabase", "delay_ms": 2000}'
```

3. **Generate Load**:
```bash
# Trigger multiple operations that hit database
for i in {1..20}; do
  curl -X GET http://localhost:3000/api/picks/latest &
done
wait
```

4. **Verify SLO Status**:
```bash
# Check SLO dashboard
curl http://localhost:3001/api/monitoring/slo

# Should show FAIL status for database latency SLO
```

5. **Verify Demotion**:
```bash
curl http://localhost:3001/api/admin/autopilot?view=config
# Mode should be LOG_ONLY or CANARY (demoted from PROD)
```

### Success Criteria
- [ ] SLO FAIL detected within 30 seconds
- [ ] Demotion triggered automatically
- [ ] Evidence snapshot captured at demotion time
- [ ] Publishing stopped immediately after demotion

### Recovery
```bash
# Remove latency injection
curl -X DELETE http://localhost:3000/api/test/inject-latency?service=supabase

# Wait for SLO recovery
# Then manually promote through gates
```

---

## Drill 3: Evaluation Error Spike → Demotion

**Scenario**: A code bug causes AutopilotGuard evaluation to throw exceptions.

**Expected Behavior**: Error tracking should detect spike and demote automatically.

### Execution Steps

1. **Setup**:
```bash
curl -X POST http://localhost:3001/api/admin/autopilot \
  -d '{"mode": "canary", "canary_percentage": 50}'
```

2. **Simulate Evaluation Errors**:
```bash
# Inject invalid context that causes evaluation to fail
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/test/trigger-evaluation-error \
    -d '{"agent": "TestAgent", "error_type": "context_invalid"}'
  sleep 0.5
done
```

3. **Verify Error Tracking**:
```sql
-- Check UNKNOWN decisions (indicates errors)
SELECT COUNT(*)
FROM autopilot_decisions
WHERE decision = 'UNKNOWN'
  AND created_at > NOW() - INTERVAL '2 minutes';

-- Should be >= 10 (demotion threshold)
```

4. **Verify Demotion**:
```bash
# Check current mode
curl http://localhost:3001/api/admin/autopilot?view=config

# Check demotion event
SELECT * FROM autopilot_demotion_events
WHERE trigger_type = 'evaluation_error_spike'
ORDER BY demoted_at DESC
LIMIT 1;
```

### Success Criteria
- [ ] Error spike detected (10+ errors in 1 minute)
- [ ] Automatic demotion to LOG_ONLY
- [ ] All subsequent decisions blocked
- [ ] Evidence snapshot preserved

---

## Drill 4: Manual Emergency Stop

**Scenario**: Operator observes unexpected behavior and triggers emergency stop.

**Expected Behavior**: Publishing stops immediately, mode changes to LOG_ONLY.

### Execution Steps

1. **Setup**:
```bash
# Put autopilot in PROD mode
curl -X POST http://localhost:3001/api/admin/autopilot \
  -d '{"mode": "prod", "confirm": true}'
```

2. **Start Background Publishing**:
```bash
# Simulate ongoing publishing activity
(while true; do
  curl -s http://localhost:3000/api/test/trigger-publish >/dev/null
  sleep 0.5
done) &
PUB_PID=$!
```

3. **Execute Emergency Stop**:
```bash
# Time this operation
START=$(date +%s.%N)

curl -X POST http://localhost:3001/api/admin/autopilot/actions \
  -H "Content-Type: application/json" \
  -H "x-user-id: drill-operator" \
  -d '{"action": "emergency_stop", "params": {"reason": "Drill: Testing emergency stop"}}'

END=$(date +%s.%N)
echo "Emergency stop executed in $(echo "$END - $START" | bc) seconds"
```

4. **Verify Immediate Stop**:
```bash
# Check mode is LOG_ONLY
curl http://localhost:3001/api/admin/autopilot?view=config

# Verify no ALLOW decisions after stop
SELECT created_at, decision
FROM autopilot_decisions
WHERE created_at > NOW() - INTERVAL '30 seconds'
ORDER BY created_at DESC;
```

5. **Cleanup**:
```bash
# Stop background publishing
kill $PUB_PID
```

### Success Criteria
- [ ] Emergency stop completes in <2 seconds
- [ ] Mode immediately changes to LOG_ONLY
- [ ] Demotion event recorded with trigger_type='manual_emergency'
- [ ] No ALLOW decisions after stop timestamp
- [ ] Audit log captures operator and reason

---

## Drill 5: Canary Percentage Increase → Stable Routing

**Scenario**: Increase canary percentage from 25% to 50% mid-operation.

**Expected Behavior**: Same context_hash should continue routing to same result.
No "reshuffle" of existing traffic.

### Execution Steps

1. **Setup at 25%**:
```bash
curl -X POST http://localhost:3001/api/admin/autopilot \
  -d '{"mode": "canary", "canary_percentage": 25}'
```

2. **Generate Baseline Traffic**:
```bash
# Generate decisions with known context hashes
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/test/trigger-publish \
    -d '{"pick_id": "stable-test-'$i'"}'
  sleep 0.1
done
```

3. **Record Pre-Change Routing**:
```sql
-- Save routing decisions before change
CREATE TEMP TABLE pre_change AS
SELECT context_hash, canary_bucket, decision
FROM autopilot_decisions
WHERE pick_id LIKE 'stable-test-%'
  AND created_at > NOW() - INTERVAL '5 minutes';
```

4. **Increase to 50%**:
```bash
curl -X PUT http://localhost:3001/api/admin/autopilot/config \
  -d '{"canary_percentage": 50}'
```

5. **Regenerate Same Traffic**:
```bash
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/test/trigger-publish \
    -d '{"pick_id": "stable-test-'$i'"}'
  sleep 0.1
done
```

6. **Verify Stable Routing**:
```sql
-- Compare routing before and after
SELECT
  p.context_hash,
  p.canary_bucket as pre_bucket,
  a.canary_bucket as post_bucket,
  CASE WHEN p.canary_bucket = a.canary_bucket THEN 'STABLE' ELSE 'CHANGED' END as status
FROM pre_change p
JOIN autopilot_decisions a ON p.context_hash = a.context_hash
WHERE a.created_at > NOW() - INTERVAL '2 minutes';

-- All rows should show 'STABLE'
```

### Success Criteria
- [ ] All context_hash values route to same bucket
- [ ] Decisions 25-49 now ALLOW (previously REJECT)
- [ ] Decisions 0-24 still ALLOW (unchanged)
- [ ] Decisions 50-99 still REJECT (unchanged)
- [ ] No routing "reshuffle" occurred

---

## Post-Drill Checklist

- [ ] Document drill results
- [ ] Record any unexpected behavior
- [ ] Update runbook if procedures changed
- [ ] Reset environment to pre-drill state
- [ ] Notify team of drill completion

## Drill Schedule

| Drill | Frequency  | Last Run   | Next Run   |
| ----- | ---------- | ---------- | ---------- |
| 1     | Quarterly  | -          | -          |
| 2     | Quarterly  | -          | -          |
| 3     | Quarterly  | -          | -          |
| 4     | Monthly    | -          | -          |
| 5     | Quarterly  | -          | -          |

---

**Document Owner**: Platform Engineering
**Last Updated**: 2026-01-18
**Review Schedule**: After each drill execution
