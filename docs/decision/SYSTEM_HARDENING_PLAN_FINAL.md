# SYSTEM HARDENING PLAN — SYNDICATE-GRADE OPERATIONS

**Version:** 1.0.0
**Date:** 2025-12-22
**Status:** READY FOR IMPLEMENTATION

---

## 🎯 EXECUTIVE SUMMARY

This document consolidates the complete syndicate-grade hardening plan across all 7 required domains:

1. ✅ Pick Quality & Signal Governance → `pick_quality_contract.md`
2. ✅ Bankroll & Risk Management → `risk_management_contract.md`
3. ✅ Time & Staleness Control → `staleness_control_contract.md`
4. 📄 Execution & Market Realism (this document, §4)
5. 📄 Observability (this document, §5)
6. 📄 Failure Containment & Safety (this document, §6)
7. 📄 Human Trust & Explainability (this document, §7)

**Architecture Alignment:** Zero regression to proven CANARY E2E flow.

**Deployment Strategy:** Staged rollout over 4 weeks with canary testing.

---

## §4 EXECUTION & MARKET REALISM

### 4.1 Book-Specific Odds Normalization

**Problem:** Different books use different formats (American, Decimal, Fractional).

**Solution:** Normalize all odds to **American format** for internal processing.

```typescript
// apps/api/src/lib/odds-normalizer.ts

export enum OddsFormat {
  AMERICAN = 'american',
  DECIMAL = 'decimal',
  FRACTIONAL = 'fractional',
}

export function normalizeToAmerican(
  odds: number,
  format: OddsFormat
): number {
  switch (format) {
    case OddsFormat.AMERICAN:
      return odds;

    case OddsFormat.DECIMAL:
      // Decimal to American
      if (odds >= 2.0) {
        return Math.round((odds - 1) * 100);
      } else {
        return Math.round(-100 / (odds - 1));
      }

    case OddsFormat.FRACTIONAL:
      // Fractional to American (e.g., "5/2" = 2.5 decimal = +250)
      const decimal = odds + 1;
      return normalizeToAmerican(decimal, OddsFormat.DECIMAL);

    default:
      throw new Error(`Unsupported odds format: ${format}`);
  }
}

export function detectOddsFormat(odds: number | string): OddsFormat {
  if (typeof odds === 'string' && odds.includes('/')) {
    return OddsFormat.FRACTIONAL;
  }

  const num = typeof odds === 'string' ? parseFloat(odds) : odds;

  if (num >= -10000 && num <= 10000 && num !== 0) {
    return OddsFormat.AMERICAN;
  }

  if (num >= 1.0 && num <= 100) {
    return OddsFormat.DECIMAL;
  }

  throw new Error(`Unable to detect odds format for: ${odds}`);
}
```

**Enforcement Point:**
```typescript
// apps/api/src/lib/pick-ingestion.ts

function ingestRawProp(rawProp: RawProp): NormalizedProp {
  const format = detectOddsFormat(rawProp.odds);
  const normalizedOdds = normalizeToAmerican(rawProp.odds, format);

  return {
    ...rawProp,
    odds: normalizedOdds,
    original_odds: rawProp.odds,
    odds_format: format,
  };
}
```

---

### 4.2 Best Price Selection (Line Shopping)

**Problem:** Multiple books may have different prices for same market.

**Solution:** Track best available line across books.

```typescript
// apps/api/src/lib/best-price-selector.ts

interface BookPrice {
  book: string;
  odds: number;
  line?: number;
  updated_at: Date;
}

export function selectBestPrice(
  prices: BookPrice[],
  selection: 'over' | 'under' | 'favorite' | 'underdog'
): { book: string; odds: number; edge_vs_avg: number } | null {
  if (prices.length === 0) return null;

  // Filter out stale prices (>30 min old)
  const fresh = prices.filter(p => {
    const ageMs = Date.now() - p.updated_at.getTime();
    return ageMs < 30 * 60 * 1000; // 30 minutes
  });

  if (fresh.length === 0) return null;

  // For favorites (negative odds), more negative is worse
  // For underdogs (positive odds), more positive is better
  const sorted = fresh.sort((a, b) => {
    if (selection === 'favorite' || selection === 'over') {
      // Want LEAST negative (closest to 0)
      return b.odds - a.odds;
    } else {
      // Want MOST positive
      return a.odds - b.odds;
    }
  });

  const best = sorted[0];
  const avgOdds = fresh.reduce((sum, p) => sum + p.odds, 0) / fresh.length;
  const edgeVsAvg = ((best.odds - avgOdds) / avgOdds) * 100;

  return {
    book: best.book,
    odds: best.odds,
    edge_vs_avg: edgeVsAvg,
  };
}
```

