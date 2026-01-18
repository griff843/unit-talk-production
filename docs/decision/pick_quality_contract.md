# Pick Quality Contract (Syndicate-Grade)

**Version:** 1.0.0
**Effective Date:** 2025-12-22
**Owner:** Risk & Trading Operations
**Review Frequency:** Monthly

---

## 🎯 PURPOSE

This contract defines the **non-negotiable eligibility criteria** for all picks entering the Unit Talk publishing pipeline. Every pick must satisfy ALL criteria or be rejected with explicit audit trail.

This is inspired by top-tier betting syndicates who **never bet on incomplete signals**.

---

## 1️⃣ MINIMUM DATA COMPLETENESS

### Required Fields (MANDATORY)

```typescript
interface PickEligibilityCriteria {
  // Core Identity
  sport: string;                    // Must be non-empty
  league: string;                   // Must be non-empty
  event_time: Date;                 // Must be valid future timestamp

  // Market Definition
  market_type: MarketType;          // From allowlist (see section 2)
  selection: string;                // What we're betting (team, player, outcome)
  line?: number;                    // Required for spread/totals/props

  // Pricing
  odds: number;                     // American odds format
  book: string;                     // Source bookmaker

  // Risk & Confidence
  confidence_score: number;         // 0-100 scale
  edge_estimate?: number;           // Expected value (percentage)

  // Metadata
  player_name?: string;             // Required for player props
  team?: string;                    // Required for team props
  stat_type?: string;               // Required for props (pts, reb, ast, etc.)
}
```

### Rejection Reasons (Auditable)

| Rejection Code | Condition | Example |
|----------------|-----------|---------|
| `MISSING_SPORT` | `!sport || sport.trim() === ''` | `null` sport |
| `MISSING_LEAGUE` | `!league || league.trim() === ''` | Empty string |
| `MISSING_EVENT_TIME` | `!event_time || isNaN(Date.parse(event_time))` | Invalid timestamp |
| `EVENT_TIME_PAST` | `new Date(event_time) <= new Date()` | Event already started |
| `MISSING_SELECTION` | `!selection || selection.trim() === ''` | No bet target |
| `MISSING_ODDS` | `!odds || odds === 0` | Odds not provided |
| `MISSING_BOOK` | `!book || book.trim() === ''` | Unknown source |
| `MISSING_LINE` | `market_type in ['spread', 'total', 'prop'] && !line` | Spread without line |
| `MISSING_PLAYER` | `market_type === 'player_prop' && !player_name` | Player prop without player |
| `MISSING_STAT_TYPE` | `market_type === 'player_prop' && !stat_type` | Prop without stat |
| `BELOW_MIN_CONFIDENCE` | `confidence_score < 65` | Too uncertain |

---

## 2️⃣ MARKET TYPE ALLOWLIST

### Approved Markets

```typescript
enum MarketType {
  // Main Lines (Highest Liquidity)
  MONEYLINE = 'moneyline',
  SPREAD = 'spread',
  TOTAL = 'total',

  // Player Props (Moderate Liquidity)
  PLAYER_PROP = 'player_prop',    // Points, rebounds, assists, etc.

  // Team Props (Moderate Liquidity)
  TEAM_PROP = 'team_prop',        // Team totals, quarters, halves

  // Game Props (Lower Liquidity - Use With Caution)
  GAME_PROP = 'game_prop',        // First basket, margin, etc.
}
```

### Market-Specific Rules

| Market Type | Required Fields | Liquidity Tier | Max Stake Multiplier |
|-------------|----------------|----------------|----------------------|
| `moneyline` | selection, odds | HIGH | 1.0x |
| `spread` | selection, line, odds | HIGH | 1.0x |
| `total` | selection (over/under), line, odds | HIGH | 1.0x |
| `player_prop` | player_name, stat_type, line, odds | MEDIUM | 0.8x |
| `team_prop` | team, stat_type, line, odds | MEDIUM | 0.8x |
| `game_prop` | selection, odds | LOW | 0.5x |

**Enforcement:** Picks from LOW liquidity markets have position sizing reduced automatically.

---

## 3️⃣ ODDS SANITY BOUNDS

### By Market Type

