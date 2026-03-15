# Skill: Pipeline Health

## Purpose

Get a complete platform health snapshot in a single pass: agent heartbeat
summary, bridge_outbox queue depth, SLO attainment, and overall platform status.
Use this as the **first diagnostic** when anything in the pick pipeline looks
wrong.

## When to Use

- Picks are not appearing in Discord as expected
- On-call: initial triage before diving into agent-level detail
- Routine health check before or after a high-volume posting window
- When `GET /api/health/summary` returns DEGRADED or CRITICAL
- Before executing any operator workflow that touches live data

## Invocation

```
/pipeline-health
```

No arguments required. All data is fetched via MCP from live Supabase + API.

## Procedure

### Step 1: Combined Pipeline Status

Call `get_pipeline_status` (unit-talk-ops):

```
Tool: get_pipeline_status
Input: {}
```

Key fields in response:

| Field                           | Meaning                                           |
| ------------------------------- | ------------------------------------------------- |
| `agents.total`                  | Total agents tracked in `agent_health`            |
| `agents.healthy`                | Heartbeat within threshold (default 5 min)        |
| `agents.stale`                  | Heartbeat older than threshold                    |
| `agents.missing`                | Never reported or inactive                        |
| `outbox.pending`                | bridge_outbox records not yet picked up           |
| `outbox.failed`                 | bridge_outbox records that errored                |
| `outbox.oldest_pending_minutes` | Age of oldest pending record (null = queue empty) |
| `outbox.stale_alert`            | `true` when picks are backed up or stalled        |
| `queried_at`                    | Timestamp of this snapshot                        |

**Alert thresholds:**

- `outbox.pending > 20` → warning
- `outbox.pending > 100` → critical
- `agents.stale > 0` → investigate heartbeat
- `agents.missing > 0` → agent may be down

### Step 2: Platform Health Summary

Call `get_platform_health` (unit-talk-ops):

```
Tool: get_platform_health
Input: {}
```

Key fields:

| Field              | Meaning                                              |
| ------------------ | ---------------------------------------------------- |
| `platform_status`  | `HEALTHY` \| `DEGRADED` \| `CRITICAL`                |
| `subsystems[]`     | Per-subsystem `status`: `UP` \| `DEGRADED` \| `DOWN` |
| `slo_breaches`     | Count of SLOs currently in BREACH                    |
| `slo_warns`        | Count of SLOs in WARN state                          |
| `alert_count`      | Total active alerts                                  |
| `high_alert_count` | High-severity alerts                                 |
| `autopilot_mode`   | Current autopilot setting                            |

Focus on any `subsystems` with `status !== 'UP'` and report their `notes`.

### Step 3: SLO Attainment (requires OPERATOR_TOKEN)

Call `get_slo_status` (unit-talk-ops):

```
Tool: get_slo_status
Input: {}
```

Key fields:

| Field               | Meaning                        |
| ------------------- | ------------------------------ |
| `window_days`       | Attainment window (7d default) |
| `slos[].name`       | SLO name                       |
| `slos[].target`     | Target attainment (0–1)        |
| `slos[].attainment` | Actual attainment (0–1)        |
| `slos[].status`     | `OK` \| `WARN` \| `BREACH`     |
| `breach_count`      | Number of breaching SLOs       |
| `warn_count`        | Number of warning SLOs         |

If OPERATOR_TOKEN is not set, skip this step and note it.

### Step 4: Report

Synthesize a single status block:

```markdown
## Pipeline Health — <queried_at>

**Platform**: HEALTHY | DEGRADED | CRITICAL **Autopilot**: <autopilot_mode>

### Agents

- Total: X | Healthy: X | Stale: X | Missing: X

### Outbox (bridge_outbox)

- Pending: X | Failed: X | Oldest pending: X min | Stale alert: yes/no

### Subsystems

| Subsystem | Status           | Notes   |
| --------- | ---------------- | ------- |
| <name>    | UP/DEGRADED/DOWN | <notes> |

### SLOs (<window_days>d window)

| SLO         | Target   | Actual | Status         |
| ----------- | -------- | ------ | -------------- |
| <name>      | X%       | X%     | OK/WARN/BREACH |
| Breaches: X | Warns: X |

### Verdict

✅ HEALTHY — no action required ⚠️ DEGRADED — <specific issue to investigate> ❌
CRITICAL — <escalate immediately>
```

## Decision Tree

| Condition                    | Next Step                                         |
| ---------------------------- | ------------------------------------------------- |
| `agents.stale > 0`           | Run `get_agent_health` for full heartbeat detail  |
| `outbox.stale_alert = true`  | Check BridgeWorker logs; consider replay workflow |
| `slo_breaches > 0`           | Run `/slo-report` for full SLO breakdown          |
| Any subsystem `DOWN`         | Check agent logs for that subsystem               |
| `platform_status = CRITICAL` | Page on-call; do not run operator workflows       |

## Relevant Repo Paths

| Path                                  | Role                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| `packages/mcp-ops/src/tools/index.ts` | `get_pipeline_status`, `get_platform_health`, `get_slo_status` |
| `apps/api/src/routes/health.ts`       | `GET /api/health/summary` (backing endpoint)                   |
| `apps/api/src/routes/slo.ts`          | `GET /api/slo/status` (backing endpoint)                       |
| `apps/api/src/lib/workflow-registry/` | Operator workflows for remediation                             |
| `docs/ops/ON_CALL_RUNBOOK.md`         | Incident response scenarios                                    |

## Expected Output

- One-screen platform health snapshot
- Agent heartbeat counts
- Outbox queue depth with stale alert flag
- Per-SLO attainment table (if OPERATOR_TOKEN available)
- Verdict and next-step recommendation
