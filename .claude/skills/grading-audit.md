# Skill: Grading Audit

## Purpose

Audit GradingAgent tier assignments for a pick cohort. Detect divergence between
shadow scoring and production grades. Surface anomalies in promotion band
distribution.

## When to Use

- After a GradingAgent deployment to verify tier assignment behavior
- When shadow divergence alerts fire (R3 guardrail breach)
- When promotion_band distribution looks skewed (e.g., too many HARD, no LIGHT)
- Before a settlement integrity audit to confirm grades are sound

## Invocation

```
/grading-audit [--window <days>] [--band <HARD|STRONG|MEDIUM|LIGHT>] [--shadow]
```

## Required Inputs

- Date window (default: last 7 days)
- Optionally: specific promotion_band filter
- Optionally: `--shadow` flag to include shadow divergence analysis

## Procedure

### Step 1: Pull Grade Distribution

```bash
# Via mcp-state: query_picks filtered by date + promotion_band
# Or direct Supabase query:
SELECT promotion_band, COUNT(*) FROM unified_picks
WHERE created_at > NOW() - INTERVAL '<window> days'
GROUP BY promotion_band;
```

### Step 2: Check Shadow Divergence (if --shadow)

```bash
# Via mcp-intelligence: get_shadow_divergence
# Or query shadow_picks table:
SELECT COUNT(*) as flagged FROM shadow_picks
WHERE divergence_detected = true
AND created_at > NOW() - INTERVAL '<window> days';
```

Expected: divergence rate < 2% (R3 guardrail threshold)

### Step 3: Inspect Anomalies

For any flagged picks, read:

- `promotion_band` vs `shadow_grade`
- `confidence` score
- `grading_agent_version`

### Step 4: Report

```markdown
## Grading Audit — <date>

| Band   | Count | % of Total |
| ------ | ----- | ---------- |
| HARD   | X     | X%         |
| STRONG | X     | X%         |
| MEDIUM | X     | X%         |
| LIGHT  | X     | X%         |

Shadow divergence rate: X% (threshold: < 2%) Anomalies detected: X picks

Status: ✅ CLEAN | ⚠️ REVIEW | ❌ BLOCKED
```

## Relevant Repo Paths

| Path                                                        | Role                            |
| ----------------------------------------------------------- | ------------------------------- |
| `apps/api/src/agents/GradingAgent/GradingAgent.ts`          | Agent entrypoint                |
| `apps/api/src/agents/GradingAgent/scoring/gradingEngine.ts` | SyndicateGradingEngine          |
| `apps/api/src/lib/verification/shadow/`                     | Shadow scoring (R3)             |
| `packages/mcp-intelligence/src/tools/`                      | MCP tool: get_shadow_divergence |
| `packages/mcp-state/src/tools/`                             | MCP tool: query_picks           |

## Expected Output

- Band distribution table
- Shadow divergence rate
- List of anomalous pick IDs (if any)
- Pass/warn/fail status
