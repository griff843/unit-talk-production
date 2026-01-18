# Time & Staleness Control Contract (Syndicate-Grade)

**Version:** 1.0.0
**Effective Date:** 2025-12-22
**Owner:** Trading Operations & Data Integrity
**Review Frequency:** Weekly

---

## 🎯 PURPOSE

**Top syndicates never bet stale lines.** Line movement is alpha. Betting on outdated odds is -EV.

This contract defines:

1. Maximum line age by market type
2. Event-time proximity rules (minimum time before start)
3. Automatic invalidation triggers (odds drift, market suspension)
4. Hard blocks on past/ambiguous event_time

**Golden Rule:** If we can't verify the line is fresh, we don't bet.

---

## 1️⃣ MAX LINE AGE BY MARKET

### Line Freshness Requirements

```typescript
interface LineAgePolicy {
  market_type: MarketType;
  max_age_minutes: number;      // Max age of odds
  requires_recent_update: boolean; // Must have recent update flag
  description: string;
}

const LINE_AGE_LIMITS: Record<MarketType, LineAgePolicy> = {
  moneyline: {
    market_type: MarketType.MONEYLINE,
    max_age_minutes: 30,          // 30 minutes for main lines
    requires_recent_update: true,
    description: 'High liquidity, frequent updates expected'
  },

  spread: {
    market_type: MarketType.SPREAD,
    max_age_minutes: 30,          // 30 minutes for spreads
    requires_recent_update: true,
    description: 'High liquidity, frequent updates expected'
  },

  total: {
    market_type: MarketType.TOTAL,
    max_age_minutes: 30,          // 30 minutes for totals
    requires_recent_update: true,
    description: 'High liquidity, frequent updates expected'
  },

  player_prop: {
    market_type: MarketType.PLAYER_PROP,
    max_age_minutes: 60,          // 60 minutes for player props
    requires_recent_update: false, // Props update less frequently
    description: 'Moderate liquidity, slower updates acceptable'
  },

  team_prop: {
    market_type: MarketType.TEAM_PROP,
    max_age_minutes: 60,
    requires_recent_update: false,
    description: 'Moderate liquidity, slower updates acceptable'
  },

  game_prop: {
    market_type: MarketType.GAME_PROP,
    max_age_minutes: 120,         // 2 hours for exotic props
    requires_recent_update: false,
    description: 'Low liquidity, infrequent updates'
  },
};
```

### Validation Logic

```typescript
interface LineAgeCheck {
  valid: boolean;
  line_age_minutes: number;
  max_allowed_minutes: number;
  rejection_reason?: string;
  updated_at?: Date;
}

function validateLineAge(
  rawProp: RawProp,
  currentTime: Date = new Date()
): LineAgeCheck {
  const policy = LINE_AGE_LIMITS[rawProp.market_type];

  // Check if we have update timestamp
  if (!rawProp.updated_at && !rawProp.created_at) {
    return {
      valid: false,
      line_age_minutes: Infinity,
      max_allowed_minutes: policy.max_age_minutes,
      rejection_reason: 'MISSING_TIMESTAMP',
    };
  }

  // Calculate line age
  const updated_at = new Date(rawProp.updated_at || rawProp.created_at);
  const ageMs = currentTime.getTime() - updated_at.getTime();
  const ageMinutes = ageMs / (1000 * 60);

  // Check against limit
  if (ageMinutes > policy.max_age_minutes) {
    return {
      valid: false,
      line_age_minutes: ageMinutes,
      max_allowed_minutes: policy.max_allowed_minutes,
      rejection_reason: 'LINE_TOO_STALE',
      updated_at,
    };
  }

  return {
    valid: true,
    line_age_minutes: ageMinutes,
    max_allowed_minutes: policy.max_age_minutes,
    updated_at,
  };
}
```

**Rejection Reason:** `LINE_TOO_STALE`

---

## 2️⃣ EVENT-TIME PROXIMITY RULES

### Minimum Time Before Game Start

**Rule:** No bets within X minutes of game start (varies by market).

```typescript
interface ProximityPolicy {
  market_type: MarketType;
  min_minutes_before_start: number;
  description: string;
}

const EVENT_PROXIMITY_LIMITS: Record<MarketType, ProximityPolicy> = {
  moneyline: {
    market_type: MarketType.MONEYLINE,
    min_minutes_before_start: 15,  // 15 min before start
    description: 'Allow close to start for main markets'
  },

  spread: {
    market_type: MarketType.SPREAD,
    min_minutes_before_start: 15,  // 15 min before start
    description: 'Allow close to start for main markets'
  },

  total: {
    market_type: MarketType.TOTAL,
    min_minutes_before_start: 15,  // 15 min before start
    description: 'Allow close to start for main markets'
  },

  player_prop: {
    market_type: MarketType.PLAYER_PROP,
    min_minutes_before_start: 60,  // 1 hour before start
    description: 'Props need more lead time due to lineup uncertainty'
  },

  team_prop: {
    market_type: MarketType.TEAM_PROP,
    min_minutes_before_start: 60,  // 1 hour before start
    description: 'Props need more lead time'
  },

  game_prop: {
    market_type: MarketType.GAME_PROP,
    min_minutes_before_start: 120, // 2 hours before start
    description: 'Exotic props need significant lead time'
  },
};
```

