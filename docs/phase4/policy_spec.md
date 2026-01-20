# Phase 4 Autopilot Policy Specification

**Version**: 1.0.0
**Date**: 2026-01-19
**Status**: Production Ready

---

## 1. Overview

This document defines the declarative policy configuration for the Autopilot Policy Engine. All autopilot actions are governed by these policies with fail-closed semantics.

---

## 2. Core Principles

### 2.1 DEFAULT = DENY

If policy is missing, malformed, or ambiguous, the action is blocked.

```typescript
// Missing rule → DENY
if (!rule) {
  return { decision: 'DENY', reason: 'POLICY_NOT_FOUND' };
}
```

### 2.2 EVIDENCE-BASED

No action may execute without sufficient evidence:
- Sample size requirements
- Confidence calibration
- CLV directionality
- Platform health status

### 2.3 MODE-GATED

Autopilot operates in one of four modes:

| Mode | Description | Actions Allowed |
|------|-------------|-----------------|
| OFF | All autopilot disabled | None |
| SHADOW | Evaluate + log only | None (logging only) |
| CANARY | Restricted scope | Percentage-based |
| AUTO | Full autopilot | All per policy |

### 2.4 OPERATOR OVERRIDE WINS

Any operator freeze immediately blocks action, regardless of policy evaluation:
- Global freeze
- Per-agent freeze
- Per-action freeze

---

## 3. Action Types

| Action Type | Description | Default Mode |
|-------------|-------------|--------------|
| PUBLISH_PICK | Publish pick to Discord | CANARY |
| PUBLISH_ALERT | Publish alert notification | CANARY |
| ADJUST_SIZING | Modify position sizing | AUTO only |
| GENERATE_HEDGE_ALERT | Create hedge opportunity alert | CANARY |
| DEMOTE_CAPPER | Demote capper tier | AUTO only |
| PAUSE_AGENT | Pause an agent | CANARY |
| AUTO_PROMOTE | Auto-promote pick | AUTO only |
| SEND_NOTIFICATION | Send user notification | CANARY |
| APPLY_COOLDOWN | Apply action cooldown | CANARY |
| UPDATE_TIER | Update capper tier | AUTO only |

---

## 4. Policy Rules

### 4.1 PUBLISH_PICK

```json
{
  "id": "publish-pick",
  "action_type": "PUBLISH_PICK",
  "enabled": true,
  "allowed_modes": ["CANARY", "AUTO"],
  "min_sample_size": 30,
  "min_confidence_score": 0.65,
  "min_confidence_tier": "A",
  "min_clv_positive_rate": 0.55,
  "require_healthy_platform": true,
  "require_slo_compliance": true,
  "cooldown_seconds": 60,
  "cooldown_scope": "entity"
}
```

**Evidence Requirements**:
- Minimum 30 historical picks for sample
- Confidence score ≥ 0.65
- Confidence tier A or S
- CLV positive rate ≥ 55%
- Platform health must be PASS or WARN
- SLO compliance required

### 4.2 PUBLISH_ALERT

```json
{
  "id": "publish-alert",
  "action_type": "PUBLISH_ALERT",
  "enabled": true,
  "allowed_modes": ["CANARY", "AUTO"],
  "min_sample_size": 10,
  "min_confidence_score": 0.50,
  "require_healthy_platform": true,
  "cooldown_seconds": 300,
  "cooldown_scope": "entity"
}
```

**Evidence Requirements**:
- Minimum 10 historical samples
- Confidence score ≥ 0.50
- Platform health must be PASS or WARN
- 5-minute cooldown per entity

### 4.3 ADJUST_SIZING

```json
{
  "id": "adjust-sizing",
  "action_type": "ADJUST_SIZING",
  "enabled": true,
  "allowed_modes": ["AUTO"],
  "min_sample_size": 50,
  "min_confidence_score": 0.70,
  "min_clv_positive_rate": 0.60,
  "max_exposure": 0.20,
  "require_healthy_platform": true,
  "require_slo_compliance": true
}
```

