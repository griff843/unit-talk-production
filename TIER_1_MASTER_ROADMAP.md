# 🎯 TIER 1 MASTER IMPLEMENTATION ROADMAP

**Status**: SOURCE OF TRUTH
**Date**: October 3, 2025
**Goal**: Production-ready Tier 1 betting intelligence system
**Timeline**: 10-14 days to true Tier 1

---

## 📊 EXECUTIVE SUMMARY

### Current State vs Tier 1 Requirements

| Criterion | Required | Current | Status | Gap |
|-----------|----------|---------|--------|-----|
| Brier Score | <0.20 | 0.1717 | ✅ | MEETS |
| Calibration Error | <3% | 10.31% | ❌ | -7.31% |
| Sample Size | 1,000+ | 669 | ❌ | -331 |
| Multi-Sport | 3+ sports | 2 (NFL, MLB batters) | ⚠️ | 1 sport |
| Historical Data | Full season | 2 days MLB, 0 days NFL | ❌ | Critical |
| Settlement Rate | >95% | 0.17% | ❌ | -94.83% |
| Provider Agnostic | Yes | No (Odds API hardcoded) | ❌ | Critical |
| Infrastructure | Production-ready | 60-70% | ❌ | -30-40% |

**Overall Status**: **TIER 2 with Tier 1 potential** (1 of 8 criteria met)

### The Truth About Our System

**What Works (The Lambo Engine)**:
- ✅ Enhanced45FactorEngine: 45 professional factors, 195-factor calculation matrix
- ✅ NFL Brier Score: 0.1717 (beats Tier 1 threshold)
- ✅ ProbabilityCalculator: 3-tier system operational
- ✅ MLB stat mappings: Fixed for all 30+ market types
- ✅ Settlement architecture: Designed and implemented
- ✅ CalibratedProbabilityCalculator: Ready to deploy

**What Doesn't Work (Engine Not Tuned)**:
- ❌ Historical data: Only 2 days MLB, 0 days NFL player_stats
- ❌ Settlement execution: 0.17% rate (1.4M props, only 2,440 settled)
- ❌ Pitcher stats: 100% empty (data collection broken)
- ❌ CalibratedProbabilityCalculator: Not integrated into scoring
- ❌ Provider architecture: Hardcoded to Odds API
- ❌ Documentation: 11 critical misalignments
- ❌ ML optimization: No factor weighting, no sport-specific tuning

**Analogy**: We have a Lamborghini (Enhanced45Factor) with an empty gas tank (no historical data), flat tires (settlement broken), and no steering wheel (not provider-agnostic).

---

## 🚨 CRITICAL FINDINGS FROM DEEP ANALYSIS

### Architecture Audit Results

**1. Enhanced45FactorEngine Misalignment**
- **Documented**: 53 factors, 195-factor system
- **Actual**: 45 factors in code (apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts)
- **Gap**: 8 missing factors or documentation error
- **Impact**: Credibility issue, potential missing scoring dimensions

**2. Database Schema Fragmentation**
- **Finding**: 70+ migration files, unclear current state
- **Missing Schemas**: player_stats, league_averages tables not in schema docs
- **Settlement System**: Fully implemented but ZERO documentation
- **Impact**: Cannot confidently modify or debug database

**3. Historical Data Reality**
- **Claimed**: "159 games of full season data for MLB batters"
- **Actual**: 1,000 records from 2 DAYS (April 1-2, 2024)
- **NFL player_stats**: 0 records
- **Impact**: ProbabilityCalculator falling back to baselines (52%)

**4. Settlement System Failure**
- **Claimed**: "1.4M props ready to settle"
- **Actual**: 1.4M are 1,000 unique props × 1,397 alternate lines
- **Settlement Rate**: 0.17% (2,440 of 1.4M)
- **Background Jobs**: 0 settled, 132 NULL constraint errors
- **Root Cause**: market_type and outcome columns NULL violations

**5. Pitcher Stats Broken**
- **Records Exist**: Jack Flaherty (157), Joe Ross (104), Hoby Milner (141)
- **Stats Content**: 100% empty `stats: {}` JSONB
- **Root Cause**: FeedAgent not extracting pitcher stats from API response
- **Impact**: Cannot calculate probabilities for pitcher props (0% → fallback 52%)

**6. CalibratedProbabilityCalculator Not Integrated**
- **Status**: Fixed syntax error, ready to deploy
- **Current Usage**: 0% (Enhanced45Factor uses base ProbabilityCalculator)
- **Impact**: Calibration error stuck at 10.31% instead of <5%

**7. Provider Lock-In**
- **Current**: Odds API hardcoded throughout codebase
- **Risk**: Single point of failure, no SGO integration path
- **Impact**: Cannot switch providers without major refactor

**8. Documentation Drift (11 Critical Gaps)**
1. Enhanced45Factor: Claims 53 factors, has 45
2. Historical data: Claims full season, has 2 days
3. Settlement system: Zero documentation
4. CalibratedProbabilityCalculator: Not mentioned in scoring docs
5. Provider architecture: No design docs
6. Database schema: 70+ migrations, no consolidated schema
7. player_stats table: Undocumented structure
8. league_averages table: Missing from all docs
9. Pitcher stats issue: Not documented anywhere
10. Tier 1 validation: Claims met, actually 1 of 8 criteria
11. Backtest results: Outdated (232 outcomes, not 669)

---

## 🔧 PHASE 1: CRITICAL INFRASTRUCTURE (Days 1-3)

### Day 1: Settlement System Fix

**Goal**: Fix NULL constraint errors, achieve >95% settlement rate

**Tasks**:

1. **Debug Settlement Failures** (2 hours)
   ```bash
   # Check constraint violations
   docker-compose exec api npx tsx apps/api/src/scripts/ml/debug-settlement-errors.ts
   ```
   - Identify which columns causing NULL violations
   - Check data flow: raw_props → settled_outcomes
   - Verify market_type and outcome mappings

