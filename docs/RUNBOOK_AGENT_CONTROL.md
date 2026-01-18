# Agent Control Operations Runbook

**Version**: 1.0.0
**Last Updated**: 2026-01-18
**Status**: PRODUCTION READY

---

## Table of Contents

1. [Emergency Procedures](#emergency-procedures)
2. [Routine Operations](#routine-operations)
3. [Troubleshooting](#troubleshooting)
4. [Audit & Investigation](#audit--investigation)
5. [Recovery Procedures](#recovery-procedures)

---

## Emergency Procedures

### 🚨 Emergency Stop All Agents

**When to use**: Critical system failure, security incident, or data corruption risk.

**Prerequisites**: Super Admin role required.

```bash
# Via CLI (if available)
npm run agent:emergency-stop --reason "Security incident detected"

# Via API
curl -X POST https://api.unittalk.com/api/agents/emergency-stop \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Security incident detected"}'
```

**What happens**:
1. `system_status.emergency_stop` is set to `true`
2. All agents stop processing within 10 seconds
3. In-flight work completes, no new work is picked up
4. All actions are logged to `audit_log`

**Recovery**: See [Clear Emergency Stop](#clear-emergency-stop)

---

### 🔴 Kill a Specific Agent (Immediate)

**When to use**: Agent is misbehaving and must be stopped immediately.

**Prerequisites**: Admin role required, confirmation token needed.

**Step 1: Request kill confirmation (60-second validity)**
```bash
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/kill/request \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Agent stuck in infinite loop"}'

# Response:
# {
#   "success": true,
#   "confirmation_token": "abc123def456...",
#   "expires_at": "2026-01-18T12:01:00Z",
#   "message": "Confirm kill within 60 seconds"
# }
```

**Step 2: Confirm kill with token**
```bash
curl -X POST https://api.unittalk.com/api/agents/kill/confirm \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation_token": "abc123def456..."}'
```

**What happens**:
1. Agent immediately stops processing
2. `current_state` and `desired_state` both set to `killed`
3. Kill event logged with full audit trail
4. Agent will not auto-restart

---

## Routine Operations

### ⏸️ Pause an Agent

**When to use**: Temporary maintenance, investigation, or load reduction.

**Prerequisites**: Operator role or higher.

```bash
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/pause \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Investigating slow processing"}'
```

**What happens**:
1. `desired_state` set to `paused`
2. Agent completes current work cycle
3. Agent skips all subsequent work cycles until resumed
4. `run_count` stops incrementing (proof of pause)
5. Heartbeats continue (agent is alive but not working)

**Verification**:
```bash
# Check metrics - run_count should be stable
curl https://api.unittalk.com/api/agents/BridgeWorker/metrics | jq '.run_count'
```

---

### ▶️ Resume an Agent

**When to use**: After maintenance or investigation is complete.

**Prerequisites**: Operator role or higher.

```bash
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/resume \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Investigation complete, resuming"}'
```

**What happens**:
1. `desired_state` set to `running`
2. Agent picks up work on next cycle (within 5 seconds)
3. `run_count` starts incrementing (proof of resume)

**Verification**:
```bash
# Watch run_count increment
watch -n 5 "curl -s https://api.unittalk.com/api/agents/BridgeWorker/metrics | jq '.run_count'"
```

---

### ⏹️ Stop an Agent (Graceful)

**When to use**: Planned shutdown, deployment, or permanent decommission.

**Prerequisites**: Operator role or higher.

```bash
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/stop \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Deploying new version"}'
```

**What happens**:
1. `desired_state` set to `stopped`
2. Agent completes current work, then stops
3. `current_state` transitions to `stopped`
4. No heartbeats after final stop

---

### 💧 Drain an Agent

**When to use**: Need to stop but allow all in-flight work to complete.

**Prerequisites**: Operator role or higher.

```bash
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/drain \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Draining before maintenance window"}'
```

**What happens**:
1. `desired_state` set to `draining`
2. Agent continues processing current batch
3. Agent does NOT pick up new work
4. After drain timeout (30s), agent stops completely
5. `drain_completed` event is logged

---

## Troubleshooting

### Agent Not Responding to Commands

**Symptoms**: Pause/stop commands issued but agent continues processing.

**Diagnosis**:
```bash
# Check agent status
curl https://api.unittalk.com/api/agents/BridgeWorker/status

# Check lifecycle events for state change requests
curl "https://api.unittalk.com/api/agents/BridgeWorker/lifecycle-events?limit=10"

# Check system status for freeze gates
curl https://api.unittalk.com/api/system/status
```

**Possible causes**:
1. **Control plane not initialized**: Check worker logs for "Agent Control Plane initialized"
2. **Database connectivity**: Control plane can't read desired state
3. **Cache stale**: Force cache clear and retry

**Resolution**:
```bash
# Force state re-check (clears cache)
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/refresh-state

# If still stuck, use kill (admin only)
```

---

### Heartbeat Missing

**Symptoms**: `last_heartbeat` is stale (>30 seconds old).

**Diagnosis**:
```bash
# Check agent health
curl https://api.unittalk.com/api/agents/BridgeWorker/health

# Check for heartbeat events
curl "https://api.unittalk.com/api/agents/BridgeWorker/lifecycle-events?event_type=heartbeat&limit=5"
```

**Possible causes**:
1. **Agent crashed**: Check container/process status
2. **Database write failed**: Check Supabase connectivity
3. **Agent stuck in long operation**: Check processing logs

**Resolution**:
1. Check container logs for errors
2. Verify Supabase connection
3. If agent is stuck, use drain or kill

---

### Metrics Not Updating

**Symptoms**: `run_count`, `success_count` etc. are stale.

**Diagnosis**:
```bash
# Get latest metrics snapshots
curl "https://api.unittalk.com/api/agents/BridgeWorker/metrics?from=2026-01-18T00:00:00Z"

# Check instrumentation is working
curl https://api.unittalk.com/api/agents/BridgeWorker/health | jq '.details.metrics'
```

**Resolution**:
1. Verify instrumentation is initialized in worker
2. Check database write permissions
3. Restart agent if metrics collection is broken

---

## Audit & Investigation

### View Agent Lifecycle History

```bash
# Get last 100 lifecycle events for an agent
curl "https://api.unittalk.com/api/agents/BridgeWorker/lifecycle-events?limit=100"

# Filter by event type
curl "https://api.unittalk.com/api/agents/BridgeWorker/lifecycle-events?event_type=state_change_requested"

# Get events in time range
curl "https://api.unittalk.com/api/agents/BridgeWorker/lifecycle-events?from=2026-01-18T00:00:00Z&to=2026-01-18T23:59:59Z"
```

### Export Audit Data

```bash
# Export lifecycle events as JSON
curl "https://api.unittalk.com/api/audit/export?agent_id=BridgeWorker&format=json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  > audit_export.json

# Export with metrics
curl "https://api.unittalk.com/api/audit/export?agent_id=BridgeWorker&include_metrics=true&format=json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  > audit_with_metrics.json
```

### Correlate Events Across Agents

```bash
# Find all events with a specific correlation ID
curl "https://api.unittalk.com/api/audit/search?correlation_id=ctrl-1234567890-abc123"
```

---

## Recovery Procedures

### Clear Emergency Stop

**Prerequisites**: Super Admin role required.

```bash
curl -X POST https://api.unittalk.com/api/system/clear-emergency-stop \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

**What happens**:
1. `system_status.emergency_stop` set to `false`
2. All agents can resume processing
3. Agents with `desired_state = running` will auto-resume

**Note**: You may need to manually resume agents that were individually paused.

---

### Restart Killed Agent

**Prerequisites**: Admin role required.

```bash
# First, set desired state back to running
curl -X POST https://api.unittalk.com/api/agents/BridgeWorker/resume \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Restarting killed agent"}'

# Then restart the container/process
kubectl rollout restart deployment/bridge-worker
# or
docker-compose restart bridge-worker
```

---

### Recover from Database Failure

If the control plane database is unavailable:

1. **Agents will continue processing** (fail-open for availability)
2. **Heartbeats will fail** but agents won't stop
3. **Control commands won't work** until DB is restored

**Recovery steps**:
1. Restore database connectivity
2. All agents will auto-resume heartbeats
3. Verify state consistency:
```bash
# Check all agents are reporting
curl https://api.unittalk.com/api/agents/list | jq '.[] | {agent_id, is_healthy}'
```

---

## Quick Reference

| Action | Role Required | Command |
|--------|--------------|---------|
| View agents | Viewer | `GET /api/agents/list` |
| View metrics | Viewer | `GET /api/agents/{id}/metrics` |
| Pause agent | Operator | `POST /api/agents/{id}/pause` |
| Resume agent | Operator | `POST /api/agents/{id}/resume` |
| Stop agent | Operator | `POST /api/agents/{id}/stop` |
| Drain agent | Operator | `POST /api/agents/{id}/drain` |
| Kill agent | Admin | `POST /api/agents/{id}/kill/request` + `confirm` |
| Emergency stop | Super Admin | `POST /api/agents/emergency-stop` |
| Clear emergency | Super Admin | `POST /api/system/clear-emergency-stop` |

---

## Contact

- **On-call**: #on-call channel in Discord
- **Escalation**: Platform Engineering team
- **Documentation**: [docs/PHASE1_E2E_PLAN.md](./PHASE1_E2E_PLAN.md)