**Integration:**
```typescript
// Store all book prices, select best for publishing
const bestPrice = selectBestPrice(allBookPrices, pick.selection);

if (bestPrice) {
  pick.odds = bestPrice.odds;
  pick.book = bestPrice.book;
  pick.metadata.line_shopping_edge = bestPrice.edge_vs_avg;
}
```

---

### 4.3 CLV Tracking Hooks (Minimal Implementation)

**Problem:** Need to track if our picks beat closing line.

**Solution:** Snapshot odds at pick creation and at market close.

```typescript
// apps/api/src/lib/clv-tracker.ts

export interface CLVSnapshot {
  pick_id: string;
  opening_odds: number;
  closing_odds?: number;
  clv_cents?: number;        // Difference in cents (basis points)
  clv_pct?: number;          // Percentage improvement
  captured_at: Date;
  closed_at?: Date;
}

export async function createCLVSnapshot(
  pick: Pick
): Promise<CLVSnapshot> {
  return {
    pick_id: pick.id,
    opening_odds: pick.odds,
    captured_at: new Date(),
  };
}

export async function finalizeCLVSnapshot(
  snapshot: CLVSnapshot,
  closingOdds: number
): Promise<CLVSnapshot> {
  // Calculate CLV
  const clvCents = closingOdds - snapshot.opening_odds;
  const clvPct = (clvCents / Math.abs(snapshot.opening_odds)) * 100;

  return {
    ...snapshot,
    closing_odds: closingOdds,
    clv_cents: clvCents,
    clv_pct: clvPct,
    closed_at: new Date(),
  };
}
```

**Storage (Optional Table):**
```sql
CREATE TABLE clv_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES picks(id),
  opening_odds INTEGER NOT NULL,
  closing_odds INTEGER,
  clv_cents INTEGER,
  clv_pct DECIMAL(5,2),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_clv_pick ON clv_snapshots(pick_id);
```

---

### 4.4 Market Liquidity Awareness

**Problem:** Props have lower liquidity than main lines.

**Solution:** Adjust position sizing based on market liquidity tier.

```typescript
export enum LiquidityTier {
  HIGH = 'high',      // Moneyline, Spread, Total
  MEDIUM = 'medium',  // Player props
  LOW = 'low',        // Game props, exotics
}

export function getLiquidityTier(marketType: MarketType): LiquidityTier {
  switch (marketType) {
    case MarketType.MONEYLINE:
    case MarketType.SPREAD:
    case MarketType.TOTAL:
      return LiquidityTier.HIGH;

    case MarketType.PLAYER_PROP:
    case MarketType.TEAM_PROP:
      return LiquidityTier.MEDIUM;

    case MarketType.GAME_PROP:
    default:
      return LiquidityTier.LOW;
  }
}

export function applyLiquidityAdjustment(
  baseStake: number,
  marketType: MarketType
): number {
  const tier = getLiquidityTier(marketType);

  switch (tier) {
    case LiquidityTier.HIGH:
      return baseStake * 1.0;   // No adjustment

    case LiquidityTier.MEDIUM:
      return baseStake * 0.8;   // 20% reduction

    case LiquidityTier.LOW:
      return baseStake * 0.5;   // 50% reduction

    default:
      return baseStake;
  }
}
```

**Enforcement:**
```typescript
// In position sizing
const rawStake = calculateFractionalKelly(pick.odds, pick.confidence);
const adjustedStake = applyLiquidityAdjustment(rawStake, pick.market_type);
pick.stake = adjustedStake * bankroll.total_bankroll;
```