### Validation Logic

```typescript
interface ProximityCheck {
  valid: boolean;
  minutes_until_start: number;
  min_required_minutes: number;
  rejection_reason?: string;
}

function validateEventProximity(
  rawProp: RawProp,
  currentTime: Date = new Date()
): ProximityCheck {
  const policy = EVENT_PROXIMITY_LIMITS[rawProp.market_type];

  // Check for valid event_time
  if (!rawProp.event_time) {
    return {
      valid: false,
      minutes_until_start: -Infinity,
      min_required_minutes: policy.min_minutes_before_start,
      rejection_reason: 'MISSING_EVENT_TIME',
    };
  }

  const event_time = new Date(rawProp.event_time);

  // Check if event is in the past
  if (event_time <= currentTime) {
    return {
      valid: false,
      minutes_until_start: 0,
      min_required_minutes: policy.min_minutes_before_start,
      rejection_reason: 'EVENT_TIME_PAST',
    };
  }

  // Calculate time until start
  const timeUntilMs = event_time.getTime() - currentTime.getTime();
  const minutesUntil = timeUntilMs / (1000 * 60);

  // Check proximity limit
  if (minutesUntil < policy.min_minutes_before_start) {
    return {
      valid: false,
      minutes_until_start: minutesUntil,
      min_required_minutes: policy.min_minutes_before_start,
      rejection_reason: 'EVENT_TOO_SOON',
    };
  }

  return {
    valid: true,
    minutes_until_start: minutesUntil,
    min_required_minutes: policy.min_minutes_before_start,
  };
}
```

**Rejection Reasons:**
- `MISSING_EVENT_TIME`: No event_time provided
- `EVENT_TIME_PAST`: Event already started
- `EVENT_TOO_SOON`: Too close to game start

---

## 3️⃣ AUTOMATIC INVALIDATION TRIGGERS

### Odds Drift Detection

**Rule:** Reject pick if odds have moved beyond acceptable threshold since data capture.

```typescript
interface OddsDriftPolicy {
  market_type: MarketType;
  max_drift_threshold: number;  // Max acceptable movement (in odds points)
  description: string;
}

const ODDS_DRIFT_LIMITS: Record<MarketType, OddsDriftPolicy> = {
  moneyline: {
    market_type: MarketType.MONEYLINE,
    max_drift_threshold: 20,      // Max 20 point movement (e.g., -110 to -130)
    description: 'Main lines should be relatively stable'
  },

  spread: {
    market_type: MarketType.SPREAD,
    max_drift_threshold: 15,      // Max 15 point movement
    description: 'Spreads should be stable'
  },

  total: {
    market_type: MarketType.TOTAL,
    max_drift_threshold: 15,
    description: 'Totals should be stable'
  },

  player_prop: {
    market_type: MarketType.PLAYER_PROP,
    max_drift_threshold: 30,      // Props can move more
    description: 'Props have higher volatility'
  },

  team_prop: {
    market_type: MarketType.TEAM_PROP,
    max_drift_threshold: 30,
    description: 'Props have higher volatility'
  },

  game_prop: {
    market_type: MarketType.GAME_PROP,
    max_drift_threshold: 50,      // Exotic props can swing widely
    description: 'Exotic markets are volatile'
  },
};
```

### Drift Validation (Live Check)