2. **Schema Validation** (1 hour)
   ```sql
   -- Verify settled_outcomes schema
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'settled_outcomes';

   -- Check NULL counts
   SELECT
     COUNT(*) FILTER (WHERE market_type IS NULL) as null_market_type,
     COUNT(*) FILTER (WHERE outcome IS NULL) as null_outcome,
     COUNT(*) as total
   FROM settled_outcomes;
   ```

3. **Fix Data Pipeline** (3 hours)
   - Update settlement scripts to populate all required columns
   - Add validation before insert to catch NULL values
   - Test with 100 props end-to-end
   - Deploy fix to background jobs

4. **Re-run Settlement** (2 hours)
   ```bash
   # Clear failed settlements
   docker-compose exec api npx tsx apps/api/src/scripts/ml/clear-failed-settlements.ts

   # Re-settle all 1.4M props
   docker-compose exec api npx tsx apps/api/src/scripts/ml/settle-all-props.ts
   ```

**Validation**:
- Settlement rate >95% (target: 1.33M of 1.4M props)
- Zero NULL constraint errors
- Background jobs complete successfully

---

### Day 2: Pitcher Stats Data Collection

**Goal**: Populate pitcher stats in player_stats.stats JSONB

**Tasks**:

1. **Analyze Odds API Response** (1 hour)
   ```bash
   # Capture raw API response for pitcher prop
   docker-compose exec api npx tsx apps/api/src/scripts/ml/capture-pitcher-api-response.ts
   ```
   - Identify pitcher stat field names
   - Map to player_stats schema (strikeoutsThrown → strikeOuts, etc.)

2. **Update FeedAgent** (3 hours)
   - File: `apps/api/src/agents/FeedAgent/transform.ts`
   - Add pitcher stat extraction logic
   ```typescript
   // Extract pitcher stats from API response
   if (prop.position === 'P') {
     stats = {
       strikeOuts: prop.strikeoutsThrown || 0,
       outs: prop.outs || 0,
       hitsAllowed: prop.hitsAllowed || 0,
       earnedRuns: prop.earnedRuns || 0,
       walks: prop.walks || 0,
       // ... all pitcher stat fields
     };
   }
   ```

3. **Backfill Historical Pitcher Stats** (2 hours)
   ```bash
   # Backfill Aug-Sep 2025 pitcher data
   docker-compose exec api npx tsx apps/api/src/scripts/ml/backfill-pitcher-stats.ts
   ```
   - Target: 100+ pitchers with 20+ games each
   - Date range: August 1 - October 3, 2025

4. **Validate Pitcher Probabilities** (1 hour)
   ```bash
   # Test pitcher probability calculations
   docker-compose exec api npx tsx apps/api/src/scripts/ml/test-pitcher-probabilities.ts
   ```
   - Verify stats JSONB populated (not empty)
   - Confirm player_historical method (not fallback)
   - Check probability ranges (5-95%, not 52%)

**Validation**:
- 100+ pitchers with populated stats
- 0% empty stats JSONB
- Pitcher props use player_historical method

---

### Day 3: Database Schema Consolidation

**Goal**: Single source of truth for database schema

**Tasks**:

1. **Generate Current Schema** (1 hour)
   ```bash
   # Export complete schema from Supabase
   docker-compose exec postgres pg_dump -U postgres -s unit_talk > schema.sql
   ```

2. **Document All Tables** (3 hours)
   Create `docs/database/SCHEMA_V3.md`:
   - All 45 tables with descriptions
   - Column types, constraints, indexes
   - Foreign key relationships
   - JSONB structures (stats, metadata, factors)
   - Example queries for each table

3. **Document Settlement Pipeline** (2 hours)
   Create `docs/database/SETTLEMENT_ARCHITECTURE.md`:
   - Data flow: raw_props → player_stats → settled_outcomes
   - Stat extraction logic
   - Probability calculation integration
   - Background job architecture

4. **Migration Cleanup** (1 hour)
   - Review 70+ migration files
   - Create consolidated migration if needed
   - Document migration history

**Validation**:
- Complete schema documentation
- Settlement architecture fully documented
- Database state matches documentation

---

## 🎯 PHASE 2: SCORING SYSTEM OPTIMIZATION (Days 4-6)

### Day 4: CalibratedProbabilityCalculator Integration

**Goal**: Reduce calibration error from 10.31% to <5%

**Tasks**:

1. **Integrate into Enhanced45FactorEngine** (2 hours)
   - File: `apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts`
   ```typescript
   import { CalibratedProbabilityCalculator } from '../../../models/CalibratedProbabilityCalculator';

   // Replace ProbabilityCalculator with CalibratedProbabilityCalculator
   private probCalc = new CalibratedProbabilityCalculator();
   ```

2. **Update Calibration Curves** (2 hours)
   ```bash
   # Calculate updated calibration factors from 669 outcomes
   docker-compose exec api npx tsx apps/api/src/scripts/ml/update-calibration-curves.ts
   ```
   - Recalculate for all market types
   - Update calibrationCurve in CalibratedProbabilityCalculator.ts

3. **Backtest Calibrated System** (2 hours)
   ```bash
   # Run comprehensive backtest with calibration
   docker-compose exec api npx tsx apps/api/src/scripts/ml/run-comprehensive-backtest.ts
   ```
   - Target calibration error: <5%
   - Verify Brier Score still <0.20

4. **Deploy and Monitor** (1 hour)
   - Deploy to production
   - Monitor first 50 picks for calibration drift
   - Adjust curves if needed

**Validation**:
- Calibration error <5% across all markets
- Brier Score maintained <0.20
- No degradation in win rates

---

### Day 5: ML-Based Factor Weighting

**Goal**: Optimize 45 factors using ML instead of hardcoded weights

