# Pipeline Refactor Implementation Guide

## Overview

This document outlines the comprehensive refactor of the Unit Talk data pipeline to establish a clean, production-ready architecture:

**Data Flow:** `raw_props` → `normalized (unified_picks)` → `scored_props` → `v_daily_board` → alerts/publishing

## Migration Applied

✅ **Migration `20251008_000000_refactor_data_pipeline.sql`** has been created with:
- `scored_props` table for normalized scoring output
- `bet_slips` and `bet_legs` tables for parlays/teasers
- `ml_features` and `ml_labels` tables for ML feature store
- `model_versions` table for model tracking
- `v_prop_read_model` and `v_daily_board` views
- Helper RPCs: `promote_pick()`, `approve_pick()`
- Automatic slip settlement trigger when legs update

## Implementation Roadmap

### Phase 1: Core Data Flow (Priority 1)

#### 1.1 Update FeedAgent
**File:** `apps/api/src/agents/FeedAgent/index.ts`

**Changes Required:**
```typescript
// CURRENT: Writes directly to unified_picks
await this.unifiedPicksService.createPick(pick);

// NEW: Write to raw_props only
await this.rawPropsRepo.insert({
  external_id: prop.id,
  sport: prop.sport,
  market: prop.market,
  player_name: prop.player_name,
  team: prop.team,
  opponent: prop.opponent,
  game_date: prop.game_date,
  over_odds: prop.over_odds,
  under_odds: prop.under_odds,
  line: prop.line,
  bookmaker_key: prop.bookmaker_key,
  raw_data: prop,
  ingested_at: new Date()
});

// Then trigger normalizer
await this.normalizer.processRawProps(batchId);
```

**Testing:**
```bash
npx tsx apps/api/src/scripts/test-feed-to-raw-props.ts
```

#### 1.2 Create Normalizer Agent
**File:** `apps/api/src/agents/NormalizerAgent/index.ts`

**Purpose:** Convert `raw_props` → `unified_picks` with bookmaker normalization

**Key Features:**
- Idempotent UPSERT on `external_prop_id`
- Derive odds from `over_odds`/`under_odds` when needed
- Normalize selection (`over`/`under`/`yes`/`no`)
- Batch-friendly (process 100+ props/sec)
- Handle edge cases: missing odds, non-player markets, american odds

**Implementation:**
```typescript
export class NormalizerAgent extends BaseAgent {
  async normalizeRawProps(rawProps: RawProp[]): Promise<UnifiedPick[]> {
    return rawProps.map(raw => ({
      external_prop_id: raw.external_id,
      external_game_id: raw.game_id,
      sport: raw.sport,
      market: this.normalizeMarket(raw.market),
      selection: this.normalizeSelection(raw),
      line: raw.line,
      odds: this.deriveOdds(raw),  // Smart odds derivation
      player_name: raw.player_name,
      team: raw.team,
      opponent: raw.opponent,
      game_date: raw.game_date,
      bookmaker_key: raw.bookmaker_key,
      metadata: { raw_id: raw.id, source: 'normalizer' },
      workflow_stage: 'normalized',
      status: 'pending'
    }));
  }

  private deriveOdds(raw: RawProp): number {
    // If selection is 'over', use over_odds
    if (raw.selection === 'over') return raw.over_odds;
    if (raw.selection === 'under') return raw.under_odds;
    // Default: use best odds
    return Math.max(raw.over_odds || -110, raw.under_odds || -110);
  }

  private normalizeSelection(raw: RawProp): string {
    // Map various formats to standard
    const sel = (raw.selection || '').toLowerCase();
    if (['over', 'yes', 'true'].includes(sel)) return 'over';
    if (['under', 'no', 'false'].includes(sel)) return 'under';
    return raw.selection || 'over';
  }
}
```

**Unit Tests:**
```typescript
// apps/api/src/agents/NormalizerAgent/__tests__/edgeCases.test.ts
describe('NormalizerAgent Edge Cases', () => {
  it('handles american odds correctly', () => {
    const raw = { over_odds: +150, under_odds: -180 };
    expect(normalizer.deriveOdds(raw)).toBe(150);
  });

  it('handles missing under_odds', () => {
    const raw = { over_odds: -110, under_odds: null };
    expect(normalizer.deriveOdds(raw)).toBe(-110);
  });

  it('handles non-player markets', () => {
    const raw = { market: 'moneyline', player_name: null };
    expect(normalizer.normalize(raw)).toHaveProperty('market', 'moneyline');
  });
});
```