```typescript
interface OddsDriftCheck {
  valid: boolean;
  original_odds: number;
  current_odds?: number;
  drift_amount?: number;
  max_allowed_drift: number;
  rejection_reason?: string;
}

async function validateOddsDrift(
  rawProp: RawProp,
  oddsProvider: OddsProvider
): Promise<OddsDriftCheck> {
  const policy = ODDS_DRIFT_LIMITS[rawProp.market_type];

  try {
    // Fetch current odds from live source
    const currentOdds = await oddsProvider.getCurrentOdds(
      rawProp.game_id,
      rawProp.market_type,
      rawProp.selection
    );

    if (!currentOdds) {
      // Market no longer available
      return {
        valid: false,
        original_odds: rawProp.odds,
        max_allowed_drift: policy.max_drift_threshold,
        rejection_reason: 'MARKET_SUSPENDED',
      };
    }

    // Calculate drift
    const drift = Math.abs(currentOdds - rawProp.odds);

    if (drift > policy.max_drift_threshold) {
      return {
        valid: false,
        original_odds: rawProp.odds,
        current_odds: currentOdds,
        drift_amount: drift,
        max_allowed_drift: policy.max_drift_threshold,
        rejection_reason: 'ODDS_DRIFT_EXCEEDED',
      };
    }

    return {
      valid: true,
      original_odds: rawProp.odds,
      current_odds: currentOdds,
      drift_amount: drift,
      max_allowed_drift: policy.max_drift_threshold,
    };

  } catch (error) {
    // Provider error - reject for safety
    return {
      valid: false,
      original_odds: rawProp.odds,
      max_allowed_drift: policy.max_drift_threshold,
      rejection_reason: 'ODDS_PROVIDER_ERROR',
    };
  }
}
```

**Rejection Reasons:**
- `MARKET_SUSPENDED`: Market no longer available
- `ODDS_DRIFT_EXCEEDED`: Odds moved beyond threshold
- `ODDS_PROVIDER_ERROR`: Unable to verify current odds

---

### Market Suspension Detection

**Rule:** Reject if market status changes to suspended/unavailable.

```typescript
interface MarketStatus {
  available: boolean;
  suspended: boolean;
  reason?: string;
}

async function validateMarketStatus(
  rawProp: RawProp,
  oddsProvider: OddsProvider
): Promise<{ valid: boolean; status: MarketStatus; rejection_reason?: string }> {
  try {
    const status = await oddsProvider.getMarketStatus(
      rawProp.game_id,
      rawProp.market_type
    );

    if (status.suspended || !status.available) {
      return {
        valid: false,
        status,
        rejection_reason: 'MARKET_SUSPENDED',
      };
    }

    return {
      valid: true,
      status,
    };

  } catch (error) {
    return {
      valid: false,
      status: { available: false, suspended: true, reason: 'provider_error' },
      rejection_reason: 'MARKET_STATUS_UNKNOWN',
    };
  }
}
```

---

## 4️⃣ HARD BLOCKS (SAFETY GUARDRAILS)

### Past Event Block

**Rule:** NEVER bet on events that have already started.

```typescript
function blockPastEvents(rawProp: RawProp): { blocked: boolean; reason?: string } {
  if (!rawProp.event_time) {
    return {
      blocked: true,
      reason: 'MISSING_EVENT_TIME',
    };
  }

  const event_time = new Date(rawProp.event_time);
  const now = new Date();

  if (event_time <= now) {
    return {
      blocked: true,
      reason: 'EVENT_TIME_PAST',
    };
  }

  return { blocked: false };
}
```

### Ambiguous Time Block

**Rule:** Reject if event_time format is invalid or ambiguous.

```typescript
function blockAmbiguousEventTime(rawProp: RawProp): { blocked: boolean; reason?: string } {
  if (!rawProp.event_time) {
    return {
      blocked: true,
      reason: 'MISSING_EVENT_TIME',
    };
  }

  // Try to parse event_time
  const parsed = new Date(rawProp.event_time);

  if (isNaN(parsed.getTime())) {
    return {
      blocked: true,
      reason: 'INVALID_EVENT_TIME_FORMAT',
    };
  }

  // Check for unrealistic times (more than 1 year in future)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (parsed > oneYearFromNow) {
    return {
      blocked: true,
      reason: 'EVENT_TIME_TOO_FAR_FUTURE',
    };
  }

  return { blocked: false };
}
```

---

## 🔧 ENFORCEMENT POINTS

### Point 1: Raw Props Ingestion

**Location:** `apps/api/src/lib/staleness-validator.ts`