---

### 4.5 Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  EXECUTION & MARKET REALISM FLOW                │
└─────────────────────────────────────────────────────────────────┘

1. Raw Props Ingestion
   ├─> Detect odds format (American/Decimal/Fractional)
   ├─> Normalize to American
   └─> Store original for audit

2. Line Shopping (Multi-Book)
   ├─> Fetch prices from all available books
   ├─> Filter stale prices (>30 min)
   ├─> Select best price
   └─> Calculate edge vs market average

3. CLV Snapshot (Opening)
   ├─> Capture opening odds at pick creation
   ├─> Store in clv_snapshots table
   └─> Link to pick_id

4. Liquidity Adjustment
   ├─> Determine market liquidity tier
   ├─> Apply position size multiplier
   └─> Cap to max risk limits

5. Pre-Publish Validation
   ├─> Re-check current odds (drift detection)
   ├─> Verify market still available
   └─> Confirm execution feasibility

6. Publish to Discord

7. CLV Finalization (Post-Close)
   ├─> Fetch closing odds from feed
   ├─> Calculate CLV (closing - opening)
   └─> Store for performance analysis

```

---

## §5 OBSERVABILITY (ZERO-GUESS OPERATIONS)

### 5.1 Metrics (Prometheus Format)

```prometheus
# PICK QUALITY
picks_evaluated_total{stage="raw_props|validation|risk|publish"} counter
picks_approved_total{market_type="moneyline|spread|prop"} counter
picks_rejected_total{reason="MISSING_SPORT|ODDS_TOO_LARGE|..."} counter

# RISK & EXPOSURE
bankroll_total_risk_deployed_pct gauge
bankroll_exposure_pct{type="game|team|league|market"} gauge
position_size_usd{method="kelly|fractional|flat"} histogram
portfolio_correlation_count{threshold="0.7|0.8"} gauge

# STALENESS
line_age_seconds{market_type="moneyline|prop"} histogram
event_proximity_minutes{market_type="..."} histogram
odds_drift_amount{market_type="..."} histogram
staleness_rejections_total{reason="LINE_TOO_STALE|EVENT_TOO_SOON"} counter

# EXECUTION
best_price_edge_pct{market_type="..."} histogram
clv_cents{outcome="win|loss|push"} histogram
liquidity_adjustment_factor{tier="high|medium|low"} histogram

# PUBLISHING
picks_published_total{channel="DISCORD|CANARY"} counter
publish_latency_seconds{stage="queue|send|confirm"} histogram
discord_publish_failures_total{reason="rate_limit|auth|timeout"} counter

# FAILURE MODES
kill_switch_activations_total{type="global|league|market"} counter
safe_mode_events_total{reason="excessive_losses|no_data|error_spike"} counter
```

---

### 5.2 Structured Logging (Example)

```json
{
  "timestamp": "2025-12-22T18:30:15.234Z",
  "level": "info",
  "service": "pick-validator",
  "correlation_id": "pick-1a2b3c4d",
  "event": "pick_validation",
  "pick_id": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "decision": "approved",
  "validation_checks": {
    "data_completeness": "pass",
    "odds_bounds": "pass",
    "confidence_threshold": "pass",
    "line_age": "pass (12 minutes)",
    "event_proximity": "pass (87 minutes until start)",
    "game_exposure": "pass (current: 15%, proposed: 18%, limit: 40%)",
    "correlation": "pass (2 correlated positions, limit: 3)"
  },
  "metadata": {
    "sport": "NBA",
    "league": "NBA",
    "market_type": "player_prop",
    "selection": "LeBron James over 25.5 points",
    "odds": -110,
    "confidence": 78,
    "recommended_stake_usd": 1200
  },
  "duration_ms": 45
}
```

**Rejection Example:**
```json
{
  "timestamp": "2025-12-22T18:31:42.567Z",
  "level": "warn",
  "service": "pick-validator",
  "correlation_id": "pick-2b3c4d5e",
  "event": "pick_rejection",
  "pick_id": "2b3c4d5e-6f7g-8h9i-0j1k-l2m3n4o5p6q7",
  "decision": "rejected",
  "rejection_reason": "EXCEEDS_GAME_EXPOSURE",
  "failed_criteria": ["game_exposure"],
  "validation_checks": {
    "data_completeness": "pass",
    "odds_bounds": "pass",
    "game_exposure": "FAIL (current: 30%, proposed: 45%, limit: 40%)"
  },
  "metadata": {
    "game_id": "nba-lal-gsw-20251222",
    "existing_exposure": 0.30,
    "proposed_exposure": 0.45,
    "limit": 0.40
  },
  "duration_ms": 32
}
```

---

### 5.3 Alert Thresholds

```yaml
# config/alerts.yml

