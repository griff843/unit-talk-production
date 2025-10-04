Due to length constraints, I'll create a comprehensive but concise version. Here's the file:

```markdown
# Read-Models Wiring Guide

Complete guide for integrating with the new database read-models (views) and approval workflow.

---

## Quick Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Data Adapter | `apps/command-center/src/data/ccDataAdapter.ts` | Read from views, write via RPCs |
| Schedulers | `apps/api/src/scripts/schedulers/liveLoops.ts` | Continuous feed/scoring/promotion |
| Verification | `apps/api/src/scripts/verify/verifyCommandCenter.ts` | Health checks |

---

## Database Views

### v_daily_board
**Purpose**: Today's picks dashboard (game_date >= current_date)
**Columns**: prop_id, sport, market, selection, line, odds, game_date, player_name, edge, prob_win, professional_score, tier, confidence, kelly_fraction, clv_pct, queue_status, publish_at, approved_by, denied_by, reason

**Query**:
```typescript
const picks = await ccAdapter.fetchBoard({
  status: 'pending',  // or 'approved', 'rejected', null
  limit: 100,
  sport: 'NFL',  // optional
  tier: 'A'      // optional
});
```

### v_prop_read_model
**Purpose**: All picks with scoring data
**Usage**: ScoringAgent reads from this view to find props needing scores

### v_open_promotions
**Purpose**: Pending approval queue
**Filters**: status='pending' only

---

## RPCs (Remote Procedure Calls)

### submit_pick
**Signature**: `submit_pick(p_unified_pick_id UUID, p_reason TEXT, p_org_id UUID DEFAULT NULL) RETURNS UUID`
**Returns**: queue_id

```typescript
const queueId = await ccAdapter.submit(propId, 'Operator submission', orgId);
```

### approve_pick
**Signature**: `approve_pick(p_queue_id UUID, p_approved_by UUID, p_reason TEXT DEFAULT NULL) RETURNS VOID`

```typescript
await ccAdapter.approve(queueId, actorId, 'Quality check passed');
```

### deny_pick
**Signature**: `deny_pick(p_queue_id UUID, p_denied_by UUID, p_reason TEXT DEFAULT NULL) RETURNS VOID`

```typescript
await ccAdapter.deny(queueId, actorId, 'Insufficient edge');
```

---

## Command Center Integration

### Using the Adapter

```typescript
import { CCDataAdapter, useCommandCenterBoard } from '@/data/ccDataAdapter';

// In your component
function PickApprovalGrid() {
  const { picks, loading, error, refresh } = useCommandCenterBoard({
    status: 'pending',
    limit: 50
  });

  const handleApprove = async (pick: BoardPick) => {
    await ccAdapter.approve(pick.queue_id!, ACTOR_ID, 'Approved by operator');
    toast.success('Pick approved');
    refresh();
  };

  return (
    <div>
      {picks.map(pick => (
        <PickCard key={pick.prop_id} pick={pick} onApprove={handleApprove} />
      ))}
    </div>
  );
}
```

### Real-Time Subscriptions

```typescript
useEffect(() => {
  const unsubscribe = ccAdapter.subscribeToBoard(
    (payload) => {
      console.log('Board changed:', payload);
      refresh();
    },
    { status: 'pending' }
  );

  return unsubscribe;
}, []);
```

---

## Schedulers

### Starting Schedulers

```bash
# Development
npm run start:schedulers

# Production (via PM2 or systemd)
pm2 start apps/api/src/scripts/schedulers/liveLoops.ts --name schedulers
```

### Scheduler Loops

| Loop | Interval | Purpose |
|------|----------|---------|
| FeedLoop | 45s | Ingest today+48h props |
| ScoringLoop | 30s | Update scored_props for today |
| PromotionLoop | 30s | Fix missing publish_at timestamps |

### Artifacts

Schedulers write to `apps/api/out/ops/schedulers/`:
- `feedloop-<RUNID>.json`
- `scoringloop-<RUNID>.json`
- `promotionloop-<RUNID>.json`

---

## Verification

### Command Center Health Check

```bash
npx tsx apps/api/src/scripts/verify/verifyCommandCenter.ts
```

**Checks**:
1. v_daily_board has rows (today+)
2. v_prop_read_model has rows (today+)
3. scored_props has recent updates (last 2h)
4. promotion_queue has approved picks

**Output**: `apps/api/out/ops/verify/VERIFY_CC_<timestamp>.json`

---

## Rollback / Troubleshooting

### Disable Views (Use Legacy Queries)

```bash
# Set environment variable
export USE_VIEWS=0

# Restart services
pm2 restart all
```

### Manual View Refresh

```sql
-- If views show stale data (shouldn't happen with real-time)
REFRESH MATERIALIZED VIEW IF EXISTS v_daily_board;  -- Not materialized, instant
```

### Check RPC Availability

```sql
SELECT proname, pronargs FROM pg_proc WHERE proname IN ('submit_pick', 'approve_pick', 'deny_pick');
```

Should return 3 rows.

---

## Column Mapping

| View Column | Type | Nullable | Source |
|-------------|------|----------|--------|
| prop_id | UUID | NO | unified_picks.id |
| edge | NUMERIC | YES | scored_props.edge |
| queue_status | TEXT | YES | promotion_queue.status |
| publish_at | TIMESTAMPTZ | YES | promotion_queue.publish_at |

---

## Performance Notes

- Views are **not materialized** - they query live data instantly
- Indexes exist on scored_props(tier, edge) for fast filtering
- promotion_queue indexed on (status, created_at)
- Real-time subscriptions use Supabase realtime (no polling needed)

---

## Developer Workflow

1. **Read picks**: Use `ccAdapter.fetchBoard()`
2. **Display in UI**: Map to your grid/table component
3. **Approve/Deny**: Call `ccAdapter.approve()` or `ccAdapter.deny()`
4. **Refresh UI**: Either call `refresh()` or rely on subscriptions
5. **Monitor health**: Run verification script periodically

---

**Last Updated**: 2025-10-04
**Owner**: Platform Engineering

