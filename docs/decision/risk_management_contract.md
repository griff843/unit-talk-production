# Bankroll & Risk Management Contract (Syndicate-Grade)

**Version:** 1.0.0
**Effective Date:** 2025-12-22
**Owner:** Risk Management & Portfolio Operations
**Review Frequency:** Weekly

---

## 🎯 PURPOSE

Top betting syndicates **never blow up** because they enforce rigid bankroll and exposure controls. This contract defines:

1. Global bankroll configuration
2. Position sizing methodologies (Kelly / fractional Kelly / flat)
3. Exposure caps (per game, team, league, market)
4. Correlated play detection and limits

**Non-Negotiable:** Every pick must pass ALL risk checks before promotion.

---

## 1️⃣ GLOBAL BANKROLL CONFIGURATION

### Bankroll Definition

```typescript
interface BankrollConfig {
  // Core Bankroll
  total_bankroll: number;           // Total capital (USD)
  risk_per_pick_pct: number;        // Default 1-2% per pick
  max_total_risk_pct: number;       // Max 20% deployed at once

  // Reserve Requirements
  min_reserve_pct: number;          // Minimum 20% in reserve
  emergency_reserve_pct: number;    // Emergency 10% untouchable

  // Drawdown Limits
  daily_stop_loss_pct: number;      // Stop trading if down X%
  weekly_drawdown_limit_pct: number; // Max weekly drawdown
  monthly_drawdown_limit_pct: number; // Max monthly drawdown

  // Refresh Policy
  bankroll_refresh_frequency: 'daily' | 'weekly' | 'monthly';
  auto_compound: boolean;           // Auto-compound profits
}
```

### Example Configuration (YAML)

```yaml
# config/bankroll.yml
bankroll:
  total_bankroll: 100000            # $100k bankroll
  risk_per_pick_pct: 1.5            # 1.5% per pick ($1,500)
  max_total_risk_pct: 20            # Max 20% deployed ($20k)

  min_reserve_pct: 20               # Keep 20% liquid
  emergency_reserve_pct: 10         # Never touch 10%

  daily_stop_loss_pct: 5            # Stop if down 5% in a day
  weekly_drawdown_limit_pct: 10     # Max 10% weekly loss
  monthly_drawdown_limit_pct: 15    # Max 15% monthly loss

  bankroll_refresh_frequency: weekly
  auto_compound: true               # Reinvest profits weekly
```

**Enforcement:** All position sizes calculated as percentage of **current bankroll** (not initial).

---

## 2️⃣ POSITION SIZING METHODOLOGIES

### Kelly Criterion (Base Method)

```typescript
/**
 * Full Kelly: Optimal bet size for max long-term growth
 * Formula: Kelly% = (edge / odds)
 * Where: edge = (win_prob * decimal_odds) - 1
 */
function calculateFullKelly(
  odds: number,           // American odds
  confidence: number      // Win probability (0-100)
): number {
  // Convert American to decimal
  const decimalOdds = odds > 0
    ? (odds / 100) + 1
    : (100 / Math.abs(odds)) + 1;

  // Win probability
  const winProb = confidence / 100;

  // Edge calculation
  const edge = (winProb * decimalOdds) - 1;

  // Kelly fraction
  const kelly = edge / (decimalOdds - 1);

  // Clamp to 0-25% (never bet more than 25% of bankroll)
  return Math.max(0, Math.min(kelly, 0.25));
}
```

### Fractional Kelly (Recommended for Production)

```typescript
/**
 * Fractional Kelly: Conservative approach to reduce variance
 * Typical fractions: 1/2 Kelly, 1/4 Kelly, 1/10 Kelly
 */
const KELLY_FRACTION = 0.25; // Use 1/4 Kelly (most syndicates use 1/2 to 1/4)

function calculateFractionalKelly(
  odds: number,
  confidence: number,
  fraction: number = KELLY_FRACTION
): number {
  const fullKelly = calculateFullKelly(odds, confidence);
  return fullKelly * fraction;
}
```

### Flat Stake (Fixed Percentage)