```typescript
const ODDS_BOUNDS: Record<MarketType, { min: number; max: number }> = {
  moneyline: { min: -500, max: +500 },    // Favorites to underdogs
  spread: { min: -130, max: +130 },       // Typical juice range
  total: { min: -130, max: +130 },        // Typical juice range
  player_prop: { min: -200, max: +200 },  // Slightly wider for props
  team_prop: { min: -200, max: +200 },
  game_prop: { min: -300, max: +300 },    // Wider for exotic props
};
```

### Validation Logic

```typescript
function validateOdds(odds: number, marketType: MarketType): ValidationResult {
  const bounds = ODDS_BOUNDS[marketType];

  // Convert to absolute value for comparison
  const absOdds = Math.abs(odds);

  if (absOdds < 100) {
    return {
      valid: false,
      reason: 'ODDS_TOO_SMALL',
      message: `Odds ${odds} below minimum threshold (100)`,
    };
  }

  if (absOdds > 10000) {
    return {
      valid: false,
      reason: 'ODDS_TOO_LARGE',
      message: `Odds ${odds} above maximum threshold (10000)`,
    };
  }

  // Market-specific bounds
  if (odds < 0 && odds < bounds.min) {
    return {
      valid: false,
      reason: 'FAVORITE_TOO_HEAVY',
      message: `Favorite odds ${odds} exceed ${marketType} limit (${bounds.min})`,
    };
  }

  if (odds > 0 && odds > bounds.max) {
    return {
      valid: false,
      reason: 'UNDERDOG_TOO_LARGE',
      message: `Underdog odds ${odds} exceed ${marketType} limit (${bounds.max})`,
    };
  }

  return { valid: true };
}
```

**Rejection Reasons:**
- `ODDS_TOO_SMALL`: Odds < 100 (invalid market pricing)
- `ODDS_TOO_LARGE`: Odds > 10000 (unrealistic longshot)
- `FAVORITE_TOO_HEAVY`: Favorite beyond market-specific limit
- `UNDERDOG_TOO_LARGE`: Underdog beyond market-specific limit

---

## 4️⃣ CONFIDENCE NORMALIZATION

### Single Canonical Scale: 0-100

All confidence scores must be normalized to **0-100** scale before evaluation.

```typescript
function normalizeConfidence(raw: number, source: string): number {
  // Handle different source scales
  switch (source) {
    case 'kelly_fraction':
      // Kelly fraction is 0-1, convert to 0-100
      return Math.min(Math.max(raw * 100, 0), 100);

    case 'probability':
      // Implied probability is 0-1, convert to 0-100
      return Math.min(Math.max(raw * 100, 0), 100);

    case 'edge_percentage':
      // Edge is typically -20 to +20, map to 40-80 confidence
      return Math.min(Math.max(50 + (raw * 1.5), 0), 100);

    case '0_10_scale':
      // 0-10 scale, multiply by 10
      return Math.min(Math.max(raw * 10, 0), 100);

    case '0_100_scale':
    default:
      // Already 0-100
      return Math.min(Math.max(raw, 0), 100);
  }
}
```

### Minimum Thresholds

| Tier | Minimum Confidence | Intended Use |
|------|-------------------|--------------|
| Production | 65 | Live publishing to Discord |
| Canary | 50 | Testing channel only |
| Archive | 0 | Historical tracking only |

**Enforcement:**
```typescript
if (normalizedConfidence < 65 && channel === 'PRODUCTION') {
  reject('CONFIDENCE_TOO_LOW', `Confidence ${normalizedConfidence} below production threshold (65)`);
}
```

---

## 5️⃣ EXPLICIT REJECTION REASONS

### Rejection Interface

