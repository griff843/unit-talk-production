# PR8: Auto-Remediation Playbooks

**Version**: 1.0.0
**Status**: IMPLEMENTED
**Date**: 2026-01-19
**Author**: Platform Engineering Team

---

## Overview

PR8 implements an automated remediation system that responds to SLO incidents with pre-defined playbooks. The system follows a **DRY RUN ONLY by default** approach with optional approval workflows for live execution.

### Key Principles

1. **Safety First**: All executions are DRY RUN by default
2. **Knob Verification**: Playbooks only execute if required control knobs exist
3. **Idempotent**: Same incident won't trigger multiple remediations
4. **Auditable**: Complete audit trail of all executions
5. **Feature-Flagged**: Everything disabled by default

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Command Center UI                             │
│                   /dashboard/remediation                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API Endpoint                                    │
│            /api/admin/remediation                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 RemediationEngine                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ PlaybookRegistry│  │  KnobResolver   │  │ ExecutionLogger │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │          │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│    Playbooks      │  │ CONTROL_KNOBS     │  │    Database       │
│                   │  │ INVENTORY.md      │  │ ops.remediation_* │
│ • MV_REFRESH_LAG  │  │                   │  │                   │
│ • PIPELINE_LAG    │  │ Authoritative     │  │ • playbooks       │
│ • CREDIT_BURN     │  │ source of which   │  │ • executions      │
│ • DISCORD_BACKLOG │  │ knobs exist       │  │ • config          │
│ • SLO_EVALUATOR   │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## Phase 0: Control Knobs Discovery

Before implementing any playbooks, we conducted a comprehensive discovery of all control knobs in the system:

### Discovery Results

| Knob ID | Type | Location | Executable |
|---------|------|----------|------------|
| AUTOPILOT_MODE | EXECUTABLE | autopilot_mode_config | ✅ |
| AUTOPILOT_GLOBAL_FREEZE | EXECUTABLE | autopilot_policy_config | ✅ |
| AUTOPILOT_AGENT_FREEZE | EXECUTABLE | autopilot_policy_config | ✅ |
| AUTOPILOT_FREEZE_STATE | EXECUTABLE | runtime_config/autopilot_state.json | ✅ |
| SYSTEM_FREEZE | EXECUTABLE | system_config | ✅ |
| SAFE_MODE | EXECUTABLE | system_config | ✅ |
| WORKFLOW_STATUS | EXECUTABLE | workflow_registry | ✅ |
| AGENT_ENABLED | EXECUTABLE | agent_registry | ✅ |
| API_QUOTA_THROTTLE | RECOMMENDATION_ONLY | In-memory | ❌ |
| SLO_EVALUATION_ENABLED | RECOMMENDATION_ONLY | Requires verification | ❌ |

See [CONTROL_KNOBS_INVENTORY.md](./CONTROL_KNOBS_INVENTORY.md) for complete inventory.

---

## Playbooks

### Summary

| Playbook | Execution Type | Required Knobs | Description |
|----------|----------------|----------------|-------------|
| MV_REFRESH_LAG | RECOMMENDATION_ONLY | SLO_EVALUATION_ENABLED | Manual MV refresh guidance |
| PIPELINE_LAG_THROTTLE | EXECUTABLE | AUTOPILOT_MODE | Throttle autopilot on lag |
| CREDIT_BURN_THROTTLE | RECOMMENDATION_ONLY | API_QUOTA_THROTTLE | API usage reduction guidance |
| DISCORD_BACKLOG_NUDGE | EXECUTABLE | DISCORD_WEBHOOK | Send ops notification |
| SLO_EVALUATOR_STUCK | EXECUTABLE | WORKFLOW_STATUS, AGENT_ENABLED | Restart stuck evaluator |

### 1. MV_REFRESH_LAG (Recommendation Only)

**Trigger**: Materialized view staleness SLO breach

**Why Recommendation Only**: No automated MV refresh toggle exists in the system.

**Actions**:
- Generate detailed manual remediation steps
- Provide SQL commands for MV refresh
- Log recommendation for audit

**Example Recommendation**:
```sql
-- Check stale views
SELECT schemaname, matviewname FROM pg_matviews;

-- Refresh concurrently
REFRESH MATERIALIZED VIEW CONCURRENTLY <view_name>;
```

### 2. PIPELINE_LAG_THROTTLE (Executable)

**Trigger**: Event processing latency SLO breach

**Required Knob**: AUTOPILOT_MODE

