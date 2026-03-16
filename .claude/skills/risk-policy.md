# Skill: Risk Policy Review

## Purpose

Evaluate the current RiskEngine configuration and portfolio exposure state.
Validate Kelly sizer parameters, exposure limits, and market-type caps against
actual pick distribution.

## When to Use

- Before deploying a new scoring or promotion band configuration
- When the ops status dashboard shows risk alerts
- After a high-volume posting session to verify exposure limits held
- When market-type exposure caps are approaching thresholds

## Invocation

```
/risk-policy [--live] [--window <days>]
```

`--live` queries the running API for real-time RiskEngine metrics.

## Required Inputs

- Optional: date window for historical exposure analysis (default: today)
- Optional: `--live` flag to pull real-time metrics from API

## Procedure

### Step 1: Pull Risk Metrics

```bash
# Via mcp-intelligence: get_risk_metrics
# Or direct: GET /api/risk
```

Key fields to check:

- `portfolioExposure.total` vs configured max
- `kellyUtilization` — should be < 0.35 (market_type_kelly_limit)
- `alerts[]` — any active breaches

### Step 2: Check Exposure Caps

```bash
# Verify market_type_kelly_limit seeded in risk_engine_config:
SELECT key, value FROM risk_engine_config WHERE key = 'market_type_kelly_limit';
# Expected: 0.35
```

### Step 3: Validate Distribution

Pull pick counts by market type for the window:

```bash
SELECT meta->>'market_type' as market_type, COUNT(*)
FROM unified_picks
WHERE created_at > NOW() - INTERVAL '<window> days'
GROUP BY market_type;
```

Compare against exposure caps.

### Step 4: Report

```markdown
## Risk Policy Review — <date>

### Current Configuration

| Parameter               | Configured | Actual | Status |
| ----------------------- | ---------- | ------ | ------ |
| market_type_kelly_limit | 0.35       | X      | ✅/⚠️  |
| portfolio_max_exposure  | X          | X      | ✅/⚠️  |

### Active Alerts

<none | list alerts>

### Exposure by Market Type

| Market Type | Pick Count | Kelly Usage | Status |
| ----------- | ---------- | ----------- | ------ |
| ...         | X          | X%          | ✅/⚠️  |

Status: ✅ WITHIN POLICY | ⚠️ APPROACHING LIMIT | ❌ BREACH
```

## Relevant Repo Paths

| Path                                       | Role                       |
| ------------------------------------------ | -------------------------- |
| `apps/api/src/services/risk/RiskEngine.ts` | Core risk engine           |
| `apps/api/src/routes/health.ts`            | Risk subsystem health      |
| `packages/mcp-intelligence/src/tools/`     | MCP tool: get_risk_metrics |
| `supabase/migrations/`                     | risk_engine_config seed    |

## Expected Output

- Risk configuration table
- Active alerts list
- Exposure by market type
- Pass/warning/breach status