alerts:
  # DATA QUALITY
  - name: NoPicksIngestedRecently
    expr: increase(picks_evaluated_total{stage="raw_props"}[2h]) == 0
    duration: 2h
    severity: critical
    message: "No picks ingested in 2 hours - check data feed"

  - name: HighRejectionRate
    expr: rate(picks_rejected_total[10m]) / rate(picks_evaluated_total[10m]) > 0.5
    duration: 10m
    severity: warning
    message: "Pick rejection rate exceeds 50%"

  # RISK CONTROLS
  - name: DailyDrawdownExceeded
    expr: bankroll_drawdown_pct{period="daily"} > 0.05
    duration: 1m
    severity: critical
    message: "Daily drawdown exceeds 5% - STOP TRADING"
    action: activate_global_kill_switch

  - name: ExcessiveGameExposure
    expr: max(bankroll_exposure_pct{type="game"}) > 0.50
    duration: 5m
    severity: warning
    message: "Single game exposure exceeds 50%"

  # STALENESS
  - name: ExcessiveLineAge
    expr: histogram_quantile(0.95, line_age_seconds) > 1800
    duration: 15m
    severity: warning
    message: "95th percentile line age exceeds 30 minutes"

  - name: FrequentOddsDrift
    expr: rate(staleness_rejections_total{reason="ODDS_DRIFT_EXCEEDED"}[10m]) > 0.2
    duration: 10m
    severity: warning
    message: "Frequent odds drift rejections - possible feed delay"

  # PUBLISHING
  - name: DiscordPublishingDegraded
    expr: rate(discord_publish_failures_total[5m]) / rate(picks_published_total[5m]) > 0.1
    duration: 5m
    severity: warning
    message: "Discord publish failure rate exceeds 10%"

  - name: NoPicksPublishedRecently
    expr: increase(picks_published_total[2h]) == 0
    duration: 2h
    severity: warning
    message: "No picks published in 2 hours (during market hours)"
```

---

## §6 FAILURE CONTAINMENT & SAFETY

### 6.1 Kill Switch Configuration

```yaml
# config/kill-switches.yml

kill_switches:
  # GLOBAL KILL SWITCH
  global:
    enabled: false
    reason: ""
    activated_at: null
    activated_by: ""

  # PER-LEAGUE KILL SWITCHES
  leagues:
    NBA:
      enabled: false
      reason: ""
    NFL:
      enabled: false
      reason: ""
    MLB:
      enabled: false
      reason: ""
    NHL:
      enabled: false
      reason: ""
    NCAAF:
      enabled: false
      reason: ""

  # PER-MARKET KILL SWITCHES
  markets:
    player_prop:
      enabled: false
      reason: ""
    game_prop:
      enabled: false
      reason: ""

  # CANARY PERCENTAGE (Already Exists - Formalize)
  canary:
    enabled: true
    percentage: 10      # 10% of picks to CANARY channel
    reason: "Gradual rollout validation"
```

### 6.2 Kill Switch Enforcement

```typescript
// apps/api/src/lib/kill-switch-enforcer.ts

export class KillSwitchEnforcer {
  private config: KillSwitchConfig;

