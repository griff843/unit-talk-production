# Control Knobs Inventory

**Version**: 1.0.0
**Status**: PHASE 0 Discovery Complete
**Date**: 2026-01-19
**Author**: PR8 Auto-Remediation Discovery

---

## Purpose

This document provides an authoritative inventory of all control knobs, kill switches, feature flags, and operational levers available in the Unit Talk platform. This inventory is required for PR8: Auto-Remediation Playbooks to determine which playbooks can be EXECUTABLE vs RECOMMENDATION_ONLY.

**CRITICAL**: Playbooks may ONLY manipulate knobs documented in this inventory. Any knob not listed here does NOT exist and must result in a RECOMMENDATION_ONLY playbook.

---

## 1. Autopilot Control Plane

### 1.1 AutopilotGuard (Primary Control)

**Location**: `apps/api/src/lib/AutopilotGuard.ts`

**Modes**:
| Mode | Description | Side Effects |
|------|-------------|--------------|
| `off` | All side effects blocked (dry-run) | None |
| `log_only` | Side effects blocked but logged | Logging only |
| `canary` | Percentage-based rollout | Limited |
| `prod` | Full side effects allowed | All |

**Database Table**: `autopilot_mode_config`

**RPC Functions**:
- `get_autopilot_mode()` - Returns current mode configuration
- `set_autopilot_mode(p_mode, p_actor, p_confirm, p_canary_percentage)` - Set mode
- `record_autopilot_demotion(p_from_mode, p_to_mode, p_trigger_type, p_trigger_details, p_triggered_by)` - Record demotion

**Environment Variables**:
- `AUTOPILOT_MODE` - Fallback mode (off|log_only|canary|prod)
- `AUTOPILOT_CANARY_PERCENTAGE` - Canary rollout percentage (0-100)

**API Endpoint**: `POST /api/admin/autopilot/mode`

**Knob ID**: `AUTOPILOT_MODE`
**Type**: EXECUTABLE
**Safe to Toggle**: Yes (with confirmation for PROD)

---

### 1.2 AutopilotPolicyEngine

**Location**: `apps/api/src/lib/AutopilotPolicyEngine.ts`

**Database Table**: `autopilot_policy_config`

**Policy Modes**: `OFF`, `SHADOW`, `CANARY`, `AUTO`

**Freeze Controls**:
| Control | Description | Scope |
|---------|-------------|-------|
| `global_freeze` | Freeze all autopilot actions | System-wide |
| `agent_freezes` | Freeze specific agents | Per-agent |
| `action_freezes` | Freeze specific action types | Per-action |

**Action Types**:
- `PUBLISH_PICK`
- `PUBLISH_ALERT`
- `ADJUST_SIZING`
- `GENERATE_HEDGE_ALERT`
- `DEMOTE_CAPPER`
- `PAUSE_AGENT`
- `AUTO_PROMOTE`
- `SEND_NOTIFICATION`
- `APPLY_COOLDOWN`
- `UPDATE_TIER`

**Knob IDs**:
- `AUTOPILOT_GLOBAL_FREEZE` - Type: EXECUTABLE
- `AUTOPILOT_AGENT_FREEZE` - Type: EXECUTABLE
- `AUTOPILOT_ACTION_FREEZE` - Type: EXECUTABLE

---

## 2. File-Based Freeze State

### 2.1 Autopilot Freeze State

**Location**: `packages/shared-utils/src/autopilot-freeze.ts`
**State File**: `runtime_config/autopilot_state.json`
**Feature Flag**: `AUTOPILOT_FREEZE_ENABLED`

**Freeze Scopes**:
| Scope | Description |
|-------|-------------|
| `ALL` | Complete freeze of all automated operations |
| `DEPLOYMENTS` | Freeze deployment-related automation |
| `AFFECTED_FLOW` | Freeze only the affected workflow |
| `DATA_OPERATIONS` | Freeze data-touching automation |

**Agent Lanes**:
- `ScoringAgent`
- `SettlementAgent`
- `GradingAgent`
- `PublishingAgent`

**State Schema**:
```json
{
  "frozen": boolean,
  "scope": "ALL" | "DEPLOYMENTS" | "AFFECTED_FLOW" | "DATA_OPERATIONS" | null,
  "reason": string | null,
  "triggered_at": string | null,
  "triggered_by": string | null,
  "auto_unfreeze_at": string | null,
  "incident_id": string | null,
  "frozen_lanes": string[]
}
```

**Script**: `npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL|FROZEN`

**Knob ID**: `AUTOPILOT_FREEZE_STATE`
**Type**: EXECUTABLE
**Safe to Toggle**: Yes (file-based, reversible)

---

## 3. Database system_config Table

### 3.1 System Freeze

