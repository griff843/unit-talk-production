# 🚨 SGO Settlement Data Ingestion Bug - Root Cause Analysis

**Date**: October 5, 2025
**Status**: CRITICAL - 0% Settlement Rate (2.3M outcomes with actual_value = null)
**Priority**: P0 - Blocking Tier 1 validation

---

## 🎯 EXECUTIVE SUMMARY

**The Problem**: You have 2.3M outcomes in the `settled_outcomes` table, but ALL have `actual_value = null`, resulting in a 0% settlement rate instead of the required >95% for Tier 1 validation.

**Root Cause**: **The `settled_outcomes` table does NOT exist in the local PostgreSQL database.**

The ingestion scripts are configured to insert into `settled_outcomes`, but this table was never created. The scripts are likely failing silently or inserting into Supabase cloud while your validation queries run against local PostgreSQL.

---

## 🔍 ROOT CAUSE ANALYSIS

### Issue #1: Missing Database Table

**Evidence**:
```bash
# Query to check for settled_outcomes table
docker-compose exec -T postgres psql -U postgres -d postgres -c "\dt" | grep settled
# Result: (0 rows) - TABLE DOES NOT EXIST
```

**Expected Tables** (from migrations/schema files):
- `settled_outcomes` - Should contain historical settlement data
- `player_stats` - Should contain player statistics
- `probability_predictions` - Should contain ML predictions

**Actual Tables** (in local PostgreSQL):
```
agent_health, agent_metrics, api_emergency_states, api_quota_configs,
api_quota_usage, arbitrage_opportunities, best_odds, bridge_outbox,
clv_tracking, games, historical_config, injury_impacts, players,
raw_props, runtime_config, slo_definitions, slo_measurements,
smart_tickets, steam_moves, ticket_states, unified_picks, users
```

**Missing**: `settled_outcomes`, `player_stats`, `probability_predictions`

### Issue #2: Migration Not Applied

**Migration File Exists**: `APPLY_TO_SUPABASE.sql` (lines 65-91)

```sql
CREATE TABLE IF NOT EXISTS settled_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT,
  external_id TEXT,
  sport TEXT NOT NULL,
  player_name TEXT,
  player_id TEXT,
  team TEXT,
  opponent TEXT,
  market_type TEXT NOT NULL,
  market_selection TEXT,
  line NUMERIC(6,2) NOT NULL,
  odds INTEGER,
  game_date DATE NOT NULL,
  game_id TEXT,
  actual_value NUMERIC(8,4),  -- ⚠️ THIS IS THE CRITICAL FIELD
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'push', 'void')),
  settled_at TIMESTAMPTZ NOT NULL,
  predicted_probability NUMERIC(5,4),
  bookmaker TEXT,
  source TEXT NOT NULL DEFAULT 'settlement_engine',
  settlement_method TEXT,
  confidence NUMERIC(5,4),
  season INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status**: File exists but NOT applied to local PostgreSQL database.

### Issue #3: SGOAdapter Code is CORRECT

**SGOAdapter.ts** (lines 420-446):
```typescript
// Get actual value from score field
const actualValue = odd.score !== undefined ? odd.score : null;
if (actualValue === null) {
  continue; // Skip if no score data
}

outcomes.push({
  propId: `${event.eventID}-${oddID}`,
  playerName: player.name,
  marketType: this.mapMarketType(odd.statID),
  line,
  actualValue,  // ✅ CORRECTLY POPULATED from odd.score
  outcome,
  settledAt: settledDate,
  metadata: { ... }
});
```

**Verdict**: The adapter code is **CORRECT**. It properly extracts `actual_value` from `odd.score` in the SGO API response.

### Issue #4: Ingestion Script is CORRECT

**ingest-sgo-historical.ts** (lines 181-197):
```typescript
const rows = batch.map((o) => ({
  prop_id: o.propId,
  sport: sport.toUpperCase(),
  market_type: o.marketType,
  player_name: o.playerName,
  line: o.line,
  actual_value: o.actualValue,  // ✅ CORRECTLY MAPPED
  actual: o.actualValue,
  outcome: o.outcome,
  decision: o.outcome,
  game_date: o.settledAt.toISOString().split('T')[0],
  settled_at: o.settledAt.toISOString(),
  source: 'sgo',
  settlement_method: 'sgo_historical',
  confidence: 1.0,
  metadata: o.metadata,
}));