**Tasks**:

1. **Extract Historical Factor Values** (2 hours)
   ```bash
   # Export factor values for all 669 settled outcomes
   docker-compose exec api npx tsx apps/api/src/scripts/ml/extract-factor-history.ts
   ```
   - Output: CSV with 45 factor columns + outcome
   - Include metadata (sport, market, player)

2. **Train Factor Weight Model** (3 hours)
   ```python
   # Python script for ML training
   # File: apps/api/src/scripts/ml/train-factor-weights.py

   from sklearn.ensemble import GradientBoostingClassifier
   from sklearn.model_selection import cross_val_score

   # Load factor data
   df = pd.read_csv('factor_history.csv')

   # Train model to predict outcome from factors
   X = df[factor_columns]
   y = df['outcome']

   model = GradientBoostingClassifier(n_estimators=100)
   model.fit(X, y)

   # Extract feature importances as weights
   weights = dict(zip(factor_columns, model.feature_importances_))
   ```

3. **Implement Dynamic Weighting** (2 hours)
   - File: `apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts`
   ```typescript
   // Replace hardcoded weights with ML-derived weights
   private factorWeights = {
     clvValue: 0.085,      // From ML model
     timeToGame: 0.072,    // From ML model
     steamDetection: 0.068, // From ML model
     // ... all 45 factors with ML weights
   };
   ```

4. **Backtest ML Weights** (1 hour)
   - Compare performance vs hardcoded weights
   - Validate improvement in Brier Score or calibration

**Validation**:
- ML weights improve Brier Score by 5-10%
- Calibration error maintained <5%
- Feature importance analysis documented

---

### Day 6: Sport-Specific Tuning

**Goal**: Optimize factors and weights per sport

**Tasks**:

1. **Analyze Sport-Specific Performance** (2 hours)
   ```bash
   # Breakdown by sport
   docker-compose exec api npx tsx apps/api/src/scripts/ml/analyze-by-sport.ts
   ```
   - NFL vs MLB calibration differences
   - Market-type performance within each sport
   - Identify sport-specific patterns

2. **Create Sport-Specific Factor Sets** (3 hours)
   ```typescript
   // NFL-specific factors
   const nflFactors = {
     weatherImpact: 0.065,      // Critical for NFL
     homeFieldAdvantage: 0.058, // Important for NFL
     divisionGame: 0.042,       // NFL-specific
     // ... NFL-optimized weights
   };

   // MLB-specific factors
   const mlbFactors = {
     ballparkFactor: 0.071,     // Critical for MLB
     pitcherHandedness: 0.063,  // MLB-specific
     weatherImpact: 0.031,      // Less important for MLB
     // ... MLB-optimized weights
   };
   ```

3. **Implement Sport Router** (2 hours)
   - File: `apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts`
   ```typescript
   private getFactorWeights(sport: string) {
     switch(sport) {
       case 'NFL': return this.nflFactorWeights;
       case 'MLB': return this.mlbFactorWeights;
       case 'NBA': return this.nbaFactorWeights;
       default: return this.defaultFactorWeights;
     }
   }
   ```

4. **Validate Sport-Specific Models** (1 hour)
   - Backtest each sport independently
   - Verify improvement over universal weights

**Validation**:
- NFL Brier Score <0.17 (maintain)
- MLB Brier Score <0.19 (improve from 0.20)
- Calibration error <5% for both sports

---

## 🏗️ PHASE 3: PROVIDER-AGNOSTIC ARCHITECTURE (Days 7-9)

### Day 7: Provider Abstraction Layer

**Goal**: Abstract data provider interface for any source (Odds API, SGO, etc.)

**Tasks**:

1. **Create Provider Interface** (2 hours)
   - File: `apps/api/src/providers/IProviderAdapter.ts`
   ```typescript
   export interface IProviderAdapter {
     // Fetch props
     fetchProps(params: FetchPropsParams): Promise<UnifiedProp[]>;

     // Fetch outcomes
     fetchOutcomes(params: FetchOutcomesParams): Promise<UnifiedOutcome[]>;

     // Fetch player stats
     fetchPlayerStats(params: FetchPlayerStatsParams): Promise<UnifiedPlayerStats[]>;

     // Provider metadata
     getProviderName(): string;
     getProviderCapabilities(): ProviderCapabilities;
   }
   ```

2. **Define Unified Data Models** (2 hours)
   - File: `apps/api/src/models/UnifiedModels.ts`
   ```typescript
   export interface UnifiedProp {
     id: string;
     sport: string;
     league: string;
     playerName: string;
     marketType: string;
     line: number;
     odds: number;
     bookmaker: string;
     gameDate: Date;
     metadata: Record<string, any>;
   }

   export interface UnifiedOutcome {
     propId: string;
     playerName: string;
     marketType: string;
     line: number;
     actualValue: number;
     outcome: 'win' | 'loss' | 'push' | 'void';
     settledAt: Date;
   }

   export interface UnifiedPlayerStats {
     playerName: string;
     sport: string;
     gameDate: Date;
     stats: Record<string, number>;
   }
   ```

3. **Implement Odds API Adapter** (3 hours)
   - File: `apps/api/src/providers/OddsApiAdapter.ts`
   ```typescript
   export class OddsApiAdapter implements IProviderAdapter {
     async fetchProps(params: FetchPropsParams): Promise<UnifiedProp[]> {
       // Fetch from Odds API
       const response = await this.client.get('/props', params);

       // Transform to unified format
       return response.data.map(this.transformToUnifiedProp);
     }

     private transformToUnifiedProp(apiProp: any): UnifiedProp {
       return {
         id: apiProp.id,
         sport: this.mapSport(apiProp.sport_key),
         playerName: apiProp.player_name,
         marketType: this.mapMarketType(apiProp.market),
         line: apiProp.point,
         odds: apiProp.price,
         // ... field mappings
       };
     }
   }
   ```