#### 1.3 Update ScoringAgent
**File:** `apps/api/src/agents/ScoringAgent/index.ts`

**Changes:**
```typescript
// CURRENT: Reads from unified_picks directly
const picks = await this.unifiedPicksRepo.findByStatus('pending');

// NEW: Read from v_prop_read_model
const props = await this.supabase
  .from('v_prop_read_model')
  .select('*')
  .gte('game_date', new Date().toISOString())
  .is('scored_at', null)  // Not yet scored
  .order('game_date', { ascending: true })
  .limit(100);

// Score each prop
for (const prop of props.data) {
  const features = await this.extractFeatures(prop);
  const result = await this.enhanced45FactorEngine.calculate45FactorScore(features);

  // Write to scored_props
  await this.supabase.from('scored_props').insert({
    prop_ref: prop.prop_ref,
    edge: result.expectedValue,
    prob_win: result.confidence,
    professional_score: result.totalScore,
    tier: result.tier,
    confidence: result.confidence,
    kelly_fraction: result.kellyFraction,
    clv_pct: 0,  // Will be calculated later
    model_version: 'enhanced-45-factor-v1',
    market_score: result.marketScore,
    player_score: result.playerScore,
    matchup_score: result.matchupScore,
    price_score: result.priceScore,
    meta_score: result.metaScore,
    factor_scores: result.factorScores,
    risk_adjusted_score: result.riskAdjustedScore,
    expected_value: result.expectedValue,
    sharpe_ratio: result.sharpeRatio,
    max_drawdown: result.maxDrawdown
  });

  // Also insert model version if new
  await this.supabase.from('model_versions').insert({
    model_name: 'enhanced-45-factor',
    version: 'v1',
    is_active: true,
    config: result.configUsed,
    metrics: {
      avg_score: result.totalScore,
      processing_time_ms: result.processingTimeMs
    }
  }).onConflict('model_name,version').ignore();
}
```

**CLI Smoke Test:**
```bash
npx tsx apps/api/src/scripts/score-smoke.ts --limit 10
```

### Phase 2: Settlement & Alerts

#### 2.1 Validate Settlement Agent
**File:** `apps/api/src/workflows/agents/SettlementAgent.ts`

**Requirements:**
- Insert ONLY into `settled_outcomes` table
- Skip already-settled props (check `settled_outcomes.prop_ref`)
- Resume safely after crashes
- Join on `(player_name, game_date)` or `game_id`

**Validation:**
```typescript
// Ensure idempotency
const existing = await supabase
  .from('settled_outcomes')
  .select('prop_ref')
  .in('prop_ref', propRefs);

const toSettle = props.filter(p =>
  !existing.data.some(e => e.prop_ref === p.prop_ref)
);
```

**CLI Smoke Test:**
```bash
npx tsx apps/api/src/scripts/settle-smoke.ts --date 2025-10-07 --limit 5
```

#### 2.2 Update Alerts Agent
**File:** `apps/api/src/agents/alert/AlertAgent.ts`

**Changes:**
```typescript
// CURRENT: Smoke test only
// NEW: Source from v_daily_board

async pollForApprovedPicks(): Promise<void> {
  const picks = await this.supabase
    .from('v_daily_board')
    .select('*')
    .eq('queue_status', 'approved')
    .lte('publish_at', new Date().toISOString())
    .is('published_at', null)  // Not yet published
    .order('publish_at', { ascending: true })
    .limit(10);

  for (const pick of picks.data) {
    // Post to Discord
    await this.discordClient.postPick(pick);

    // Mark as published
    await this.supabase
      .from('promotion_queue')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('pick_id', pick.id);
  }
}

// Run every 60s with idempotent protection
async start(): Promise<void> {
  setInterval(() => this.pollForApprovedPicks(), 60000);
}
```

### Phase 3: Parlays & Teasers

#### 3.1 Create SlipSettlement Worker
**File:** `apps/api/src/workers/SlipSettlementWorker.ts`

**Purpose:** React to new `settled_outcomes` and update bet legs + slips