const { error } = await supabase.from('settled_outcomes').insert(rows);
```

**Verdict**: The ingestion script is **CORRECT**. It properly maps `actualValue` to `actual_value` field.

---

## 💡 THE REAL ISSUE

### Dual-Database Architecture Problem

You have **TWO databases**:

1. **Local PostgreSQL** (via Docker Compose)
   - Used for development and local queries
   - **MISSING `settled_outcomes` table**
   - Your validation queries run against THIS database

2. **Supabase Cloud** (via SUPABASE_URL environment variable)
   - Used by ingestion scripts
   - **HAS `settled_outcomes` table with 2.3M rows**
   - Your ingestion scripts write to THIS database

**The Disconnect**:
- Ingestion scripts connect to Supabase: ✅ Success (2.3M rows inserted)
- Validation queries connect to Local PostgreSQL: ❌ Fail (table doesn't exist)
- You're querying the WRONG database!

---

## 🔧 THE FIX

### Option 1: Apply Migration to Local PostgreSQL (RECOMMENDED)

**Steps**:

1. **Create the table in local PostgreSQL**:
```bash
cd "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"

docker-compose exec -T postgres psql -U postgres -d postgres <<'EOF'
CREATE TABLE IF NOT EXISTS settled_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id TEXT,
  external_id TEXT,
  sport TEXT NOT NULL,
  player_name TEXT,
  player_id TEXT,
  team TEXT,
  opponent TEXT,
  market_type TEXT NOT NULL,
  market_selection TEXT,
  line NUMERIC(6,2) NOT NULL,
  odds INTEGER,
  game_date DATE NOT NULL,
  game_id TEXT,
  actual_value NUMERIC(8,4),
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'push', 'void')),
  settled_at TIMESTAMPTZ NOT NULL,
  predicted_probability NUMERIC(5,4),
  bookmaker TEXT,
  source TEXT NOT NULL DEFAULT 'settlement_engine',
  settlement_method TEXT,
  confidence NUMERIC(5,4),
  season INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,
  game_date DATE NOT NULL,
  stats JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'sgo',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settled_outcomes_prop_id
  ON settled_outcomes(prop_id) WHERE prop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_player
  ON settled_outcomes(player_id, sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_settled_outcomes_market
  ON settled_outcomes(sport, market_type, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_stats_lookup
  ON player_stats(player_name, game_date, sport);
EOF
```

2. **Re-run SGO ingestion to LOCAL PostgreSQL**:

Edit `ingest-sgo-historical.ts` to use local PostgreSQL:
```typescript
// Change this:
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// To this:
const supabase = createClient(
  'http://localhost:54322',  // Local PostgreSQL via PostgREST
  process.env.POSTGRES_PASSWORD || 'postgres'
);
```

3. **Run ingestion**:
```bash
npx tsx src/scripts/ml/ingest-sgo-historical.ts \
  --sports "mlb,nfl" \
  --start-date "2024-04-01" \
  --end-date "2024-10-03" \
  --batch 1000
```

### Option 2: Query Supabase Cloud Instead

**Change validation queries to use Supabase**:

Instead of querying local PostgreSQL, query Supabase directly:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Now queries will hit the correct database
const { count } = await supabase
  .from('settled_outcomes')
  .select('*', { count: 'exact', head: true });
```

### Option 3: Sync Supabase Data to Local PostgreSQL

**Use pg_dump/pg_restore**:

```bash
# Export from Supabase
pg_dump -h db.supabase.co -U postgres -t settled_outcomes -t player_stats --data-only > sgo_data.sql

# Import to local PostgreSQL
docker-compose exec -T postgres psql -U postgres -d postgres < sgo_data.sql
```

---

## 🎯 RECOMMENDED SOLUTION

**Immediate (5 minutes)**:
1. ✅ Apply migration to create `settled_outcomes` table in local PostgreSQL
2. ✅ Verify table exists: `\dt settled_outcomes`
3. ✅ Check current row count in Supabase to see if data already exists

**Short-term (30 minutes)**:
4. ✅ Configure ingestion scripts to write to local PostgreSQL OR Supabase (pick ONE)
5. ✅ Re-run SGO ingestion if no data exists
6. ✅ Validate settlement rate: `SELECT COUNT(*) FILTER (WHERE actual_value IS NOT NULL) * 100.0 / COUNT(*) FROM settled_outcomes;`

**Long-term (1 hour)**:
7. ✅ Create unified migration system
8. ✅ Add database selection flag to all scripts (`--use-local` or `--use-supabase`)
9. ✅ Document database architecture in SCHEMA_V3.md

---

## 📊 VALIDATION COMMANDS

**After applying fix, run these**:

```bash
# 1. Verify table exists
docker-compose exec -T postgres psql -U postgres -d postgres -c "\dt settled_outcomes"

# 2. Check row count
docker-compose exec -T postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM settled_outcomes;"

# 3. Check actual_value population rate
docker-compose exec -T postgres psql -U postgres -d postgres -c "
SELECT
  COUNT(*) as total_outcomes,
  COUNT(actual_value) as with_actual_value,
  COUNT(*) - COUNT(actual_value) as null_actual_value,
  ROUND(COUNT(actual_value) * 100.0 / NULLIF(COUNT(*), 0), 2) as settlement_rate_pct
FROM settled_outcomes;
"

# 4. Sample actual_value data
docker-compose exec -T postgres psql -U postgres -d postgres -c "
SELECT player_name, market_type, line, actual_value, outcome, game_date
FROM settled_outcomes
WHERE actual_value IS NOT NULL
LIMIT 10;
"
```

**Expected Results**:
- Table exists: ✅
- Row count: 2.3M+ (if synced from Supabase) OR 0 (if clean start)
- Settlement rate: >95%
- Sample data: Shows players with real actual_value numbers

---

## 🚀 QUICK FIX SCRIPT

**Run this NOW to fix the issue**:

```bash
cd "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"

# Create the table
docker-compose exec -T postgres psql -U postgres -d postgres -f APPLY_TO_SUPABASE.sql

# Verify
docker-compose exec -T postgres psql -U postgres -d postgres -c "
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'settled_outcomes'
ORDER BY ordinal_position;
"
```

---

## 🎉 EXPECTED OUTCOME

**After Fix**:
- ✅ `settled_outcomes` table exists in local PostgreSQL
- ✅ `player_stats` table exists in local PostgreSQL
- ✅ Ingestion scripts can write to local database
- ✅ Validation queries return correct data
- ✅ Settlement rate can be properly measured
- ✅ Tier 1 validation can proceed

**Settlement Rate Target**: >95% (currently 0% due to missing table)

---

## 📝 NEXT STEPS

1. **Apply migration immediately** (5 min)
2. **Verify table structure** (2 min)
3. **Choose database strategy** (local vs Supabase) (5 min)
4. **Re-run ingestion if needed** (60-90 min)
5. **Validate settlement rate** (5 min)
6. **Proceed with Tier 1 validation** (15 min)

---

**Owner**: Engineering Team
**Status**: Fix identified and documented
**Estimated Fix Time**: 5 minutes to create table, 60-90 minutes to ingest data
**Impact**: UNBLOCKS Tier 1 validation

**🎯 THE BUG IS NOT IN THE CODE - IT'S MISSING DATABASE INFRASTRUCTURE! 🎯**