4. **Create Provider Registry** (1 hour)
   - File: `apps/api/src/providers/ProviderRegistry.ts`
   ```typescript
   export class ProviderRegistry {
     private providers: Map<string, IProviderAdapter> = new Map();

     register(name: string, provider: IProviderAdapter) {
       this.providers.set(name, provider);
     }

     get(name: string): IProviderAdapter {
       const provider = this.providers.get(name);
       if (!provider) throw new Error(`Provider ${name} not found`);
       return provider;
     }
   }
   ```

**Validation**:
- Odds API adapter produces UnifiedProp format
- Provider interface documented
- No breaking changes to existing code

---

### Day 8: SGO Provider Implementation

**Goal**: Implement SGO adapter for historical data integration

**Tasks**:

1. **Study SGO API Format** (1 hour)
   - Document SGO prop format
   - Document SGO outcome format
   - Document SGO player stats format
   - Create field mapping specification

2. **Implement SGO Adapter** (4 hours)
   - File: `apps/api/src/providers/SGOAdapter.ts`
   ```typescript
   export class SGOAdapter implements IProviderAdapter {
     async fetchProps(params: FetchPropsParams): Promise<UnifiedProp[]> {
       // SGO uses different endpoint structure
       const response = await this.client.get('/markets', {
         sport: this.mapSportToSGO(params.sport),
         date: params.date,
       });

       return response.markets.map(this.transformToUnifiedProp);
     }

     async fetchOutcomes(params: FetchOutcomesParams): Promise<UnifiedOutcome[]> {
       // SGO settlement endpoint
       const response = await this.client.get('/settlements', {
         date: params.date,
       });

       return response.settlements.map(this.transformToUnifiedOutcome);
     }

     private transformToUnifiedProp(sgoMarket: any): UnifiedProp {
       // SGO field mappings
       return {
         id: sgoMarket.market_id,
         sport: this.mapSportFromSGO(sgoMarket.sport),
         playerName: sgoMarket.participant_name,
         marketType: this.mapMarketType(sgoMarket.market_type),
         line: sgoMarket.handicap,
         odds: this.convertOdds(sgoMarket.decimal_odds),
         // ... complete mapping
       };
     }
   }
   ```

3. **Create Provider Failover** (2 hours)
   - File: `apps/api/src/providers/ProviderManager.ts`
   ```typescript
   export class ProviderManager {
     private primaryProvider: IProviderAdapter;
     private fallbackProviders: IProviderAdapter[];

     async fetchPropsWithFailover(params: FetchPropsParams): Promise<UnifiedProp[]> {
       try {
         return await this.primaryProvider.fetchProps(params);
       } catch (error) {
         console.warn('Primary provider failed, trying fallback');

         for (const fallback of this.fallbackProviders) {
           try {
             return await fallback.fetchProps(params);
           } catch (fallbackError) {
             continue;
           }
         }

         throw new Error('All providers failed');
       }
     }
   }
   ```

4. **Test SGO Integration** (1 hour)
   ```bash
   # Test SGO adapter with sample data
   docker-compose exec api npx tsx apps/api/src/scripts/ml/test-sgo-adapter.ts
   ```

**Validation**:
- SGO adapter produces UnifiedProp format
- Failover works (Odds API → SGO)
- Field mappings 100% accurate

---

### Day 9: Multi-Level Caching & Batch Processing

**Goal**: Handle 10,000+ props/day with performance optimizations

**Tasks**:

1. **Implement Redis L1 Cache** (2 hours)
   - File: `apps/api/src/cache/RedisCache.ts`
   ```typescript
   export class RedisCache {
     async getCachedProps(key: string): Promise<UnifiedProp[] | null> {
       const cached = await this.redis.get(key);
       return cached ? JSON.parse(cached) : null;
     }

     async setCachedProps(key: string, props: UnifiedProp[], ttl: number = 300) {
       await this.redis.setex(key, ttl, JSON.stringify(props));
     }
   }
   ```

2. **Implement PostgreSQL L2 Cache** (2 hours)
   - Table: `provider_cache`
   ```sql
   CREATE TABLE provider_cache (
     cache_key TEXT PRIMARY KEY,
     provider_name TEXT NOT NULL,
     data_type TEXT NOT NULL, -- 'props' | 'outcomes' | 'stats'
     data JSONB NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     expires_at TIMESTAMP NOT NULL
   );

   CREATE INDEX idx_provider_cache_expires ON provider_cache(expires_at);
   ```

3. **Implement Batch Processing** (3 hours)
   - File: `apps/api/src/providers/BatchProcessor.ts`
   ```typescript
   export class BatchProcessor {
     async processPropsInBatches(
       props: UnifiedProp[],
       batchSize: number = 100,
       concurrency: number = 5
     ): Promise<void> {
       const batches = this.createBatches(props, batchSize);

       // Process batches with concurrency limit
       await pLimit(concurrency)(
         batches.map(batch => () => this.processBatch(batch))
       );
     }

     private async processBatch(batch: UnifiedProp[]): Promise<void> {
       // Calculate probabilities
       const probabilities = await Promise.all(
         batch.map(prop => this.probCalc.calculateProbability(prop))
       );

       // Score with Enhanced45Factor
       const scores = await Promise.all(
         batch.map((prop, i) =>
           this.scorer.score(prop, probabilities[i])
         )
       );

       // Bulk insert to database
       await this.db.insertPicksBulk(scores);
     }
   }
   ```

4. **Load Testing** (1 hour)
   ```bash
   # Test with 10,000 props
   docker-compose exec api npx tsx apps/api/src/scripts/ml/load-test-batch-processing.ts
   ```
   - Target: <2 seconds per 100 props
   - Verify cache hit rates >80%

**Validation**:
- Process 10,000 props in <5 minutes
- Redis cache hit rate >80%
- PostgreSQL L2 cache working
- Zero memory leaks