**Config Key**: `system_freeze`
**API Endpoint**: `/api/admin/freeze`

**Schema**:
```typescript
interface FreezeConfig {
  enabled: boolean;
  freeze_publishing: boolean;
  enable_shadow_mode: boolean;
  allow_grading: boolean;
  emergency_override?: boolean;
  reason?: string;
  estimated_duration?: string;
  activated_by?: string;
  activated_at?: Date;
  scheduled_end?: Date;
}
```

**Knob ID**: `SYSTEM_FREEZE`
**Type**: EXECUTABLE
**Safe to Toggle**: Yes

---

### 3.2 Safe Mode

**Config Key**: `safe_mode`
**API Endpoint**: `/api/admin/safe-mode`

**Schema**:
```typescript
interface SafeModeConfig {
  enabled: boolean;
  force_s_tier_only: boolean;      // Force S-tier only picks
  ev_minimum_boost: number;        // +% EV minimum boost
  mute_teasers: boolean;           // Disable teaser recommendations
  mute_combos: boolean;            // Disable combo recommendations
  max_exposure_reduction: number;  // % exposure reduction
  emergency_contact?: string;
  reason?: string;
  activated_by?: string;
  activated_at?: Date;
}
```

**Default Values**:
- `force_s_tier_only`: true
- `ev_minimum_boost`: 2.0
- `mute_teasers`: true
- `mute_combos`: true
- `max_exposure_reduction`: 25.0

**Knob ID**: `SAFE_MODE`
**Type**: EXECUTABLE
**Safe to Toggle**: Yes

---

### 3.3 Shadow Mode

**Config Key**: `shadow_mode`

**Schema**:
```json
{
  "enabled": boolean,
  "reason": string,
  "enabled_at": string
}
```

**Knob ID**: `SHADOW_MODE`
**Type**: EXECUTABLE
**Safe to Toggle**: Yes

---

### 3.4 Active Restrictions

**Config Key**: `active_restrictions`

**Schema** (auto-applied when safe mode is enabled):
```json
{
  "force_s_tier": boolean,
  "ev_boost": number,
  "disable_teasers": boolean,
  "disable_combos": boolean,
  "exposure_reduction": number,
  "applied_at": string
}
```

**Knob ID**: `ACTIVE_RESTRICTIONS`
**Type**: DERIVED (auto-applied)

---

## 4. Environment Variable Feature Flags

### 4.1 Ops Notification Worker

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_NOTIFICATION_WORKER_ENABLED` | `false` | Enable notification worker |
| `OPS_POLL_INTERVAL_MS` | `60000` | Polling interval in ms |
| `OPS_NOTIFICATION_COOLDOWN_MINUTES` | `15` | Cooldown between notifications |
| `OPS_NOTIFICATION_MAX_PER_HOUR` | `20` | Max notifications per hour |

**Knob IDs**:
- `OPS_NOTIFICATION_WORKER_ENABLED` - Type: ENV_VAR
- `OPS_POLL_INTERVAL_MS` - Type: ENV_VAR

---

### 4.2 Discord Alerts

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_DISCORD_ALERTS_ENABLED` | `false` | Enable Discord alerts |
| `OPS_DISCORD_CHANNEL_ID` | - | Target channel ID |
| `OPS_DISCORD_ESCALATION_ROLE_ID` | - | Role for critical alerts |

**Knob ID**: `OPS_DISCORD_ALERTS_ENABLED`
**Type**: ENV_VAR

---

### 4.3 Notion Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_NOTION_LOGGING_ENABLED` | `false` | Enable Notion logging |
| `OPS_NOTION_DATABASE_ID` | - | Target database ID |

**Knob ID**: `OPS_NOTION_LOGGING_ENABLED`
**Type**: ENV_VAR

---

