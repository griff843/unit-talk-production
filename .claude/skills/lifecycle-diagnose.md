# Skill: Lifecycle Diagnose

## Purpose

Diagnose pick lifecycle pipeline health. Identify stuck picks, outbox backlogs,
orphaned bridge_outbox entries, and stale agent heartbeats. Provides a
structured snapshot of the current pipeline state.

## When to Use

- When picks are not appearing in Discord as expected
- When bridge_outbox depth is climbing
- When DiscordPromotionAgent health is degraded
- When `/api/health` shows a non-healthy status
- During incident response to understand which pipeline stage is blocked

## Invocation

```
/lifecycle-diagnose [--pick <id>] [--full]
```

Without arguments: platform-wide snapshot. `--pick <id>`: trace a single pick
through all lifecycle stages. `--full`: include closing_snapshots coverage
check.

## Procedure

### Step 1: Platform Health Snapshot

```bash
# Via mcp-ops: get_agent_health + get_ops_status
# Or: GET /api/health/summary
```

Check `platform_status` and any `slo_breaches`.

### Step 2: Outbox Depth

```bash
# Via mcp-state: get_outbox_depth
# Or direct:
SELECT status, COUNT(*) FROM bridge_outbox GROUP BY status;
SELECT status, COUNT(*) FROM publish_outbox GROUP BY status;
```

Alert thresholds: bridge_outbox pending > 20 = warning, > 100 = critical.

### Step 3: Stuck Picks

```sql
-- Submitted but not graded after 10 minutes
SELECT id, created_at, lifecycle_stage FROM unified_picks
WHERE lifecycle_stage = 'submitted'
AND created_at < NOW() - INTERVAL '10 minutes'
AND posted_to_discord = false;

-- Graded but not posted after 5 minutes
SELECT id, promotion_band, created_at FROM unified_picks
WHERE promotion_band IS NOT NULL
AND posted_to_discord = false
AND created_at < NOW() - INTERVAL '5 minutes';
```

### Step 4: Single Pick Trace (if --pick)

```sql
SELECT id, lifecycle_stage, promotion_band, posted_to_discord,
       promotion_posted_at, settlement_status, created_at
FROM unified_picks WHERE id = '<pick_id>';
```

Then check bridge_outbox and prop_settlements for same pick_id.

### Step 5: Worker Heartbeats

```sql
SELECT agent_name, status, last_heartbeat_at FROM agent_health
ORDER BY last_heartbeat_at DESC;
```

Stale threshold: heartbeat older than 2× the agent's interval (usually 60s →
stale after 120s).

### Step 6: Report

```markdown
## Lifecycle Diagnose — <timestamp>

Platform Status: HEALTHY | DEGRADED | CRITICAL

| Stage           | Stuck Count | Oldest (min) | Status |
| --------------- | ----------- | ------------ | ------ |
| Submitted→Grade | X           | X            | ✅/⚠️  |
| Graded→Posted   | X           | X            | ✅/⚠️  |
| Posted→Settled  | X           | X            | ✅/⚠️  |

Outbox Depth: bridge=X pending, publish=X pending

Stale Agents: <none | list>
```

## Relevant Repo Paths

| Path                                                 | Role                                             |
| ---------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/workers/BridgeWorker.ts`               | bridge_outbox processor                          |
| `apps/api/src/agents/DiscordPromotionAgent/index.ts` | posting agent                                    |
| `apps/api/src/routes/health.ts`                      | health endpoint                                  |
| `apps/api/src/services/agentHealthHeartbeat.ts`      | heartbeat service                                |
| `packages/mcp-ops/src/tools/`                        | MCP tools: get_agent_health, get_ops_status      |
| `packages/mcp-state/src/tools/`                      | MCP tools: get_outbox_depth, get_lifecycle_stage |

## Expected Output

- Platform health status
- Per-stage stuck pick counts
- Outbox depth (both queues)
- Stale agent heartbeat list
- For `--pick`: full lifecycle trace
