# 🚨 URGENT: SQL Migration NOT Applied

## Current Status
- ❌ **BLOCKER**: Old unique constraint still blocking all database writes
- ✅ **Code Fixes**: All 3 bugs fixed in codebase
- ❌ **Database**: SQL migration NOT successfully applied

## Evidence
FeedAgent run at 2025-09-30 22:39:46 shows:
```
[UnifiedPicksWriter] Chunk 1: duplicate detected (23505), treating as skippedDedup
[UnifiedPicksWriter] Chunk 2: duplicate detected (23505), treating as skippedDedup
[UnifiedPicksWriter] Complete: inserted=0 skippedDedup=2412
```

**Error 23505** = Unique constraint violation = Old constraint still active

## The Problem

The old unique constraint `idx_unified_picks_external_ids` is STILL active in Supabase:

```sql
-- This constraint is BLOCKING multiple bookmakers:
CREATE UNIQUE INDEX idx_unified_picks_external_ids
  ON public.unified_picks (external_game_id, external_prop_id);
```

This constraint does NOT include `bookmaker_key`, so when DraftKings inserts a pick, FanDuel's insert for the same prop gets rejected with error 23505.

## Required Action

### Step 1: Verify Current State

Go to Supabase SQL Editor and run the queries in `VERIFY_SQL_MIGRATION.sql`:

https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief/sql

This will show you:
1. All current indexes on unified_picks
2. Whether old constraint exists (SHOULD be dropped)
3. Whether new constraint exists (SHOULD exist)
4. Whether metadata column exists

### Step 2: Apply Migration

If verification shows old constraint still exists:

1. Go to Supabase SQL Editor
2. Copy the ENTIRE contents of `APPLY_THIS_SQL_TO_SUPABASE.sql`
3. Paste into SQL Editor
4. Click **Run** button
5. Wait for "Success. No rows returned" message
6. Run verification queries again to confirm

### Step 3: Test System

After SQL is confirmed applied, test FeedAgent:

```bash
docker-compose exec -T api npx tsx src/runner/runFeedAgentNow.ts \
  --sport=mlb \
  --markets="h2h,spreads,totals,player-props" \
  --write=1 \
  --maxEvents=5
```

**Expected Result**:
```
inserted=2400+ picks
skippedDedup=0 (first run)
errors=0
```

Then verify database:
```bash
docker-compose exec -T api npx tsx src/scripts/check-supabase-props.ts
```

**Expected Result**:
```
📊 Total picks in database: 2400+
📅 Picks for today: 2400+
```

## Why This Is Critical

Without multiple bookmakers per prop, the following features are IMPOSSIBLE:

1. **Devigging** ⚡ - Remove bookmaker vig to calculate true probabilities
2. **Line Shopping** 💰 - Find best available odds across books
3. **Sharp Detection** 📊 - Identify sharp vs public money
4. **CLV Tracking** 📈 - Track closing line value per bookmaker
5. **Market Efficiency** 🔍 - Analyze price discrepancies

**Currently**: System can only store 1 bookmaker per prop → Professional features broken
**After Fix**: System stores all 4 bookmakers per prop → Professional features operational

## Summary

All code bugs are fixed. The ONLY remaining blocker is applying the SQL migration in Supabase to drop the old unique constraint and create the new one that includes bookmaker_key.

This is a 30-second SQL execution that unblocks the entire professional betting platform.

---
**Created**: 2025-09-30 18:40 ET
**Blocker**: SQL migration not applied
**Time to Fix**: <1 minute
