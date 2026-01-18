# AUTOPILOT_SPEC.md

**Unit Talk Platform - Autopilot System Specification**
**Version**: 1.0.0
**Date**: 2025-01-14
**Status**: Production Ready

---

## Executive Summary

This document specifies the Unit Talk Autopilot system for autonomous pick publishing without human intervention. The system operates in four distinct modes with evidence-based promotion gates, comprehensive safety mechanisms, and fail-closed design principles.

**Core Principle**: The autopilot NEVER publishes a pick unless it has passed all safety checks and quality gates. When in doubt, the system defaults to rejection (fail-closed).

---

## Table of Contents

1. [Autopilot State Machine](#autopilot-state-machine)
2. [Mode Definitions](#mode-definitions)
3. [Promotion Gates](#promotion-gates)
4. [Decision Logic](#decision-logic)
5. [Safety Mechanisms](#safety-mechanisms)
6. [Kill-Switch & Emergency Stop](#kill-switch--emergency-stop)
7. [Monitoring & Observability](#monitoring--observability)
8. [Rollback Procedures](#rollback-procedures)

---

## Autopilot State Machine

### State Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOPILOT STATE MACHINE                       │
│                                                                   │
│   ┌──────┐                                                       │
│   │ OFF  │  (Autopilot completely disabled)                     │
│   └──┬───┘                                                       │
│      │                                                            │
│      │ START (manual)                                            │
│      ▼                                                            │
│   ┌──────────┐                                                   │
│   │ LOG_ONLY │  (Evaluate + Log decisions, NO publishing)       │
│   └──┬───────┘                                                   │
│      │                                                            │
│      │ GATE 1: Stability Check (7 days @ >95% accuracy)         │
│      ▼                                                            │
│   ┌─────────┐                                                    │
│   │ CANARY  │  (Publish to test channel, 25% traffic)           │
│   └──┬──────┘                                                    │
│      │                                                            │
│      │ GATE 2: Performance Check (3 days @ >98% accuracy)       │
│      ▼                                                            │
│   ┌──────┐                                                       │
│   │ PROD │  (Full production publishing, 100% traffic)          │
│   └──┬───┘                                                       │
│      │                                                            │
│      │ EMERGENCY STOP (any time)                                │
│      ▼                                                            │
│   ┌──────┐                                                       │
│   │ OFF  │  (Immediate halt, manual restart required)           │
│   └──────┘                                                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

State Transition Rules:
  - OFF → LOG_ONLY: Manual activation only
  - LOG_ONLY → CANARY: Promotion Gate 1 passed + manual approval
  - CANARY → PROD: Promotion Gate 2 passed + manual approval
  - Any → OFF: Emergency stop (automatic or manual)
  - No automatic promotions without human approval
```

---

## Mode Definitions

### 1. OFF Mode

**State**: Autopilot completely disabled

**Behavior**:
- ❌ No evaluation runs
- ❌ No decision logging
- ❌ No pick publishing
- ❌ No database writes (except mode change logs)

**Use Cases**:
- Initial system state
- Post-emergency stop
- Maintenance windows
- System debugging

**Exit Conditions**:
- Manual activation to LOG_ONLY mode
- Requires operator approval

---

### 2. LOG_ONLY Mode

**State**: Evaluation and logging without any publishing

**Behavior**:
- ✅ Evaluate candidate picks
- ✅ Run risk checks
- ✅ Run staleness checks
- ✅ Log decisions to `autopilot_decisions` table
- ✅ Generate daily reports
- ❌ NO Discord posts
- ❌ NO database writes to picks/publishing tables
- ❌ NO external side effects

**Purpose**: Build confidence in autopilot decision-making without risk

**Decision Process**:
```typescript
FOR EACH candidate_pick:
  risk_check = evaluate_risk(pick)
  staleness_check = evaluate_staleness(pick)
  slo_check = evaluate_slo_status()

  decision = make_decision(risk_check, staleness_check, slo_check)

  // Log what WOULD happen in production
  log_decision({
    decision: 'approved' | 'rejected' | 'unknown',
    would_publish: boolean,
    publish_blocked_reason: string | null,
    mode: 'log_only'
  })

  // CRITICAL: Do NOT actually publish
```

**Success Metrics**:
- Decision accuracy: Compare logged decisions to manual operator decisions
- False positive rate: Picks that should NOT have been approved
- False negative rate: Picks that SHOULD have been approved
- SLO adherence: Decisions respect SLO blockers

**Promotion Requirements** (see Gate 1 below):
- 7+ days of continuous operation
- ≥95% decision accuracy
- <2% false positive rate
- <5% false negative rate
- Manual operator approval

---

### 3. CANARY Mode

**State**: Limited production publishing to test channel

**Behavior**:
- ✅ Evaluate candidate picks
- ✅ Run risk checks
- ✅ Run staleness checks
- ✅ Log decisions to `autopilot_decisions` table
- ✅ **Publish to Discord canary channel** (25% traffic)
- ✅ Write to picks/publishing tables
- ⚠️ Limited scope: Test channel only
- ⚠️ Traffic control: 25% of eligible picks

**Purpose**: Validate real-world publishing with limited blast radius

**Traffic Control**:
```typescript
FOR EACH approved_pick:
  IF random() < 0.25:  // 25% sampling
    IF passes_all_gates(pick):
      publish_to_canary_channel(pick)
    ELSE:
      log_blocked_reason(pick)
```

**Canary Channel Configuration**:
- Discord channel: `#canary-autopilot-picks`
- User audience: Internal team + beta testers only
- Notification prefix: " [CANARY - AUTOPILOT]"
- Metadata included: Risk score, decision reason, SLO snapshot

**Success Metrics**:
- Publishing accuracy: ≥98% of canary picks are high quality
- User feedback: <2% negative feedback on canary picks
- False positive rate: <1%
- System stability: No circuit breaker trips

**Promotion Requirements** (see Gate 2 below):
- 3+ days of continuous operation in canary mode
- ≥98% publishing accuracy
- <1% false positive rate
- <2% user complaints
- Manual operator approval

---

### 4. PROD Mode

**State**: Full production publishing

**Behavior**:
- ✅ Evaluate candidate picks
- ✅ Run risk checks
- ✅ Run staleness checks
- ✅ Log decisions to `autopilot_decisions` table
- ✅ **Publish to Discord production channels** (100% traffic)
- ✅ Write to picks/publishing tables
- ✅ Full system engagement

**Purpose**: Autonomous operation without human intervention

**Production Publishing**:
```typescript
FOR EACH approved_pick:
  IF passes_all_gates(pick):
    publish_to_production_channel(pick)
    mark_as_published(pick)
  ELSE:
    log_blocked_reason(pick)
    OPTIONAL: notify_operator_for_review(pick)
```

**Production Channel Configuration**:
- Discord channels: `#live-picks`, `#vip-picks` (based on tier)
- User audience: All subscribers
- Notification prefix: None (standard production format)
- Rate limits: 10 picks per 15 minutes (prevent spam)

**Success Metrics**:
- Publishing accuracy: ≥99% of production picks are high quality
- User feedback: <1% negative feedback
- CLV performance: Positive CLV on ≥60% of picks
- System uptime: ≥99.5%

**Degradation Triggers** (automatic demotion to LOG_ONLY):
- Publishing accuracy drops below 95% for 24 hours
- False positive rate exceeds 3%
- Circuit breaker trips exceed 10 per hour
- SLO failures exceed 50% for 1 hour

---

## Promotion Gates

### Gate 1: LOG_ONLY → CANARY

**Evidence-Based Requirements**:

1. **Stability Period**: 7 consecutive days in LOG_ONLY mode
   - No manual restarts or crashes
   - No critical errors logged

2. **Decision Accuracy**: ≥95% agreement with manual operator decisions
   - Sample size: Minimum 500 picks evaluated
   - Calculation: `(correct_decisions / total_decisions) * 100`
   - Measurement: Compare autopilot decisions to post-facto manual review

3. **False Positive Rate**: <2%
   - False positive: Autopilot approved, but manual review rejects
   - Calculation: `(false_positives / total_approvals) * 100`
   - Impact: High risk – could publish bad picks

4. **False Negative Rate**: <5%
   - False negative: Autopilot rejected, but manual review approves
   - Calculation: `(false_negatives / total_rejections) * 100`
   - Impact: Medium risk – misses good picks (revenue loss)

5. **SLO Compliance**: 100% of decisions respect SLO blockers
   - No picks approved during SLO failures
   - No publishing during system degradation

6. **Risk Scoring Calibration**: Risk scores align with outcomes
   - Low risk (<20): ≥95% should be approved
   - Medium risk (20-50): Manual review region
   - High risk (>50): ≥95% should be rejected

**Validation Process**:

```sql
-- Query to validate Gate 1 criteria
WITH decision_accuracy AS (
  SELECT
    COUNT(*) FILTER (WHERE autopilot_decision = manual_review) AS correct,
    COUNT(*) AS total,
    (COUNT(*) FILTER (WHERE autopilot_decision = manual_review)::FLOAT / COUNT(*)) AS accuracy
  FROM autopilot_decisions ad
  JOIN manual_reviews mr ON ad.pick_id = mr.pick_id
  WHERE ad.mode = 'log_only'
    AND ad.evaluated_at >= NOW() - INTERVAL '7 days'
),
false_positives AS (
  SELECT
    COUNT(*) FILTER (WHERE ad.decision = 'approved' AND mr.decision = 'rejected') AS fp_count,
    COUNT(*) FILTER (WHERE ad.decision = 'approved') AS total_approvals,
    (COUNT(*) FILTER (WHERE ad.decision = 'approved' AND mr.decision = 'rejected')::FLOAT /
     COUNT(*) FILTER (WHERE ad.decision = 'approved')) AS fp_rate
  FROM autopilot_decisions ad
  JOIN manual_reviews mr ON ad.pick_id = mr.pick_id
  WHERE ad.mode = 'log_only'
    AND ad.evaluated_at >= NOW() - INTERVAL '7 days'
)
SELECT
  da.accuracy >= 0.95 AS accuracy_passed,
  fp.fp_rate < 0.02 AS false_positive_passed,
  -- Add other checks
FROM decision_accuracy da, false_positives fp;
```

**Manual Approval Checklist**:

- [ ] All automated checks passed
- [ ] Review sample of 50 random decisions
- [ ] Review all high-risk decisions (risk score >50)
- [ ] Confirm SLO compliance
- [ ] Ops team approval
- [ ] Engineering team approval

**Promotion Action**:
```bash
# Execute promotion to CANARY
curl -X POST https://api.unittalk.com/autopilot/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "from_mode": "log_only",
    "to_mode": "canary",
    "approved_by": "operator@unittalk.com",
    "approval_reason": "Gate 1 criteria met, manual review completed"
  }'
```

---

### Gate 2: CANARY → PROD

**Evidence-Based Requirements**:

1. **Stability Period**: 3 consecutive days in CANARY mode
   - No emergency stops
   - No rollbacks to LOG_ONLY

2. **Publishing Accuracy**: ≥98% of published picks are high quality
   - Sample size: Minimum 200 picks published to canary
   - Quality measurement: User feedback + manual review
   - Calculation: `(high_quality_picks / total_published) * 100`

3. **False Positive Rate**: <1%
   - Stricter than Gate 1 (production requires higher bar)
   - Measured on published picks only

4. **User Feedback**: <2% negative feedback
   - Measure complaints, downvotes, negative comments
   - Calculation: `(negative_feedback / total_published) * 100`

5. **System Stability**: No circuit breaker trips
   - Discord API: 0 trips
   - Supabase: 0 trips
   - External APIs: <3 trips per day

6. **SLO Performance**: ≥95% SLO pass rate
   - Ingestion freshness: <60 minutes
   - Publishing latency: <2 seconds (p95)
   - Grading backlog: <100 picks

7. **Rate Limit Compliance**: No rate limit violations
   - Discord: ≤10 picks per 15 minutes
   - No spam complaints

**Validation Process**:

```sql
-- Query to validate Gate 2 criteria
WITH canary_performance AS (
  SELECT
    COUNT(*) AS total_published,
    COUNT(*) FILTER (WHERE quality_score >= 8) AS high_quality,
    COUNT(*) FILTER (WHERE user_feedback = 'negative') AS negative_feedback,
    (COUNT(*) FILTER (WHERE quality_score >= 8)::FLOAT / COUNT(*)) AS accuracy,
    (COUNT(*) FILTER (WHERE user_feedback = 'negative')::FLOAT / COUNT(*)) AS feedback_rate
  FROM autopilot_decisions
  WHERE mode = 'canary'
    AND would_publish = true
    AND evaluated_at >= NOW() - INTERVAL '3 days'
),
circuit_breaker_trips AS (
  SELECT COUNT(*) AS trip_count
  FROM circuit_breaker_events
  WHERE occurred_at >= NOW() - INTERVAL '3 days'
)
SELECT
  cp.accuracy >= 0.98 AS accuracy_passed,
  cp.feedback_rate < 0.02 AS feedback_passed,
  cbt.trip_count = 0 AS stability_passed
FROM canary_performance cp, circuit_breaker_trips cbt;
```

**Manual Approval Checklist**:

- [ ] All automated checks passed
- [ ] Review all published picks from canary period
- [ ] Analyze user feedback in detail
- [ ] Confirm no system instability
- [ ] Review CLV performance (if available)
- [ ] Ops team approval
- [ ] Engineering team approval
- [ ] Product team approval

**Promotion Action**:
```bash
# Execute promotion to PROD
curl -X POST https://api.unittalk.com/autopilot/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "from_mode": "canary",
    "to_mode": "prod",
    "approved_by": "operator@unittalk.com",
    "approval_reason": "Gate 2 criteria met, canary period successful"
  }'
```

---

## Decision Logic

### Decision Flow

```
START: Pick Candidate
  │
  ▼
┌─────────────────────┐
│ 1. Risk Assessment  │
│  - Missing fields?  │
│  - Invalid odds?    │
│  - Extreme values?  │
│  - Low confidence?  │
└──────┬──────────────┘
       │
       ▼
  Risk Score Calculated (0-100)
       │
       ├─ Score ≥50 → REJECT (High Risk)
       │
       ▼
┌─────────────────────┐
│ 2. Staleness Check  │
│  - Data age >60min? │
│  - Odds stale >30m? │
│  - Too many recent? │
└──────┬──────────────┘
       │
       ▼
  Staleness Result
       │
       ├─ is_stale = true → REJECT (Stale Data)
       │
       ▼
┌─────────────────────┐
│ 3. SLO Check        │
│  - Overall FAIL?    │
│  - Datasources down?│
│  - Too many fails?  │
└──────┬──────────────┘
       │
       ▼
  SLO Blockers?
       │
       ├─ Blockers present → REJECT (System Degraded)
       │
       ▼
┌─────────────────────┐
│ 4. Decision Logic   │
│  Risk <20 + Fresh   │
│  → APPROVED         │
│                     │
│  Risk 20-50 + Fresh │
│  → UNKNOWN (Review) │
│                     │
│  Otherwise          │
│  → REJECTED         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 5. Publishing Check │
│  - Mode = log_only? │
│    → Block publish  │
│  - Mode = canary?   │
│    → 25% sampling   │
│  - Mode = prod?     │
│    → Publish        │
└─────────────────────┘
```

### Risk Scoring Algorithm

**Risk Score = Sum of Risk Factors (capped at 100)**

| Risk Factor | Severity | Score | Description |
|------------|----------|-------|-------------|
| Missing critical fields | Critical | +100 | player_name, stat_type, or line missing |
| Zero odds | Critical | +80 | Odds = 0 (corrupted data) |
| Missing odds | High | +60 | No over_odds or under_odds |
| Extreme odds | High | +50 | Odds > ±500 (suspicious) |
| Extreme line | High | +40 | Line value > 1000 |
| Low confidence | Medium | +30 | Confidence < 0.5 |
| Suspicious line | Medium | +25 | Line < 0.1 for non-boolean props |
| Invalid sport | Medium | +20 | Sport not in [NBA, NFL, MLB, NHL, NCAAB, NCAAF] |

**Risk Thresholds by Mode**:
- **log_only**: <50 (lenient for testing)
- **canary**: <30 (stricter for limited publishing)
- **prod**: <20 (very strict for full production)

### Staleness Criteria

| Check | Threshold | Impact |
|-------|-----------|--------|
| Data age | >60 minutes | Stale (too old to publish) |
| Odds freshness | Newer odds available >30 min | Stale (better data exists) |
| Recent publish volume | >10 picks in last 15 min | Rate limit (prevent spam) |

**Staleness Thresholds by Mode**:
- **log_only**: 60 minutes (lenient)
- **canary**: 30 minutes (moderate)
- **prod**: 15 minutes (strict)

### SLO Blockers

**Automatic Rejection if**:
1. Overall SLO status = FAIL
2. Both datasources (local_postgres AND supabase) disconnected
3. More than 2 SLOs failing simultaneously

**SLO Status Checks**:
```typescript
function checkSLOBlockers(snapshot: SLOSnapshot): string[] {
  const blockers = [];

  if (snapshot.overall_status === 'FAIL') {
    blockers.push('Overall SLO status is FAIL');
  }

  if (!snapshot.data_sources.local_postgres && !snapshot.data_sources.supabase) {
    blockers.push('Both datasources disconnected');
  }

  if (snapshot.slo_summary.fail_count > 2) {
    blockers.push(`Too many failing SLOs (${snapshot.slo_summary.fail_count})`);
  }

  return blockers;
}
```

---

## Safety Mechanisms

### 1. Fail-Closed Design

**Principle**: When in doubt, REJECT

**Implementation**:
- Default decision = 'unknown' (not 'approved')
- All checks must explicitly pass (no implicit pass)
- Missing data → REJECT
- Calculation errors → REJECT
- Timeouts → REJECT

**Code Example**:
```typescript
let decision: DecisionOutcome = 'unknown'; // Fail-closed default

if (!riskResult.passed) {
  decision = 'rejected';
} else if (stalenessResult.is_stale) {
  decision = 'rejected';
} else if (riskResult.risk_score < 20) {
  decision = 'approved'; // Only approved if explicitly safe
} else {
  decision = 'unknown'; // Ambiguous case → manual review
}
```

---

### 2. Evidence-Based Decision Logging

**All decisions logged to `autopilot_decisions` table**:

```sql
CREATE TABLE autopilot_decisions (
  id UUID PRIMARY KEY,
  mode TEXT NOT NULL,
  evaluation_run_id UUID NOT NULL,
  evaluated_at TIMESTAMPTZ,

  -- Pick context
  pick_id UUID,
  pick_data JSONB NOT NULL,

  -- Decision outcome
  decision TEXT NOT NULL, -- 'approved', 'rejected', 'unknown'
  decision_reason TEXT NOT NULL,

  -- Evidence
  risk_score NUMERIC(5,2),
  risk_factors JSONB,
  data_age_minutes INTEGER,
  odds_staleness_minutes INTEGER,
  is_stale BOOLEAN,

  -- Publishing context
  would_publish BOOLEAN NOT NULL,
  publish_channel TEXT,
  publish_blocked_reason TEXT,

  -- SLO snapshot
  slo_snapshot JSONB,

  -- Performance
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Retention**: All decisions retained indefinitely for audit and ML training

---

### 3. Circuit Breaker Integration

**External Service Protection**:

| Service | Failure Threshold | Reset Timeout | Fallback |
|---------|------------------|---------------|----------|
| Discord API | 3 failures | 45 seconds | Queue for retry |
| Supabase | 3 failures | 45 seconds | Local cache |
| OpenAI API | 3 failures | 45 seconds | Template formatting |
| Odds API | 5 failures | 60 seconds | Cached data |

**Circuit Breaker States**:
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service unavailable, requests fail fast
- **HALF_OPEN**: Testing recovery, limited requests

**Autopilot Behavior**:
- If Discord circuit breaker OPEN → Block publishing, queue decisions
- If Supabase circuit breaker OPEN → Emergency stop, cannot evaluate
- If odds API circuit breaker OPEN → Mark data as stale, reject picks

---

### 4. Rate Limiting

**Publishing Rate Limits**:

```typescript
const RATE_LIMITS = {
  // Prevent spam
  max_picks_per_15_min: 10,
  max_picks_per_hour: 30,
  max_picks_per_day: 200,

  // Prevent concurrent overload
  max_concurrent_evaluations: 5,
  max_picks_per_batch: 50,
};

// Rate limiter implementation
class RateLimiter {
  check(channel: string): boolean {
    const recent_count = getRecentPublishCount(channel, 15 * 60);
    return recent_count < RATE_LIMITS.max_picks_per_15_min;
  }
}
```

**Enforcement**:
- Staleness checker queries recent publish count
- If threshold exceeded → Mark pick as stale, reject
- Reset counter after time window expires

---

### 5. Idempotency

**Duplicate Prevention**:

```typescript
// Use pick_id as idempotency key
const existingDecision = await supabase
  .from('autopilot_decisions')
  .select('*')
  .eq('pick_id', pick.id)
  .eq('evaluation_run_id', current_run_id)
  .single();

if (existingDecision) {
  return existingDecision; // Skip re-evaluation
}
```

**Benefits**:
- Safe to retry evaluation runs
- No duplicate publishing
- Consistent decision outcomes

---

### 6. Gradual Traffic Ramp

**Canary Traffic Control**:

```typescript
const TRAFFIC_PERCENTAGES = {
  canary: 0.25, // 25% of approved picks
  prod: 1.0,    // 100% of approved picks
};

function shouldPublish(mode: AutopilotMode, pick: PickData): boolean {
  const threshold = TRAFFIC_PERCENTAGES[mode];
  const hash = stableHash(pick.id); // Deterministic hash
  return (hash % 100) < (threshold * 100);
}
```

**Benefits**:
- Consistent sampling (same pick always in/out of canary)
- No sudden traffic spikes
- Easy to adjust percentage

---

## Kill-Switch & Emergency Stop

### Emergency Stop Triggers

**Automatic Emergency Stop** (immediate transition to OFF mode):

1. **Publishing Accuracy Drop**
   - Accuracy <90% over 1 hour
   - False positive rate >5% over 1 hour
   - Action: Immediate stop, alert ops team

2. **Circuit Breaker Storms**
   - >10 circuit breaker trips in 1 hour (any service)
   - >5 Discord circuit breaker trips in 1 hour
   - Action: Stop publishing, alert ops team

3. **SLO Catastrophic Failure**
   - >50% of SLOs failing for >30 minutes
   - Both datasources (local_postgres AND supabase) down for >5 minutes
   - Action: Stop all operations, alert ops team

4. **Rate Limit Violations**
   - Discord rate limit hit >3 times in 1 hour
   - User complaints about spam
   - Action: Stop publishing, alert ops team

5. **Manual Emergency Stop**
   - Operator executes emergency stop command
   - Action: Immediate stop, require manual restart

**Emergency Stop Implementation**:

```typescript
class EmergencyStop {
  private stopReasons: string[] = [];

  async evaluateTriggers(): Promise<boolean> {
    // Check all automatic triggers
    const accuracyCheck = await this.checkAccuracy();
    const circuitBreakerCheck = await this.checkCircuitBreakers();
    const sloCheck = await this.checkSLOStatus();
    const rateLimitCheck = await this.checkRateLimits();

    if (accuracyCheck.shouldStop) {
      this.stopReasons.push(accuracyCheck.reason);
    }
    if (circuitBreakerCheck.shouldStop) {
      this.stopReasons.push(circuitBreakerCheck.reason);
    }
    if (sloCheck.shouldStop) {
      this.stopReasons.push(sloCheck.reason);
    }
    if (rateLimitCheck.shouldStop) {
      this.stopReasons.push(rateLimitCheck.reason);
    }

    return this.stopReasons.length > 0;
  }

  async execute(): Promise<void> {
    // 1. Set mode to OFF
    await supabase
      .from('autopilot_config')
      .update({ mode: 'off', stopped_at: new Date(), stop_reason: this.stopReasons.join('; ') })
      .eq('id', 'current');

    // 2. Cancel all in-flight evaluations
    await cancelAllEvaluations();

    // 3. Alert operations team
    await discord.send({
      channel: '#ops-alerts',
      content: `🚨 EMERGENCY STOP TRIGGERED 🚨\n\nReasons:\n${this.stopReasons.map(r => `- ${r}`).join('\n')}\n\nManual restart required.`,
      priority: 'critical'
    });

    // 4. Log emergency stop event
    await supabase.from('autopilot_events').insert({
      event_type: 'emergency_stop',
      reasons: this.stopReasons,
      triggered_at: new Date()
    });
  }
}
```

---

### Manual Kill-Switch

**Kill-Switch Endpoints**:

```bash
# Immediate emergency stop
POST /api/autopilot/emergency-stop
Authorization: Bearer $ADMIN_TOKEN

Response:
{
  "success": true,
  "mode": "off",
  "stopped_at": "2025-01-14T10:30:00Z",
  "reason": "Manual emergency stop by operator@unittalk.com"
}
```

**Kill-Switch Access Control**:
- Requires admin authentication
- Audit logged with operator identity
- Confirmation required (prevent accidental stops)

**Kill-Switch UI** (Command Center):

```typescript
function EmergencyStopButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleEmergencyStop = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to EMERGENCY STOP the autopilot?\n\n' +
      'This will:\n' +
      '- Immediately halt all publishing\n' +
      '- Cancel in-flight evaluations\n' +
      '- Require manual restart\n\n' +
      'Type "EMERGENCY STOP" to confirm'
    );

    if (confirmed === 'EMERGENCY STOP') {
      await fetch('/api/autopilot/emergency-stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Emergency stop executed. Autopilot is now OFF.');
    }
  };

  return (
    <button
      className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
      onClick={handleEmergencyStop}
    >
      🚨 EMERGENCY STOP
    </button>
  );
}
```

---

### Graceful Degradation

**Degradation Paths** (instead of full stop):

1. **PROD → CANARY** (automatic demotion)
   - Trigger: Accuracy drops below 95% for 24 hours
   - Action: Reduce traffic to 25%, increase monitoring

2. **CANARY → LOG_ONLY** (automatic demotion)
   - Trigger: Accuracy drops below 90% for 12 hours
   - Action: Stop publishing, continue evaluation for analysis

3. **Any Mode → LOG_ONLY** (operator intervention)
   - Trigger: Manual demotion by operator
   - Action: Stop publishing, continue evaluation

**Degradation Implementation**:

```typescript
async function evaluateDegradation(mode: AutopilotMode): Promise<AutopilotMode | null> {
  if (mode === 'prod') {
    const accuracy = await getAccuracyLast24Hours();
    if (accuracy < 0.95) {
      return 'canary'; // Demote to canary
    }
  }

  if (mode === 'canary') {
    const accuracy = await getAccuracyLast12Hours();
    if (accuracy < 0.90) {
      return 'log_only'; // Demote to log_only
    }
  }

  return null; // No degradation needed
}
```

---

## Monitoring & Observability

### Real-Time Metrics

**Autopilot Dashboard** (Command Center):

```
┌────────────────────────────────────────────────────────────┐
│ Autopilot Status: PROD                                     │
│ Last Evaluation: 2 minutes ago                             │
│ Next Evaluation: in 3 minutes                              │
├────────────────────────────────────────────────────────────┤
│ Today's Metrics:                                           │
│   Total Evaluated: 347                                     │
│   Approved: 213 (61%)                                      │
│   Rejected: 98 (28%)                                       │
│   Unknown: 36 (11%)                                        │
│   Published: 213 (100% of approved)                        │
├────────────────────────────────────────────────────────────┤
│ Quality Metrics (24h):                                     │
│   Publishing Accuracy: 99.2% ✅                            │
│   False Positive Rate: 0.3% ✅                             │
│   User Feedback: 0.5% negative ✅                          │
│   Avg Risk Score: 12.4                                     │
├────────────────────────────────────────────────────────────┤
│ System Health:                                             │
│   SLO Status: PASS (6/6 SLOs passing)                     │
│   Circuit Breakers: All CLOSED                            │
│   Rate Limits: 7/10 picks used (last 15min)              │
│   Last Emergency Stop: Never                               │
└────────────────────────────────────────────────────────────┘
```

---

### Alert Configuration

**Alert Levels**:

| Severity | Threshold | Action | Channel |
|----------|-----------|--------|---------|
| Info | Decision logged | Log only | None |
| Warning | Accuracy <97% for 4 hours | Notify ops team | Discord #ops |
| Critical | Accuracy <95% for 1 hour | Alert + escalate | Discord #ops + PagerDuty |
| Emergency | Emergency stop triggered | Immediate response | Discord #ops + PagerDuty + SMS |

**Alert Examples**:

```typescript
// Warning: Accuracy degradation
if (accuracy < 0.97 && duration > 4 * 60 * 60) {
  await discord.send({
    channel: '#ops',
    content: '⚠️ Autopilot accuracy degraded to 96.8% over last 4 hours. Monitor closely.',
    severity: 'warning'
  });
}

// Critical: Accuracy drop
if (accuracy < 0.95 && duration > 1 * 60 * 60) {
  await discord.send({
    channel: '#ops',
    content: '🚨 CRITICAL: Autopilot accuracy dropped to 94.2%. Automatic demotion to CANARY in progress.',
    severity: 'critical'
  });
  await pagerduty.trigger({
    incident_key: 'autopilot-accuracy-drop',
    description: 'Autopilot accuracy below threshold'
  });
}

// Emergency: Emergency stop
if (emergencyStopTriggered) {
  await discord.send({
    channel: '#ops',
    content: '🚨🚨🚨 EMERGENCY STOP TRIGGERED 🚨🚨🚨\n\nAutopilot has been stopped. Manual restart required.',
    severity: 'emergency'
  });
  await pagerduty.trigger({
    incident_key: 'autopilot-emergency-stop',
    description: 'Autopilot emergency stop executed'
  });
  await sms.send({
    to: ONCALL_PHONE,
    message: 'EMERGENCY: Autopilot stopped. Check Command Center immediately.'
  });
}
```

---

### Daily Reports

**Report Generation** (automated via SQL function):

```sql
SELECT * FROM get_daily_autopilot_report('2025-01-14');

-- Returns:
{
  "total_evaluated": 347,
  "approved_count": 213,
  "rejected_count": 98,
  "unknown_count": 36,
  "would_publish_count": 213,
  "avg_risk_score": 12.4,
  "stale_count": 15,
  "rejection_reasons": [
    {"reason": "Risk check failed: Extreme odds", "count": 23},
    {"reason": "Staleness check failed: Data >60min old", "count": 15},
    {"reason": "SLO blockers: Overall status FAIL", "count": 8}
  ],
  "avg_execution_time_ms": 127
}
```

**Report Distribution**:
- Discord #autopilot-reports channel (daily at 9 AM EST)
- Notion page for persistent storage
- Email to ops team (weekly summary)

---

## Rollback Procedures

### Rollback Scenarios

**Scenario 1: PROD → CANARY (Performance Degradation)**

**Trigger**: Accuracy drops below 95% for 24 hours

**Procedure**:
1. Automatic demotion to CANARY mode
2. Reduce traffic to 25%
3. Alert ops team
4. Investigate root cause
5. Fix issues
6. Re-evaluate Gate 2 criteria
7. Manual re-promotion to PROD if criteria met

**Rollback Time**: Immediate (automatic)

---

**Scenario 2: CANARY → LOG_ONLY (Publishing Issues)**

**Trigger**: Accuracy drops below 90% for 12 hours

**Procedure**:
1. Automatic demotion to LOG_ONLY mode
2. Stop all publishing
3. Alert ops team
4. Investigate root cause
5. Fix issues
6. Re-evaluate Gate 1 criteria
7. Manual re-promotion to CANARY if criteria met

**Rollback Time**: Immediate (automatic)

---

**Scenario 3: Any Mode → OFF (Emergency Stop)**

**Trigger**: Emergency stop triggered (automatic or manual)

**Procedure**:
1. Immediate halt of all operations
2. Cancel in-flight evaluations
3. Alert ops team (critical)
4. Investigate root cause
5. Fix issues
6. Manual restart required (cannot auto-restart)

**Recovery Steps**:
1. Identify and resolve emergency stop cause
2. Verify all systems healthy
3. Run manual test evaluation
4. Restart in LOG_ONLY mode
5. Monitor closely for 24 hours
6. Re-evaluate promotion gates as needed

**Rollback Time**: Immediate stop, recovery time varies (hours to days)

---

### Rollback Testing

**Quarterly Rollback Drills**:

1. **Simulated Emergency Stop**
   - Trigger: Manual emergency stop in production
   - Validate: Immediate halt, alerts sent, systems stopped
   - Recovery: Manual restart, full system validation

2. **Simulated Accuracy Drop**
   - Trigger: Inject bad decisions to simulate accuracy drop
   - Validate: Automatic demotion from PROD → CANARY
   - Recovery: Remove bad decisions, automatic promotion back

3. **Simulated Circuit Breaker Storm**
   - Trigger: Disable Discord API to trigger circuit breaker
   - Validate: Emergency stop after threshold breached
   - Recovery: Re-enable API, manual restart

**Drill Documentation**:
- Record trigger time, response time, recovery time
- Document any issues discovered
- Update procedures based on learnings

---

## Appendix: Configuration Examples

### Autopilot Configuration

```yaml
# apps/command-center/config/autopilot.yaml

autopilot:
  enabled: true
  mode: "log_only"  # off | log_only | canary | prod

  evaluation:
    poll_interval_ms: 300000  # 5 minutes
    batch_size: 50
    timeout_ms: 10000  # 10 seconds

  risk_thresholds:
    log_only: 50
    canary: 30
    prod: 20

  staleness_thresholds:
    log_only: 60  # minutes
    canary: 30
    prod: 15

  rate_limits:
    max_picks_per_15_min: 10
    max_picks_per_hour: 30
    max_picks_per_day: 200

  promotion_gates:
    gate1:  # LOG_ONLY → CANARY
      stability_days: 7
      min_accuracy: 0.95
      max_false_positive_rate: 0.02
      max_false_negative_rate: 0.05
      min_sample_size: 500

    gate2:  # CANARY → PROD
      stability_days: 3
      min_accuracy: 0.98
      max_false_positive_rate: 0.01
      max_user_complaints_rate: 0.02
      min_sample_size: 200

  emergency_stop:
    min_accuracy_1h: 0.90
    max_circuit_breaker_trips_1h: 10
    max_slo_fail_percentage: 0.50
    max_slo_fail_duration_minutes: 30

  alerting:
    discord_webhook: "${AUTOPILOT_DISCORD_WEBHOOK}"
    pagerduty_key: "${AUTOPILOT_PAGERDUTY_KEY}"
    oncall_phone: "${ONCALL_PHONE}"
```

---

**Document Maintained By**: Platform Engineering Team
**Last Updated**: 2025-01-14
**Next Review**: After each mode promotion or emergency stop event
