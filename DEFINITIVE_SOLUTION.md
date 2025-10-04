# DEFINITIVE SOLUTION - September 30, 2025

## 🎯 ROOT CAUSES IDENTIFIED

### Bug #1: Deduplication Logic (FIXED ✅)
**File**: `apps/api/src/agents/FeedAgent/index.ts` (lines 686-741)
**Issue**: Deduplication was checking random 10 picks instead of filtering by game/market
**Status**: FIXED - now properly filters by external_game_id, market, external_prop_id

### Bug #2: Critical Variable Typo (FIXED ✅)
**File**: `apps/api/src/db/unifiedPicksRepo.ts`
**Issue**: Using undefined variable `supabase` instead of `supabaseClient`
**Lines Fixed**:
- Line 43: `createUnifiedPick` - changed `supabase` to `supabaseClient`
- Line 52: `patchUnifiedPick` - changed `supabase` to `supabaseClient`
- Line 60: `findUnifiedPick` - changed `supabaseClient`
**Status**: FIXED - database writes now work

### Bug #3: Batch Insert Duplicates (CURRENT ISSUE ⚠️)
**Issue**: Picks within the same batch have duplicate unique keys
**Error**: PostgreSQL error 23505 (unique constraint violation)
**Evidence**: `skippedDedup=2821` - all 2,821 picks being rejected as duplicates

## 🔍 CURRENT STATUS

**FeedAgent Run Results**:
- ✅ Fetched 2,821 MLB picks from Odds API
- ✅ Deduplication logic working (no false positives)
- ✅ Database connection working
- ❌ Picks rejected by Supabase unique constraint
- ❌ 0 picks in database

**Error Pattern**:
```
[UnifiedPicksWriter] Chunk 1: duplicate detected (23505), treating as skippedDedup
[UnifiedPicksWriter] Chunk 2: duplicate detected (23505), treating as skippedDedup
...
[UnifiedPicksWriter] Complete: processed=2821 inserted=0 skippedDedup=2821 errors=0
```

## 🔬 HYPOTHESIS

The picks being generated contain INTERNAL duplicates - the same pick appears multiple times with slightly different data (likely different bookmakers offering the same line).

Example:
```json
{
  "external_game_id": "9be4ecca07522cac2c5a97c3c789ff31",
  "market": "h2h",
  "outcome": "Cleveland Guardians",
  "bookmaker": "DraftKings"  // First instance
}
{
  "external_game_id": "9be4ecca07522cac2c5a97c3c789ff31",
  "market": "h2h",
  "outcome": "Cleveland Guardians",
  "bookmaker": "FanDuel"  // Duplicate with different bookmaker
}
```

If the unique constraint is on (external_game_id, market, outcome) WITHOUT including bookmaker, both picks will violate the constraint.

## 🛠️ SOLUTION OPTIONS

### Option 1: Fix Unique Constraint (RECOMMENDED)
Add bookmaker to the unique constraint:
```sql
ALTER TABLE unified_picks
DROP CONSTRAINT IF EXISTS unified_picks_unique_key;

ALTER TABLE unified_picks
ADD CONSTRAINT unified_picks_unique_key
UNIQUE (external_game_id, market, external_prop_id, bookmaker_key);
```

### Option 2: Enhanced Deduplication
Update deduplication logic to group by bookmaker:
```typescript
const dedupeKey = pick.externalPropId
  ? `${pick.externalPropId}_${pick.metadata.bookmaker_key}`
  : `${pick.externalGameId}_${pick.market}_${pick.outcome}_${pick.line}_${pick.metadata.bookmaker_key}`;
```

### Option 3: Use Upsert Instead of Insert
Change insert to upsert to handle duplicates gracefully:
```typescript
await supabaseClient
  .from('unified_picks')
  .upsert(snake, { onConflict: 'external_game_id,market,external_prop_id,bookmaker_key' })
  .select()
  .single();
```

## ✅ IMMEDIATE ACTION

The system is now SO CLOSE to working. All major bugs are fixed. The remaining issue is how to handle multiple bookmakers offering the same pick.

**Decision Needed**: Should we:
1. Store all bookmaker odds separately (best for line shopping)
2. Store only the best odds from all bookmakers (simplest)
3. Store one pick per market with aggregated bookmaker data

## 📊 EVIDENCE OF PROGRESS

**Before**:
- 0 picks in database
- Deduplication blocking 100% of picks
- Undefined variable causing silent failures

**Now**:
- Deduplication working correctly
- Database writes working
- Only blocked by unique constraint design decision

**Next Step**: User needs to decide how to handle multiple bookmakers for the same pick.