**Actions**:
1. Check current autopilot mode
2. If not already throttled, set mode to `log_only`
3. Record previous mode for rollback

**Rollback**:
```bash
# Via API
POST /api/admin/autopilot/mode
Body: { "mode": "prod", "confirm": true }
```

### 3. CREDIT_BURN_THROTTLE (Recommendation Only)

**Trigger**: API credit burn rate SLO breach

**Why Recommendation Only**: API quota throttling is in-memory only (APIQuotaCoordinator).

**Actions**:
- Identify high-volume API callers
- Recommend rate reduction strategies
- Suggest provider contact if needed

### 4. DISCORD_BACKLOG_NUDGE (Executable)

**Trigger**: Discord notification backlog SLO breach

**Required Knob**: DISCORD_WEBHOOK

**Actions**:
1. Build Discord embed with incident details
2. Send webhook notification to ops channel
3. Log notification for audit

### 5. SLO_EVALUATOR_STUCK (Executable)

**Trigger**: SLO evaluation freshness SLO breach

**Required Knobs**: WORKFLOW_STATUS, AGENT_ENABLED

**Actions**:
1. Check workflow registry for stale SLO workflows
2. Mark stale workflows as terminated
3. Re-enable any disabled SLO agents
4. Trigger workflow registry reconciliation

---

## Database Schema

### Tables

```sql
-- Playbook definitions
ops.remediation_playbooks (
  playbook_id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  execution_type TEXT,  -- EXECUTABLE | RECOMMENDATION_ONLY
  required_knobs TEXT[],
  default_action JSONB,
  cooldown_seconds INTEGER,
  max_per_hour INTEGER,
  status TEXT,  -- active | disabled | deprecated
  version INTEGER
)

-- Execution audit log
ops.remediation_executions (
  execution_id UUID PRIMARY KEY,
  playbook_id TEXT,
  incident_id TEXT,
  correlation_id UUID,
  execution_key TEXT,  -- Idempotency key
  status TEXT,  -- pending | approved | executed | failed | skipped
  execution_type TEXT,
  triggered_by TEXT,
  dry_run BOOLEAN DEFAULT TRUE,
  actions_taken JSONB,
  recommendations TEXT[],
  rollback_steps TEXT[],
  error_message TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Global configuration
ops.remediation_config (
  config_key TEXT PRIMARY KEY,
  config_value JSONB,
  description TEXT
)
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REMEDIATION_ENABLED` | `false` | Master enable flag |
| `REMEDIATION_DRY_RUN_ONLY` | `true` | Force all executions to dry run |
| `REMEDIATION_REQUIRE_APPROVAL` | `true` | Require approval for live execution |
| `REMEDIATION_MAX_PER_HOUR` | `10` | Global rate limit |
| `REMEDIATION_COOLDOWN_SECONDS` | `60` | Cooldown between runs |

### Feature Flags

All remediation features are **OFF by default**:

```bash
# Enable remediation system
REMEDIATION_ENABLED=true

# Enable live execution (DANGEROUS - requires explicit approval)
REMEDIATION_DRY_RUN_ONLY=false

# Skip approval workflow (NOT RECOMMENDED)
REMEDIATION_REQUIRE_APPROVAL=false
```

---

## API Endpoints

### GET /api/admin/remediation

Fetch remediation dashboard data.

**Query Parameters**:
- `view`: `dashboard` | `playbooks` | `executions` | `pending` | `stats` | `config`
- `playbook_id`: Filter by playbook
- `status`: Filter by status
- `limit`: Max results (default: 50)
- `hours`: Hours back for stats (default: 24)

### POST /api/admin/remediation

Trigger or approve remediation.

**Request Body**:
```json
{
  "action": "trigger" | "approve",
  "playbook_id": "PIPELINE_LAG_THROTTLE",
  "incident_id": "inc-123",
  "dry_run": true,
  "execution_id": "uuid" // For approve action
}
```

### PUT /api/admin/remediation

Update playbook configuration.

**Request Body**:
```json
{
  "playbook_id": "PIPELINE_LAG_THROTTLE",
  "status": "active" | "disabled"
}
```

---

## Command Center UI

Access the remediation dashboard at `/dashboard/remediation`.

### Features

1. **Dashboard Overview**
   - Stats cards (total, successful, failed, pending)
   - System status badges (enabled/disabled, dry run mode)