**Implementation:**
```typescript
export class SlipSettlementWorker {
  async processSettlements(): Promise<void> {
    // Find recently settled outcomes
    const settlements = await this.supabase
      .from('settled_outcomes')
      .select('*')
      .gte('settled_at', new Date(Date.now() - 3600000).toISOString())  // Last hour
      .order('settled_at', { ascending: false });

    for (const settlement of settlements.data) {
      // Find all legs referencing this prop
      const legs = await this.supabase
        .from('bet_legs')
        .select('*, slip:bet_slips(*)')
        .eq('prop_ref', settlement.prop_ref)
        .eq('status', 'pending');

      for (const leg of legs.data) {
        // Determine leg outcome
        const legStatus = this.determineLegStatus(leg, settlement);

        // Update leg
        await this.supabase
          .from('bet_legs')
          .update({
            status: legStatus,
            actual_result: settlement.actual_value,
            result_source: 'settlement_engine',
            settled_at: new Date()
          })
          .eq('id', leg.id);

        // Slip auto-updates via trigger
      }
    }
  }

  private determineLegStatus(leg: BetLeg, settlement: Settlement): string {
    if (settlement.result === 'push') return 'push';
    if (settlement.result === 'cancelled') return 'cancelled';

    // Check if leg selection won
    if (leg.selection === 'over') {
      return settlement.actual_value > leg.line ? 'won' : 'lost';
    } else {
      return settlement.actual_value < leg.line ? 'won' : 'lost';
    }
  }
}
```

#### 3.2 Pricing Rules for Push Adjustments
```typescript
// When a leg pushes in a parlay, recalculate odds
function recalculateParlayOdds(legs: BetLeg[]): number {
  const activeLogs = legs.filter(l => l.status !== 'push');
  return activeLogs.reduce((acc, leg) => acc * oddsToDecimal(leg.odds), 1);
}
```

### Phase 4: ML Feature Store

#### 4.1 Create ML Feature Snapshot Job
**File:** `apps/api/src/jobs/MLFeatureSnapshotJob.ts`

**Purpose:** Nightly snapshot of features + labels for training

**Implementation:**
```typescript
export class MLFeatureSnapshotJob {
  async run(): Promise<void> {
    const yesterday = new Date(Date.now() - 86400000);

    // Get all scored props from yesterday
    const props = await this.supabase
      .from('v_prop_read_model')
      .select('*')
      .gte('game_date', yesterday.toISOString())
      .lt('game_date', new Date().toISOString())
      .not('scored_at', 'is', null);

    for (const prop of props.data) {
      // Extract features
      const features = await this.extractFeatures(prop);

      // Insert into ml_features
      await this.supabase.from('ml_features').insert({
        prop_ref: prop.prop_ref,
        feature_set_version: 'v1',
        market_features: features.market,
        player_features: features.player,
        matchup_features: features.matchup,
        price_features: features.price,
        meta_features: features.meta,
        feature_vector: features.vector
      });

      // Check if settled
      const settlement = await this.supabase
        .from('settled_outcomes')
        .select('*')
        .eq('prop_ref', prop.prop_ref)
        .single();

      if (settlement.data) {
        // Insert label
        await this.supabase.from('ml_labels').insert({
          prop_ref: prop.prop_ref,
          hit: settlement.data.result === 'win',
          actual_value: settlement.data.actual_value,
          margin: settlement.data.actual_value - prop.line,
          predicted_prob: prop.prob_win,
          predicted_value: prop.line + (prop.edge || 0),
          prediction_error: Math.abs(settlement.data.actual_value - (prop.line + (prop.edge || 0))),
          game_date: prop.game_date
        });
      }
    }

    // Optional: Export to Parquet
    if (process.env.ML_EXPORT_PARQUET === 'true') {
      await this.exportToParquet(props.data);
    }
  }
}
```

**Cron Setup:**
```typescript
// Run nightly at 4 AM
cron.schedule('0 4 * * *', () => new MLFeatureSnapshotJob().run());
```

### Phase 5: Scheduler Updates

#### 5.1 Update liveLoops.ts
**File:** `apps/api/src/scripts/schedulers/liveLoops.ts`