```typescript
interface PickRejection {
  pick_id?: string;
  rejection_code: RejectionCode;
  rejection_reason: string;
  failed_criteria: string[];
  raw_data_snapshot: Partial<RawProp>;
  timestamp: Date;
  pipeline_stage: 'raw_props' | 'validation' | 'risk_check' | 'publish';
}

enum RejectionCode {
  // Data Completeness
  MISSING_SPORT = 'MISSING_SPORT',
  MISSING_LEAGUE = 'MISSING_LEAGUE',
  MISSING_EVENT_TIME = 'MISSING_EVENT_TIME',
  EVENT_TIME_PAST = 'EVENT_TIME_PAST',
  MISSING_SELECTION = 'MISSING_SELECTION',
  MISSING_ODDS = 'MISSING_ODDS',
  MISSING_BOOK = 'MISSING_BOOK',
  MISSING_LINE = 'MISSING_LINE',
  MISSING_PLAYER = 'MISSING_PLAYER',
  MISSING_STAT_TYPE = 'MISSING_STAT_TYPE',

  // Market Type
  UNSUPPORTED_MARKET = 'UNSUPPORTED_MARKET',

  // Odds Validation
  ODDS_TOO_SMALL = 'ODDS_TOO_SMALL',
  ODDS_TOO_LARGE = 'ODDS_TOO_LARGE',
  FAVORITE_TOO_HEAVY = 'FAVORITE_TOO_HEAVY',
  UNDERDOG_TOO_LARGE = 'UNDERDOG_TOO_LARGE',

  // Confidence
  CONFIDENCE_TOO_LOW = 'CONFIDENCE_TOO_LOW',
  CONFIDENCE_MISSING = 'CONFIDENCE_MISSING',

  // Time & Staleness (see Staleness Contract)
  LINE_TOO_STALE = 'LINE_TOO_STALE',
  EVENT_TOO_SOON = 'EVENT_TOO_SOON',

  // Risk Limits (see Risk Contract)
  EXCEEDS_POSITION_LIMIT = 'EXCEEDS_POSITION_LIMIT',
  EXCEEDS_GAME_EXPOSURE = 'EXCEEDS_GAME_EXPOSURE',
  EXCEEDS_PLAYER_EXPOSURE = 'EXCEEDS_PLAYER_EXPOSURE',
  TOO_CORRELATED = 'TOO_CORRELATED',

  // Kill Switch (see Failure Containment)
  LEAGUE_SUSPENDED = 'LEAGUE_SUSPENDED',
  MARKET_SUSPENDED = 'MARKET_SUSPENDED',
  GLOBAL_KILL_SWITCH = 'GLOBAL_KILL_SWITCH',
}
```

### Audit Logging

**All rejections MUST be logged to `pick_rejections` table:**

```sql
CREATE TABLE pick_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_prop_id UUID,
  rejection_code VARCHAR(50) NOT NULL,
  rejection_reason TEXT NOT NULL,
  failed_criteria JSONB NOT NULL,
  raw_data_snapshot JSONB NOT NULL,
  pipeline_stage VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pick_rejections_code ON pick_rejections(rejection_code);
CREATE INDEX idx_pick_rejections_stage ON pick_rejections(pipeline_stage);
CREATE INDEX idx_pick_rejections_created ON pick_rejections(created_at DESC);
```

---

## 🔧 ENFORCEMENT POINTS

### Point 1: Raw Props Validation (First Line)

**Location:** `apps/api/src/lib/pick-quality-validator.ts`

```typescript
export function validateRawProp(rawProp: RawProp): ValidationResult {
  const errors: string[] = [];

  // Data completeness
  if (!rawProp.sport?.trim()) errors.push('MISSING_SPORT');
  if (!rawProp.league?.trim()) errors.push('MISSING_LEAGUE');
  if (!rawProp.event_time) errors.push('MISSING_EVENT_TIME');
  if (new Date(rawProp.event_time) <= new Date()) errors.push('EVENT_TIME_PAST');
  if (!rawProp.selection?.trim() && !rawProp.player_name?.trim()) errors.push('MISSING_SELECTION');

  // Odds validation
  const oddsResult = validateOdds(rawProp.over_odds || rawProp.under_odds, rawProp.market_type);
  if (!oddsResult.valid) errors.push(oddsResult.reason);

  // Market-specific
  if (['spread', 'total', 'player_prop'].includes(rawProp.market_type) && !rawProp.line) {
    errors.push('MISSING_LINE');
  }

  if (rawProp.market_type === 'player_prop' && !rawProp.player_name) {
    errors.push('MISSING_PLAYER');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      rejection: {
        rejection_code: errors[0] as RejectionCode,
        rejection_reason: `Failed validation: ${errors.join(', ')}`,
        failed_criteria: errors,
        raw_data_snapshot: rawProp,
        pipeline_stage: 'raw_props',
      }
    };
  }

  return { valid: true };
}
```

