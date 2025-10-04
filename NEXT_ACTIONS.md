# ✅ Smoke Test Passed - Next Actions

**Status**: DB workflow end-to-end verified ✓
**Prop tested**: `adeeada1-91f1-49dc-a95f-e5ff22c6af84`
**Queue entry**: `1e0a4ca8-7905-4485-abec-ef41005d424e`
**Result**: Approved with publish_at timestamp

---

## 2️⃣ Wire App to New Read Models

### Command Center (`apps/command-center`)

Replace hand-rolled queries with views:

```typescript
// OLD: Complex joins
const picks = await supabase
  .from('unified_picks')
  .select('*, scored_props(*), promotion_queue(*)')
  .gte('game_date', today)
  ...

// NEW: Simple view query
const { data: picks } = await supabase
  .from('v_daily_board')
  .select('*')
  .order('tier', { ascending: true, nullsFirst: false })
  .order('edge', { ascending: false, nullsFirst: false })
  .limit(50);
```

### API Public Feed (`apps/api/src/api-server.ts`)

```typescript
// Endpoint: GET /api/props
router.get('/props', async (req, res) => {
  const { sport, tier, limit = 20 } = req.query;

  let query = supabase
    .from('v_prop_read_model')
    .select('*');

  if (sport) query = query.eq('sport', sport);
  if (tier) query = query.eq('tier', tier);

  const { data } = await query
    .order('edge', { ascending: false, nullsFirst: false })
    .limit(limit);

  res.json(data);
});
```

### Pending Approvals View

```typescript
// Endpoint: GET /api/approvals/pending
const { data: pending } = await supabase
  .from('v_open_promotions')
  .select('*')
  .order('created_at', { ascending: false });
```

### Approval Actions (Use RPCs)

```typescript
// Submit for approval
const { data: queueId } = await supabase.rpc('submit_pick', {
  p_unified_pick_id: propId,
  p_reason: 'High edge S-tier pick',
  p_org_id: null
});

// Approve
await supabase.rpc('approve_pick', {
  p_queue_id: queueId,
  p_approved_by: userId,
  p_reason: 'Verified metrics'
});

// Deny
await supabase.rpc('deny_pick', {
  p_queue_id: queueId,
  p_denied_by: userId,
  p_reason: 'Line moved'
});
```

---

## 3️⃣ Make Scoring Live

### Scoring Agent Writer (`apps/api/src/agents/ScoringAgent`)

```typescript
// apps/api/src/agents/ScoringAgent/index.ts

async function writeScores(picks: ScoredPick[]) {
  const rows = picks.map(p => ({
    prop_ref: p.unified_id,           // UUID from unified_picks.id
    edge: p.edge,
    prob_win: p.probability,
    professional_score: p.pscore,
    tier: p.tier,                     // 'S', 'A', 'B', 'C'
    confidence: p.confidence,
    kelly_fraction: p.kelly,
    clv_pct: p.clv,
  }));

  const { error } = await supabase
    .from('scored_props')
    .upsert(rows, { onConflict: 'prop_ref' });

  if (error) {
    logger.error('Failed to write scores:', error);
    throw error;
  }

  logger.info(\`Wrote \${rows.length} scores to scored_props\`);
}
```

**Key changes:**
- ✅ Write to `scored_props` table (not `unified_picks`)
- ✅ Always include all 7 scoring columns
- ✅ Use `prop_ref` as foreign key to `unified_picks.id`
- ✅ Views automatically join scoring data

---

## 4️⃣ E2E Test (Full Day's Slate)

```bash
# In Docker API container
docker-compose exec api bash

# Run comprehensive E2E
npx tsx apps/api/src/scripts/e2e/everything.ts \
  --sports=mlb,nfl,nba,nhl \
  --markets=h2h,spreads,totals,player_props \
  --bookmakers=dk,fd,betmgm,caesars \
  --lookahead=72h \
  --batch=20

# Check results
ls -lh apps/api/out/ops/agents/
cat apps/api/out/ops/E2E_AUDIT_*.md
```

**Expected artifacts:**
- `feedagent-*.json` - Ingested props with external IDs
- `scoringagent-*.json` - Scored props with tiers
- `E2E_AUDIT_*.md` - Summary with pass/fail gates
- `ACCEPTANCE_GATES_SUMMARY.md` - Updated status