```typescript
/**
 * Flat Stake: Simple fixed percentage per pick
 * Used when confidence model is uncertain
 */
function calculateFlatStake(
  bankroll: number,
  fixed_pct: number = 1.5  // 1.5% default
): number {
  return bankroll * (fixed_pct / 100);
}
```

### Stake Selector Logic

```typescript
enum SizingMethod {
  FULL_KELLY = 'full_kelly',
  FRACTIONAL_KELLY = 'fractional_kelly',   // RECOMMENDED
  FLAT_STAKE = 'flat_stake',
}

interface SizingDecision {
  method: SizingMethod;
  raw_size: number;
  capped_size: number;
  cap_reason?: string;
}

function selectPositionSize(
  pick: Pick,
  bankroll: BankrollConfig,
  method: SizingMethod = SizingMethod.FRACTIONAL_KELLY
): SizingDecision {
  let raw_size: number;

  switch (method) {
    case SizingMethod.FULL_KELLY:
      raw_size = calculateFullKelly(pick.odds, pick.confidence);
      break;

    case SizingMethod.FRACTIONAL_KELLY:
      raw_size = calculateFractionalKelly(pick.odds, pick.confidence, KELLY_FRACTION);
      break;

    case SizingMethod.FLAT_STAKE:
    default:
      raw_size = bankroll.risk_per_pick_pct / 100;
      break;
  }

  // Apply bankroll cap
  const dollar_size = raw_size * bankroll.total_bankroll;
  const max_risk = bankroll.total_bankroll * (bankroll.risk_per_pick_pct / 100);

  const capped_size = Math.min(raw_size, max_risk / bankroll.total_bankroll);
  const cap_reason = dollar_size > max_risk
    ? `Capped to ${bankroll.risk_per_pick_pct}% max per pick`
    : undefined;

  return {
    method,
    raw_size,
    capped_size,
    cap_reason,
  };
}
```

**Recommendation:** Use **Fractional Kelly (1/4)** in production for optimal balance of growth and risk control.

---

## 3️⃣ EXPOSURE CAPS

### Per-Game Exposure

**Rule:** Never risk more than 40% of bankroll on a single game.

```typescript
interface GameExposure {
  game_id: string;
  total_risk_pct: number;
  active_picks: Pick[];
}

const MAX_GAME_EXPOSURE = 0.40; // 40%

function checkGameExposure(
  new_pick: Pick,
  existing_picks: Pick[]
): ExposureCheckResult {
  // Find all picks for this game
  const gamePicks = existing_picks.filter(p =>
    p.game_id === new_pick.game_id ||
    (p.home_team === new_pick.home_team && p.away_team === new_pick.away_team)
  );

  // Calculate total exposure
  const existing_exposure = gamePicks.reduce((sum, p) => sum + p.stake_pct, 0);
  const new_exposure = existing_exposure + new_pick.stake_pct;

  if (new_exposure > MAX_GAME_EXPOSURE) {
    return {
      approved: false,
      reason: 'EXCEEDS_GAME_EXPOSURE',
      details: {
        current: existing_exposure,
        proposed: new_pick.stake_pct,
        total: new_exposure,
        limit: MAX_GAME_EXPOSURE,
      }
    };
  }

  return { approved: true };
}
```

### Per-Team Exposure

**Rule:** Never risk more than 30% on a single team (across all games).

```typescript
const MAX_TEAM_EXPOSURE = 0.30; // 30%

function checkTeamExposure(
  new_pick: Pick,
  existing_picks: Pick[]
): ExposureCheckResult {
  // Find all picks involving this team
  const teamPicks = existing_picks.filter(p =>
    p.team === new_pick.team ||
    p.home_team === new_pick.team ||
    p.away_team === new_pick.team
  );

  const existing_exposure = teamPicks.reduce((sum, p) => sum + p.stake_pct, 0);
  const new_exposure = existing_exposure + new_pick.stake_pct;

  if (new_exposure > MAX_TEAM_EXPOSURE) {
    return {
      approved: false,
      reason: 'EXCEEDS_TEAM_EXPOSURE',
      details: {
        team: new_pick.team,
        current: existing_exposure,
        proposed: new_pick.stake_pct,
        total: new_exposure,
        limit: MAX_TEAM_EXPOSURE,
      }
    };
  }

  return { approved: true };
}
```