### Point 2: Pick Creation Validation (Second Line)

**Location:** `apps/api/src/routes/domain/picks-insert.ts`

```typescript
router.post('/insert', async (req, res) => {
  // ... auth and parsing ...

  // Validate pick quality
  const validationResult = validateRawProp(pickData);
  if (!validationResult.valid) {
    // Log rejection
    await logPickRejection(validationResult.rejection!);

    return res.status(400).json({
      success: false,
      error: 'Pick failed quality validation',
      rejection_code: validationResult.rejection!.rejection_code,
      failed_criteria: validationResult.rejection!.failed_criteria,
    });
  }

  // Continue with insert...
});
```

### Point 3: Promotion Validation (Third Line)

**Location:** `apps/api/src/routes/ops-picks.ts` (promote endpoint)

```typescript
router.post('/:id/promote', async (req, res) => {
  // Fetch pick...

  // Re-validate before promotion (double-check)
  const revalidation = validatePickForPromotion(pick);
  if (!revalidation.valid) {
    await logPickRejection({
      ...revalidation.rejection!,
      pipeline_stage: 'publish',
    });

    return res.status(400).json({
      success: false,
      error: 'Pick failed pre-publish validation',
      rejection_code: revalidation.rejection!.rejection_code,
    });
  }

  // Continue with promotion...
});
```

---

## 📊 METRICS & MONITORING

### Key Metrics (Prometheus Format)

```
# Total picks evaluated
picks_evaluated_total{stage="raw_props|validation|publish"} counter

# Picks rejected by reason
picks_rejected_total{reason="MISSING_SPORT|ODDS_TOO_LARGE|..."} counter

# Picks approved and published
picks_approved_total{market_type="moneyline|spread|..."} counter

# Validation duration
pick_validation_duration_seconds{stage="..."} histogram
```

### Alerts

```yaml
# Alert if rejection rate exceeds 50%
- alert: PickRejectionRateHigh
  expr: rate(picks_rejected_total[5m]) / rate(picks_evaluated_total[5m]) > 0.5
  for: 10m
  annotations:
    summary: "Pick rejection rate exceeds 50%"

# Alert if no picks approved in 2 hours (during market hours)
- alert: NoPicksApproved
  expr: increase(picks_approved_total[2h]) == 0
  annotations:
    summary: "No picks approved in 2 hours - check data pipeline"
```

---

## ✅ TESTING & VALIDATION

### Unit Tests Required

```typescript
describe('Pick Quality Contract', () => {
  it('rejects pick with missing sport', () => {
    const result = validateRawProp({ sport: null, ...validDefaults });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('MISSING_SPORT');
  });

  it('rejects odds outside market bounds', () => {
    const result = validateRawProp({
      odds: -600,
      market_type: 'moneyline',
      ...validDefaults
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('FAVORITE_TOO_HEAVY');
  });

  it('accepts valid player prop with all required fields', () => {
    const result = validateRawProp({
      sport: 'NBA',
      league: 'NBA',
      market_type: 'player_prop',
      player_name: 'LeBron James',
      stat_type: 'points',
      line: 25.5,
      odds: -110,
      event_time: new Date(Date.now() + 3600000),
      ...validDefaults
    });
    expect(result.valid).toBe(true);
  });
});
```

---

## 🚀 ROLLOUT PLAN

### Phase 1: Canary (Week 1)
- Deploy validation to CANARY channel only
- Monitor rejection rates
- Tune thresholds if needed

### Phase 2: Production Logging (Week 2)
- Add validation to production but **log-only mode**
- No actual rejections
- Measure impact

### Phase 3: Full Enforcement (Week 3)
- Enable full rejection with audit logging
- Alert on high rejection rates
- Review rejected picks daily

---

## 📋 CHANGE LOG

| Date | Version | Change |
|------|---------|--------|
| 2025-12-22 | 1.0.0 | Initial contract definition |

---

**Approved By:** Risk & Trading Operations
**Next Review:** 2026-01-22