---

## ✅ PHASE 4: VALIDATION & TESTING (Days 10-12)

### Day 10: Comprehensive Backtest (All 8 Criteria)

**Goal**: Validate system meets all Tier 1 requirements

**Tasks**:

1. **Historical Data Collection** (3 hours)
   ```bash
   # Option A: Get SGO week ($1,000)
   # - 75,000+ historical outcomes
   # - Full season data for active sports
   # - Immediate Tier 1 validation

   # Option B: Continue with current data
   # - Wait 8 weeks for sufficient sample size
   # - Free but slower
   ```

2. **Run Full System Backtest** (3 hours)
   ```bash
   # With SGO data or accumulated data
   docker-compose exec api npx tsx apps/api/src/scripts/ml/tier-1-validation.ts
   ```
   - Calculate all 8 Tier 1 metrics
   - Generate detailed report
   - Identify any remaining gaps

3. **Validation Report** (2 hours)
   - Create `TIER_1_VALIDATION_REPORT.md`
   - Document all 8 criteria with evidence
   - Include statistical confidence intervals
   - Add comparison to industry benchmarks

**Validation Criteria**:
1. ✅ Brier Score <0.20
2. ✅ Calibration Error <3%
3. ✅ Sample Size >1,000 outcomes
4. ✅ Multi-Sport Coverage (NFL, MLB, NBA minimum)
5. ✅ Historical Data >20 games per player
6. ✅ Settlement Rate >95%
7. ✅ Provider Agnostic (2+ providers working)
8. ✅ Production Infrastructure (99.9% uptime)

---

### Day 11: Market-Specific Validation

**Goal**: Validate each market individually

**Tasks**:

1. **NFL Markets** (2 hours)
   - Rushing Yards: Target Brier <0.17, Cal Error <2%
   - Receiving Yards: Target Brier <0.18, Cal Error <4%
   - Passing Yards: Target Brier <0.19, Cal Error <5%
   - Receptions: Target Brier <0.20, Cal Error <10%
   - Defense Sacks: Target Brier <0.21, Cal Error <12%
   - Defense Tackles: Target Brier <0.22, Cal Error <15%

2. **MLB Markets** (2 hours)
   - Hits: Target Brier <0.19
   - Total Bases: Target Brier <0.19
   - Home Runs: Target Brier <0.15 (binary outcome)
   - RBI: Target Brier <0.20
   - Runs: Target Brier <0.19
   - Strikeouts (Pitcher): Target Brier <0.18
   - Outs (Pitcher): Target Brier <0.18

3. **NBA Markets** (2 hours) - *If data available*
   - Points: Target Brier <0.19
   - Rebounds: Target Brier <0.20
   - Assists: Target Brier <0.20
   - 3-Pointers: Target Brier <0.18

4. **Generate Market Report** (2 hours)
   - Create `MARKET_VALIDATION_REPORT.md`
   - Performance by market type
   - Recommendations for disabled markets
   - Timeline for market expansion

**Validation**:
- 12+ markets meeting Tier 1 thresholds
- Clear documentation for each market
- Action plan for underperforming markets

---

### Day 12: Production Simulation

**Goal**: Simulate full production day with all systems

**Tasks**:

1. **Setup Production Simulation** (1 hour)
   ```bash
   # Create test environment
   docker-compose -f docker-compose.prod-sim.yml up -d
   ```

2. **Run Daily Workflow** (4 hours)
   - 6:00 AM: FeedAgent ingests today's props (all sports)
   - 6:30 AM: ScoringAgent processes 500+ props
   - 7:00 AM: ApprovalAgent flags top 50 picks
   - 9:00 AM: First batch published to Discord
   - 3:00 PM: Second batch published (late-breaking)
   - 11:00 PM: RecapAgent generates daily summary
   - Next Day: Settlement and backtest update

3. **Monitor All Metrics** (2 hours)
   - Prop ingestion rate (target: 100+ props/min)
   - Scoring throughput (target: 50+ props/min)
   - API response times (target: <500ms p95)
   - Database connections (target: <50 active)
   - Error rates (target: <0.1%)
   - Discord delivery (target: <10s latency)

4. **Generate Production Report** (1 hour)
   - Create `PRODUCTION_SIMULATION_REPORT.md`
   - Document all metrics
   - Identify bottlenecks
   - Optimization recommendations

**Validation**:
- Zero critical errors
- All agents healthy
- Picks delivered on time
- System handles 500+ props/day

---

## 🚀 PHASE 5: PRODUCTION DEPLOYMENT (Day 13)

### Day 13: Go Live

**Goal**: Deploy to production with monitoring

**Tasks**:

1. **Pre-Deployment Checklist** (1 hour)
   - [ ] All 8 Tier 1 criteria met
   - [ ] Backtest reports generated
   - [ ] Documentation updated (11 gaps fixed)
   - [ ] Database schema consolidated
   - [ ] Settlement system >95% rate
   - [ ] CalibratedProbabilityCalculator integrated
   - [ ] Provider-agnostic architecture deployed
   - [ ] SGO adapter working (if purchased)
   - [ ] Redis + PostgreSQL caching operational
   - [ ] Batch processing tested at scale
   - [ ] All agents healthy
   - [ ] Command Center operational
   - [ ] Discord integration tested
   - [ ] Monitoring dashboards configured

2. **Deploy to Production** (2 hours)
   ```bash
   # Production deployment
   ./dev.sh deploy production

   # Verify all services
   ./dev.sh status
   curl http://api.unittalk.com/health
   ```

3. **Monitor First Production Day** (4 hours)
   - Watch logs for errors
   - Monitor pick quality in real-time
   - Track user engagement
   - Validate Discord delivery
   - Check database performance

