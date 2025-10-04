# Recommended Settlement Approach - Using Our System

**Problem**: Your Bash script assumes wrong schema. We already have settlement code - it just stalled.

---

## Our Actual System (What Exists)

### Tables
```
raw_props (1.4M rows)
├── id, sport, player_name, stat_type, line, game_date, odds
└── Source: Odds API ingestion

player_stats (135K rows)
├── id, sport, player_name, game_date, team, season
├── stats (JSONB): {"passingYards": 270, "passingTDs": 2, ...}
└── Source: MLB Stats API, ESPN API

settled_outcomes (1.8K rows) ❌ Should be 1.2M+
├── prop_id, result, actual_value, settled_at
└── Source: PropsSettlementEngine
```

### Settlement Code (Already Built)
```
apps/api/src/services/data-collection/PropsSettlementEngine.ts
└── settlePropsByDate(sport, date)
    ├── Fetches raw_props for date
    ├── Fetches player_stats for date
    ├── Matches props to stats via JSONB
    ├── Inserts into settled_outcomes
    └── Returns {settled, skipped}

apps/api/src/scripts/ml/settle-optimized.ts
└── Batched, parallelized wrapper
    ├── 10 workers processing date ranges
    ├── In-memory deduplication
    ├── Bulk inserts (1000/batch)
    └── Should process 1.4M in 3-4 hours
```

---

## What Went Wrong

### Settlement Ran But Stalled at 0.1%

**Evidence**:
- Started with 1,871 props settled
- Ran optimized script with 10 workers
- Completed but didn't add any new settlements
- Likely reasons:
  1. **Date mismatch** - Props from dates we don't have stats for
  2. **Process crash** - Workers died silently
  3. **Logic bug** - Skipping valid props

---

## Recommended Fix (Use Our Code, Not Bash)

### Step 1: Diagnose (5 min)

```typescript
// Check date overlap
const { data: propDates } = await supabase
  .from('raw_props')
  .select('game_date')
  .eq('sport', 'MLB')
  .order('game_date')
  .limit(1);

const { data: statDates } = await supabase
  .from('player_stats')
  .select('game_date')
  .eq('sport', 'MLB')
  .order('game_date')
  .limit(1);

// If dates don't overlap → we need more stats
// If dates overlap → settlement logic issue
```

### Step 2: Fix Settlement Script (10 min)

**Option A: Date Range Issue**
```typescript
// Current (wrong):
await engine.processDateRange('MLB', '2024-04-01', '2024-10-15', 10);

// Fix: Use actual prop date range
const { data } = await supabase
  .from('raw_props')
  .select('game_date')
  .eq('sport', 'MLB');

const dates = data.map(p => p.game_date);
const minDate = Math.min(...dates);
const maxDate = Math.max(...dates);

await engine.processDateRange('MLB', minDate, maxDate, 10);
```

**Option B: Worker Crash**
```typescript
// Add error handling in settle-optimized.ts
async processDateChunk(sport, dates, workerId) {
  for (const date of dates) {
    try {
      await this.settleDateMLB(date);
    } catch (error) {
      console.error(`Worker ${workerId} failed on ${date}:`, error);
      // Continue to next date instead of crashing
    }
  }
}
```

**Option C: Skipping Valid Props**
```typescript
// Current logic might be too strict
// Check PropsSettlementEngine.ts line 170-200

// If skipping due to null stat_type:
const marketType = (prop.stat_type || prop.market_type || '').toLowerCase();
// Change to:
const marketType = prop.stat_type?.toLowerCase()
  || prop.market_type?.toLowerCase()
  || this.inferMarketType(prop.description); // Add inference
```

### Step 3: Run Fixed Settlement (2-4 hours)

```bash
# Simple restart with better logging
cd apps/api
npx tsx src/scripts/ml/settle-optimized-v2.ts 2>&1 | tee settlement.log

# Monitor progress
watch -n 30 'curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/settled_outcomes?select=count" | jq'
```

### Step 4: Backtest (30 min)

