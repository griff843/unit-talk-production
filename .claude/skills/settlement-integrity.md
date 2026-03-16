# Skill: Settlement Integrity

## Purpose

Audit prop_settlements against expected outcomes. Detect missing settlements,
double-settlements, and mismatches between settlement_result and actual
outcomes. Verify closing_snapshots completeness for the audit window.

## When to Use

- After a settlement batch run to verify correctness
- When pick win/loss counts look anomalous in analytics
- Before generating a performance report to ensure settlement data is clean
- When SettlementAgent health shows degraded status

## Invocation

```
/settlement-integrity [--window <days>] [--sport <nfl|nba|mlb|nhl>]
```

## Required Inputs

- Date window (default: last 7 days)
- Optionally: sport filter

## Procedure

### Step 1: Count Unsettled Picks Past Deadline

```sql
SELECT COUNT(*) FROM unified_picks
WHERE settlement_status = 'pending'
AND event_start_time < NOW() - INTERVAL '24 hours';
```

Any result > 0 is a settlement gap that needs investigation.

### Step 2: Check for Double-Settlements

```sql
SELECT pick_id, COUNT(*) as count
FROM prop_settlements
GROUP BY pick_id
HAVING COUNT(*) > 1;
```

Expected: empty result set.

### Step 3: Verify closing_snapshots Coverage

```sql
SELECT COUNT(*) as missing FROM unified_picks u
LEFT JOIN closing_snapshots cs ON cs.pick_id = u.id
WHERE u.settlement_status = 'settled'
AND cs.id IS NULL
AND u.created_at > NOW() - INTERVAL '<window> days';
```

Expected: 0. Any missing closing snapshots break the audit trail.

### Step 4: Sample Result Spot-Check

Pull 5 settled picks and verify `settlement_result` matches known outcome.

### Step 5: Report

```markdown
## Settlement Integrity Report — <date>

| Check                       | Result  | Status |
| --------------------------- | ------- | ------ |
| Unsettled past deadline     | X picks | ✅/❌  |
| Double-settlements          | X       | ✅/❌  |
| Missing closing_snapshots   | X       | ✅/❌  |
| Spot-check sample (5 picks) | X/5 ok  | ✅/❌  |

Status: ✅ CLEAN | ⚠️ GAPS FOUND | ❌ INTEGRITY BREACH
```

## Relevant Repo Paths

| Path                                           | Role                           |
| ---------------------------------------------- | ------------------------------ |
| `apps/api/src/agents/SettlementAgent/index.ts` | Settlement agent               |
| `apps/api/src/lib/lifecycle/idempotency.ts`    | atomicClaimForSettle           |
| `packages/mcp-state/src/tools/`                | MCP tool: get_settlement_state |
| `supabase/migrations/*closing_snapshots*`      | closing_snapshots schema       |

## Expected Output

- Settlement gap count
- Double-settlement count
- Missing closing_snapshots count
- Spot-check result
- Pass/warning/breach status