---

## 5️⃣ Add Lightweight Safeguards

### Performance Indexes (optional but recommended)

```sql
-- Paste in Supabase SQL Editor

-- Faster S/A/B tier queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scored_props_tier_edge_partial
  ON public.scored_props(tier, edge DESC)
  WHERE tier IN ('S','A','B');

-- Recent board audit helper
CREATE OR REPLACE VIEW public.v_daily_board_recent AS
SELECT * FROM public.v_daily_board
WHERE game_date >= CURRENT_DATE - INTERVAL '1 day';
```

### Board Sanity Check (60-second cron)

```typescript
// apps/api/src/services/boardSanity.ts

export async function boardSanityCheck() {
  const { data, error } = await supabase
    .from('v_daily_board')
    .select('prop_id', { count: 'exact', head: true })
    .eq('game_date', new Date().toISOString().split('T')[0]);

  const count = data?.length || 0;

  await supabase.from('agent_health').insert({
    agent_name: 'board_sanity',
    status: count > 0 ? 'healthy' : 'warning',
    metadata: { board_count: count, check_time: new Date().toISOString() }
  });

  return count;
}
```

---

## 6️⃣ Monitoring Setup

### Supabase Dashboard Queries

Save these in Supabase > SQL > Saved Queries:

```sql
-- Active connections
SELECT * FROM pg_stat_activity
WHERE usename LIKE 'service_role%';

-- Board health today
SELECT
  COUNT(*) as total_picks,
  COUNT(DISTINCT sport) as sports_count,
  COUNT(CASE WHEN tier IN ('S','A') THEN 1 END) as premium_picks,
  MIN(edge) as min_edge,
  MAX(edge) as max_edge
FROM public.v_daily_board
WHERE game_date = CURRENT_DATE;

-- Promotion queue status
SELECT status, COUNT(*)
FROM public.promotion_queue
GROUP BY status;
```

### Add Temporal/Cron Jobs

```yaml
# docker-compose.yml or Temporal workflow

schedules:
  - name: feed-and-score
    schedule: "*/1 * * * *"  # Every 60 seconds
    workflow: FeedAgent → ScoringAgent

  - name: board-sanity
    schedule: "0 * * * *"    # Every hour
    workflow: BoardSanityCheck
```

---

## 7️⃣ Permissions Sanity

**Server/API (service_role):**
- ✅ Bypasses RLS
- ✅ Full read/write to `scored_props`, `promotion_queue`, `unified_picks`

**Client/Frontend (anon key):**
- ✅ Read-only access to views
- ✅ RLS enabled on tables
- ✅ Cannot directly insert/update tables

**Verification:**

```typescript
// Confirm using service_role in server
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ← Must be service role
);
```

---

## Quick Verification Commands

```sql
-- Counts
SELECT COUNT(*) AS board_rows FROM public.v_daily_board;
SELECT COUNT(*) AS api_rows FROM public.v_prop_read_model;
SELECT COUNT(*) AS pending_rows FROM public.v_open_promotions;

-- Table schemas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('scored_props','promotion_queue')
ORDER BY table_name, ordinal_position;

-- RPCs exist
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND proname IN ('submit_pick','approve_pick','deny_pick')
ORDER BY proname;

-- Top 20 candidates for Command Center
SELECT prop_id, sport, market, selection, line, odds, tier, edge, confidence
FROM public.v_daily_board
ORDER BY
  CASE tier WHEN 'S' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 9 END,
  edge DESC NULLS LAST
LIMIT 20;
```

---

## TL;DR Execution Order

1. ✅ **DB core done** (tables, views, RPCs, smoke test passed)
2. **Wire app reads** → Replace queries with views (Command Center, API feed)
3. **Wire scoring writes** → Upsert to `scored_props` table
4. **Run E2E** → Full 4-sport slate with artifact validation
5. **Add safeguards** → Performance indexes + board sanity cron
6. **Monitor** → Supabase queries + health checks every 60s
7. **Iterate** → Fix gates that fail, re-run specific stages

---

**Ready to proceed?** Start with step 2 (wire app to views) or run E2E test first to validate full pipeline.