```typescript
// apps/api/src/scripts/ml/backtest-v0.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(/*...*/);

async function runBacktest() {
  // Get all settled props with results
  const { data: settledProps } = await supabase
    .from('settled_outcomes')
    .select(`
      result,
      raw_props!inner(odds, professional_score, tier)
    `)
    .not('result', 'is', null);

  // Calculate win rate
  const wins = settledProps.filter(p => p.result === 'win').length;
  const losses = settledProps.filter(p => p.result === 'loss').length;
  const pushes = settledProps.filter(p => p.result === 'push').length;

  const winRate = wins / (wins + losses);

  // Calculate ROI
  let totalProfit = 0;
  for (const prop of settledProps) {
    const odds = prop.raw_props.odds;
    if (prop.result === 'win') {
      totalProfit += odds > 0 ? odds / 100 : 100 / Math.abs(odds);
    } else if (prop.result === 'loss') {
      totalProfit -= 1;
    }
  }

  const roi = (totalProfit / settledProps.length) * 100;

  // By tier
  const tierStats = {};
  for (const tier of ['S', 'A', 'B', 'C', 'D']) {
    const tierProps = settledProps.filter(p => p.raw_props.tier === tier);
    const tierWins = tierProps.filter(p => p.result === 'win').length;
    const tierLosses = tierProps.filter(p => p.result === 'loss').length;
    tierStats[tier] = {
      count: tierProps.length,
      winRate: tierWins / (tierWins + tierLosses),
    };
  }

  return {
    overall: { wins, losses, pushes, winRate, roi },
    byTier: tierStats
  };
}
```

---

## Why NOT Use the Bash Approach

### 1. Schema Mismatch
```bash
# Bash assumes:
curl "${BASE}/unified_picks?result=is.null"

# Reality:
# - Props are in raw_props (not unified_picks)
# - Results go to settled_outcomes (separate table)
# - unified_picks is for APPROVED picks, not raw props
```

### 2. Stats Structure Wrong
```bash
# Bash assumes:
actual=$(echo "$stat" | jq '.hits')

# Reality (JSONB):
actual=$(echo "$stat" | jq '.stats.hits')
# or
actual=$(echo "$stat" | jq '.stats.passingYards')
```

### 3. Reinventing the Wheel
```typescript
// We already built this in PropsSettlementEngine.ts:
async settlePropsByDate(sport: string, date: string) {
  const props = await this.getUnsettledProps(sport, date);
  const stats = await this.getPlayerStats(sport, date);

  for (const prop of props) {
    const stat = this.findMatchingStat(prop, stats);
    if (stat) {
      const result = this.determineOutcome(prop, stat);
      await this.saveSettlement(prop.id, result);
    }
  }
}
```

---

## MCP Tools We Should Use

### For Settlement
**mcp__filesystem** tools:
- Read existing settlement scripts
- Edit to fix bugs
- Write new backtest script

**Built-in Bash**:
- Run TypeScript settlement scripts
- Monitor progress
- Check Supabase counts

**NO external settlement Bash** - We have TypeScript code that works!

### For Analysis
**mcp__sequential-thinking**:
- Analyze why settlement stalled
- Plan backtest strategy
- Optimize factor weights

**mcp__byterover-mcp**:
- Store learnings about settlement patterns
- Retrieve similar debugging sessions

---

## Recommended Path Forward

### Today (Next 4 Hours)

**DO**:
1. ✅ Read `settle-optimized.ts` - understand what ran
2. ✅ Check logs/errors - why did it settle only 1,871?
3. ✅ Fix date range or error handling
4. ✅ Re-run settlement with fixes
5. ✅ Monitor until 90%+ settled
6. ✅ Run backtest TypeScript script

**DON'T**:
- ❌ Write new Bash settlement from scratch
- ❌ Modify database schema (it's fine)
- ❌ Patch unified_picks directly (wrong table)

### This Week

1. Get settlement to 90%+ (1.2M+ props)
2. Run backtest, get real win rate
3. If win rate > 54%, celebrate!
4. If win rate < 54%, tune factor weights
5. Start tracking line movements for CLV validation

---

## Bottom Line

**Your Bash approach**: Would work but requires rewriting everything to match our schema.

**Better approach**: Debug and fix our existing TypeScript settlement code that already understands our schema.

**Time comparison**:
- Bash from scratch: 2-4 hours to write + debug schema mismatches
- Fix TypeScript: 30 min to find bug + 3 hours to re-run

**I recommend**: Fix the existing TypeScript settlement, not start over in Bash.

Want me to debug `settle-optimized.ts` and get it working?