**Evidence Requirements**:
- **AUTO mode only** - too risky for CANARY
- Minimum 50 historical picks
- Confidence score ≥ 0.70
- CLV positive rate ≥ 60%
- Current exposure ≤ 20%
- Platform health and SLO compliance required

### 4.4 GENERATE_HEDGE_ALERT

```json
{
  "id": "generate-hedge-alert",
  "action_type": "GENERATE_HEDGE_ALERT",
  "enabled": true,
  "allowed_modes": ["CANARY", "AUTO"],
  "min_sample_size": 20,
  "min_confidence_score": 0.60,
  "require_healthy_platform": true,
  "cooldown_seconds": 300,
  "cooldown_scope": "entity"
}
```

### 4.5 DEMOTE_CAPPER

```json
{
  "id": "demote-capper",
  "action_type": "DEMOTE_CAPPER",
  "enabled": true,
  "allowed_modes": ["AUTO"],
  "min_sample_size": 100,
  "min_confidence_score": 0.80,
  "require_healthy_platform": true,
  "require_slo_compliance": true
}
```

**Evidence Requirements**:
- **AUTO mode only** - demotion is serious
- Minimum 100 historical picks for confidence
- Confidence score ≥ 0.80
- Platform health and SLO compliance required

### 4.6 PAUSE_AGENT

```json
{
  "id": "pause-agent",
  "action_type": "PAUSE_AGENT",
  "enabled": true,
  "allowed_modes": ["CANARY", "AUTO"],
  "require_healthy_platform": false
}
```

**Note**: Can pause even when platform is degraded (safety mechanism).

### 4.7 AUTO_PROMOTE

```json
{
  "id": "auto-promote",
  "action_type": "AUTO_PROMOTE",
  "enabled": true,
  "allowed_modes": ["AUTO"],
  "min_sample_size": 30,
  "min_confidence_score": 0.75,
  "min_confidence_tier": "A",
  "min_clv_positive_rate": 0.60,
  "require_healthy_platform": true,
  "require_slo_compliance": true
}
```

### 4.8 SEND_NOTIFICATION

```json
{
  "id": "send-notification",
  "action_type": "SEND_NOTIFICATION",
  "enabled": true,
  "allowed_modes": ["CANARY", "AUTO"],
  "require_healthy_platform": true,
  "cooldown_seconds": 60,
  "cooldown_scope": "entity"
}
```

### 4.9 APPLY_COOLDOWN

```json
{
  "id": "apply-cooldown",
  "action_type": "APPLY_COOLDOWN",
  "enabled": true,
  "allowed_modes": ["CANARY", "AUTO"]
}
```

### 4.10 UPDATE_TIER

```json
{
  "id": "update-tier",
  "action_type": "UPDATE_TIER",
  "enabled": true,
  "allowed_modes": ["AUTO"],
  "min_sample_size": 50,
  "min_confidence_score": 0.70,
  "require_healthy_platform": true,
  "require_slo_compliance": true
}
```

---

## 5. Evidence Schema

```typescript
interface PolicyEvidence {
  // Sample metrics
  sample_size?: number;
  min_sample_required?: number;

  // Confidence metrics
  confidence_score?: number;        // 0.0 - 1.0
  confidence_tier?: 'S' | 'A' | 'B' | 'C' | 'D';

  // CLV metrics
  clv_percentage?: number;          // -100% to +100%
  clv_positive_rate?: number;       // 0.0 - 1.0

  // Performance metrics
  win_rate?: number;                // 0.0 - 1.0
  roi?: number;                     // percentage

  // Risk metrics
  exposure_current?: number;        // 0.0 - 1.0
  exposure_max?: number;
  correlation_count?: number;

  // System metrics
  pipeline_health?: 'PASS' | 'WARN' | 'FAIL';
  sla_pass_rate?: number;           // 0.0 - 1.0
  stuck_picks_count?: number;
}
```

---

## 6. Decision Flow