### Per-League Exposure

**Rule:** Never risk more than 60% in a single league.

```typescript
const MAX_LEAGUE_EXPOSURE = 0.60; // 60%

function checkLeagueExposure(
  new_pick: Pick,
  existing_picks: Pick[]
): ExposureCheckResult {
  const leaguePicks = existing_picks.filter(p => p.league === new_pick.league);
  const existing_exposure = leaguePicks.reduce((sum, p) => sum + p.stake_pct, 0);
  const new_exposure = existing_exposure + new_pick.stake_pct;

  if (new_exposure > MAX_LEAGUE_EXPOSURE) {
    return {
      approved: false,
      reason: 'EXCEEDS_LEAGUE_EXPOSURE',
      details: {
        league: new_pick.league,
        current: existing_exposure,
        proposed: new_pick.stake_pct,
        total: new_exposure,
        limit: MAX_LEAGUE_EXPOSURE,
      }
    };
  }

  return { approved: true };
}
```

### Per-Market Exposure

**Rule:** Diversify across market types.

```typescript
const MAX_MARKET_EXPOSURE: Record<MarketType, number> = {
  moneyline: 0.50,      // 50% max in moneylines
  spread: 0.50,         // 50% max in spreads
  total: 0.40,          // 40% max in totals
  player_prop: 0.30,    // 30% max in player props (lower liquidity)
  team_prop: 0.25,      // 25% max in team props
  game_prop: 0.15,      // 15% max in game props (lowest liquidity)
};

function checkMarketExposure(
  new_pick: Pick,
  existing_picks: Pick[]
): ExposureCheckResult {
  const marketPicks = existing_picks.filter(p => p.market_type === new_pick.market_type);
  const existing_exposure = marketPicks.reduce((sum, p) => sum + p.stake_pct, 0);
  const new_exposure = existing_exposure + new_pick.stake_pct;

  const limit = MAX_MARKET_EXPOSURE[new_pick.market_type] || 0.20;

  if (new_exposure > limit) {
    return {
      approved: false,
      reason: 'EXCEEDS_MARKET_EXPOSURE',
      details: {
        market: new_pick.market_type,
        current: existing_exposure,
        proposed: new_pick.stake_pct,
        total: new_exposure,
        limit,
      }
    };
  }

  return { approved: true };
}
```

---

## 4️⃣ CORRELATED PLAY DETECTION

### Types of Correlation

```typescript
enum CorrelationType {
  SAME_GAME = 'same_game',           // Same game, different markets
  SAME_PLAYER = 'same_player',       // Same player, different games
  SAME_SIDE = 'same_side',           // Same outcome (e.g., both overs)
  STATISTICAL = 'statistical',        // Historical correlation > 0.7
  MARKET_DRIVEN = 'market_driven',   // Linked markets (e.g., team total + game total)
}
```

### Correlation Detection

```typescript
function detectCorrelation(
  pick_a: Pick,
  pick_b: Pick
): { correlated: boolean; type: CorrelationType; strength: number } {
  // Same game detection
  if (pick_a.game_id === pick_b.game_id) {
    return {
      correlated: true,
      type: CorrelationType.SAME_GAME,
      strength: 0.80  // Assume 80% correlation for same game
    };
  }

  // Same player detection
  if (pick_a.player_name && pick_a.player_name === pick_b.player_name) {
    return {
      correlated: true,
      type: CorrelationType.SAME_PLAYER,
      strength: 0.60  // Assume 60% correlation for same player
    };
  }

  // Same side detection (both overs, both unders, etc.)
  if (
    pick_a.selection === pick_b.selection &&
    ['over', 'under'].includes(pick_a.selection.toLowerCase())
  ) {
    return {
      correlated: true,
      type: CorrelationType.SAME_SIDE,
      strength: 0.40  // Moderate correlation
    };
  }

  // Statistical correlation (requires historical data)
  // TODO: Implement based on historical win/loss correlation

  return { correlated: false, type: null, strength: 0 };
}
```

### Correlation Limits