**Changes:**
```typescript
// Feed → Normalize loop (45s)
setInterval(async () => {
  const runId = `feed-${Date.now()}`;
  await feedAgent.run();  // Writes to raw_props
  await normalizer.processLatest();  // Normalizes to unified_picks
  await agentHealthService.ping('FeedAgent', { lastRun: new Date(), status: 'success' });
}, 45000);

// Scoring loop (30s)
setInterval(async () => {
  await scoringAgent.scoreUnscoredProps();
  await agentHealthService.ping('ScoringAgent', { lastRun: new Date(), status: 'success' });
}, 30000);

// Approvals/Alerts loop (30-60s)
setInterval(async () => {
  // Auto-approve S/A tier picks
  await approvalAgent.autoApproveHighTier();
  // Alert on approved picks
  await alertAgent.pollForApprovedPicks();
  await agentHealthService.ping('AlertAgent', { lastRun: new Date(), status: 'success' });
}, 60000);
```

### Phase 6: Command Center Integration

#### 6.1 Verify ccDataAdapter
**File:** `apps/command-center/src/data/ccDataAdapter.ts`

**Requirements:**
- Read ONLY from `v_daily_board` and `v_prop_read_model`
- Subscribe to real-time changes via Supabase subscriptions
- Call RPCs for approve/deny actions

**Example:**
```typescript
export class CCDataAdapter {
  async loadDailyBoard(): Promise<BoardRow[]> {
    const { data } = await supabase
      .from('v_daily_board')
      .select('*')
      .order('professional_score', { ascending: false });
    return data;
  }

  subscribeToChanges(callback: (row: BoardRow) => void): void {
    supabase
      .channel('daily_board_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scored_props'
      }, payload => {
        // Refresh board row
        this.loadDailyBoard().then(callback);
      })
      .subscribe();
  }

  async approvePick(pickId: string, userId: string): Promise<void> {
    await supabase.rpc('approve_pick', {
      p_pick_id: pickId,
      p_approved_by: userId
    });
  }
}
```

### Phase 7: Testing & Ops

#### 7.1 Integration Tests
**File:** `apps/api/src/__tests__/integration/dataFlow.test.ts`

```typescript
describe('Data Flow Integration', () => {
  it('ingests → normalizes → scores → approves → alerts', async () => {
    // 1. Ingest
    await feedAgent.run();
    const rawProps = await db.from('raw_props').select('*').limit(1);
    expect(rawProps.data.length).toBeGreaterThan(0);

    // 2. Normalize
    await normalizer.processLatest();
    const normalized = await db.from('unified_picks').select('*').limit(1);
    expect(normalized.data.length).toBeGreaterThan(0);

    // 3. Score
    await scoringAgent.scoreUnscoredProps();
    const scored = await db.from('scored_props').select('*').limit(1);
    expect(scored.data.length).toBeGreaterThan(0);

    // 4. Approve
    await approvalAgent.autoApproveHighTier();
    const approved = await db.from('promotion_queue')
      .select('*')
      .eq('status', 'approved')
      .limit(1);
    expect(approved.data.length).toBeGreaterThan(0);

    // 5. Alert
    await alertAgent.pollForApprovedPicks();
    const published = await db.from('promotion_queue')
      .select('*')
      .eq('status', 'published')
      .limit(1);
    expect(published.data.length).toBeGreaterThan(0);
  });
});
```

#### 7.2 Create verify-all.ts
**File:** `apps/api/src/scripts/ops/verify-all.ts`

```typescript
export async function verifyAll(): Promise<VerificationResult> {
  const checks = {
    boardRows: await checkBoardRows(),  // v_daily_board has rows
    feedRows: await checkRecentFeed(),  // raw_props has rows from last hour
    recentScoring: await checkRecentScoring(),  // scored_props has rows from last 30 min
    alertsBacklog: await checkAlertsBacklog(),  // No stale approved picks
    agentHealth: await checkAgentHealth()  // All agents pinged within 2 min
  };

  const allGreen = Object.values(checks).every(c => c.status === 'pass');

  return {
    allGreen,
    checks,
    timestamp: new Date().toISOString()
  };
}

async function checkBoardRows(): Promise<Check> {
  const { data } = await supabase.from('v_daily_board').select('id').limit(1);
  return {
    status: data && data.length > 0 ? 'pass' : 'fail',
    message: data && data.length > 0 ? 'Board has rows' : 'Board is empty'
  };
}

// ... other checks
```