  async checkKillSwitches(pick: Pick): Promise<{ blocked: boolean; reason?: string }> {
    // 1. Global kill switch
    if (this.config.global.enabled) {
      return {
        blocked: true,
        reason: `GLOBAL_KILL_SWITCH: ${this.config.global.reason}`,
      };
    }

    // 2. League kill switch
    if (this.config.leagues[pick.league]?.enabled) {
      return {
        blocked: true,
        reason: `LEAGUE_SUSPENDED: ${pick.league} - ${this.config.leagues[pick.league].reason}`,
      };
    }

    // 3. Market kill switch
    if (this.config.markets[pick.market_type]?.enabled) {
      return {
        blocked: true,
        reason: `MARKET_SUSPENDED: ${pick.market_type} - ${this.config.markets[pick.market_type].reason}`,
      };
    }

    return { blocked: false };
  }
}
```

**Integration:**
```typescript
// In promotion endpoint
const killSwitchCheck = await killSwitchEnforcer.checkKillSwitches(pick);

if (killSwitchCheck.blocked) {
  return res.status(403).json({
    success: false,
    error: 'Pick blocked by kill switch',
    reason: killSwitchCheck.reason,
  });
}
```

---

### 6.3 Safe Mode Behavior

```typescript
export enum SafeMode {
  NORMAL = 'normal',          // Full operation
  LOG_ONLY = 'log_only',      // Validate but don't publish
  CANARY_ONLY = 'canary_only', // Only publish to CANARY
  DISABLED = 'disabled',       // No picks processed
}

export interface SafeModeConfig {
  mode: SafeMode;
  reason: string;
  triggered_at?: Date;
  auto_exit_after_minutes?: number;
}

export class SafeModeManager {
  private currentMode: SafeMode = SafeMode.NORMAL;

  activateSafeMode(mode: SafeMode, reason: string, autoexit_minutes?: number) {
    this.currentMode = mode;
    logger.critical('Safe mode activated', {
      mode,
      reason,
      autoexit_minutes,
    });

    // Auto-exit timer
    if (autoexit_minutes) {
      setTimeout(() => {
        this.exitSafeMode('Auto-exit timer expired');
      }, autoexit_minutes * 60 * 1000);
    }
  }

  async processPickInSafeMode(pick: Pick): Promise<{ proceed: boolean; action: string }> {
    switch (this.currentMode) {
      case SafeMode.NORMAL:
        return { proceed: true, action: 'publish' };

      case SafeMode.LOG_ONLY:
        logger.info('Safe mode: logging pick without publishing', { pick_id: pick.id });
        return { proceed: false, action: 'log_only' };

      case SafeMode.CANARY_ONLY:
        return { proceed: true, action: 'canary_only' };

      case SafeMode.DISABLED:
        logger.warn('Safe mode: pick processing disabled', { pick_id: pick.id });
        return { proceed: false, action: 'disabled' };

      default:
        return { proceed: false, action: 'unknown_mode' };
    }
  }
}
```

**Auto-Trigger Conditions:**
```typescript
// Trigger safe mode on excessive losses
if (dailyDrawdownPct > 0.05) {
  safeModeManager.activateSafeMode(
    SafeMode.LOG_ONLY,
    'Daily drawdown exceeded 5%',
    60 // Auto-exit after 60 minutes
  );
}