```typescript
const MAX_CORRELATION_THRESHOLD = 0.70;    // 70% max correlation
const MAX_CORRELATED_POSITIONS = 3;        // Max 3 highly correlated picks
const MAX_SAME_GAME_POSITIONS = 4;         // Max 4 picks per game
const MAX_SAME_PLAYER_POSITIONS = 2;       // Max 2 picks per player

function checkCorrelationLimits(
  new_pick: Pick,
  existing_picks: Pick[]
): ExposureCheckResult {
  const correlations = existing_picks.map(p => detectCorrelation(new_pick, p));

  // Count highly correlated positions
  const highlyCorrelated = correlations.filter(c =>
    c.correlated && c.strength >= MAX_CORRELATION_THRESHOLD
  ).length;

  if (highlyCorrelated >= MAX_CORRELATED_POSITIONS) {
    return {
      approved: false,
      reason: 'TOO_CORRELATED',
      details: {
        highly_correlated_count: highlyCorrelated,
        limit: MAX_CORRELATED_POSITIONS,
      }
    };
  }

  // Count same-game positions
  const sameGameCount = correlations.filter(c =>
    c.type === CorrelationType.SAME_GAME
  ).length;

  if (sameGameCount >= MAX_SAME_GAME_POSITIONS) {
    return {
      approved: false,
      reason: 'TOO_MANY_SAME_GAME',
      details: {
        same_game_count: sameGameCount,
        limit: MAX_SAME_GAME_POSITIONS,
      }
    };
  }

  // Count same-player positions
  const samePlayerCount = correlations.filter(c =>
    c.type === CorrelationType.SAME_PLAYER
  ).length;

  if (samePlayerCount >= MAX_SAME_PLAYER_POSITIONS) {
    return {
      approved: false,
      reason: 'TOO_MANY_SAME_PLAYER',
      details: {
        same_player_count: samePlayerCount,
        limit: MAX_SAME_PLAYER_POSITIONS,
      }
    };
  }

  return { approved: true };
}
```

---

## 🔧 ENFORCEMENT LAYER

### Risk Check Pipeline

**Location:** `apps/api/src/services/RiskCheckService.ts`

```typescript
export class RiskCheckService {
  private bankrollConfig: BankrollConfig;
  private logger: Logger;

  async validatePickRisk(
    pick: Pick,
    existing_picks: Pick[]
  ): Promise<RiskCheckResult> {
    const checks: RiskCheck[] = [];

    // 1. Position sizing
    const sizing = selectPositionSize(pick, this.bankrollConfig);
    checks.push({
      name: 'position_sizing',
      passed: true,
      details: sizing,
    });

    // 2. Game exposure
    const gameCheck = checkGameExposure(pick, existing_picks);
    checks.push({
      name: 'game_exposure',
      passed: gameCheck.approved,
      details: gameCheck.details,
    });

    // 3. Team exposure
    const teamCheck = checkTeamExposure(pick, existing_picks);
    checks.push({
      name: 'team_exposure',
      passed: teamCheck.approved,
      details: teamCheck.details,
    });

    // 4. League exposure
    const leagueCheck = checkLeagueExposure(pick, existing_picks);
    checks.push({
      name: 'league_exposure',
      passed: leagueCheck.approved,
      details: leagueCheck.details,
    });

    // 5. Market exposure
    const marketCheck = checkMarketExposure(pick, existing_picks);
    checks.push({
      name: 'market_exposure',
      passed: marketCheck.approved,
      details: marketCheck.details,
    });

    // 6. Correlation limits
    const correlationCheck = checkCorrelationLimits(pick, existing_picks);
    checks.push({
      name: 'correlation',
      passed: correlationCheck.approved,
      details: correlationCheck.details,
    });

    // Overall result
    const allPassed = checks.every(c => c.passed);
    const failedChecks = checks.filter(c => !c.passed);

    return {
      approved: allPassed,
      checks,
      failed_checks: failedChecks,
      recommended_stake: sizing.capped_size * this.bankrollConfig.total_bankroll,
    };
  }
}
```

### Integration Point (Promotion Endpoint)

**Location:** `apps/api/src/routes/ops-picks.ts`