4. **Generate Day 1 Report** (1 hour)
   - Picks published: X
   - Markets covered: Y
   - Average confidence score: Z
   - System uptime: 99.9%
   - Errors: 0 critical, X minor

**Validation**:
- Production system stable
- Picks flowing to Discord
- Zero critical errors
- All monitoring green

---

## 📚 PHASE 6: DOCUMENTATION ALIGNMENT (Ongoing)

### Documentation Updates Required

**1. Fix Enhanced45Factor Documentation**
- File: `docs/architecture/ENHANCED45FACTOR_ENGINE.md`
- Update: Change "53 factors" to "45 factors"
- Add: List all 45 factors with descriptions
- Add: Factor weighting methodology (ML-derived)
- Add: Sport-specific factor sets

**2. Update Tier 1 Claims**
- File: `FINAL_TIER_1_CONFIRMATION.md` → Rename to `TIER_1_VALIDATION_REPORT.md`
- Update: Correct data claims (remove "159 games" claim)
- Add: All 8 validation criteria with evidence
- Add: Market-by-market breakdown
- Add: Comparison to industry benchmarks

**3. Document Settlement Architecture**
- File: `docs/database/SETTLEMENT_ARCHITECTURE.md` (NEW)
- Content: Complete settlement pipeline
- Content: Data flow diagrams
- Content: Background job architecture
- Content: Error handling and retry logic

**4. Document Provider Architecture**
- File: `docs/architecture/PROVIDER_ARCHITECTURE.md` (NEW)
- Content: IProviderAdapter interface
- Content: Odds API adapter implementation
- Content: SGO adapter implementation
- Content: Failover and caching strategies

**5. Consolidate Database Schema**
- File: `docs/database/SCHEMA_V3.md` (NEW)
- Content: All 45 tables documented
- Content: JSONB structures (stats, metadata)
- Content: Foreign key relationships
- Content: Index strategy

**6. Update Probability Calculator Docs**
- File: `docs/models/PROBABILITY_CALCULATOR.md`
- Add: CalibratedProbabilityCalculator integration
- Add: Market-specific calibration curves
- Add: Calibration update methodology

**7. Document Historical Data Strategy**
- File: `docs/data/HISTORICAL_DATA_STRATEGY.md` (NEW)
- Content: Current data coverage by sport
- Content: SGO integration plan
- Content: Data quality requirements
- Content: Backfill procedures

**8. Update Backtest Documentation**
- File: `docs/validation/BACKTEST_METHODOLOGY.md`
- Update: From 232 to current outcome count
- Add: All 8 Tier 1 validation criteria
- Add: Market-specific validation
- Add: Production simulation results

**9. Document ML Optimization**
- File: `docs/models/ML_FACTOR_WEIGHTING.md` (NEW)
- Content: Factor importance analysis
- Content: ML training methodology
- Content: Sport-specific tuning
- Content: Continuous improvement process

**10. Update Architecture Overview**
- File: `docs/architecture/SYSTEM_OVERVIEW.md`
- Add: Provider-agnostic architecture
- Add: Multi-level caching strategy
- Add: Batch processing architecture
- Update: Component interaction diagrams

**11. Fix CLAUDE.md Alignment**
- File: `CLAUDE.md`
- Update: Correct Enhanced45Factor count (45 not 195)
- Add: Provider architecture section
- Add: ML optimization section
- Update: Production readiness criteria

---

## 🎯 CRITICAL DECISIONS REQUIRED

### Decision 1: SGO Historical Data Purchase

**Cost**: $1,000 for 1 week access
**Benefit**: 75,000+ historical outcomes, immediate Tier 1 validation
**Alternative**: Wait 8 weeks to accumulate 1,000+ outcomes

**Recommendation**: **GET SGO** if budget allows
- Immediate validation of Tier 1 status
- Complete historical data for all active sports
- Test provider-agnostic architecture with real second provider
- Faster time to market (2 weeks vs 10 weeks)

**Timeline Impact**:
- With SGO: Tier 1 in 13 days
- Without SGO: Tier 1 in 8+ weeks

---

### Decision 2: Market Priority

**Option A: NFL + MLB Focus** (Recommended)
- Perfect for current season (October)
- Highest betting volume
- Existing data quality
- Deploy in 13 days

**Option B: Multi-Sport Expansion**
- Add NBA (starts Oct 22)
- Add NHL (started Oct 8)
- Requires additional data collection
- Deploy in 20+ days

**Recommendation**: **Start with NFL + MLB**, add NBA/NHL in Week 3-4

---

### Decision 3: Infrastructure Improvements

**Option A: Optimize Current Setup** (Recommended)
- Fix settlement system
- Integrate CalibratedProbabilityCalculator
- Add provider abstraction
- Deploy in 13 days

**Option B: Full Infrastructure Rebuild**
- Microservices architecture
- Kubernetes orchestration
- Advanced monitoring
- Deploy in 30+ days

**Recommendation**: **Optimize current setup**, plan rebuild for Phase 2

---

## 📊 EXPECTED OUTCOMES

### Tier 1 Validation Metrics (Day 13)

| Metric | Target | Expected | Status |
|--------|--------|----------|--------|
| Brier Score | <0.20 | 0.17-0.19 | ✅ On Track |
| Calibration Error | <3% | 2-4% | ✅ On Track |
| Sample Size | >1,000 | 1,000-75,000 | ⚠️ Depends on SGO |
| Multi-Sport | 3+ | 2-3 (NFL, MLB, NBA) | ✅ On Track |
| Historical Data | Full season | Full season (with SGO) | ⚠️ Depends on SGO |
| Settlement Rate | >95% | 95-98% | ✅ On Track |
| Provider Agnostic | 2+ providers | 2 (Odds API, SGO) | ✅ On Track |
| Infrastructure | 99.9% uptime | 99.9% | ✅ On Track |

**Overall Tier 1 Probability**:
- With SGO: **95%** (13 days)
- Without SGO: **60%** (60+ days)