2. **Playbooks Tab**
   - View all playbooks with status
   - Test playbooks in dry run mode
   - Enable/disable playbooks

3. **Pending Approvals Tab**
   - Review pending remediations
   - Approve or reject executions

4. **Execution History Tab**
   - View recent executions
   - See recommendations generated
   - Review errors and rollback steps

---

## Worker Integration

### OpsRemediationWorker

Extends OpsNotificationWorker to add auto-remediation:

```typescript
import { getOpsRemediationWorker } from '@/services/ops';

const worker = getOpsRemediationWorker();
await worker.start();
```

**Configuration**:
```bash
OPS_REMEDIATION_WORKER_ENABLED=true
OPS_REMEDIATION_POLL_INTERVAL_MS=60000
OPS_REMEDIATION_BATCH_SIZE=10
OPS_REMEDIATION_MAX_PER_HOUR=10
```

**SLO to Playbook Mapping**:
```typescript
const SLO_PLAYBOOK_MAPPING = {
  'mv_freshness': 'MV_REFRESH_LAG',
  'pipeline_latency': 'PIPELINE_LAG_THROTTLE',
  'api_credit_burn': 'CREDIT_BURN_THROTTLE',
  'discord_notification_backlog': 'DISCORD_BACKLOG_NUDGE',
  'slo_evaluator_lag': 'SLO_EVALUATOR_STUCK',
};
```

---

## Safety Mechanisms

### 1. DRY RUN by Default

Every execution is dry run unless explicitly configured otherwise:

```typescript
const result = await engine.executePlaybook(
  'PIPELINE_LAG_THROTTLE',
  context,
  { dryRun: true } // Default
);
```

### 2. Approval Workflow

Live executions require explicit approval:

```typescript
// Create pending execution
const result = await engine.executePlaybook(playbookId, context);
// result.status === 'pending'

// Approve and execute
await engine.approveRemediation(result.execution_id, 'ops-user');
```

### 3. Knob Verification

Playbooks only execute if required knobs exist:

```typescript
const canExecute = await knobResolver.canExecutePlaybook([
  'AUTOPILOT_MODE',
  'SYSTEM_FREEZE'
]);
// Returns { canExecute: boolean, missingKnobs: [], nonExecutableKnobs: [] }
```

### 4. Rate Limiting

Built-in rate limiting per playbook and globally:

- Per-playbook cooldown (default: 5-30 minutes)
- Per-playbook max per hour (default: 2-6)
- Global max per hour (default: 10)

### 5. Idempotency

Executions are keyed by `playbook_id + incident_id + correlation_id`:

```sql
-- Prevents duplicate executions
UNIQUE (execution_key)
```

---

## Testing

### Unit Tests

```bash
npm run test -- --grep "remediation"
```

### Integration Tests

```bash
npm run test:integration -- --grep "remediation"
```

### Manual Testing

1. Enable remediation in dry run mode:
   ```bash
   REMEDIATION_ENABLED=true
   REMEDIATION_DRY_RUN_ONLY=true
   ```

2. Trigger a test playbook:
   ```bash
   curl -X POST /api/admin/remediation \
     -H "Content-Type: application/json" \
     -d '{"action":"trigger","playbook_id":"PIPELINE_LAG_THROTTLE","incident_id":"test-123"}'
   ```

3. Review in Command Center at `/dashboard/remediation`

---

## Rollback Procedures

### Global Disable

```bash
# Immediately stop all remediations
REMEDIATION_ENABLED=false
```

### Playbook Disable

```bash
curl -X PUT /api/admin/remediation \
  -H "Content-Type: application/json" \
  -d '{"playbook_id":"PIPELINE_LAG_THROTTLE","status":"disabled"}'
```

### Undo Specific Action

Each execution records rollback steps:

```typescript
const execution = await engine.getExecutionHistory({ executionId: 'uuid' });
console.log(execution.rollback_steps);
// ["1. Restore autopilot mode to 'prod'", "2. Monitor for 5 minutes", ...]
```

---

## Related Documentation

- [CONTROL_KNOBS_INVENTORY.md](./CONTROL_KNOBS_INVENTORY.md) - Complete knob inventory
- [AUTOPILOT_FREEZE_MATRIX.md](./AUTOPILOT_FREEZE_MATRIX.md) - Freeze state details
- [PR7_INCIDENT_ROUTING.md](./PR7_INCIDENT_ROUTING.md) - Incident routing system

---

**Last Updated**: 2026-01-19
**Next Review**: After production deployment
