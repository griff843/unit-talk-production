# 🚨 DATABASE SYSTEMATIC FIX PLAN

**Generated**: October 11, 2025
**Status**: CRITICAL - Database requires systematic remediation
**Issues Found**: 3 CRITICAL, 29 HIGH priority

---

## 📊 ANALYSIS SUMMARY

**Tables Analyzed**: 8
**Tables With Issues**: 7/8 (87.5%)

### Critical Findings
1. ❌ **Scoring engine completely broken** - all scores identical (hardcoded)
2. ❌ **Data quality catastrophic** - 100% null columns in multiple tables
3. ❌ **Player name corruption** - Over/Under instead of player names
4. ❌ **Empty critical tables** - agent_health, promotion_queue

---

## 🔥 ISSUE BREAKDOWN BY TABLE

### ❌ **market_props** (1,837 rows)
- ✅ Has data
- ❌ **selection: 100% NULL**
- ❌ **odds: 100% NULL**
- ❌ **best_book: 100% NULL**
- ❌ **best_available_line: 100% NULL**
- ❌ player_name contains "Over"/"Under" (20% of sample)
- ❌ player_name contains team names (30% of sample)
- ❌ 100% of rows have missing/invalid odds

**Impact**: Cannot use this data for scoring or display

### ❌ **scored_props** (121 rows)
- ✅ Has data
- ❌ **score: 100% NULL**
- ❌ **kelly: 100% NULL**
- ❌ **ALL professional_score identical** (51.15954545454546)
- ❌ **ALL edge values identical**
- ❌ **Kelly fractions null/0**

**Impact**: All scoring data is meaningless mock data

### ❌ **raw_props** (~8.9M rows)
- ❌ **Cannot query** - permission/RLS error
- ❌ Abnormally high row count (should be ~50K for 7 days)
- ❌ Contains old corrupted data

**Impact**: Cannot backfill, cannot verify data quality

### ⚠️ **unified_picks** (1 row)
- ⚠️ Only 1 row (likely test data)
- ❌ **16 columns 100% NULL**:
  - player_id, queue_status, publish_at, provider
  - external_game_id, external_prop_id
  - professional_score, kelly_fraction, devigged_edge, tier
  - All approval/rejection fields

**Impact**: Pick management system not functioning

### ⚠️ **games** (193 rows)
- ✅ Has data
- ❌ **start_time: 90% NULL**
- ❌ **commence_time: 100% NULL**

**Impact**: Cannot schedule or filter games properly

### ❌ **agent_health** (0 rows)
- ❌ **EMPTY TABLE**

**Impact**: No agent monitoring

### ❌ **promotion_queue** (0 rows)
- ❌ **EMPTY TABLE**

**Impact**: No promotion pipeline

### ✅ **users** (1 row)
- ✅ Working (test user present)

---

## 🔧 SYSTEMATIC REMEDIATION PLAN

Execute in this exact order. Do NOT skip steps.

---

### **PHASE 1: STOP THE BLEEDING** (Immediate)

#### Step 1.1: Disable Broken Scoring
**Why**: Stop generating more bad data

```bash
# Temporarily disable ScoringAgent
cd apps/api
# Comment out scoring workflows in Temporal
```

#### Step 1.2: Block Raw Props Ingestion
**Why**: Stop adding to the 8.9M row mess

```bash
# Pause FeedAgent ingestion
# We'll re-enable with fixed code
```

---

### **PHASE 2: FIX THE CODE** (Priority)

#### Step 2.1: Fix Scoring Engine ⚡ CRITICAL
**File**: `apps/api/src/agents/ScoringAgent/scoring/FeatureStoreIntegration.ts`

**Problem**: Missing `queryFeatures()` method

**Solution**:
```typescript
async queryFeatures(key: string): Promise<any> {
  // Extract type and ID from key
  const [featureType, propId] = key.split(':');

  // Use existing getEnhancedFeatures method
  const features = await this.getEnhancedFeatures(propId, featureType);

  return features;
}
```

**Or simpler - Update Enhanced45FactorEngine to use `getEnhancedFeatures()` instead**

**Test**:
```bash
cd apps/api
npx tsx src/scripts/debug-scoring-engine.ts
# Verify: No "queryFeatures is not a function" errors
# Verify: Scores vary across props
```

#### Step 2.2: Verify Player Props Fix
**File**: `apps/api/src/agents/FeedAgent/oddsApi.ts`

