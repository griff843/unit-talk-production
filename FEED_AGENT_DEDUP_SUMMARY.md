# FeedAgent Deduplication & Observability Summary

## ✅ Implementation Complete

All refinements have been successfully implemented for the FeedAgent core markets writer with proper deduplication, observability, and guardrails.

## 🎯 Key Features

### 1. **Deduplication with Upsert**
- Uses `upsert(..., { ignoreDuplicates: true, returning: 'minimal' })`
- Batch size: 500 rows per chunk (optimized from 200)
- Pre-filter query to check existing `promotion_fingerprint` values
- Duplicate key errors (23505) count as `skippedDedup`, NOT `errors`

### 2. **Observability Helper**
```typescript
summarizeWriteMetrics(metrics, eventsFetched?, processed?)
// Output: "processed=100 inserted=50 skippedDedup=40 errors=10 events=29"
```

### 3. **Enhanced Feed Report**
Every feed report now includes:
- `eventsFetched` - Number of events processed
- `marketsProcessed` - Breakdown by market type (h2h, spreads, totals)
- `writeMetrics` - Complete metrics with dedup counts
- `passReason` - Human-readable success/failure reason

Example pass reasons:
- `"Success: 58 picks inserted"`
- `"Success: 58 picks deduplicated (repeat run)"`
- `"Success: 25 inserted, 33 deduplicated"`
- `"Failure: 10 errors occurred"`

### 4. **Guardrails**
- Tracks consecutive zero-insert runs (when `attemptedWrites > 0 && inserted == 0 && skippedDedup == 0`)
- Warns after 3 consecutive runs: `⚠️ WARN: 3+ consecutive runs with 0 inserts/dedup. Potential stale data or transform mismatch.`
- Auto-resets counter on successful insert or dedup

### 5. **Unit Tests**
Location: `apps/api/test/unit/unifiedPicksWriter.test.ts`

8 tests covering:
- ✅ Metrics summarization with various inputs
- ✅ Dedup behavior (23505 → skippedDedup)
- ✅ Non-duplicate errors increment errors counter
- ✅ Guardrail warning on 3 consecutive failures
- ✅ Counter reset on success

All tests pass: `npm test -- unifiedPicksWriter`

## 📋 Configuration Defaults

Environment variables (already in `.env.example`):
```bash
FEED_PROVIDERS=odds-api
FEED_MARKETS=h2h,spreads,totals
FEED_REGIONS=us
FEED_BOOKMAKERS=draftkings,caesars,fanduel,betmgm
FEED_EVENT_BATCH_SIZE=20
FEED_EVENT_LOOKAHEAD_HOURS=48
FEED_DISABLE_SGO=1
```

## 🧪 Smoke Test Gating Rules

### PASS Conditions
- `inserted > 0` (new data written)
- `skippedDedup > 0 && errors == 0` (repeat run, all deduplicated)
- `processed > 0 && (inserted > 0 || skippedDedup > 0)` (feed processed data)

### FAIL Conditions
- `attemptedWrites > 0 && inserted == 0 && skippedDedup == 0 && errors > 0` (real errors)

### Output Messages
- ✅ Green: `"All 58 picks deduplicated (repeat run)"` when all picks are deduped with no errors
- 🔴 Red: `"RED WARNING: X writes attempted, 0 inserted, Y errors!"` only for non-duplicate errors

## 📊 DB Sanity Checks

### Recent rows (24h)
```sql
SELECT COUNT(*)
FROM public.unified_picks
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Dedup effectiveness (should return 0 rows)
```sql
SELECT promotion_fingerprint, COUNT(*) c
FROM public.unified_picks
GROUP BY 1
HAVING COUNT(*) > 1;
```

### Error rate
Rely on feed report metrics - DB shouldn't show constraint errors for duplicates.

## 🚀 Handy Run Commands

### One-off canary test
```bash
set REDIS_URL=
npx tsx apps/api/src/runner/runFeedAgentNow.ts \
  --mode=canary \
  --sport=nfl \
  --maxEvents=1 \
  --write=1 \
  --markets="h2h,spreads,totals" \
  --regions="us" \
  --bookmakers="draftkings" \
  --providers="odds-api"
```

### E2E smoke test
```bash
set REDIS_URL=
npx tsx apps/api/src/scripts/e2e/smoke.ts \
  --mode=canary \
  --sport=nfl
```

### Run unit tests
```bash
cd apps/api
npm test -- unifiedPicksWriter
```

## 📈 Observability Output

Example console output from a successful run:
```
✅ Core markets processing completed
📊 Events fetched: 29
📊 Markets processed: { h2h: 29, spreads: 0, totals: 0 }
📊 Core market writes: { attemptedWrites: 58, inserted: 0, skippedDedup: 58, errors: 0 }
📊 Summary: processed=29 inserted=0 skippedDedup=58 errors=0 events=29
✅ Pass reason: Success: 58 picks deduplicated (repeat run)
```

## 🎉 Test Results

### First Run (Fresh Data)
- `attemptedWrites: 58`
- `inserted: 58`
- `skippedDedup: 0`
- `errors: 0`
- Pass reason: `"Success: 58 picks inserted"`

### Second Run (Repeat/Dedup)
- `attemptedWrites: 58`
- `inserted: 0`
- `skippedDedup: 58`
- `errors: 0`
- Pass reason: `"Success: 58 picks deduplicated (repeat run)"`

### Smoke Test (All Markets)
- `attemptedWrites: 438`
- `inserted: 0`
- `skippedDedup: 438`
- `errors: 0`
- Status: ✅ PASSED
- Message: `"✅ All 438 picks deduplicated (repeat run)"`

## 🔒 Dedup Guarantee

The unique constraint `uq_unified_picks_fingerprint` on `promotion_fingerprint` column ensures:
1. No duplicate picks in the database
2. Upsert with `ignoreDuplicates: true` silently skips duplicates
3. Metrics accurately track: attempted, inserted, deduplicated, errors
4. Zero false-positive error counts

## 📝 Files Modified

1. `apps/api/src/services/unifiedPicksWriter.ts`
   - Added `summarizeWriteMetrics()` helper
   - Changed from `insert` to `upsert` with `ignoreDuplicates`
   - Increased batch size to 500
   - Added guardrails for stale data detection
   - Enhanced metrics tracking

2. `apps/api/src/runner/runFeedAgentNow.ts`
   - Added observability summary output
   - Enhanced report with `passReason` field
   - Includes `eventsFetched` and `marketsProcessed` in all reports

3. `apps/api/src/scripts/e2e/smoke.ts`
   - Updated PASS logic to support dedup
   - Green success message for dedup runs
   - RED WARNING only for real errors

4. `apps/api/test/unit/unifiedPicksWriter.test.ts`
   - 8 comprehensive unit tests
   - Documents expected behavior
   - All tests passing

5. `.env.example`
   - All feed config defaults already present

---

**Status**: ✅ All refinements complete and tested
**Test Coverage**: 8/8 tests passing
**Integration**: ✅ Verified with live Supabase cloud instance
**Documentation**: ✅ Complete with examples and commands