```
┌────────────────────────┐
│   Action Request       │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Find Policy Rule      │─── Not Found ──► DENY (POLICY_NOT_FOUND)
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Check Operator        │─── Freeze Active ──► DENY (OPERATOR_FREEZE)
│  Freezes               │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Check Mode            │─── OFF ──► DENY (MODE_OFF)
│                        │─── SHADOW ──► SHADOW_ONLY
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Check Mode Allowed    │─── Not Allowed ──► DENY
│  for Action            │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Check Platform Health │─── FAIL ──► DENY (PLATFORM_DEGRADED)
│  & SLO Compliance      │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Check Evidence        │─── Insufficient ──► DENY (INSUFFICIENT_*)
│  Requirements          │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│  Check Cooldowns       │─── Active ──► DENY (COOLDOWN_ACTIVE)
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│       ALLOW            │
└────────────────────────┘
```

---

## 7. Reason Codes

| Code | Description | Escalation |
|------|-------------|------------|
| POLICY_NOT_FOUND | No rule for action type | No |
| POLICY_MALFORMED | Rule configuration error | Yes |
| MODE_OFF | Autopilot mode is OFF | No |
| MODE_SHADOW | Shadow mode (log only) | No |
| CANARY_NOT_SELECTED | Outside canary percentage | No |
| OPERATOR_FREEZE_ACTIVE | Global freeze enabled | No |
| OPERATOR_OVERRIDE | Operator override active | No |
| AGENT_FREEZE_ACTIVE | Agent-level freeze | No |
| INSUFFICIENT_SAMPLE_SIZE | Below min sample | Yes |
| CONFIDENCE_BELOW_THRESHOLD | Below confidence req | Yes |
| CLV_REQUIREMENT_NOT_MET | CLV below threshold | Yes |
| PLATFORM_DEGRADED | Platform health FAIL | No |
| SLO_VIOLATION | SLO status CRITICAL | No |
| COOLDOWN_ACTIVE | Cooldown not expired | No |
| EXPOSURE_LIMIT_EXCEEDED | Over exposure limit | No |
| ACTION_TYPE_DISABLED | Action disabled in policy | No |
| EVIDENCE_MISSING | Required evidence absent | Yes |
| ALLOWED_BY_POLICY | All requirements met | No |

---

## 8. Operator Override Specification

### 8.1 Global Freeze

```typescript
{
  "global_freeze": true  // Blocks ALL autopilot actions
}
```

### 8.2 Agent Freeze

```typescript
{
  "agent_freezes": {
    "GradingAgent": true,    // Freeze specific agent
    "AlertAgent": false      // Keep agent active
  }
}
```

### 8.3 Action Freeze

```typescript
{
  "action_freezes": {
    "PUBLISH_PICK": true,     // Freeze pick publishing
    "ADJUST_SIZING": true,    // Freeze sizing changes
    "SEND_NOTIFICATION": false // Keep notifications active
  }
}
```

---

## 9. Mode Transition Rules

| From | To | Requirements |
|------|----|--------------|
| OFF | SHADOW | Operator approval |
| SHADOW | CANARY | 24h shadow + all tests pass |
| CANARY | AUTO | 4h canary + <1% error rate |
| AUTO | CANARY | Automatic on error spike |
| CANARY | SHADOW | Automatic on 5+ errors/min |
| SHADOW | OFF | Operator approval |
| ANY | OFF | Operator override (immediate) |

---

## 10. Cooldown Scopes

| Scope | Description | Example |
|-------|-------------|---------|
| global | One cooldown for all | System-wide rate limit |
| agent | Per-agent cooldown | Agent can't repeat action |
| entity | Per-entity cooldown | Pick/capper can't be actioned again |

---

## 11. Default Configuration

```json
{
  "version": "1.0.0",
  "default_mode": "SHADOW",
  "canary_percentage": 10,
  "fail_closed": true,
  "operator_overrides": {
    "global_freeze": false,
    "agent_freezes": {},
    "action_freezes": {}
  }
}
```

**Note**: Default mode is SHADOW — new deployments log only until explicitly enabled.

---

*Policy specification version 1.0.0 - 2026-01-19*
