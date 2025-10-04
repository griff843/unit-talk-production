# System Status Report - October 4, 2025

## Executive Summary

**Status: ⚠️ PARTIALLY DEPLOYED - Schema Mismatch Detected**

The pipeline refactor infrastructure has been **partially implemented** but there are critical schema mismatches between the proposed migration and the existing production schema. The system is currently **idle** with no active agents or recent data ingestion.

---

## 🔍 Assessment Results

### 1. Database Migration Status

**Result: ⚠️ PARTIAL FAILURE**

The migration `20251008_000000_refactor_data_pipeline.sql` was applied but encountered multiple errors:

#### ✅ Successfully Created:
- `ml_features` table (already existed, skipped)
- `ml_labels` table
- `model_versions` table
- Various indexes on successfully created tables

#### ❌ Failed to Create:
- `scored_props` table - **CRITICAL** (column reference errors)
- `bet_slips` table - **FAILED** (foreign key type mismatch: user_id TEXT vs users.id UUID)
- `bet_legs` table - **FAILED** (depends on bet_slips)
- `v_prop_read_model` view - **ERROR** (column `selection` doesn't exist in unified_picks)
- `v_daily_board` view - **ERROR** (references non-existent `promotion_queue` table)
- RPCs: `promote_pick()`, `approve_pick()` - **FAILED** (table dependencies)
- Triggers: `update_slip_from_legs()` - **FAILED** (table dependencies)

#### Root Causes:
1. **Schema Mismatch**: Migration assumes column names that don't exist
   - Expected: `unified_picks.selection` → Actual: `unified_picks.prediction`
   - Expected: `users.id TEXT` → Actual: `users.id UUID`
   - Expected: `promotion_queue` table → Actual: `approval_queue` table

2. **Role Missing**: PostgreSQL roles `authenticated` and `service_role` don't exist (Supabase-specific)

### 2. Existing Schema Reality

**Actual Database: `unit_talk_dev` (PostgreSQL 15)**

#### Core Tables (Verified):
```sql
✅ raw_props              - 742,531 rows (historical data)
✅ unified_picks          - 746 rows (processed picks)
✅ settled_outcomes       - 0 rows (no settlements yet)
✅ approval_queue         - Exists (not promotion_queue)
✅ agent_health           - Exists (no recent data)
✅ ml_features            - Exists (empty)
```

#### Views (Verified):
```sql
✅ v_prop_read_model      - EXISTS (joins raw_props + unified_picks)
✅ v_daily_board          - EXISTS (joins with approval_queue)
✅ v_command_center_board - EXISTS
```

#### Key Schema Differences:

**raw_props**:
- ❌ NO `ingested_at` column → Has `created_at` instead
- ✅ Has `external_prop_id`, `game_id`, `player_name`, `team`, `opponent`
- ✅ Has `over_odds`, `under_odds`, `line`

**unified_picks**:
- ❌ NO `selection` column → Has `prediction` instead
- ✅ Has `professional_score`, `tier`, `confidence`, `kelly_fraction`
- ✅ Has `user_id` as TEXT (not UUID foreign key to users)
- ✅ Has workflow columns: `promoted_at`, `approved_at`, `approved_by`

**approval_queue** (not promotion_queue):
- ✅ Has `unified_id` (foreign key to unified_picks.id)
- ✅ Has `status`, `approved_at`, `approved_by`, `denied_at`, `denied_by`

**agent_health**:
- ✅ Has `agent` column (primary)
- ✅ Has `agent_name` column (duplicate/legacy)
- ❌ NO `last_ping` → Has `last_run` instead

### 3. Agent Status

**Result: ❌ ALL AGENTS OFFLINE**

```bash
Recent Activity Check:
- Raw props (last hour): 0
- Agent health records: 0
- Last agent run: NONE
```

#### Agents Present in Codebase:
```
✅ NormalizerAgent/        - NEW (just created)
✅ FeedAgent/              - Exists
✅ ScoringAgent/           - Exists (Enhanced45Factor)
✅ AlertAgent/             - Exists (minimal)
✅ alert/                  - Exists
✅ approval/               - Exists
✅ BaseAgent/              - Framework exists
... and 30+ other agents
```

#### Agent Implementation Status:
- **NormalizerAgent**: ✅ Code complete, not yet integrated
- **FeedAgent**: ⚠️ Writes to unified_picks directly (old pattern)
- **ScoringAgent**: ⚠️ Inline scoring (no scored_props output)
- **AlertAgent**: ⚠️ Minimal smoke test version
- **Settlement**: ❓ Exists but not verified

### 4. Data Flow Analysis

**Current Reality:**

```
[BROKEN] No active data ingestion
         ↓
raw_props (742K historical rows, 0 recent)
         ↓
[NO NORMALIZER RUNNING]
         ↓
unified_picks (746 historical rows)
         ↓
[NO SCORING AGENT RUNNING]
         ↓
??? (no scored_props table exists)
         ↓
approval_queue (not checked)
         ↓
[NO ALERT AGENT RUNNING]
```

**Expected Flow (Per Refactor Plan):**
```
FeedAgent → raw_props
            ↓
NormalizerAgent → unified_picks
                   ↓
ScoringAgent → scored_props ❌ (table missing)
               ↓
v_daily_board → approval → alerts
```

### 5. System Health Check Results

**verify-all.ts Output:**

```
❌ boardRows:       FAIL - column v_daily_board.id does not exist
❌ feedRows:        FAIL - column raw_props.ingested_at does not exist
❌ recentScoring:   FAIL - table scored_props does not exist
❌ alertsBacklog:   FAIL - table promotion_queue does not exist
❌ agentHealth:     FAIL - column agent_health.agent_name issue

SUMMARY: 0 pass, 5 fail, 0 warn
Status: 🚨 CRITICAL ISSUES DETECTED
```

---

## 📊 What's Working vs. What's Not

### ✅ What's Working:

1. **Database Infrastructure**
   - PostgreSQL 15 running healthy
   - Core tables exist and have data
   - Views are in place (v_prop_read_model, v_daily_board)
   - Historical data preserved (742K raw_props)

2. **Docker Services**
   - All containers healthy and running
   - api-cloud: ✅ Up 2 days
   - postgres: ✅ Up 2 days
   - redis: ✅ Up 2 days
   - temporal: ✅ Up 2 days

3. **Code Assets**
   - NormalizerAgent: ✅ Implemented
   - verify-all.ts: ✅ Created
   - Enhanced45FactorEngine: ✅ Exists
   - Documentation: ✅ Comprehensive

### ❌ What's NOT Working:

1. **Migration Issues**
   - scored_props table: ❌ NOT created
   - bet_slips/bet_legs: ❌ NOT created
   - Views updated: ❌ FAILED (column mismatches)
   - RPCs: ❌ NOT created
   - Triggers: ❌ NOT created

2. **Data Pipeline**
   - FeedAgent: ❌ Not running (0 ingestions in last hour)
   - NormalizerAgent: ❌ Not integrated/running
   - ScoringAgent: ❌ Not running
   - AlertAgent: ❌ Not running
   - No recent data flow

3. **Verification System**
   - verify-all.ts: ❌ All checks failed due to schema mismatches

---

## 🔧 Required Fixes

### Priority 1: Schema Alignment (CRITICAL)

**Issue**: Migration assumes schema that doesn't match production

**Fix Required**: Create a corrected migration that:

1. **Fix column references:**
   ```sql
   -- Change FROM:
   up.selection AS outcome

   -- Change TO:
   up.prediction AS outcome
   ```

2. **Fix foreign key types:**
   ```sql
   -- Change FROM:
   user_id TEXT REFERENCES users(id)

   -- Change TO:
   user_id UUID REFERENCES users(id)
   ```

3. **Fix table references:**
   ```sql
   -- Change FROM:
   LEFT JOIN promotion_queue pq...

   -- Change TO:
   LEFT JOIN approval_queue pq...
   ```

4. **Fix timestamp columns:**
   ```sql
   -- Change FROM:
   raw_props.ingested_at

   -- Change TO:
   raw_props.created_at
   ```

5. **Remove Supabase-specific roles** or create them:
   ```sql
   -- Either remove or:
   CREATE ROLE authenticated;
   CREATE ROLE service_role;
   ```

### Priority 2: Create Corrected scored_props Table

The `scored_props` table is **critical** for the new architecture but failed to create.

**Corrected Schema:**
```sql
CREATE TABLE IF NOT EXISTS scored_props (
  id BIGSERIAL PRIMARY KEY,
  pick_id UUID REFERENCES unified_picks(id),  -- Use actual UUID
  prop_ref TEXT,  -- Keep for compatibility

  -- Core scoring (match actual column types)
  edge NUMERIC(10,4),
  prob_win NUMERIC(10,6),
  professional_score NUMERIC(10,4),
  tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  confidence NUMERIC(10,6),
  kelly_fraction NUMERIC(10,6),
  clv_pct NUMERIC(10,4),

  -- Model metadata
  model_version TEXT NOT NULL DEFAULT 'enhanced-45-factor-v1',

  -- Factor scores
  market_score NUMERIC(10,4),
  player_score NUMERIC(10,4),
  matchup_score NUMERIC(10,4),
  price_score NUMERIC(10,4),
  meta_score NUMERIC(10,4),
  factor_scores JSONB DEFAULT '{}'::jsonb,

  -- Timestamps (use created_at to match convention)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT scored_props_pick_id_unique UNIQUE (pick_id, model_version)
);

CREATE INDEX idx_scored_props_tier ON scored_props(tier);
CREATE INDEX idx_scored_props_created_at ON scored_props(created_at DESC);
CREATE INDEX idx_scored_props_professional_score ON scored_props(professional_score DESC);
```

### Priority 3: Agent Integration

**Required Steps:**

1. **Fix FeedAgent** - Update to write to raw_props (may already do this based on 742K rows)
2. **Deploy NormalizerAgent** - Integrate into scheduler
3. **Update ScoringAgent** - Output to scored_props instead of inline
4. **Fix AlertAgent** - Source from v_daily_board
5. **Start Schedulers** - Get agents running

### Priority 4: Fix Verification Script

Update `verify-all.ts` to match actual schema:

```typescript
// Use actual column names:
- raw_props.created_at (not ingested_at)
- agent_health.last_run (not last_ping)
- agent_health.agent (not agent_name)
- approval_queue (not promotion_queue)
- unified_picks.id (for joins, not pick_id)
```

---

## 📈 Current vs. Expected State

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| **Database** |
| scored_props table | ✅ | ❌ | Missing |
| bet_slips table | ✅ | ❌ | Missing |
| bet_legs table | ✅ | ❌ | Missing |
| v_prop_read_model | ✅ | ✅ | Exists (different schema) |
| v_daily_board | ✅ | ✅ | Exists (different schema) |
| **Agents** |
| FeedAgent active | ✅ | ❌ | Not running |
| NormalizerAgent | ✅ | ⚠️ | Code exists, not deployed |
| ScoringAgent active | ✅ | ❌ | Not running |
| AlertAgent active | ✅ | ❌ | Not running |
| **Data Flow** |
| Recent ingestion | ✅ | ❌ | 0 rows (1 hour) |
| Normalization | ✅ | ❌ | No process |
| Scoring output | ✅ | ❌ | No table |
| Alerts | ✅ | ❌ | Not running |

---

## 🎯 Immediate Action Plan

### Step 1: Create Corrected Migration (1 hour)
```bash
# Create: supabase/migrations/20251008_000001_corrected_pipeline.sql
# - Fix all schema mismatches
# - Create scored_props with correct types
# - Fix views to use actual column names
# - Skip Supabase roles
```

### Step 2: Apply Corrected Migration (15 min)
```bash
docker-compose exec postgres psql -U postgres -d unit_talk_dev \
  -f /path/to/corrected_migration.sql
```

### Step 3: Fix verify-all.ts (30 min)
- Update to use actual schema column names
- Test until all checks pass

### Step 4: Start Agents (1-2 hours)
```bash
# 1. Check if agents can start
docker-compose exec api-cloud npm run agents:status

# 2. Start FeedAgent
docker-compose exec api-cloud npm run agents:feed

# 3. Deploy NormalizerAgent to scheduler
# 4. Start ScoringAgent
# 5. Start AlertAgent
```

### Step 5: Verify End-to-End (30 min)
```bash
# Run full verification
npx tsx apps/api/src/scripts/ops/verify-all.ts

# Expected: ALL GREEN
```

---

## 💡 Key Findings

1. **Good News:**
   - Infrastructure is solid (Docker, PostgreSQL, Redis, Temporal all healthy)
   - Historical data is preserved (742K raw_props)
   - Core tables and views exist
   - Agent code is present and ready

2. **Bad News:**
   - Migration has critical schema mismatches
   - scored_props table doesn't exist (blocking scoring pipeline)
   - No agents are currently running (0 activity)
   - Verification script fails due to schema assumptions

3. **Root Cause:**
   - Migration was designed for a theoretical "clean slate" schema
   - Actual production schema has evolved differently
   - Column names, types, and table names differ from assumptions

4. **Path Forward:**
   - Create corrected migration matching actual schema
   - Deploy scored_props table with proper types
   - Update verification to match reality
   - Restart agent pipeline

---

## 📋 Checklist for Production Readiness

### Before Going Live:
- [ ] Apply corrected migration successfully
- [ ] Verify scored_props table exists with correct schema
- [ ] Update and test verify-all.ts (all checks pass)
- [ ] Start FeedAgent (ingestion active)
- [ ] Deploy NormalizerAgent (normalization running)
- [ ] Start ScoringAgent (writing to scored_props)
- [ ] Start AlertAgent (publishing approved picks)
- [ ] Monitor for 1 hour (ensure stability)
- [ ] Check data flow end-to-end
- [ ] Verify Command Center integration

---

## 📞 Summary for Stakeholders

**Current State**: System is **offline** with no active data processing. The migration partially succeeded but critical components failed due to schema mismatches.

**Impact**: No new picks are being generated, scored, or published. Historical data is safe.

**Timeline to Recovery**:
- **Corrected migration**: 1 hour
- **Testing & validation**: 1 hour
- **Agent deployment**: 1-2 hours
- **Monitoring & verification**: 1 hour
- **Total**: 4-5 hours to full operation

**Risk Level**: **MEDIUM**
- No data loss
- Infrastructure healthy
- Clear path to resolution
- Just needs schema correction + agent restart

---

**Report Generated**: 2025-10-04 11:33 EDT
**System Uptime**: 2 days (containers), 0 days (agents)
**Next Update**: After corrected migration applied