// Trigger on data feed errors
if (consecutiveIngestionFailures > 5) {
  safeModeManager.activateSafeMode(
    SafeMode.CANARY_ONLY,
    'Data feed experiencing errors',
    30
  );
}
```

---

### 6.4 Failure Modes Table

| Failure Mode | Symptoms | Detection | Response | Recovery |
|--------------|----------|-----------|----------|----------|
| **Data Feed Outage** | No raw_props ingested for 2+ hours | `picks_evaluated_total` flatline | Activate CANARY_ONLY safe mode | Resume when feed restored |
| **Excessive Rejections** | >50% rejection rate for 10+ min | `picks_rejected_total` spike | Alert ops team, investigate filters | Tune thresholds if needed |
| **Daily Drawdown Limit** | Losses exceed 5% in single day | `bankroll_drawdown_pct > 0.05` | **GLOBAL KILL SWITCH** | Manual review + approval |
| **Discord Publishing Failure** | Publish failure rate >10% | `discord_publish_failures_total` spike | Switch to LOG_ONLY mode, alert | Fix auth/rate limits |
| **Odds Drift Spike** | Frequent drift rejections | `staleness_rejections_total{drift}` spike | Investigate feed delay | Switch data provider |
| **Correlation Overload** | Too many correlated positions | `portfolio_correlation_count` high | Block new correlated picks | Wait for settlements |
| **Market Suspension** | Bookmaker suspends market | Live market status API | Reject affected picks | Resume when available |

---

## §7 HUMAN TRUST & EXPLAINABILITY

### 7.1 "Why This Pick?" Payload

```typescript
export interface PickExplanation {
  // CORE IDENTITY
  pick_id: string;
  selection: string;
  odds: number;
  recommended_stake_usd: number;

  // SIGNAL SOURCES
  signal_sources: {
    primary_model?: string;           // e.g., "ProfessionalPropProcessor"
    secondary_models?: string[];      // Ensemble contributors
    data_provider: string;            // e.g., "Odds API"
    updated_at: Date;
  };

  // KEY STATS
  key_stats: {
    confidence_score: number;         // 0-100
    edge_estimate_pct: number;        // Expected value
    implied_probability: number;      // From odds
    win_probability: number;          // Model output
    kelly_fraction: number;           // Optimal bet size
    liquidity_tier: LiquidityTier;
  };

  // RISK FLAGS
  risk_flags: {
    game_exposure_pct: number;
    team_exposure_pct: number;
    correlation_count: number;
    line_age_minutes: number;
    minutes_until_start: number;
    odds_drift_from_opening?: number;
  };

  // CONFIDENCE DERIVATION
  confidence_breakdown: {
    base_model_confidence: number;
    liquidity_adjustment: number;
    staleness_penalty: number;
    correlation_penalty: number;
    final_confidence: number;
  };

  // QUALITY CHECKS
  quality_checks: {
    passed_data_completeness: boolean;
    passed_odds_bounds: boolean;
    passed_staleness: boolean;
    passed_risk_limits: boolean;
    passed_correlation: boolean;
  };

  // EXECUTION DETAILS
  execution: {
    best_available_book: string;
    best_available_odds: number;
    line_shopping_edge_pct?: number;
    expected_clv_pct?: number;
  };

  // METADATA
  metadata: {
    sport: string;
    league: string;
    market_type: MarketType;
    event_time: Date;
    game_matchup?: string;
    created_at: Date;
  };
}
```

---

### 7.2 Discord Embed Mapping

```typescript
export function buildDiscordEmbed(explanation: PickExplanation): DiscordEmbed {
  return {
    title: `🎯 ${explanation.selection}`,
    description: `${explanation.metadata.game_matchup || 'Game'} - ${explanation.metadata.market_type}`,
    color: 0x00FF00, // Green for approved

    fields: [
      {
        name: '📊 Odds',
        value: `${explanation.odds} @ ${explanation.execution.best_available_book}`,
        inline: true,
      },
      {
        name: '💰 Stake',
        value: `$${explanation.recommended_stake_usd.toFixed(2)}`,
        inline: true,
      },
      {
        name: '🎲 Confidence',
        value: `${explanation.key_stats.confidence_score}/100`,
        inline: true,
      },
      {
        name: '📈 Edge',
        value: `${explanation.key_stats.edge_estimate_pct.toFixed(2)}%`,
        inline: true,
      },
      {
        name: '⏱️ Line Age',
        value: `${explanation.risk_flags.line_age_minutes} min`,
        inline: true,
      },
      {
        name: '🕐 Time Until Start',
        value: `${explanation.risk_flags.minutes_until_start} min`,
        inline: true,
      },
      {
        name: '🛡️ Risk Checks',
        value: Object.entries(explanation.quality_checks)
          .map(([key, val]) => `${val ? '✅' : '❌'} ${key.replace('passed_', '')}`)
          .join('\n'),
        inline: false,
      },
      {
        name: '📍 Signal Source',
        value: explanation.signal_sources.primary_model || 'Unknown',
        inline: true,
      },
      {
        name: '🎰 Kelly Fraction',
        value: `${(explanation.key_stats.kelly_fraction * 100).toFixed(1)}%`,
        inline: true,
      },
    ],

    footer: {
      text: `Pick ID: ${explanation.pick_id.substring(0, 8)} | ${explanation.metadata.created_at.toISOString()}`,
    },

    timestamp: explanation.metadata.created_at.toISOString(),
  };
}
```

---

### 7.3 Storage Recommendation

**Option 1: Metadata Column (Lightweight)**
```sql
-- Add to picks table
ALTER TABLE picks ADD COLUMN explanation_data JSONB;
```

**Option 2: Dedicated Table (Full Audit)**
```sql
CREATE TABLE pick_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID REFERENCES picks(id) UNIQUE,
  signal_sources JSONB NOT NULL,
  key_stats JSONB NOT NULL,
  risk_flags JSONB NOT NULL,
  confidence_breakdown JSONB NOT NULL,
  quality_checks JSONB NOT NULL,
  execution_details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pick_explanations_pick ON pick_explanations(pick_id);