**Run:**
```bash
npx tsx apps/api/src/scripts/ops/verify-all.ts
```

### Phase 8: Documentation Updates

#### 8.1 Update READMODELS_WIRING.md
- Document `v_prop_read_model` and `v_daily_board` schemas
- Explain Command Center integration
- Show RPC usage examples

#### 8.2 Update CLEANUP_PLAYBOOK.md
- Add notes on new tables: `scored_props`, `bet_slips`, `bet_legs`, `ml_features`, `ml_labels`
- Document safe cleanup procedures for parlay/ML data

## Acceptance Criteria

✅ **All checks pass:**
```bash
npx tsx apps/api/src/scripts/ops/verify-all.ts
# Output:
# ✅ boardRows: PASS
# ✅ feedRows: PASS
# ✅ recentScoring: PASS
# ✅ alertsBacklog: PASS (0 stale)
# ✅ agentHealth: PASS
#
# 🎉 ALL GREEN
```

✅ **v_daily_board shows scored rows:**
```sql
SELECT COUNT(*) FROM v_daily_board WHERE tier IN ('S', 'A');
-- Should return rows
```

✅ **Approvals → Alerts publish & mark published:**
```sql
SELECT * FROM promotion_queue WHERE status = 'published' AND published_at IS NOT NULL;
-- Should show recently published picks
```

✅ **Parlay settlement works:**
```typescript
// Create 2-leg parlay
const slip = await createParlay([leg1, leg2]);
// Settle both legs
await settleLegs([leg1, leg2]);
// Check slip status
expect(slip.status).toBe('won'); // or 'lost' or 'push'
```

✅ **ML features filled:**
```sql
SELECT COUNT(*) FROM ml_features WHERE extracted_at >= NOW() - INTERVAL '1 day';
-- Should show yesterday's features
```

## Next Steps

1. **Apply migration:**
   ```bash
   docker-compose exec api npx supabase db push
   ```

2. **Implement agents in order:**
   - Normalizer (Phase 1.2)
   - Update FeedAgent (Phase 1.1)
   - Update ScoringAgent (Phase 1.3)
   - Update AlertAgent (Phase 2.2)
   - SlipSettlement worker (Phase 3.1)
   - ML snapshot job (Phase 4.1)

3. **Update schedulers:**
   - Modify `liveLoops.ts` (Phase 5.1)

4. **Test integration:**
   - Run `verify-all.ts`
   - Run integration tests

5. **Deploy:**
   - Restart services
   - Monitor logs
   - Validate end-to-end flow

## File Manifest

### Created Files
- ✅ `supabase/migrations/20251008_000000_refactor_data_pipeline.sql`

### Files to Create/Modify
- `apps/api/src/agents/NormalizerAgent/index.ts` (NEW)
- `apps/api/src/agents/NormalizerAgent/__tests__/edgeCases.test.ts` (NEW)
- `apps/api/src/agents/FeedAgent/index.ts` (MODIFY)
- `apps/api/src/agents/ScoringAgent/index.ts` (MODIFY)
- `apps/api/src/agents/alert/AlertAgent.ts` (MODIFY)
- `apps/api/src/workflows/agents/SettlementAgent.ts` (VALIDATE)
- `apps/api/src/workers/SlipSettlementWorker.ts` (NEW)
- `apps/api/src/jobs/MLFeatureSnapshotJob.ts` (NEW)
- `apps/api/src/scripts/schedulers/liveLoops.ts` (MODIFY)
- `apps/api/src/scripts/score-smoke.ts` (NEW)
- `apps/api/src/scripts/settle-smoke.ts` (NEW)
- `apps/api/src/scripts/ops/verify-all.ts` (NEW)
- `apps/api/src/__tests__/integration/dataFlow.test.ts` (NEW)
- `apps/command-center/src/data/ccDataAdapter.ts` (VALIDATE)
- `docs/READMODELS_WIRING.md` (UPDATE)
- `docs/CLEANUP_PLAYBOOK.md` (UPDATE)

---

**Note:** This is a comprehensive guide. Due to the extensive scope, I recommend implementing in phases with testing at each step. The migration is ready to apply, and the implementation patterns are documented for each component.
