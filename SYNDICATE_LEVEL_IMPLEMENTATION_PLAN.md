# Syndicate-Level Scoring System Implementation Plan
## From Mock Data to Real Professional Intelligence

**Document Version:** 1.0
**Created:** October 2, 2025
**Timeline:** 4 weeks
**Status:** Ready for Implementation

---

## 🎯 Executive Summary

### Current State
The Unit Talk platform has **70% of a professional-grade betting intelligence system** built:
- ✅ Complete agent orchestration framework
- ✅ Enhanced45FactorEngine architecture (195-factor system)
- ✅ Database infrastructure with cache-first design
- ✅ Odds API integration with full market coverage
- ✅ Discord integration and user management
- ✅ Temporal workflow orchestration

### The Problem
The scoring system is **fundamentally broken** because:
- ❌ All probability calculations use hardcoded 52% win rate
- ❌ FeatureStore returns empty data (tables don't exist)
- ❌ No historical player performance data
- ❌ No real edge detection
- ❌ Picks score identically regardless of value

**Example:** A -1000 odds pick (99% implied probability) and a +200 odds pick (33% implied probability) both get scored assuming 52% win rate. This is completely unusable.

### The Solution
Implement the missing **30% data layer** to unlock the existing infrastructure:
1. Create feature storage tables
2. Build data collection pipelines
3. Implement real probability models
4. Replace hardcoded assumptions with calculations

### Expected Outcome
**A fully operational syndicate-level scoring system** that:
- Calculates real win probabilities (35-75% range based on data)
- Identifies positive expected value picks
- Scores picks meaningfully (20-100 range with clear separation)
- Achieves 54-56% hit rate on top-tier picks
- Processes picks in <200ms with 80%+ cache hit rate

---

## 📊 Current State Analysis

### What We Have (70% Complete)

#### **1. Infrastructure Layer ✅**
- Agent-based architecture (BaseAgent, specialized agents)
- Temporal workflow orchestration
- Event-driven processing
- Health monitoring and metrics
- Docker orchestration

#### **2. Database Architecture ✅**
```
Existing Tables:
- unified_picks (5,251 Oct 2 picks ingested successfully)
- games (schedule and game information)
- sports_game_odds (odds from multiple bookmakers)
- scoring_queue (pick processing queue)
- cache_coordination (5 cache-related tables)
- api_quota_configs (rate limiting)
```

#### **3. Scoring Framework ✅**
- Enhanced45FactorEngine class structure
- FeatureStoreIntegration architecture
- MaterialChangeDetector for updates
- Professional odds filtering (just implemented)
- 45-factor category breakdown:
  - Market Factors (10): EV, line movement, CLV, efficiency, splits, volume, arbitrage, steam, resistance, timing
  - Player Factors (10): Form, role stability, matchups, injury, fatigue, usage, trends, clutch, tendencies, situational
  - Matchup Factors (10): Team vs team, DvP, pace, game script, home/away, referee, weather, venue, rest, motivation
  - Price Factors (10): Line shopping, Kelly, risk-adjusted return, correlation, portfolio impact, volatility, liquidity, timing, spread, option value
  - Meta Factors (5): Data quality, model agreement, accuracy, confidence, recency bias

#### **4. Data Ingestion ✅**
- Odds API as primary provider
- Full market coverage (59 NFL markets, 27 MLB markets)
- Real-time ingestion operational
- Deduplication and validation

### What We're Missing (30% - Critical Gap)

#### **1. Feature Storage Tables ❌**
```sql
Missing:
- feature_values (stores all computed features)
- feature_freshness (tracks update timestamps)
- player_stats (historical player performance)
- line_history (line movement tracking)
- sharp_indicators (sharp money signals)
```

**Impact:** FeatureStore can't return real data, falls back to mocks

#### **2. Data Collection Pipelines ❌**
```
Missing:
- Player statistics ingestion (MLB/NFL APIs)
- Historical game results
- Line movement tracking
- Weather data collection
- Injury report updates
```

**Impact:** No data to feed into probability models

#### **3. Probability Models ❌**
```typescript
Current (Line 543 of Enhanced45FactorEngine.ts):
const assumedTrueProb = 0.52; // Hardcoded for EVERYTHING

Needed:
- Historical hit rate calculations
- League average adjustments
- Matchup factors
- Home/away splits
- Recency weighting
```

**Impact:** Cannot calculate real win probabilities or expected value

---

## 🎯 Goals & Success Criteria

### Primary Goals

**Goal 1: Real Probability Calculations**
- Replace hardcoded 52% with player-specific probabilities
- Probabilities should range 35-75% based on actual data
- Success: Backtest shows calibration (52% picks win 52% of time)

**Goal 2: Meaningful Score Differentiation**
- Scores should range 20-100 with clear separation
- Top 10% should score 70+, bottom 10% under 35
- Success: Score variance >20 points between tiers

**Goal 3: Edge Detection**
- Identify picks with positive expected value
- 30%+ of analyzed picks show measurable edge
- Success: CLV positive on 60%+ of recommended bets

**Goal 4: Professional Hit Rate**
- Top-tier picks (S/A grade) achieve 54-56% win rate
- Better than implied probability by 2-4%
- Success: 100+ pick sample shows statistical significance

**Goal 5: Production Performance**
- Process picks in <200ms with real calculations
- Cache hit rate >80% on feature lookups
- Success: p95 latency <200ms, no performance degradation

### Success Metrics

| Metric | Current | Target | Validation Method |
|--------|---------|--------|-------------------|
| Score Variance | 2-3 points | 20-60 points | Statistical analysis of score distribution |
| Probability Range | 52% (all picks) | 35-75% | Sample 100 picks, verify range |
| Positive EV % | 0% (unknown) | 30%+ | Calculate EV for all picks, measure % >0 |
| Hit Rate (S/A tier) | ~50% (random) | 54-56% | 100 pick backtest, statistical significance |
| Processing Time | <50ms (no queries) | <200ms | p95 latency monitoring |
| Data Freshness | N/A | <2 hours | feature_freshness table lag |

---

## 📋 Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Build data storage and collection infrastructure
**Duration:** 5-7 days
**Dependencies:** None (can start immediately)

#### Day 1: Database Tables
**Deliverables:**
1. `supabase/migrations/20251003_create_feature_tables.sql`
```sql
-- Feature storage for all computed features
CREATE TABLE IF NOT EXISTS feature_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'player', 'team', 'game', 'prop'
  entity_id TEXT NOT NULL,     -- player_id, team_id, etc.
  feature_name TEXT NOT NULL,  -- 'recent_hit_rate', 'dvp_rating', etc.
  value JSONB NOT NULL,        -- flexible storage for any data type
  as_of TIMESTAMPTZ NOT NULL,  -- point-in-time value
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, feature_name, as_of)
);

-- Track feature update timestamps
CREATE TABLE IF NOT EXISTS feature_freshness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL,
  UNIQUE(feature_name, entity_type, entity_id)
);

-- Indexes for performance
CREATE INDEX idx_feature_values_lookup
  ON feature_values(entity_type, entity_id, feature_name);
CREATE INDEX idx_feature_values_asof
  ON feature_values(as_of DESC);
CREATE INDEX idx_feature_freshness_updated
  ON feature_freshness(last_updated DESC);
```

2. `supabase/migrations/20251003_create_player_stats_table.sql`
```sql
-- Historical player statistics
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  team TEXT,
  game_date DATE NOT NULL,
  opponent TEXT,
  home_away TEXT CHECK (home_away IN ('home', 'away')),
  stats JSONB NOT NULL,        -- all stats for that game
  season INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, game_date, sport)
);

CREATE INDEX idx_player_stats_lookup
  ON player_stats(player_id, sport, game_date DESC);
CREATE INDEX idx_player_stats_season
  ON player_stats(sport, season, player_id);
```

3. `supabase/migrations/20251003_create_line_history_table.sql`
```sql
-- Track line movements for CLV analysis
CREATE TABLE IF NOT EXISTS line_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT,
  line NUMERIC,
  odds INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_line_history_prop
  ON line_history(prop_id, timestamp DESC);
CREATE INDEX idx_line_history_event
  ON line_history(event_id, market, timestamp DESC);
```

4. Run migrations and verify tables exist

#### Day 2: MLB Stats Integration
**Deliverables:**
1. `apps/api/src/services/data-collection/MLBStatsService.ts`
```typescript
/**
 * MLB Stats API Integration
 * Official MLB Stats API: https://statsapi.mlb.com
 */
export class MLBStatsService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';

  async getPlayerGameLog(playerId: string, season: number): Promise<GameLog[]> {
    // Fetch player game-by-game stats for season
  }

  async getPlayerStats(playerId: string, date: string): Promise<PlayerStats> {
    // Fetch player stats for specific game date
  }

  async getTeamStats(teamId: string, season: number): Promise<TeamStats> {
    // Fetch team aggregate statistics
  }
}
```

2. `apps/api/src/scripts/data-collection/ingestMLBStats.ts`
```typescript
/**
 * Daily MLB statistics ingestion
 * Runs after games complete (typically 2-4 hours post-game)
 */
async function ingestMLBStats() {
  // 1. Get completed games for date
  // 2. For each game, fetch player stats
  // 3. Store in player_stats table
  // 4. Update feature_freshness
}
```

3. Cron job configuration for automated daily runs

#### Day 3: NFL Stats Integration
**Deliverables:**
1. `apps/api/src/services/data-collection/NFLStatsService.ts`
```typescript
/**
 * NFL Stats API Integration
 * Uses ESPN or NFL.com unofficial API
 */
export class NFLStatsService {
  async getPlayerGameStats(playerId: string, gameId: string): Promise<PlayerStats> {
    // Fetch player stats for specific game
  }

  async getPlayerSeasonStats(playerId: string, season: number): Promise<SeasonStats> {
    // Fetch player aggregate season stats
  }
}
```

2. `apps/api/src/scripts/data-collection/ingestNFLStats.ts`
3. Cron job configuration

#### Day 4: Historical Data Backfill
**Deliverables:**
1. `apps/api/src/scripts/data-collection/historicalBackfill.ts`
```typescript
/**
 * Backfill last 30 days of player statistics
 * Required before probability models can function
 */
async function backfillHistoricalData() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  // For each day in last 30 days:
  //   - Fetch MLB stats (if in season)
  //   - Fetch NFL stats (if in season)
  //   - Store in player_stats table
  //   - Update feature_freshness
}
```

2. Execute backfill for both MLB and NFL
3. Verify 30 days of data in player_stats table

#### Day 5: Line Movement Tracker
**Deliverables:**
1. `apps/api/src/services/data-collection/LineMovementTracker.ts`
```typescript
/**
 * Track odds changes from Odds API
 * Poll every 5-15 minutes, store snapshots
 */
export class LineMovementTracker {
  async trackLineMovements() {
    // 1. Fetch current odds from Odds API
    // 2. Compare to last snapshot in line_history
    // 3. Store changes in line_history table
    // 4. Calculate line velocity
  }
}
```

2. Background service that runs continuously
3. Store line snapshots in line_history table

#### Day 6-7: Testing & Validation
**Tasks:**
- Verify all tables populated with real data
- Check data quality (no nulls, valid ranges)
- Validate cron jobs running successfully
- Monitor API rate limits and quotas
- Document data pipeline architecture

**Phase 1 Success Criteria:**
- ✅ All database tables created and indexed
- ✅ 30 days of historical player stats in database
- ✅ Line movement tracking operational
- ✅ Automated daily stats updates working
- ✅ Data quality >95% (completeness, accuracy)

---

### Phase 2: Probability Models (Week 2)
**Goal:** Build real probability calculations to replace 52% hardcoded assumption
**Duration:** 5-7 days
**Dependencies:** Phase 1 complete (requires historical data)

#### Day 1-2: Historical Hit Rate Calculator
**Deliverables:**
1. `apps/api/src/models/HitRateCalculator.ts`
```typescript
/**
 * Calculate historical hit rates for player + market combinations
 */
export class HitRateCalculator {
  async calculateHitRate(
    playerId: string,
    market: string,
    line: number,
    lookbackDays: number = 30
  ): Promise<number> {
    // 1. Query player_stats for last N games
    // 2. For each game, check if player went OVER line
    // 3. Calculate hit rate: hits / total_games
    // 4. Apply recency weighting (last 5 games weighted higher)

    // Example for "total_bases > 1.5":
    // Last 20 games: 13 games over 1.5 TB
    // Last 5 games: 4 games over 1.5 TB
    // Weighted rate: (13/20 * 0.4) + (4/5 * 0.6) = 74%

    return weightedHitRate;
  }
}
```

2. `supabase/functions/calculate_player_hit_rate.sql`
```sql
-- SQL function for fast hit rate calculations
CREATE OR REPLACE FUNCTION calculate_player_hit_rate(
  p_player_id TEXT,
  p_market TEXT,
  p_line NUMERIC,
  p_lookback_days INTEGER DEFAULT 30
) RETURNS NUMERIC AS $$
DECLARE
  hit_count INTEGER;
  total_count INTEGER;
  hit_rate NUMERIC;
BEGIN
  -- Query player_stats for games in lookback period
  -- Calculate how many times player went over line
  -- Return hit_rate as decimal (0.0 to 1.0)

  RETURN hit_rate;
END;
$$ LANGUAGE plpgsql;
```

3. Unit tests with historical data validation

#### Day 3: League Average Adjustments
**Deliverables:**
1. `apps/api/src/models/LeagueAverageService.ts`
```typescript
/**
 * Calculate league averages and player deviations
 */
export class LeagueAverageService {
  async calculatePlayerDeviation(
    playerId: string,
    sport: string,
    market: string,
    season: number
  ): Promise<number> {
    // 1. Calculate league average for market
    // 2. Calculate player average for market
    // 3. Return deviation multiplier

    // Example:
    // League avg total bases: 1.8
    // Player avg total bases: 2.1
    // Deviation: 2.1 / 1.8 = 1.17 (17% above average)

    return deviationMultiplier;
  }
}
```

2. Cache league averages (updated weekly)
3. Store in feature_values table

#### Day 4: Matchup Adjustments
**Deliverables:**
1. `apps/api/src/models/MatchupFactorCalculator.ts`
```typescript
/**
 * Calculate matchup-specific adjustments
 */
export class MatchupFactorCalculator {
  async calculateMatchupFactor(
    playerId: string,
    opponent: string,
    market: string
  ): Promise<number> {
    // 1. Opponent defense vs position (DvP) rating
    // 2. Historical player vs opponent performance
    // 3. Home/away splits
    // 4. Rest advantage

    // Example:
    // Player vs tough defense: 0.85 (15% harder)
    // Player at home: 1.05 (5% boost)
    // Player well-rested: 1.03 (3% boost)
    // Combined: 0.85 * 1.05 * 1.03 = 0.92

    return combinedFactor;
  }
}
```

2. DvP ratings calculated from opponent stats
3. Home/away splits from player_stats table

#### Day 5: Recency & Trend Analysis
**Deliverables:**
1. `apps/api/src/models/TrendAnalyzer.ts`
```typescript
/**
 * Identify hot/cold streaks and apply recency weighting
 */
export class TrendAnalyzer {
  async calculateRecencyWeight(
    playerId: string,
    market: string,
    daysAgo: number
  ): Promise<number> {
    // Exponential decay: recent games matter more
    // Formula: weight = 0.7^(days_ago / 7)

    // Example:
    // Today's game: 0.7^0 = 1.0 (100% weight)
    // 7 days ago: 0.7^1 = 0.7 (70% weight)
    // 14 days ago: 0.7^2 = 0.49 (49% weight)

    return weight;
  }

  async detectStreak(
    playerId: string,
    market: string
  ): Promise<{ type: 'hot' | 'cold' | 'neutral', confidence: number }> {
    // Detect sustained performance trends
    // Last 5 games significantly above/below average
  }
}
```

2. Integration with probability calculations

#### Day 6-7: Model Integration & Testing
**Deliverables:**
1. `apps/api/src/models/ProbabilityModelService.ts`
```typescript
/**
 * Main probability calculation service
 * Combines all factors into final probability
 */
export class ProbabilityModelService {
  async calculateTrueProbability(
    playerId: string,
    market: string,
    line: number,
    opponent: string,
    venue: 'home' | 'away'
  ): Promise<{
    probability: number;
    confidence: number;
    factors: {
      baseHitRate: number;
      leagueAdjustment: number;
      matchupFactor: number;
      recencyWeight: number;
    };
  }> {
    // 1. Get historical hit rate (e.g., 0.65)
    const hitRate = await this.hitRateCalculator.calculate(...);

    // 2. Apply league average adjustment (e.g., 1.15)
    const leagueAdj = await this.leagueAverageService.calculate(...);

    // 3. Apply matchup factors (e.g., 0.92)
    const matchupFactor = await this.matchupCalculator.calculate(...);

    // 4. Apply recency weighting (e.g., 1.05)
    const recencyWeight = await this.trendAnalyzer.calculate(...);

    // 5. Combine: 0.65 * 1.15 * 0.92 * 1.05 = 72.4%
    const finalProb = hitRate * leagueAdj * matchupFactor * recencyWeight;

    return {
      probability: finalProb,
      confidence: this.calculateConfidence(...),
      factors: { hitRate, leagueAdj, matchupFactor, recencyWeight }
    };
  }
}
```

2. Backtest validation against 100+ historical picks
3. Calibration testing (52% picks should win 52% of time)
4. Store calculated probabilities in feature_values table

**Phase 2 Success Criteria:**
- ✅ Probability calculations return 35-75% range (not 52%)
- ✅ Backtest shows calibration within ±3%
- ✅ All factors properly weighted and combined
- ✅ Confidence scores accurately reflect data quality
- ✅ Processing time <100ms per probability calculation

---

### Phase 3: Market Intelligence (Week 3)
**Goal:** Add professional market analysis features
**Duration:** 5-7 days
**Dependencies:** Phase 1 complete (requires line_history data)

#### Day 1-2: Line Movement Analysis
**Deliverables:**
1. `apps/api/src/models/LineMovementAnalyzer.ts`
```typescript
/**
 * Calculate line movement velocity and direction
 */
export class LineMovementAnalyzer {
  async calculateLineVelocity(propId: string): Promise<number> {
    // 1. Query line_history for prop
    // 2. Calculate movement per hour
    // 3. High velocity = strong market signal

    // Example:
    // Line moved from -150 to -180 in 2 hours
    // Velocity: 30 points / 2 hours = 15 points/hour
    // Score: High velocity (>10/hr) = strong signal

    return velocityScore; // 0-100
  }

  async detectSteamMove(propId: string): Promise<boolean> {
    // Rapid line movement (>20 points in <1 hour)
    // Indicates sharp money
  }
}
```

2. Real-time line monitoring service
3. Alert generation for steam moves

#### Day 3: Closing Line Value (CLV)
**Deliverables:**
1. `apps/api/src/models/CLVCalculator.ts`
```typescript
/**
 * Predict closing line and calculate CLV
 */
export class CLVCalculator {
  async predictClosingLine(
    propId: string,
    currentLine: number,
    timeUntilGameMinutes: number
  ): Promise<number> {
    // 1. Historical line movement patterns
    // 2. Current velocity
    // 3. Time decay modeling

    // Example:
    // Current: -150 (4 hours before game)
    // Velocity: +5 points/hour toward favorite
    // Predicted close: -170
    // CLV if bet now: -150 vs -170 = 20 points value

    return predictedClosingLine;
  }
}
```

2. CLV tracking for all placed bets
3. CLV performance reporting

#### Day 4: Sharp Money Detection
**Deliverables:**
1. `apps/api/src/models/SharpMoneyDetector.ts`
```typescript
/**
 * Identify sharp money indicators
 */
export class SharpMoneyDetector {
  async detectSharpMoney(propId: string): Promise<{
    detected: boolean;
    confidence: number;
    indicators: string[];
  }> {
    // Indicators:
    // 1. Line moved against public betting %
    // 2. Steam move detected
    // 3. Reverse line movement (RLM)
    // 4. Opening line beater

    return { detected, confidence, indicators };
  }
}
```

2. Integration with probability calculations
3. Scoring boost for sharp money alignment

#### Day 5: Market Efficiency Scoring
**Deliverables:**
1. `apps/api/src/models/MarketEfficiencyAnalyzer.ts`
```typescript
/**
 * Calculate market efficiency for finding value
 */
export class MarketEfficiencyAnalyzer {
  async calculateMarketEfficiency(
    sport: string,
    market: string
  ): Promise<number> {
    // Less efficient markets = more opportunity
    // 1. Historical closing line accuracy
    // 2. Line movement volatility
    // 3. Number of bookmakers offering market

    // Example:
    // Obscure prop (few books): 70% efficient
    // Popular prop (many books): 95% efficient
    // More value in 70% efficient market

    return efficiencyScore; // 0-100
  }
}
```

2. Efficiency scores per market type
3. Target low-efficiency markets for analysis

#### Day 6-7: Integration & Testing
**Tasks:**
- Integrate all market intelligence features
- Test with live line data
- Validate steam detection accuracy
- CLV tracking validation
- Performance optimization

**Phase 3 Success Criteria:**
- ✅ Line velocity calculations accurate
- ✅ Steam detection identifies 80%+ of steam moves
- ✅ CLV predictions within ±10 points
- ✅ Sharp money indicators properly weighted
- ✅ Market efficiency scores differentiate opportunities

---

### Phase 4: System Integration (Week 4)
**Goal:** Connect all components and achieve production-ready system
**Duration:** 5-7 days
**Dependencies:** Phases 1-3 complete

#### Day 1-2: Enhanced45FactorEngine Integration
**Deliverables:**
1. Update `apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts`

**Critical Changes:**
```typescript
// OLD (Line 543):
const assumedTrueProb = 0.52; // HARDCODED - WRONG!

// NEW:
const trueProb = await this.probabilityModelService.calculateTrueProbability(
  features.player,
  features.marketType,
  features.market.line,
  features.opponent,
  features.venue
);
```

```typescript
// OLD (Line 528-563):
private calculateDeviggedEV(features, enhancedFeatures): number {
  const assumedTrueProb = 0.52;
  const ev = calculateTrueExpectedValue(odds, assumedTrueProb);
  // ...
}

// NEW:
private async calculateDeviggedEV(features, enhancedFeatures): Promise<number> {
  // 1. Get REAL probability from models
  const probResult = await this.probabilityModelService.calculateTrueProbability(...);
  const trueProb = probResult.probability;

  // 2. Calculate TRUE expected value
  const impliedProb = oddsToImpliedProbability(features.odds);
  const edge = trueProb - impliedProb;
  const ev = calculateTrueExpectedValue(features.odds, trueProb);

  // 3. Score based on actual edge (not odds penalty)
  const baseScore = 50 + (edge * 200); // 10% edge = 70 score

  // 4. Adjust for confidence
  const confidenceAdjusted = baseScore * probResult.confidence;

  return confidenceAdjusted;
}
```

2. Update `apps/api/src/agents/ScoringAgent/scoring/FeatureStoreIntegration.ts`

**Critical Changes:**
```typescript
// OLD (Line 870-925):
private createFallbackFeatures(): EnhancedFeatures {
  return {
    lineHistory: [],      // EMPTY
    recentGames: [],      // EMPTY
    // ... all defaults/mocks
  };
}

// NEW:
async getEnhancedFeatures(propId, sport, playerId): Promise<EnhancedFeatures> {
  // 1. Query feature_values table for player features
  const features = await this.featureStoreService.queryFeatures({
    entityType: 'player',
    entityId: playerId,
    featureNames: [
      'recent_hit_rate',
      'league_deviation',
      'matchup_factor',
      'recency_weight',
      'trend_analysis',
      // ... all 45 features
    ]
  });

  // 2. Query player_stats for recent games
  const recentGames = await this.getPlayerRecentGames(playerId, sport, 10);

  // 3. Query line_history for line movement
  const lineHistory = await this.getLineHistory(propId);

  // 4. Combine into EnhancedFeatures format
  return this.transformToEnhancedFeatures(features, recentGames, lineHistory);
}
```

3. Remove all hardcoded assumptions
4. Remove odds penalty logic (now using real edge)

#### Day 3: Backtest Validation
**Deliverables:**
1. `apps/api/src/scripts/validation/backtestValidator.ts`
```typescript
/**
 * Validate scoring system against historical picks
 */
async function backtestScoring() {
  // 1. Get historical picks with known outcomes (last 30 days)
  // 2. Re-score using new system
  // 3. Measure accuracy:
  //    - Score distribution (should be 20-100 range)
  //    - Win rate by tier (S: 56%+, A: 54%+, B: 52%+)
  //    - Calibration (52% picks win 52% of time)
  //    - Expected value accuracy

  // 4. Generate report
  return {
    totalPicks: 500,
    scoreRange: { min: 22, max: 87, avg: 54 },
    winRateByTier: {
      S: 0.572,
      A: 0.549,
      B: 0.523,
      C: 0.487,
      D: 0.401
    },
    calibration: {
      picks40_50: { predicted: 0.45, actual: 0.43 },
      picks50_60: { predicted: 0.55, actual: 0.54 },
      picks60_70: { predicted: 0.65, actual: 0.67 },
    },
    clvPositive: 0.624 // 62.4% of picks had positive CLV
  };
}
```

2. Minimum 100 pick backtest sample
3. Statistical significance testing
4. Report generation with visualizations

#### Day 4: Factor Weight Optimization
**Deliverables:**
1. `apps/api/src/scripts/optimization/factorWeightOptimizer.ts`
```typescript
/**
 * Optimize factor weights using historical performance
 */
async function optimizeFactorWeights() {
  // 1. Test different weight combinations
  // 2. Measure performance on validation set
  // 3. Find optimal weights that maximize:
  //    - Win rate on top-tier picks
  //    - Calibration accuracy
  //    - Expected value realization

  // Current weights:
  // Market: 0.30, Player: 0.25, Matchup: 0.20, Price: 0.15, Meta: 0.10

  // Test variations and update if better performance found
}
```

2. A/B testing framework for weight changes
3. Documentation of optimal weights

#### Day 5: Performance Optimization
**Tasks:**
- Database query optimization
- Index tuning for feature_values lookups
- Caching strategy implementation
- Connection pool optimization
- Batch processing improvements

**Target Metrics:**
- p95 latency <200ms
- Cache hit rate >80%
- Database connection pool utilization <70%
- Feature calculation throughput 500+ picks/minute

#### Day 6-7: End-to-End Testing & Documentation
**Deliverables:**
1. `apps/api/src/scripts/e2e/fullSystemTest.ts`
```typescript
/**
 * Complete end-to-end system validation
 */
async function fullSystemTest() {
  // 1. Ingest today's props
  // 2. Score all props through real system
  // 3. Validate scores are meaningful
  // 4. Check performance metrics
  // 5. Verify no picks score with 52% assumption
  // 6. Generate system health report
}
```

2. `PRODUCTION_DEPLOYMENT.md` - Complete deployment guide
3. `SCORING_SYSTEM_DOCS.md` - Technical documentation
4. `OPERATOR_GUIDE.md` - How to monitor and maintain system
5. Performance benchmarking report
6. Data quality monitoring dashboard (Retool)

**Phase 4 Success Criteria:**
- ✅ No hardcoded probabilities anywhere in codebase
- ✅ Backtest shows 54%+ win rate on S/A tier picks
- ✅ Score distribution 20-100 with clear tiers
- ✅ p95 latency <200ms
- ✅ Cache hit rate >80%
- ✅ All documentation complete

---

## 📈 Expected Impact

### Before Implementation (Current State)

**Scoring Quality:**
- All picks scored 50-55 (meaningless)
- Cannot differentiate value from garbage
- 52% hardcoded for everything
- Random 50% win rate

**User Experience:**
- Cannot trust recommendations
- No edge detection
- Picks look professional but are useless
- System appears broken

**Business Impact:**
- Platform unusable for real betting
- Cannot compete with professional cappers
- Zero credibility with sharp bettors
- Massive technical debt

### After Implementation (Target State)

**Scoring Quality:**
- Scores range 20-100 with clear separation
- Real probability calculations (35-75%)
- Identifies positive EV picks (30%+ of analyzed picks)
- 54-56% win rate on top-tier picks

**User Experience:**
- Trustworthy, data-driven recommendations
- Clear tier system (S/A/B/C/D)
- Transparent factor breakdowns
- Professional-grade intelligence

**Business Impact:**
- Platform competitive with top betting services
- Sharp bettors can trust system
- Credibility with professional community
- Technical foundation for future features

### Key Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Score Variance | 2-3 pts | 20-60 pts | **10-20x increase** |
| Probability Range | 52% only | 35-75% | **Real calculations** |
| Edge Detection | 0% | 30%+ | **Infinite improvement** |
| Win Rate (Top Tier) | ~50% | 54-56% | **+4-6%** |
| Processing Time | 50ms | <200ms | **4x slower but USEFUL** |
| System Credibility | 0/10 | 8/10 | **Professional-grade** |

### ROI Analysis

**Time Investment:** 105-145 hours over 4 weeks
**Cost Investment:** $0-10/month additional (APIs are free tier)
**Infrastructure Investment:** $0 (all components already built)

**Value Created:**
- Unusable system → Professional-grade system
- 0% credibility → 80% credibility
- No competitive advantage → Syndicate-level intelligence
- Technical debt → Technical asset

**Return:** Infinite ROI (from $0 value to production-ready platform)

---

## 🎯 Implementation Strategy

### Parallel Work Streams

**Stream A (Critical Path):** Database → Data Collection → Models → Integration
**Stream B (Parallel):** Line Tracking → CLV → Sharp Money
**Stream C (Parallel):** Weather/Injury → Matchup → Venue

Stream A blocks everything - must complete first.
Streams B and C can run in parallel after database setup.

### Dependencies & Blockers

**Week 1 Blockers:**
- None (can start immediately)

**Week 2 Blockers:**
- Requires 30 days historical data from Week 1
- Cannot calculate hit rates without game logs

**Week 3 Blockers:**
- Requires line_history data from Week 1
- CLV tracking needs historical line movements

**Week 4 Blockers:**
- Requires all models from Weeks 2-3
- Integration needs completed probability calculations

### Risk Mitigation

**Risk:** Data source APIs go down
**Mitigation:** Multiple backup sources, graceful degradation, cache last known values
**Fallback:** Use cached features until API restored

**Risk:** Models not accurate enough
**Mitigation:** Start simple, iterate based on backtesting, A/B test changes
**Fallback:** Can revert to previous model if new one underperforms

**Risk:** Performance degradation
**Mitigation:** Cache-first architecture already built, indexes optimized
**Fallback:** Pre-compute features during off-peak hours

**Risk:** Timeline slippage
**Mitigation:** Focus on MVP features first, defer nice-to-haves
**Fallback:** 6-8 week timeline with buffer is still excellent ROI

---

## 📋 Deliverables Checklist

### Phase 1: Foundation
- [ ] Migration: create_feature_tables.sql
- [ ] Migration: create_player_stats_table.sql
- [ ] Migration: create_line_history_table.sql
- [ ] Service: MLBStatsService.ts
- [ ] Service: NFLStatsService.ts
- [ ] Script: ingestMLBStats.ts
- [ ] Script: ingestNFLStats.ts
- [ ] Script: historicalBackfill.ts
- [ ] Service: LineMovementTracker.ts
- [ ] Cron jobs configured for daily stats
- [ ] Documentation: DATA_PIPELINE_SETUP.md

### Phase 2: Models
- [ ] Model: HitRateCalculator.ts
- [ ] Function: calculate_player_hit_rate.sql
- [ ] Model: LeagueAverageService.ts
- [ ] Model: MatchupFactorCalculator.ts
- [ ] Model: TrendAnalyzer.ts
- [ ] Service: ProbabilityModelService.ts
- [ ] Tests: probabilityModels.test.ts
- [ ] Backtest validation (100+ picks)
- [ ] Documentation: PROBABILITY_MODELS.md

### Phase 3: Market Intelligence
- [ ] Model: LineMovementAnalyzer.ts
- [ ] Model: CLVCalculator.ts
- [ ] Model: SharpMoneyDetector.ts
- [ ] Model: MarketEfficiencyAnalyzer.ts
- [ ] Tests: marketIntelligence.test.ts
- [ ] Documentation: MARKET_INTELLIGENCE.md

### Phase 4: Integration
- [ ] Updated: Enhanced45FactorEngine.ts (remove hardcoded 52%)
- [ ] Updated: FeatureStoreIntegration.ts (real queries)
- [ ] Script: backtestValidator.ts
- [ ] Script: factorWeightOptimizer.ts
- [ ] Script: fullSystemTest.ts
- [ ] Dashboard: Scoring metrics (Retool)
- [ ] Tests: e2e_real_scoring.test.ts
- [ ] Documentation: PRODUCTION_DEPLOYMENT.md
- [ ] Documentation: SCORING_SYSTEM_DOCS.md
- [ ] Documentation: OPERATOR_GUIDE.md

---

## 🚀 Getting Started

### Prerequisites
- Existing Unit Talk platform (70% complete)
- Supabase database access
- Odds API credentials (already have)
- Development environment setup

### Immediate Next Steps

1. **Review this plan** with stakeholders
2. **Create new chat session** for implementation
3. **Start with Phase 1, Day 1:** Database table creation
4. **Reference this document** for detailed specifications

### How to Use This Plan

**For Implementation:**
1. Start new chat: "Implement Phase 1, Day 1 from SYNDICATE_LEVEL_IMPLEMENTATION_PLAN.md"
2. Follow deliverables checklist
3. Complete each phase before moving to next
4. Validate success criteria at end of each phase

**For Tracking Progress:**
- Use deliverables checklist as task list
- Mark items complete as you build
- Update success criteria validation
- Document any deviations from plan

**For Stakeholder Updates:**
- Reference expected impact section
- Share backtest results after Phase 2
- Report on success metrics after Phase 4

---

## 📚 Appendix

### Data Source Reference

**MLB Stats API:**
- Base URL: https://statsapi.mlb.com/api/v1
- Cost: FREE
- Rate Limits: None (official API)
- Documentation: https://github.com/toddrob99/MLB-StatsAPI

**NFL API (Unofficial):**
- Multiple options: ESPN, NFL.com
- Cost: FREE
- Rate Limits: Reasonable (avoid excessive requests)

**OpenWeatherMap:**
- Base URL: https://api.openweathermap.org
- Cost: FREE tier (1000 calls/day)
- Documentation: https://openweathermap.org/api

**Odds API (Already Have):**
- Used for line movement tracking
- Already integrated and operational

### Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ODDS API                              │
│              (Pick Ingestion - Working)                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              FeedAgent (Working)                         │
│         Ingests picks → unified_picks table              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│          ScoringAgent (Framework Complete)               │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │   Enhanced45FactorEngine (NEEDS FIX)       │         │
│  │   - Remove hardcoded 52%                    │         │
│  │   - Call ProbabilityModelService (NEW)      │         │
│  │   - Calculate real EV                       │         │
│  └────────────────┬───────────────────────────┘         │
│                   │                                      │
│                   ▼                                      │
│  ┌────────────────────────────────────────────┐         │
│  │   FeatureStoreIntegration (NEEDS FIX)      │         │
│  │   - Query feature_values (NEW TABLE)        │         │
│  │   - Query player_stats (NEW TABLE)          │         │
│  │   - Query line_history (NEW TABLE)          │         │
│  └────────────────┬───────────────────────────┘         │
└───────────────────┼──────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│         ProbabilityModelService (NEW)                    │
│                                                          │
│  ├─ HitRateCalculator (queries player_stats)            │
│  ├─ LeagueAverageService (queries player_stats)         │
│  ├─ MatchupFactorCalculator (queries player_stats)      │
│  └─ TrendAnalyzer (queries player_stats)                │
│                                                          │
│  Returns: Real probability (35-75% range)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              DATABASE (Supabase)                         │
│                                                          │
│  EXISTING:                                               │
│  ├─ unified_picks (picks from Odds API)                 │
│  ├─ games (schedule)                                    │
│  ├─ sports_game_odds (odds data)                        │
│  └─ cache_* tables (5 tables)                           │
│                                                          │
│  NEW (Phase 1):                                          │
│  ├─ feature_values (computed features)                  │
│  ├─ feature_freshness (update tracking)                 │
│  ├─ player_stats (historical performance)               │
│  └─ line_history (line movements)                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│         Data Collection Services (NEW)                   │
│                                                          │
│  ├─ MLBStatsService (daily stats ingestion)             │
│  ├─ NFLStatsService (daily stats ingestion)             │
│  └─ LineMovementTracker (continuous line tracking)      │
└─────────────────────────────────────────────────────────┘
```

### Success Story (4 Weeks from Now)

**Today:** System scores all picks 52%, cannot differentiate value
**Week 1:** Database filled with 30 days player stats
**Week 2:** First real probability calculation: "Bo Naylor 68% to go over 1.5 TB vs weak RHP"
**Week 3:** CLV tracking shows +15 points on recommended bet
**Week 4:** Backtest validates 55.2% win rate on S-tier picks

**Result:** Professional-grade betting intelligence platform, competitive with top services

---

**Document End**

**Next Action:** Start new chat with message:
"Begin implementation of Phase 1, Day 1 from SYNDICATE_LEVEL_IMPLEMENTATION_PLAN.md - Create database tables for feature storage"