### 4.4 Weekly Digest

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_DIGEST_ENABLED` | `false` | Enable weekly digest |
| `OPS_DIGEST_CRON` | `0 9 * * 1` | Cron schedule |
| `OPS_DIGEST_TIMEZONE` | `America/New_York` | Timezone |
| `OPS_DIGEST_CHANNEL_ID` | - | Target channel ID |

**Knob ID**: `OPS_DIGEST_ENABLED`
**Type**: ENV_VAR

---

## 5. Database Control Tables

### 5.1 Workflow Registry

**Table**: `workflow_registry`

**Status Values**:
- `starting`
- `running`
- `paused`
- `stopping`
- `completed`
- `failed`
- `terminated`
- `stale`

**RPC Functions**:
- `register_workflow(p_workflow_id, p_run_id, p_agent_name, p_workflow_type, p_task_queue, p_metadata)`
- `workflow_heartbeat(p_workflow_id)`
- `unregister_workflow(p_workflow_id, p_status)`
- `reconcile_workflow_registry(p_stale_threshold_seconds)`
- `get_managed_workflows(p_agent_name, p_status)`

**Knob ID**: `WORKFLOW_STATUS`
**Type**: EXECUTABLE
**Manipulation**: Can pause/stop workflows via status update

---

### 5.2 Agent Registry

**Table**: `agent_registry`

**Columns**:
- `agent_name` - Agent identifier
- `enabled` - Whether agent is enabled
- `status` - Current status
- `config` - JSONB configuration

**Knob ID**: `AGENT_ENABLED`
**Type**: EXECUTABLE

---

### 5.3 SLO Configuration (ops schema)

**Tables**:
- `ops.slos` - SLO definitions
- `ops.slo_incidents` - SLO incidents
- `ops.slo_evaluations` - Evaluation results

**Key Fields**:
- `evaluation_enabled` - Whether SLO evaluation is active
- `threshold_value` - SLO threshold
- `severity` - warning | critical

**Knob ID**: `SLO_EVALUATION_ENABLED`
**Type**: RECOMMENDATION_ONLY (requires schema existence verification)

---

### 5.4 Capital Policy

**Table**: `capital_policy_config`

**Key Fields**:
- `bankroll_units` - Total bankroll
- `max_units_per_day` - Daily limit
- `max_units_per_game` - Per-game limit
- `max_units_per_player` - Per-player limit
- `max_kelly_at_risk_units` - Kelly cap
- `risk_engine_enabled` - Enable/disable risk engine

**Knob ID**: `RISK_ENGINE_ENABLED`
**Type**: EXECUTABLE

---

## 6. API Rate Limiting

### 6.1 API Quota Coordinator

**Location**: `apps/api/src/services/APIQuotaCoordinator.ts`

**In-Memory Controls**:
- `dailyLimit` - Max requests per day
- `monthlyLimit` - Max requests per month
- `requestsPerSecond` - Rate limit
- `burstLimit` - Burst limit

**Database Table**: `api_health_status`
- `provider` - API provider name
- `status` - healthy|warning|critical
- `credits_remaining` - Available credits

**Knob ID**: `API_QUOTA_THROTTLE`
**Type**: RECOMMENDATION_ONLY (in-memory, no persistent toggle)

---

## 7. Summary: Playbook Feasibility Matrix

| Playbook | Required Knob | Knob Exists | Playbook Type |
|----------|---------------|-------------|---------------|
| `MV_REFRESH_LAG` | SLO throttle or pause | **NO** | RECOMMENDATION_ONLY |
| `PIPELINE_LAG_THROTTLE` | Autopilot mode or poll interval | **YES** | EXECUTABLE |
| `CREDIT_BURN_THROTTLE` | API quota throttle | **PARTIAL** | RECOMMENDATION_ONLY |
| `DISCORD_BACKLOG_NUDGE` | Discord webhook | **YES** | EXECUTABLE |
| `SLO_EVALUATOR_STUCK` | Agent restart or freeze | **YES** | EXECUTABLE |

---

## 8. Recommended Playbook Actions

### EXECUTABLE Playbooks

1. **PIPELINE_LAG_THROTTLE**
   - Toggle: `AUTOPILOT_MODE` → `log_only`
   - Or: Increase `OPS_POLL_INTERVAL_MS`

2. **DISCORD_BACKLOG_NUDGE**
   - Action: Send webhook notification
   - No toggle required

3. **SLO_EVALUATOR_STUCK**
   - Toggle: `AUTOPILOT_AGENT_FREEZE` for specific agent
   - Or: Update `workflow_registry` status to `stopping`

### RECOMMENDATION_ONLY Playbooks

1. **MV_REFRESH_LAG**
   - Reason: No materialized view refresh toggle exists
   - Recommendation: "Manually run REFRESH MATERIALIZED VIEW CONCURRENTLY"

2. **CREDIT_BURN_THROTTLE**
   - Reason: API quota is in-memory only
   - Recommendation: "Reduce API call frequency or contact provider"

---

## 9. How to Add New Knobs

When adding new control knobs to the system:

1. **Database-based**: Add to `system_config` table with clear schema
2. **Environment-based**: Document in this file and add to `.env.example`
3. **File-based**: Add to `runtime_config/` with JSON schema
4. **API-based**: Create endpoint under `/api/admin/`

**Update this inventory** after adding any new control mechanism.

---

## 10. Related Documentation

- [AUTOPILOT_FREEZE_MATRIX.md](./AUTOPILOT_FREEZE_MATRIX.md) - Freeze state details
- [PR7_INCIDENT_ROUTING.md](./PR7_INCIDENT_ROUTING.md) - Ops notification system
- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md) - Auto-resolution rules

---

**Last Updated**: 2026-01-19
**Next Review**: After PR8 implementation