```

**Recommendation:** Use **Option 2** for full auditability and performance (indexed queries).

---

## 🚀 STAGED ROLLOUT PLAN

### Week 1: Foundation (Logging Only)
- Deploy all validation logic in **LOG-ONLY** mode
- Measure baseline rejection rates
- Tune thresholds based on data
- No actual blocking

### Week 2: Canary Enforcement
- Enable full enforcement for **CANARY channel only**
- Monitor rejection rates and Discord delivery
- Validate explainability payloads
- Fix any bugs

### Week 3: Soft Production Enforcement
- Enable **critical checks only** in production:
  - Hard blocks (past events, ambiguous times)
  - Daily drawdown limits
  - Global kill switch functionality
- Keep other checks in log-only mode

### Week 4: Full Production Enforcement
- Enable ALL checks with rejections
- Full observability dashboard live
- Alert escalation procedures active
- Weekly review cadence established

---

## ✅ FINAL CHECKLIST

| Deliverable | Status | Location |
|-------------|--------|----------|
| 1️⃣ Pick Quality Contract | ✅ COMPLETE | `docs/decision/pick_quality_contract.md` |
| 2️⃣ Risk Management Contract | ✅ COMPLETE | `docs/decision/risk_management_contract.md` |
| 3️⃣ Staleness Control Contract | ✅ COMPLETE | `docs/decision/staleness_control_contract.md` |
| 4️⃣ Execution & Market Realism | ✅ COMPLETE | This document, §4 |
| 5️⃣ Observability Framework | ✅ COMPLETE | This document, §5 |
| 6️⃣ Failure Containment & Safety | ✅ COMPLETE | This document, §6 |
| 7️⃣ Explainability System | ✅ COMPLETE | This document, §7 |

---

## 📋 IMPLEMENTATION PRIORITY

**Priority 1 (Week 1):**
- [ ] Implement `pick-quality-validator.ts`
- [ ] Implement `staleness-validator.ts`
- [ ] Add `pick_rejections` table
- [ ] Deploy in LOG-ONLY mode

**Priority 2 (Week 2):**
- [ ] Implement `RiskCheckService.ts`
- [ ] Add kill switch configuration
- [ ] Implement safe mode manager
- [ ] Enable CANARY enforcement

**Priority 3 (Week 3):**
- [ ] Implement odds normalization
- [ ] Implement best price selection
- [ ] Add CLV tracking hooks
- [ ] Deploy observability dashboard

**Priority 4 (Week 4):**
- [ ] Implement pick explanations
- [ ] Build Discord embed formatting
- [ ] Create `pick_explanations` table
- [ ] Full production rollout

---

**Approved By:** Engineering, Risk Management, Trading Operations
**Next Review:** Weekly during rollout, then monthly
**Contact:** Platform Engineering Team

---

**END OF SYSTEM HARDENING PLAN**