---

### Revenue Projection

**Month 1** (NFL + MLB):
- 150-200 picks/week
- 100-300 users @ $50/month
- **$5,000-$15,000/month**

**Month 2** (Add NBA):
- 300-400 picks/week
- 300-500 users @ $50/month
- **$15,000-$25,000/month**

**Month 3** (Add NHL):
- 400-500 picks/week
- 500-1,000 users @ $50/month
- **$25,000-$50,000/month**

**Month 6** (Full Multi-Sport):
- 500-700 picks/week
- 2,000-3,000 users @ $50/month
- **$100,000-$150,000/month**

---

## 🚨 RISK MITIGATION

### Technical Risks

**Risk 1: Settlement System Failure**
- **Impact**: Cannot validate Tier 1 status
- **Mitigation**: Day 1 priority, extensive testing
- **Contingency**: Manual settlement scripts ready

**Risk 2: Historical Data Insufficient**
- **Impact**: Cannot meet sample size requirement
- **Mitigation**: SGO purchase provides 75,000+ outcomes
- **Contingency**: Wait 8 weeks for organic accumulation

**Risk 3: Calibration Degradation**
- **Impact**: Falls below <3% target
- **Mitigation**: Continuous monitoring, curve updates
- **Contingency**: Revert to base ProbabilityCalculator

**Risk 4: Provider API Changes**
- **Impact**: Data pipeline breaks
- **Mitigation**: Provider abstraction, automatic failover
- **Contingency**: Manual API update within 4 hours

### Business Risks

**Risk 1: User Churn Due to Quality**
- **Impact**: Revenue loss
- **Mitigation**: Only enable markets meeting Tier 1 thresholds
- **Contingency**: Disable underperforming markets

**Risk 2: Competitive Pressure**
- **Impact**: Users switch to competitors
- **Mitigation**: Focus on calibration quality (edge over competitors)
- **Contingency**: Price adjustment, feature expansion

**Risk 3: Regulatory Changes**
- **Impact**: Market restrictions
- **Mitigation**: Provider-agnostic architecture allows quick pivots
- **Contingency**: Multi-state/multi-provider strategy

---

## 📋 DAILY TASK BREAKDOWN

### Week 1: Infrastructure (Days 1-3)

**Day 1: Settlement System**
- 8:00 AM: Debug settlement NULL errors (2h)
- 10:00 AM: Schema validation (1h)
- 11:00 AM: Fix data pipeline (3h)
- 2:00 PM: Re-run settlement on 1.4M props (2h)
- 4:00 PM: Validate >95% settlement rate (1h)

**Day 2: Pitcher Stats**
- 8:00 AM: Analyze Odds API response (1h)
- 9:00 AM: Update FeedAgent extraction (3h)
- 12:00 PM: Backfill pitcher stats (2h)
- 2:00 PM: Validate probabilities (1h)
- 3:00 PM: Test with 100 pitcher props (1h)

**Day 3: Database Schema**
- 8:00 AM: Export schema from Supabase (1h)
- 9:00 AM: Document all 45 tables (3h)
- 12:00 PM: Document settlement architecture (2h)
- 2:00 PM: Migration cleanup (1h)
- 3:00 PM: Validate schema docs (1h)

---

### Week 2: Optimization (Days 4-6)

**Day 4: CalibratedProbabilityCalculator**
- 8:00 AM: Integrate into Enhanced45Factor (2h)
- 10:00 AM: Update calibration curves (2h)
- 12:00 PM: Backtest calibrated system (2h)
- 2:00 PM: Deploy and monitor (1h)

**Day 5: ML Factor Weighting**
- 8:00 AM: Extract factor history (2h)
- 10:00 AM: Train ML weight model (3h)
- 1:00 PM: Implement dynamic weighting (2h)
- 3:00 PM: Backtest ML weights (1h)

**Day 6: Sport-Specific Tuning**
- 8:00 AM: Analyze sport performance (2h)
- 10:00 AM: Create sport-specific factors (3h)
- 1:00 PM: Implement sport router (2h)
- 3:00 PM: Validate sport models (1h)

---

### Week 2: Provider Architecture (Days 7-9)

**Day 7: Provider Abstraction**
- 8:00 AM: Create provider interface (2h)
- 10:00 AM: Define unified models (2h)
- 12:00 PM: Implement Odds API adapter (3h)
- 3:00 PM: Create provider registry (1h)

**Day 8: SGO Integration**
- 8:00 AM: Study SGO API format (1h)
- 9:00 AM: Implement SGO adapter (4h)
- 1:00 PM: Create provider failover (2h)
- 3:00 PM: Test SGO integration (1h)

**Day 9: Caching & Batch Processing**
- 8:00 AM: Implement Redis L1 cache (2h)
- 10:00 AM: Implement PostgreSQL L2 cache (2h)
- 12:00 PM: Implement batch processing (3h)
- 3:00 PM: Load testing (1h)

---

### Week 2: Validation (Days 10-12)

**Day 10: Comprehensive Backtest**
- 8:00 AM: Historical data collection (3h)
- 11:00 AM: Run full system backtest (3h)
- 2:00 PM: Generate validation report (2h)

**Day 11: Market Validation**
- 8:00 AM: Validate NFL markets (2h)
- 10:00 AM: Validate MLB markets (2h)
- 12:00 PM: Validate NBA markets (2h)
- 2:00 PM: Generate market report (2h)

**Day 12: Production Simulation**
- 8:00 AM: Setup simulation (1h)
- 9:00 AM: Run daily workflow (4h)
- 1:00 PM: Monitor metrics (2h)
- 3:00 PM: Generate production report (1h)

---

### Week 2: Deployment (Day 13)

**Day 13: Go Live**
- 8:00 AM: Pre-deployment checklist (1h)
- 9:00 AM: Deploy to production (2h)
- 11:00 AM: Monitor first production day (4h)
- 3:00 PM: Generate Day 1 report (1h)