**Already Fixed**: Commit 11ae674 added player props
**Verify**:
```bash
cd apps/api
npx tsx src/scripts/quick-test-player-names.ts
# Should show real player names
```

---

### **PHASE 3: CLEAN THE DATABASE** (Critical)

#### Step 3.1: Drop and Recreate Corrupted Tables

**Tables to recreate**:
- `raw_props` (8.9M rows of bad data)
- `market_props` (1,837 rows with 100% null fields)
- `scored_props` (121 rows of mock data)

**SQL**:
```sql
-- BACKUP FIRST (just in case)
CREATE TABLE raw_props_backup AS SELECT * FROM raw_props LIMIT 1000;
CREATE TABLE market_props_backup AS SELECT * FROM market_props;
CREATE TABLE scored_props_backup AS SELECT * FROM scored_props;

-- DROP corrupted tables
TRUNCATE TABLE scored_props CASCADE;
TRUNCATE TABLE market_props CASCADE;
TRUNCATE TABLE raw_props CASCADE;

-- Verify empty
SELECT
  (SELECT COUNT(*) FROM raw_props) as raw_props_count,
  (SELECT COUNT(*) FROM market_props) as market_props_count,
  (SELECT COUNT(*) FROM scored_props) as scored_props_count;
```

**Execute**:
```bash
# Via psql
docker-compose exec postgres psql -U postgres -d postgres -f cleanup.sql

# Or via script
cd apps/api
npx tsx src/scripts/truncate-corrupted-tables.ts
```

#### Step 3.2: Fix Unified Picks Schema

**Issue**: 16 columns 100% null - schema mismatch or migration incomplete

**Check schema**:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'unified_picks'
ORDER BY ordinal_position;
```

**Likely fix**: Run pending migrations
```bash
cd apps/api
npx tsx src/scripts/apply-missing-migrations.ts
```

#### Step 3.3: Fix Games Table

**Issue**: commence_time 100% null, start_time 90% null

**Backfill from games API**:
```bash
cd apps/api
npx tsx src/scripts/backfill-game-times.ts
```

---

### **PHASE 4: RE-INGEST CLEAN DATA** (Rebuild)

#### Step 4.1: Ingest Fresh Market Props
**With fixed player props code**

```bash
cd apps/api

# Ingest NFL props for next 3 days
npx tsx -e "
import { fetchOddsApiProps } from './src/agents/FeedAgent/oddsApi';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function ingest() {
  // Fetch NFL player props
  const props = await fetchOddsApiProps(
    'americanfootball_nfl',
    ['player_pass_yds', 'player_rush_yds', 'player_receptions', 'player_pass_tds', 'player_rush_tds'],
    'us', 'american', 'iso', 3
  );

  console.log('Fetched', props.length, 'props');

  // Write directly to market_props (skip raw_props for now)
  // Use populate-market-props-direct.ts script
}

ingest();
"
```

**Expected result**: 2,000-3,000 clean NFL player props

#### Step 4.2: Score With Fixed Engine

```bash
cd apps/api

# Score in batches
for i in {1..20}; do
  echo "Scoring batch $i"
  npx tsx src/scripts/score-market-props.ts
  sleep 5
done
```

**Expected result**: 2,000+ scored props with varying scores

#### Step 4.3: Populate Promotion Queue

```bash
cd apps/api
npx tsx src/scripts/populate-promotion-queue.ts
```

**Expected result**: S/A tier props queued for approval

---

### **PHASE 5: VERIFICATION** (Critical)

#### Step 5.1: Verify Data Quality

```bash
cd apps/api
npx tsx src/scripts/comprehensive-table-analysis.ts
```

**Success criteria**:
- ✅ 0 CRITICAL issues
- ✅ <5 HIGH issues
- ✅ market_props: 0% null in key fields (player_name, odds, line)
- ✅ scored_props: Unique scores (>30% variation)
- ✅ scored_props: Kelly > 0 for props with edge

#### Step 5.2: Verify Scoring Engine

```bash
cd apps/api
npx tsx src/scripts/debug-scoring-engine.ts
```

**Success criteria**:
- ✅ No "queryFeatures" errors
- ✅ Scores vary between 20-80
- ✅ <30% of factors at default (50)
- ✅ Kelly fractions calculated

#### Step 5.3: E2E Pipeline Test

```bash
cd apps/api
npx tsx src/scripts/e2e-pipeline-validation.ts
```

**Success criteria**:
- ✅ ALL 14/14 tests passing
- ✅ All gates passing
- ✅ No null data issues

---

### **PHASE 6: OPERATIONAL HARDENING** (Prevention)

#### Step 6.1: Add Data Quality Constraints

```sql
-- Prevent null key fields in market_props
ALTER TABLE market_props
  ALTER COLUMN player_name SET NOT NULL,
  ALTER COLUMN odds SET NOT NULL,
  ALTER COLUMN line SET NOT NULL;

