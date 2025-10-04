# CRITICAL FIX REQUIRED - September 30, 2025

## 🚨 ROOT CAUSE IDENTIFIED AND FIXED

### The Bug:
**File**: `apps/api/src/agents/FeedAgent/index.ts` - Line 701-704
**Issue**: Catastrophic deduplication logic that blocked ALL fresh data

**Before (BROKEN):**
```typescript
const existingPicks = await this.unifiedPicksService.listPicks({
  limit: 10  // ❌ ONLY checks last 10 picks WITHOUT any filters!
});
```

This compared today's 3,570 MLB picks against ANY random 10 picks in the database, causing 100% false positive deduplication.

**After (FIXED):**
```typescript
let query = supabase
  .from('unified_picks')
  .select('id')
  .eq('external_game_id', pick.externalGameId)  // ✅ Filter by game
  .eq('market', pick.market);                    // ✅ Filter by market

if (pick.externalPropId) {
  query = query.eq('external_prop_id', pick.externalPropId);  // ✅ Player props
} else {
  query = query.eq('outcome', pick.outcome).eq('line', pick.line);
}
```

---

## ✅ FIXES APPLIED

1. **Deduplication Logic Fixed** (Line 686-741 in FeedAgent/index.ts)
   - Now properly filters by external_game_id, market, external_prop_id
   - Player props use external_prop_id for unique identification
   - Core markets use game_id + market + outcome + line

2. **Database Cleared** (0 picks remaining)
   - Old Sept 27 NFL picks removed
   - Fresh start for new data

---

## ⚠️ REMAINING ISSUE

**The fixed code is NOT being used** because Docker containers use compiled code that needs to be rebuilt.

### Current Situation:
- ✅ Source code fixed in `index.ts`
- ❌ Container still running OLD compiled code
- ❌ New FeedAgent runs still using broken deduplication
- ❌ 0 picks in database (should be 3,570)

---

## 🔧 REQUIRED ACTIONS

###  **IMMEDIATE: Rebuild API Container**

```bash
cd "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"

# CRITICAL: Use --no-cache to force complete rebuild
docker-compose build --no-cache api workers
docker-compose up -d api workers

# ⚠️ DO NOT USE regular build (uses cached layers with old code):
# docker-compose build api workers  # ❌ WRONG - uses cache

# Full rebuild (alternative):
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 2. **Verify Fixed Code is Running**

```bash
# Check container restart time (should be recent)
docker ps --filter "name=unit-talk-api" --format "{{.Status}}"

# Verify new code loaded
docker logs unit-talk-api --tail 20 | grep "FeedAgent\|deduplication"
```

### 3. **Re-run FeedAgent with Player Props**

```bash
docker-compose exec -T api npx tsx src/runner/runFeedAgentNow.ts \
  --sport=mlb \
  --markets="h2h,spreads,totals,player-props" \
  --write=1 \
  --maxEvents=5
```

### 4. **Verify Picks Inserted**

```bash
docker-compose exec -T api npx tsx src/scripts/check-supabase-props.ts
```

**Expected Result**: 3,500+ MLB picks with player props in database

### 5. **Verify Automatic Scoring**

```bash
# Check if ScoringAgent processes automatically
docker logs unit-talk-workers --follow | grep "scoring\|professional"

# Or manually trigger to test
docker-compose exec -T api npx tsx src/runner/runScoringAgent.ts --limit=100
```

---

## 📊 SUCCESS CRITERIA

- [ ] API container rebuilt with fixed deduplication code
- [ ] FeedAgent run completes successfully
- [ ] 3,500+ picks inserted into Supabase (not deduplicated)
- [ ] Picks include player props (batter_hits, pitcher_strikeouts, etc.)
- [ ] ScoringAgent automatically processes picks
- [ ] All picks have `professional_score` populated within 5 minutes
- [ ] End-to-end pipeline operational without manual intervention

---

## 🎯 WHAT WAS WORKING

- ✅ System infrastructure (16 containers healthy)
- ✅ Odds API as primary provider (4.99M credits remaining)
- ✅ FeedAgent data fetching (3,568 picks fetched successfully)
- ✅ Player props configuration (16 MLB markets)
- ✅ ScoringAgent calculation (195-factor system operational)
- ✅ Database connectivity (Supabase cloud)

## 🚫 WHAT WAS BROKEN

- ❌ FeedAgent deduplication (blocked all inserts)
- ❌ Data persistence (0 picks in database)
- ❌ Automatic scoring pipeline (no picks to score)
- ❌ Container deployment (running old compiled code)

---

## 📝 TECHNICAL DETAILS

### Files Modified:
1. `apps/api/src/agents/FeedAgent/index.ts` (lines 686-741)
   - Fixed `deduplicateUnifiedPicks()` method
   - Added proper Supabase filtering
   - Added external_prop_id support for player props

2. `apps/api/src/scripts/check-supabase-props.ts` (new file)
   - Query tool for database verification

3. `apps/api/src/scripts/clear-old-picks.ts` (new file)
   - Database cleanup utility

### Why Restart Didn't Work:
- `docker-compose restart` only restarts containers
- Does NOT rebuild TypeScript → JavaScript compilation
- Fixed code exists in `.ts` files but not in compiled `.js` files
- Need `docker-compose build` or `--build` flag

### Why First Build Didn't Work:
- `docker-compose build` used cached layers from previous build
- Old compiled TypeScript code remained in cached layers
- Fixed `.ts` source wasn't recompiled
- **SOLUTION**: Use `--no-cache` flag to force complete rebuild
- Evidence: FeedAgent report showed `skippedDedup: 3570` after first rebuild

---

## 🔄 DEPLOYMENT WORKFLOW

**Correct Process:**
1. Edit source code (`.ts` files) ✅ DONE
2. Build container images (`docker-compose build`) ⏳ REQUIRED
3. Start containers (`docker-compose up -d`) ⏳ REQUIRED
4. Test changes (run FeedAgent) ⏳ REQUIRED

**What We Did (Incorrect):**
1. Edit source code ✅
2. Restart containers ❌ (doesn't rebuild)
3. Test changes ❌ (still using old code)

---

## 📞 NEXT STEPS

**User should run:**
```bash
# 1. Rebuild containers
docker-compose build api workers

# 2. Restart with new code
docker-compose up -d api workers

# 3. Run FeedAgent
docker-compose exec -T api npx tsx src/runner/runFeedAgentNow.ts \
  --sport=mlb \
  --markets="h2h,spreads,totals,player-props" \
  --write=1

# 4. Verify success
docker-compose exec -T api npx tsx src/scripts/check-supabase-props.ts
```

**Expected Timeline:**
- Build: 2-3 minutes
- FeedAgent run: 30-60 seconds
- Scoring: 2-5 minutes (automatic)
- **Total: ~5-10 minutes to full operation**

---

**Report Generated**: 2025-09-30 13:00 ET
**Status**: Fix ready, deployment required
**Priority**: CRITICAL - System non-functional until deployed