---

## ✅ SUCCESS CRITERIA

### Technical Success

1. **All 8 Tier 1 Criteria Met**
   - ✅ Brier Score <0.20
   - ✅ Calibration Error <3%
   - ✅ Sample Size >1,000
   - ✅ Multi-Sport Coverage
   - ✅ Historical Data Quality
   - ✅ Settlement Rate >95%
   - ✅ Provider Agnostic
   - ✅ Infrastructure Stability

2. **System Performance**
   - ✅ Process 500+ props/day
   - ✅ API response time <500ms p95
   - ✅ Zero critical errors
   - ✅ 99.9% uptime

3. **Documentation Complete**
   - ✅ All 11 gaps fixed
   - ✅ Schema fully documented
   - ✅ Architecture diagrams updated
   - ✅ Operator handbook current

### Business Success

1. **User Metrics**
   - ✅ 100+ active users by Week 4
   - ✅ <10% churn rate
   - ✅ >4.5/5 satisfaction score

2. **Revenue Metrics**
   - ✅ $5,000+ MRR by Month 1
   - ✅ $15,000+ MRR by Month 2
   - ✅ $25,000+ MRR by Month 3

3. **Market Position**
   - ✅ Top 3 in calibration quality
   - ✅ Competitive with professional sharps
   - ✅ Foundation for syndicate-level quality

---

## 🏆 THE LAMBO ANALOGY

**Current State**: Lamborghini Aventador with:
- ✅ V12 engine (Enhanced45Factor - 45 factors)
- ❌ Empty gas tank (no historical data)
- ❌ Flat tires (settlement broken)
- ❌ No steering wheel (not provider-agnostic)
- ❌ Dirty windshield (documentation drift)

**After 13 Days**: Ready to Race
- ✅ Full gas tank (SGO + accumulated data)
- ✅ New tires (settlement >95%)
- ✅ Steering wheel (provider-agnostic)
- ✅ Clean windshield (docs aligned)
- ✅ Tuned engine (ML weights, calibration)
- ✅ Professional pit crew (monitoring, failover)

**Result**: **Tier 1 Betting Intelligence Platform** ready to compete with the best in the world.

---

## 📞 STAKEHOLDER COMMUNICATION

### Daily Standups

**Format**: 15 min, 9:00 AM daily

**Topics**:
1. Yesterday's progress
2. Today's focus
3. Blockers
4. Metrics update

### Weekly Reviews

**Format**: 1 hour, Friday 4:00 PM

**Topics**:
1. Week progress vs plan
2. Tier 1 criteria status
3. Technical debt
4. Next week priorities

### Milestone Reports

**Deliverables**:
- Day 3: Infrastructure Complete
- Day 6: Optimization Complete
- Day 9: Provider Architecture Complete
- Day 12: Validation Complete
- Day 13: Production Deployment

---

## 🔄 CONTINUOUS IMPROVEMENT

### Post-Launch (Days 14+)

**Week 3-4**:
- Monitor production metrics daily
- Update calibration curves weekly
- Expand to NBA markets
- Optimize ML factor weights
- Achieve 1,000+ outcome milestone

**Week 5-8**:
- Add NHL markets
- Improve defensive stat models
- Achieve <2% calibration error
- Expand to 20+ markets
- Target 2,000+ outcomes

**Week 9-12**:
- Multi-sport backtesting
- Advanced ML models (ensemble methods)
- Syndicate-level quality features
- Target 5,000+ outcomes
- **Pure Tier 1 Elite Status**

---

## 📚 APPENDIX

### A. Technology Stack

- **Database**: PostgreSQL (Supabase)
- **Cache**: Redis (L1), PostgreSQL (L2)
- **API**: Node.js, TypeScript
- **Orchestration**: Docker Compose
- **Monitoring**: Prometheus, Grafana
- **ML**: Python (scikit-learn, pandas)
- **Data Providers**: Odds API, SGO
- **Messaging**: Discord.js

### B. Key Files Reference

| Component | File Path |
|-----------|-----------|
| Enhanced45Factor | apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts |
| ProbabilityCalculator | apps/api/src/models/ProbabilityCalculator.ts |
| CalibratedProbabilityCalculator | apps/api/src/models/CalibratedProbabilityCalculator.ts |
| FeedAgent Transform | apps/api/src/agents/FeedAgent/transform.ts |
| Settlement Scripts | apps/api/src/scripts/ml/settle-*.ts |
| Provider Interface | apps/api/src/providers/IProviderAdapter.ts |
| Odds API Adapter | apps/api/src/providers/OddsApiAdapter.ts |
| SGO Adapter | apps/api/src/providers/SGOAdapter.ts |
| Batch Processor | apps/api/src/providers/BatchProcessor.ts |

### C. Database Tables

| Table | Purpose | Row Count |
|-------|---------|-----------|
| raw_props | Ingested props from providers | 1.4M |
| unified_picks | Scored picks ready for approval | 10K+ |
| settled_outcomes | Historical outcomes for backtest | 2,440 → 1.3M target |
| player_stats | Player performance history | 1,000 (MLB only) |
| league_averages | Sport/market baseline stats | TBD |
| agent_health | Real-time agent monitoring | 5 |
| agent_metrics | Agent performance tracking | 1K+ |

### D. Contact & Support

- **Engineering Lead**: [Contact Info]
- **Product Owner**: [Contact Info]
- **DevOps**: [Contact Info]
- **Documentation**: This file (TIER_1_MASTER_ROADMAP.md)

---

**Document Version**: 1.0
**Last Updated**: October 3, 2025
**Next Review**: October 13, 2025 (Post-Deployment)
**Owner**: Engineering Team

**🚀 THIS IS OUR SOURCE OF TRUTH TO TIER 1 🚀**
