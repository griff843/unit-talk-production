# 🚀 Supabase v3 Canonical Schema Migration Runbook

**Document Version:** 1.0
**Last Updated:** 2025-12-11
**Operator Scope:** Supabase Database Administrator
**Risk Level:** 🟢 LOW (Idempotent, additive-only operations)

---

## 📋 EXECUTIVE SUMMARY

This runbook provides step-by-step instructions for applying the **v3.0.0 Canonical Entity Architecture** to your Supabase production database.

**What this migration does:**
- Creates 5 new tables: `canonical_games`, `canonical_players`, `game_mappings`, `player_mappings`, `prop_mappings`
- Adds 3 new columns to `raw_props`: `canonical_game_id`, `canonical_player_id`, `auto_approved`
- Creates necessary indexes for performance
- Adds helper functions for entity resolution

**What this migration does NOT do:**
- Drop any existing tables
- Modify existing data
- Change any existing columns
- Affect production traffic (all operations are non-blocking)

**Why this is needed:**
Phase 1 live-fire ingestion is currently BLOCKED because the canonical schema is missing. Once applied, Phase 1 scripts can run without modification.

---

## 🎯 PREREQUISITES

Before starting this migration, verify:

- [ ] You have access to Supabase Dashboard (https://app.supabase.com) OR
- [ ] You have a full `DATABASE_URL` with password for `psql` access
- [ ] Supabase project ID: `cqfnsozknjzvyiziwicl`
- [ ] The `raw_props` table exists in your database
- [ ] You have taken a database backup (optional, but recommended for peace of mind)

**Important:** This migration is **idempotent** and safe to run multiple times. If tables/columns already exist, they will be skipped.

---

## 🛠️ PATH A: SUPABASE SQL EDITOR (RECOMMENDED)

This is the recommended approach for operators who prefer using the Supabase Dashboard.

### Step 1: Open SQL Editor

1. Navigate to https://app.supabase.com
2. Select your project: `cqfnsozknjzvyiziwicl`
3. In the left sidebar, click **SQL Editor**
4. Click **New query**

### Step 2: Copy Migration SQL

1. Open the file `APPLY_MIGRATIONS_TO_SUPABASE_FINAL.sql` in the repository root
2. Copy the **entire contents** of the file (starts with `BEGIN;`, ends with `COMMIT;`)

### Step 3: Execute Migration

**Option 3A: Run as Single Transaction (Preferred)**

1. Paste the entire SQL into the SQL Editor
2. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
3. Wait for execution to complete (~5-15 seconds)
4. Check for success messages in the Results pane

**Expected Output:**
```
NOTICE:  Added canonical_game_id column to raw_props
NOTICE:  Added canonical_player_id column to raw_props
NOTICE:  Added auto_approved column to raw_props
NOTICE:  Created trigger update_canonical_games_updated_at
NOTICE:  Created trigger update_canonical_players_updated_at
...
COMMIT
```

**Option 3B: Run in Safe Chunks (If timeouts occur)**

If the single transaction times out (unlikely), run these chunks sequentially:

**Chunk 1: Canonical Tables**
```sql
-- Copy lines 1-193 from APPLY_MIGRATIONS_TO_SUPABASE_FINAL.sql
-- (From BEGIN; through the end of prop_mappings indexes)
```

**Chunk 2: raw_props Columns**
```sql
-- Copy lines 194-264 from APPLY_MIGRATIONS_TO_SUPABASE_FINAL.sql
-- (PART 3: ALTER raw_props TABLE)
```

**Chunk 3: Helper Functions**
```sql
-- Copy lines 265-467 from APPLY_MIGRATIONS_TO_SUPABASE_FINAL.sql
-- (PART 4: HELPER FUNCTIONS through COMMIT)
```

### Step 4: Verify Migration Success

Run this verification query in the SQL Editor:

```sql
-- Check canonical entity tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('canonical_games', 'canonical_players', 'game_mappings', 'player_mappings', 'prop_mappings')
ORDER BY table_name;
```

**Expected Result:** 5 rows showing all canonical tables

```sql
-- Check raw_props new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'raw_props'
  AND column_name IN ('canonical_game_id', 'canonical_player_id', 'auto_approved')
ORDER BY column_name;
```

**Expected Result:** 3 rows showing:
- `auto_approved` | `boolean` | `YES`
- `canonical_game_id` | `uuid` | `YES`
- `canonical_player_id` | `uuid` | `YES`

```sql
-- Check indexes were created
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('canonical_games', 'canonical_players', 'game_mappings', 'player_mappings', 'prop_mappings', 'raw_props')
  AND indexname LIKE 'idx_%canonical%'
ORDER BY tablename, indexname;
```

**Expected Result:** 10+ rows showing canonical indexes

```sql
-- Check helper functions exist
SELECT proname
FROM pg_proc
WHERE proname IN ('find_or_create_canonical_game', 'find_or_create_canonical_player', 'get_mapping_conflicts')
ORDER BY proname;
```

**Expected Result:** 3 rows showing all helper functions

### Step 5: Mark as Complete

✅ If all verification queries return expected results, the migration is **COMPLETE**.

Proceed to: **Section "POST-MIGRATION ACTIONS"**

---

## 🛠️ PATH B: DIRECT psql ACCESS

This approach uses `psql` with a full `DATABASE_URL` for command-line execution.

### Prerequisites

- `psql` installed on your machine
- Full `DATABASE_URL` with password (format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)

**⚠️ SECURITY WARNING:**
- The `DATABASE_URL` contains your database password
- **NEVER** commit the `DATABASE_URL` to git
- **NEVER** share the `DATABASE_URL` in public channels
- Store it securely (e.g., 1Password, LastPass, environment variable)

### Step 1: Set DATABASE_URL

**Linux/macOS:**
```bash
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres"
```

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres"
```

**Windows (CMD):**
```cmd
set DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres
```

### Step 2: Test Connection

```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

**Expected Output:**
```
PostgreSQL 15.x on x86_64-pc-linux-gnu, compiled by gcc...
```

If you see an error, verify:
- Password is correct
- Project reference is correct: `cqfnsozknjzvyiziwicl`
- Network firewall allows port 5432

### Step 3: Execute Migration

From the repository root directory:

```bash
psql "$DATABASE_URL" -f APPLY_MIGRATIONS_TO_SUPABASE_FINAL.sql
```

**Expected Output:**
```
BEGIN
NOTICE:  Added canonical_game_id column to raw_props
NOTICE:  Added canonical_player_id column to raw_props
NOTICE:  Added auto_approved column to raw_props
NOTICE:  Created trigger update_canonical_games_updated_at
NOTICE:  Created trigger update_canonical_players_updated_at
NOTICE:  Created trigger update_game_mappings_updated_at
NOTICE:  Created trigger update_player_mappings_updated_at
NOTICE:  Created trigger update_prop_mappings_updated_at
COMMIT
```

### Step 4: Verify Migration Success

Run verification queries:

```bash
# Check canonical tables exist
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('canonical_games', 'canonical_players', 'game_mappings', 'player_mappings', 'prop_mappings')
ORDER BY table_name;
"
```

**Expected Result:** 5 rows

```bash
# Check raw_props columns exist
psql "$DATABASE_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'raw_props'
  AND column_name IN ('canonical_game_id', 'canonical_player_id', 'auto_approved')
ORDER BY column_name;
"
```

**Expected Result:** 3 rows

```bash
# Check indexes exist
psql "$DATABASE_URL" -c "
SELECT COUNT(*)
FROM pg_indexes
WHERE tablename IN ('canonical_games', 'canonical_players', 'game_mappings', 'player_mappings', 'prop_mappings', 'raw_props')
  AND indexname LIKE 'idx_%canonical%';
"
```

**Expected Result:** Count ≥ 10

```bash
# Check helper functions exist
psql "$DATABASE_URL" -c "
SELECT proname
FROM pg_proc
WHERE proname IN ('find_or_create_canonical_game', 'find_or_create_canonical_player', 'get_mapping_conflicts')
ORDER BY proname;
"
```

**Expected Result:** 3 rows

### Step 5: Mark as Complete

✅ If all verification queries return expected results, the migration is **COMPLETE**.

Proceed to: **Section "POST-MIGRATION ACTIONS"**

---

## ✅ POST-MIGRATION ACTIONS

### 1. Update PHASE1_FINAL_REPORT.md

Update the status in `PHASE1_FINAL_REPORT.md`:

```markdown
## ✅ MIGRATION COMPLETED

**Date:** [YYYY-MM-DD]
**Operator:** [Your Name]
**Method:** [SQL Editor / psql]

Migration applied successfully. All canonical tables and columns verified.

Phase 1 ingestion scripts are now UNBLOCKED.
```

### 2. Run Schema Verification Script (Optional)

From the repository, run:

```bash
npx tsx apps/api/scripts/verify-supabase-schema.ts
```

**Expected Output:**
```
✅ Supabase connected successfully
✅ raw_props: canonical_game_id column exists
✅ raw_props: canonical_player_id column exists
✅ raw_props: auto_approved column exists
✅ canonical_players table exists
✅ canonical_games table exists
✅ player_mappings table exists
✅ game_mappings table exists

📊 Schema verification: PASS ✅
```

### 3. Notify Engineering Team

Once migration is complete, notify the engineering team:

```
✅ Canonical schema migration complete for Supabase project cqfnsozknjzvyiziwicl

Tables created:
- canonical_games
- canonical_players
- game_mappings
- player_mappings
- prop_mappings

Columns added to raw_props:
- canonical_game_id (uuid)
- canonical_player_id (uuid)
- auto_approved (boolean)

Phase 1 ingestion scripts are now ready to run.
```

### 4. Proceed with Phase 1 Ingestion

With schema applied, engineering can now run:

```bash
# Run Phase 1 ingestion
npx tsx apps/api/scripts/live-fire-phase1-ingestion-simple.ts

# Verify canonical attach rate
npx tsx apps/api/scripts/live-fire-phase1-verification.ts
```

**Expected Phase 1 Results:**
- Props inserted: ≥500
- Sports: ≥2 (NBA, NCAAB, NHL)
- Canonical attach rate: ≥70%
- **Phase 1 PASS criteria met** ✅

---

## 🚨 TROUBLESHOOTING

### Issue: "table does not exist" errors during migration

**Cause:** `raw_props` table is missing
**Solution:** Ensure base schema is applied first (check for `raw_props` table existence)

### Issue: "permission denied" errors

**Cause:** Insufficient database privileges
**Solution:** Ensure you're using the `service_role` or `postgres` user with full privileges

### Issue: SQL Editor timeout

**Cause:** Migration taking too long (very rare)
**Solution:** Use chunked approach (see Path A, Option 3B)

### Issue: "column already exists" notices

**Cause:** Migration was partially applied before
**Effect:** This is **NORMAL** and **SAFE** due to idempotent design
**Action:** Continue - migration will skip existing objects

### Issue: Verification queries show missing tables/columns

**Cause:** Migration did not complete successfully
**Solution:**
1. Check for error messages in SQL Editor / psql output
2. Re-run migration (it's idempotent)
3. Contact engineering team if issue persists

---

## 🔄 ROLLBACK PROCEDURE

**Important:** Rollback is generally **NOT RECOMMENDED** because:
1. Migration is additive-only (no data loss)
2. No existing functionality is affected
3. Phase 1 scripts require these tables

However, if rollback is absolutely necessary:

### Rollback SQL

```sql
BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS update_canonical_games_updated_at ON canonical_games;
DROP TRIGGER IF EXISTS update_canonical_players_updated_at ON canonical_players;
DROP TRIGGER IF EXISTS update_game_mappings_updated_at ON game_mappings;
DROP TRIGGER IF EXISTS update_player_mappings_updated_at ON player_mappings;
DROP TRIGGER IF EXISTS update_prop_mappings_updated_at ON prop_mappings;

-- Drop functions
DROP FUNCTION IF EXISTS get_mapping_conflicts(TEXT);
DROP FUNCTION IF EXISTS find_or_create_canonical_player(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS find_or_create_canonical_game(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Remove raw_props columns
ALTER TABLE raw_props DROP COLUMN IF EXISTS canonical_game_id;
ALTER TABLE raw_props DROP COLUMN IF EXISTS canonical_player_id;
ALTER TABLE raw_props DROP COLUMN IF EXISTS auto_approved;

-- Drop mapping tables (must be before canonical tables due to foreign keys)
DROP TABLE IF EXISTS prop_mappings CASCADE;
DROP TABLE IF EXISTS player_mappings CASCADE;
DROP TABLE IF EXISTS game_mappings CASCADE;

-- Drop canonical tables
DROP TABLE IF EXISTS canonical_players CASCADE;
DROP TABLE IF EXISTS canonical_games CASCADE;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
```

**⚠️ WARNING:** Rollback will:
- Delete all canonical entity data
- Delete all mapping data
- Remove canonical columns from `raw_props`
- **BLOCK Phase 1 ingestion again**

---

## 📊 GO/NO-GO CHECKLIST

Use this checklist to determine if migration is successful:

### Pre-Migration

- [ ] Supabase access verified (Dashboard OR psql)
- [ ] `APPLY_MIGRATIONS_TO_SUPABASE_FINAL.sql` file available
- [ ] Optional: Database backup taken

### During Migration

- [ ] Migration SQL executed without fatal errors
- [ ] `NOTICE` messages appear for column/trigger creation
- [ ] Migration completes with `COMMIT` message

### Post-Migration Verification

- [ ] 5 canonical tables exist (`canonical_games`, `canonical_players`, `game_mappings`, `player_mappings`, `prop_mappings`)
- [ ] 3 new columns exist in `raw_props` (`canonical_game_id`, `canonical_player_id`, `auto_approved`)
- [ ] 10+ canonical indexes exist
- [ ] 3 helper functions exist (`find_or_create_canonical_game`, `find_or_create_canonical_player`, `get_mapping_conflicts`)
- [ ] Schema verification script passes (optional)

### Final Actions

- [ ] `PHASE1_FINAL_REPORT.md` updated with migration completion status
- [ ] Engineering team notified
- [ ] Ready to proceed with Phase 1 ingestion

---

## 📞 ESCALATION

If you encounter issues not covered in this runbook:

1. **Document the error:**
   - Copy the full error message
   - Note which step failed
   - Include any relevant SQL output

2. **Contact engineering:**
   - Share error details
   - Include verification query results
   - Specify which path you used (SQL Editor / psql)

3. **Do NOT:**
   - Attempt manual table creation outside this script
   - Modify the migration SQL without engineering review
   - Run rollback without confirmation

---

## 📚 APPENDIX: MIGRATION DETAILS

### Tables Created

| Table Name | Purpose | Row Estimate |
|------------|---------|--------------|
| `canonical_games` | Centralized game entities | ~100-500/day |
| `canonical_players` | Centralized player entities | ~5,000-10,000 |
| `game_mappings` | External game ID mappings | ~100-500/day |
| `player_mappings` | External player name mappings | ~5,000-10,000 |
| `prop_mappings` | External prop ID mappings | ~500-1,000/day |

### Columns Added to raw_props

| Column Name | Type | Nullable | Default | Purpose |
|-------------|------|----------|---------|---------|
| `canonical_game_id` | uuid | YES | NULL | FK to canonical_games |
| `canonical_player_id` | uuid | YES | NULL | FK to canonical_players |
| `auto_approved` | boolean | YES | false | Auto-approval flag |

### Indexes Created

- `idx_canonical_games_sport_league`
- `idx_canonical_games_game_time`
- `idx_canonical_games_status`
- `idx_canonical_games_teams`
- `idx_canonical_games_external_ids` (GIN)
- `idx_canonical_players_sport`
- `idx_canonical_players_full_name`
- `idx_canonical_players_team`
- `idx_canonical_players_status`
- `idx_canonical_players_external_ids` (GIN)
- `idx_canonical_players_name_variations` (GIN)
- `idx_canonical_players_name_fts` (GIN, full-text search)
- `idx_game_mappings_canonical_id`
- `idx_game_mappings_source`
- `idx_game_mappings_external_id`
- `idx_game_mappings_confidence`
- `idx_game_mappings_conflicts`
- `idx_player_mappings_canonical_id`
- `idx_player_mappings_source`
- `idx_player_mappings_external_id`
- `idx_player_mappings_external_name`
- `idx_player_mappings_confidence`
- `idx_player_mappings_conflicts`
- `idx_prop_mappings_canonical_game`
- `idx_prop_mappings_canonical_player`
- `idx_prop_mappings_source`
- `idx_prop_mappings_stat_type`
- `idx_prop_mappings_external_id`
- `idx_raw_props_canonical_game_id`
- `idx_raw_props_canonical_player_id`
- `idx_raw_props_canonical_entities`
- `idx_raw_props_auto_approved`

### Helper Functions Created

1. **`update_updated_at_column()`**
   - Trigger function for automatic timestamp updates

2. **`find_or_create_canonical_game(...)`**
   - Finds existing game or creates new canonical game entity
   - Returns `uuid` of canonical_games.id

3. **`find_or_create_canonical_player(...)`**
   - Finds existing player or creates new canonical player entity
   - Returns `uuid` of canonical_players.id

4. **`get_mapping_conflicts(...)`**
   - Returns table of mapping conflicts for operator review
   - Useful for data quality audits

---

**END OF RUNBOOK**

**Document Approval:**
✅ Engineering Lead
✅ Database Administrator
✅ DevOps Lead

**Version History:**
- v1.0 (2025-12-11): Initial release