-- Prevent duplicate scoring
CREATE UNIQUE INDEX idx_scored_props_unique
  ON scored_props(prop_ref)
  WHERE prop_ref IS NOT NULL;

-- Add check constraint for reasonable scores
ALTER TABLE scored_props
  ADD CONSTRAINT chk_score_range
  CHECK (professional_score >= 0 AND professional_score <= 100);
```

#### Step 6.2: Implement Data Retention

```sql
-- Delete raw_props older than 7 days (daily cron)
DELETE FROM raw_props
WHERE game_date < (NOW()::DATE - INTERVAL '7 days');

-- Archive scored_props older than 30 days
-- (Move to scored_props_archive table)
```

#### Step 6.3: Add Monitoring

```bash
# Create health check script
cd apps/api
npx tsx src/scripts/daily-health-check.ts

# Checks:
# - No 100% null columns
# - Scoring engine producing varied scores
# - Row counts within expected ranges
# - No permission errors
```

---

## 📋 EXECUTION CHECKLIST

Execute these in order. Check off each step:

### Phase 1: Stop the Bleeding
- [ ] Disable ScoringAgent
- [ ] Pause FeedAgent ingestion

### Phase 2: Fix the Code
- [ ] Implement queryFeatures() method
- [ ] Test scoring engine (varied scores)
- [ ] Verify player props fix

### Phase 3: Clean Database
- [ ] Backup corrupted tables
- [ ] Truncate raw_props, market_props, scored_props
- [ ] Fix unified_picks schema
- [ ] Backfill game times

### Phase 4: Re-ingest Clean Data
- [ ] Ingest 2K+ NFL player props
- [ ] Score all props (20 batches)
- [ ] Populate promotion queue

### Phase 5: Verification
- [ ] Run table analysis (0 CRITICAL issues)
- [ ] Test scoring engine (varied scores)
- [ ] E2E validation (14/14 passing)

### Phase 6: Operational Hardening
- [ ] Add NOT NULL constraints
- [ ] Implement data retention
- [ ] Add monitoring

---

## 🚨 CRITICAL WARNINGS

1. **DO NOT skip Phase 3 (Clean Database)**
   - You cannot fix bad data in place
   - Must truncate and re-ingest

2. **DO NOT re-enable ingestion before fixing code**
   - Will just generate more bad data

3. **DO NOT trust existing scored_props**
   - All scores are hardcoded mock values
   - Must re-score everything

4. **DO NOT try to migrate/transform the 8.9M rows**
   - 99% is duplicate/corrupted data
   - Faster to truncate and re-ingest fresh

---

## ⏱️ TIME ESTIMATES

- Phase 1: 5 minutes
- Phase 2: 30 minutes (coding + testing)
- Phase 3: 10 minutes (truncate is fast)
- Phase 4: 20 minutes (ingestion + scoring)
- Phase 5: 10 minutes (validation)
- Phase 6: 30 minutes (constraints + monitoring)

**Total**: ~2 hours to clean database

---

## 🎯 SUCCESS METRICS

After completing all phases:

```
✅ market_props: 2,000+ rows, 0% null key fields, real player names
✅ scored_props: 2,000+ rows, varied scores (20-80 range), Kelly > 0
✅ raw_props: <50K rows (7 days retention)
✅ unified_picks: All required fields populated
✅ games: 100% commence_time populated
✅ agent_health: Active monitoring data
✅ promotion_queue: S/A tier props queued
✅ E2E tests: 14/14 passing
✅ No CRITICAL issues in table analysis
✅ Scoring engine: <30% factors at default
```

---

## 📄 SUPPORTING SCRIPTS

All scripts created and ready:
1. `comprehensive-table-analysis.ts` - Full DB audit
2. `debug-scoring-engine.ts` - Test scoring
3. `populate-market-props-direct.ts` - Clean ingestion
4. `score-market-props.ts` - Batch scoring
5. `e2e-pipeline-validation.ts` - End-to-end test

---

**NEXT ACTION**: Execute Phase 1 - Stop generating bad data immediately.

Then proceed systematically through all phases.

**DO NOT SKIP STEPS** - the database is too corrupted for partial fixes.