```typescript
export async function validateStaleness(
  rawProp: RawProp,
  oddsProvider?: OddsProvider
): Promise<StalenessCheckResult> {
  const checks: StalenessCheck[] = [];

  // 1. Hard blocks (safety)
  const pastEventBlock = blockPastEvents(rawProp);
  if (pastEventBlock.blocked) {
    return {
      valid: false,
      rejection_reason: pastEventBlock.reason!,
      checks: [],
    };
  }

  const ambiguousTimeBlock = blockAmbiguousEventTime(rawProp);
  if (ambiguousTimeBlock.blocked) {
    return {
      valid: false,
      rejection_reason: ambiguousTimeBlock.reason!,
      checks: [],
    };
  }

  // 2. Line age check
  const lineAgeCheck = validateLineAge(rawProp);
  checks.push({
    name: 'line_age',
    passed: lineAgeCheck.valid,
    details: lineAgeCheck,
  });

  // 3. Event proximity check
  const proximityCheck = validateEventProximity(rawProp);
  checks.push({
    name: 'event_proximity',
    passed: proximityCheck.valid,
    details: proximityCheck,
  });

  // 4. Odds drift check (if provider available)
  if (oddsProvider) {
    const driftCheck = await validateOddsDrift(rawProp, oddsProvider);
    checks.push({
      name: 'odds_drift',
      passed: driftCheck.valid,
      details: driftCheck,
    });

    // 5. Market status check
    const statusCheck = await validateMarketStatus(rawProp, oddsProvider);
    checks.push({
      name: 'market_status',
      passed: statusCheck.valid,
      details: statusCheck,
    });
  }

  // Overall result
  const allPassed = checks.every(c => c.passed);
  const failedChecks = checks.filter(c => !c.passed);

  return {
    valid: allPassed,
    rejection_reason: failedChecks[0]?.details.rejection_reason,
    checks,
    failed_checks: failedChecks,
  };
}
```

### Point 2: Pick Promotion (Pre-Publish Validation)

**Location:** `apps/api/src/routes/ops-picks.ts`

```typescript
router.post('/:id/promote', async (req, res) => {
  const pick = await fetchPick(req.params.id);

  // Re-validate staleness before publishing
  const stalenessCheck = await validateStaleness(pick, oddsProvider);

  if (!stalenessCheck.valid) {
    await logPickRejection({
      pick_id: pick.id,
      rejection_code: stalenessCheck.rejection_reason!,
      rejection_reason: `Staleness check failed: ${stalenessCheck.rejection_reason}`,
      failed_criteria: stalenessCheck.failed_checks?.map(c => c.name) || [],
      raw_data_snapshot: pick,
      pipeline_stage: 'publish',
    });

    return res.status(400).json({
      success: false,
      error: 'Pick failed staleness validation',
      rejection_reason: stalenessCheck.rejection_reason,
      failed_checks: stalenessCheck.failed_checks,
    });
  }

  // Continue with promotion...
});
```

---

## 📊 MONITORING & ALERTS

### Prometheus Metrics

```
# Staleness rejections by reason
staleness_rejections_total{reason="LINE_TOO_STALE|EVENT_TOO_SOON|..."} counter

# Average line age at ingestion
line_age_seconds{market_type="moneyline|spread|..."} histogram

# Time until event start
event_proximity_minutes{market_type="..."} histogram

# Odds drift distribution
odds_drift_amount{market_type="..."} histogram
```

### Alerts

```yaml
- alert: HighStalenessRejectionRate
  expr: rate(staleness_rejections_total[10m]) / rate(picks_evaluated_total[10m]) > 0.3
  annotations:
    summary: "Staleness rejection rate exceeds 30% - check data feed"

- alert: ExcessiveOddsDrift
  expr: histogram_quantile(0.95, odds_drift_amount) > 50
  annotations:
    summary: "95th percentile odds drift exceeds 50 points - possible feed delay"
```

---

## 🧪 TESTING

```typescript
describe('Staleness Validation', () => {
  it('rejects line older than max age', () => {
    const staleProps = {
      market_type: 'moneyline',
      updated_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour old
      ...validDefaults
    };

    const result = validateLineAge(staleProp);
    expect(result.valid).toBe(false);
    expect(result.rejection_reason).toBe('LINE_TOO_STALE');
  });

  it('rejects event starting in 5 minutes', () => {
    const imminent = {
      market_type: 'moneyline',
      event_time: new Date(Date.now() + 5 * 60 * 1000), // 5 min away
      ...validDefaults
    };

    const result = validateEventProximity(imminent);
    expect(result.valid).toBe(false);
    expect(result.rejection_reason).toBe('EVENT_TOO_SOON');
  });

  it('blocks past events', () => {
    const pastEvent = {
      event_time: new Date(Date.now() - 3600000), // 1 hour ago
      ...validDefaults
    };

    const result = blockPastEvents(pastEvent);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('EVENT_TIME_PAST');
  });
});
```

---

## ✅ ROLLOUT PLAN

### Week 1: Hard Blocks Only
- Deploy past event and ambiguous time blocks
- **CRITICAL**: These are safety guardrails

### Week 2: Line Age Logging
- Add line age checks in **log-only** mode
- Measure baseline line age distribution
- Tune thresholds

### Week 3: Event Proximity Logging
- Add proximity checks in **log-only** mode
- Measure baseline time-to-start distribution

### Week 4: Full Enforcement
- Enable all staleness checks with rejections
- Monitor rejection rates
- Alert on anomalies

---

**Approved By:** Trading Operations & Data Integrity
**Next Review:** 2025-12-29 (Weekly)