```typescript
router.post('/:id/promote', async (req, res) => {
  const pick = await fetchPick(req.params.id);

  // Fetch all active picks (not settled)
  const activePicks = await supabaseClient
    .from('picks')
    .select('*')
    .neq('status', 'settled')
    .neq('id', pick.id);

  // Run risk checks
  const riskCheckService = new RiskCheckService(bankrollConfig);
  const riskResult = await riskCheckService.validatePickRisk(pick, activePicks.data || []);

  if (!riskResult.approved) {
    // Log rejection
    await logPickRejection({
      pick_id: pick.id,
      rejection_code: riskResult.failed_checks[0].name.toUpperCase(),
      rejection_reason: `Risk check failed: ${riskResult.failed_checks.map(c => c.name).join(', ')}`,
      failed_criteria: riskResult.failed_checks.map(c => c.name),
      raw_data_snapshot: pick,
      pipeline_stage: 'risk_check',
    });

    return res.status(400).json({
      success: false,
      error: 'Pick failed risk checks',
      failed_checks: riskResult.failed_checks,
    });
  }

  // Continue with promotion...
  pick.stake = riskResult.recommended_stake;
});
```

---

## 📊 MONITORING & METRICS

### Prometheus Metrics

```
# Total risk deployed
bankroll_total_risk_deployed_pct gauge

# Risk by category
bankroll_exposure_pct{type="game|team|league|market"} gauge

# Correlation metrics
portfolio_correlation_count{threshold="0.7|0.8|0.9"} gauge

# Drawdown tracking
bankroll_drawdown_pct{period="daily|weekly|monthly"} gauge

# Position sizing distribution
position_size_pct{method="kelly|fractional|flat"} histogram
```

### Alerts

```yaml
- alert: ExcessiveGameExposure
  expr: max(bankroll_exposure_pct{type="game"}) > 0.40
  annotations:
    summary: "Game exposure exceeds 40% limit"

- alert: DailyDrawdownLimit
  expr: bankroll_drawdown_pct{period="daily"} > 0.05
  annotations:
    summary: "Daily drawdown exceeds 5% - STOP TRADING"
    severity: critical

- alert: HighCorrelationRisk
  expr: portfolio_correlation_count{threshold="0.8"} > 3
  annotations:
    summary: "Too many highly correlated positions"
```

---

## 🧪 TESTING

```typescript
describe('Risk Management', () => {
  it('caps position size to max per pick', () => {
    const sizing = selectPositionSize(
      { odds: -110, confidence: 80 },
      { total_bankroll: 100000, risk_per_pick_pct: 2 }
    );
    expect(sizing.capped_size * 100000).toBeLessThanOrEqual(2000);
  });

  it('rejects pick exceeding game exposure', () => {
    const existing = [
      { game_id: 'game1', stake_pct: 0.25 },
      { game_id: 'game1', stake_pct: 0.20 },
    ];
    const newPick = { game_id: 'game1', stake_pct: 0.10 };

    const result = checkGameExposure(newPick, existing);
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('EXCEEDS_GAME_EXPOSURE');
  });

  it('detects same-game correlation', () => {
    const pick_a = { game_id: 'game1', selection: 'over' };
    const pick_b = { game_id: 'game1', selection: 'under' };

    const correlation = detectCorrelation(pick_a, pick_b);
    expect(correlation.correlated).toBe(true);
    expect(correlation.type).toBe(CorrelationType.SAME_GAME);
  });
});
```

---

## ✅ ROLLOUT PLAN

### Week 1: Configuration
- Deploy bankroll config to production
- Set initial limits conservatively

### Week 2: Logging Mode
- Add risk checks to promotion endpoint
- **Log-only** mode (no rejections)
- Monitor baseline exposure levels

### Week 3: Soft Enforcement
- Enable rejections for CRITICAL limits only:
  - Daily drawdown > 5%
  - Game exposure > 50%

### Week 4: Full Enforcement
- Enable all risk checks
- Alert on any rejected picks
- Review and tune limits based on data

---

**Approved By:** Risk Management & Portfolio Operations
**Next Review:** 2025-12-29 (Weekly)
