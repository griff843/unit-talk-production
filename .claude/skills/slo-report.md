# Skill: SLO Report

## Purpose

Generate a focused SLO attainment report: per-SLO status, breach/warn counts,
and platform health context. Use this to understand whether the platform is
meeting its service level objectives and which SLOs need remediation.

## When to Use

- Weekly or daily SLO review
- After an incident to assess SLO impact
- When `get_platform_health` reports `slo_breaches > 0`
- Before planning a remediation sprint
- When the on-call runbook asks "what SLOs are affected?"

## Invocation

```
/slo-report [--context]
```

`--context`: also runs `get_platform_health` to correlate SLO state with
subsystem health. Recommended for incident response.

**Requires**: `OPERATOR_TOKEN` env var set in `unit-talk-ops` MCP server. If
OPERATOR_TOKEN is missing, `get_slo_status` will return an auth error.

## Procedure

### Step 1: SLO Attainment (requires OPERATOR_TOKEN)

Call `get_slo_status` (unit-talk-ops):

```
Tool: get_slo_status
Input: {}
```

Key fields:

| Field               | Meaning                                |
| ------------------- | -------------------------------------- |
| `window_days`       | Attainment window in days (default: 7) |
| `computed_at`       | Timestamp                              |
| `slos[].id`         | SLO identifier                         |
| `slos[].name`       | Human-readable SLO name                |
| `slos[].target`     | Target attainment (0.0–1.0)            |
| `slos[].attainment` | Actual attainment (0.0–1.0)            |
| `slos[].status`     | `OK` \| `WARN` \| `BREACH`             |
| `slos[].unit`       | Unit label (e.g. `%`, `ms`)            |
| `breach_count`      | Number of SLOs in BREACH               |
| `warn_count`        | Number of SLOs in WARN                 |

**Canonical SLOs** (from `docs/ops/SLO_DEFINITIONS.md`):

| SLO                   | Target                            |
| --------------------- | --------------------------------- |
| lifecycle_attainment  | 95% picks reach POSTED within SLA |
| discord_posting       | 98% successful Discord deliveries |
| grading_latency_p50   | p50 grading latency < 300s        |
| settlement_attainment | 99.5% picks settled correctly     |

### Step 2: Platform Health Context (if `--context`)

Call `get_platform_health` (unit-talk-ops):

```
Tool: get_platform_health
Input: {}
```

Use `platform_status`, `slo_breaches`, `slo_warns`, and `subsystems[]` to
correlate: which subsystem health issues are driving SLO degradation?

### Step 3: Compute Attainment Gap

For each SLO with `status !== 'OK'`:

```
gap = target - attainment
gap_pct = gap * 100
```

A gap > 5% (relative to target) warrants a dedicated investigation or sprint.

### Step 4: Report

```markdown
## SLO Report — <window_days>d window ending <computed_at>

**Platform Status**: HEALTHY | DEGRADED | CRITICAL (from get_platform_health)

### SLO Attainment

| SLO                   | Target | Actual | Gap   | Status         |
| --------------------- | ------ | ------ | ----- | -------------- |
| lifecycle_attainment  | 95.0%  | X.X%   | -X.X% | OK/WARN/BREACH |
| discord_posting       | 98.0%  | X.X%   | -X.X% | OK/WARN/BREACH |
| grading_latency_p50   | —      | Xms    | —     | OK/WARN/BREACH |
| settlement_attainment | 99.5%  | X.X%   | -X.X% | OK/WARN/BREACH |

**Summary**: X breach(es), X warn(s)

### Subsystem Correlation (if --context)

| Subsystem | Health Status | SLO Impact |
| --------- | ------------- | ---------- |
| <name>    | UP/DEGRADED   | <inferred> |

### Verdict

✅ ALL SLOs OK — no action required ⚠️ WARN — monitor <SLO name>; consider
investigation sprint if sustained ❌ BREACH — escalate <SLO name>; check on-call
runbook Scenario <N>
```

## Remediation References

| SLO                     | Breach Runbook                                                  |
| ----------------------- | --------------------------------------------------------------- |
| `lifecycle_attainment`  | `ON_CALL_RUNBOOK.md` Scenario 3: Posting Failure                |
| `discord_posting`       | `ON_CALL_RUNBOOK.md` Scenario 2: Discord Outage                 |
| `grading_latency_p50`   | Check GradingAgent heartbeat; review RiskEngine circuit breaker |
| `settlement_attainment` | `ON_CALL_RUNBOOK.md` Scenario 4: Settlement Failure             |

For any BREACH:

1. Run `/pipeline-health` to check agent and outbox state
2. Run `/pick-trace <id>` on affected picks to find stuck stages
3. Execute the relevant `get_operator_workflows` workflow if one exists

## Relevant Repo Paths

| Path                                                      | Role                                         |
| --------------------------------------------------------- | -------------------------------------------- |
| `packages/mcp-ops/src/tools/index.ts`                     | `get_slo_status`, `get_platform_health`      |
| `apps/api/src/routes/slo.ts`                              | `GET /api/slo/status` — backing endpoint     |
| `apps/api/src/routes/health.ts`                           | `GET /api/health/summary` — backing endpoint |
| `apps/api/src/lib/platform/PlatformThresholdEvaluator.ts` | Alert threshold logic                        |
| `docs/ops/SLO_DEFINITIONS.md`                             | Canonical SLO definitions                    |
| `docs/ops/ON_CALL_RUNBOOK.md`                             | Incident response per scenario               |

## Expected Output

- Per-SLO attainment table with gap and status
- Breach/warn count summary
- Optional platform subsystem correlation
- Verdict and remediation pointer
