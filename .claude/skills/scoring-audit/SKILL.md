# Skill: Scoring Audit

## Purpose

Provide a structured, read-only audit of Unit Talk's scoring and edge-evaluation
layer. Reviews calibration state, band distribution, promotion accuracy, CLV
signal validity, and shadow scoring divergence to identify drift, inconsistency,
weak contracts, or logic contradictions that could degrade the core pick
machine.

**Portability class:** Unit Talk-Specific (the review pattern is reusable for
sports-betting intelligence platforms; the subjects — CLV, calibration bands,
promotion logic, pick lifecycle — are Unit Talk-specific)

## Invocation

```
/scoring-audit
```

With focus area:

```
/scoring-audit --focus calibration
/scoring-audit --focus bands
/scoring-audit --focus promotion
/scoring-audit --focus clv
/scoring-audit --focus shadow
```

---

## When to Use

Run `/scoring-audit` when:

- A grading agent or scoring logic change completes — verify no regression
- CLV or calibration metrics seem off or have not been reviewed recently
- Pick quality appears inconsistent (unexpected bands, wrong promotions)
- Before a risk policy sprint — confirm intelligence layer is sound first
- As part of a truth audit sprint when intelligence health is in question
- After a `promotion_band = null` incident — confirm fix is holding
- The `shadow_scoring_runs` divergence rate appears elevated
- Intelligence review docs in `docs/ai/` may be stale relative to current code

---

## Required Inputs (gather before starting)

| Input         | What it is                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| Focus area(s) | Which aspects to review: calibration, bands, promotion, CLV, shadow, or all |
| Review scope  | Recent sprint that changed scoring, or general health check                 |
| Time window   | Date range for metrics (default: last 7 days)                               |

---

## Optional Inputs

- Specific strategy run to compare (`out/strategy-runs/<strategyId>/<date>/`)
- Known scoring concerns from operator or recent incident
- Intelligence review doc to cross-reference (`docs/ai/`)
- Shadow divergence threshold expectations

---

## MCP Intelligence Tools Reference

The `mcp-intelligence` MCP server provides the primary runtime data source:

| Tool                    | What it returns                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| `compute_clv`           | CLV edge computation from book odds vs closing line                    |
| `compute_calibration`   | Brier score, ECE, MCE calibration metrics from predicted probabilities |
| `get_shadow_divergence` | Shadow scoring divergence rate from `shadow_scoring_runs` table        |
| `get_risk_metrics`      | Live portfolio risk from `GET /api/risk/status`                        |

These tools require live Supabase/API access. If unavailable, note the gap and
proceed with static source review only.

---

## Procedure

### Step 1: Check Calibration State

Query calibration metrics or inspect the most recent calibration artifacts:

```bash
# Via MCP: compute_calibration with a representative sample of picks
# Key metrics:
#   Brier score: lower is better (perfect = 0, random = 0.25)
#   ECE (Expected Calibration Error): < 0.05 is healthy
#   MCE (Maximum Calibration Error): should be monitored for outlier bins
```

If `compute_calibration` is unavailable, inspect:

- `docs/ai/` for the most recent intelligence review covering calibration
- `out/strategy-runs/` for any saved calibration outputs

**Calibration parameters to note**: Platt scaling `a=0.95, b=0.01` — mild
compression pulling extreme probabilities toward center. Verify these have not
been altered without a documented reason.

### Step 2: Check Band Distribution

Inspect the distribution of picks across promotion bands:

```bash
# Expected bands: HARD, SOFT, PASS, SHARP (or project-specific equivalents)
# Key checks:
#   - Is any band absent entirely? (may indicate routing failure)
#   - Is distribution severely skewed vs historical baseline?
#   - Are newly graded picks receiving expected bands?
```

**Known failure mode**: `promotion_band = null` — occurs when `GradingAgent.ts`
line ~972 returns `result.promotionBand || null` instead of
`result.promotionBand || 'HARD'`. A null promotion band means the pick never
reaches the Discord posting queue. Always check this first when band
distribution looks wrong.

### Step 3: Check Promotion Accuracy

Trace the promotion pipeline to verify picks are being routed correctly:

```bash
# Inspect unified_picks for recently graded picks:
#   pick_origin: capper / null / system
#   promotion_band: must NOT be null for posted picks
#   lifecycle_stage: should reach 'promoted' → 'posted'
#   posted_to_discord: should be true for promoted picks

# Three posting paths — verify each is functioning:
#   processCapperPicks()  — when meta.pick_origin = 'capper'
#   processSystemPicks()  — when meta.system_approved = true
#   processLegacyPicks()  — when promotion_band = 'HARD' AND pick_origin IS NULL
```

For any pick stuck in lifecycle, use `/discord-diagnose` to trace the
posting-specific failure.

### Step 4: Check CLV Signal

```bash
# Via MCP: compute_clv with recent pick sample
# Key metrics:
#   Positive CLV (>0) = edge vs market
#   Negative CLV = value-negative picks reaching posting
#   CLV by band: HARD band should have highest average CLV
```

Check whether CLV by band aligns with expected scoring hierarchy. Significant
deviation may indicate scoring factor drift or miscalibration.

### Step 5: Check Shadow Scoring Divergence (if R3 active)

```bash
# Via MCP: get_shadow_divergence with window parameter
# Key metric: divergence_rate — how often shadow scoring differs from prod
# Healthy baseline: < 5% divergence in stable conditions
# Elevated divergence (> 10%) = investigate scoring logic difference
```

Also check `shadow_scoring_runs` table directly for recent run records.

### Step 6: Cross-Reference Intelligence Docs

Inspect the most recent intelligence review docs:

```bash
ls docs/ai/
# Look for: intelligence review summaries, LLM decision playbook, scoring notes
# Compare documented behavior vs current calibration/band findings
# Flag any discrepancies between docs and current metrics
```

### Step 7: Generate Audit Output

Use the output format below.

---

## Output Format

```markdown
# Scoring Audit — <scope or focus area>

**Date**: <YYYY-MM-DD> **Focus**: all | calibration | bands | promotion | clv |
shadow **Data source**: MCP live | static docs | mixed **Confidence**: HIGH |
MEDIUM | LOW

---

## Calibration State

- Brier score: <value or "unavailable">
- ECE: <value or "unavailable">
- Assessment: HEALTHY | MONITOR | DEGRADED
- Notes: <any anomaly or notable observation>

---

## Band Distribution

| Band | Pick Count | % of Total | Expected? |
| ---- | ---------- | ---------- | --------- |
| HARD | <N>        | <X>%       | YES / NO  |
| SOFT | <N>        | <X>%       | YES / NO  |
| ...  | ...        | ...        | ...       |

**Null promotion_band count**: <N> (must be 0 for healthy state)

Assessment: HEALTHY | SKEWED | BROKEN

---

## Promotion Accuracy

- Pick origin coverage: capper / system / legacy paths all functioning?
- Lifecycle transitions: picks reaching 'promoted' → 'posted'?
- Known failure mode (promotion_band=null): <found / not found / data
  unavailable>
- Assessment: HEALTHY | DEGRADED | BROKEN

---

## CLV Signal

- Average CLV (all): <value or "unavailable">
- CLV by band alignment: matches expected hierarchy? YES / NO / UNKNOWN
- Assessment: HEALTHY | MONITOR | DEGRADED

---

## Shadow Divergence

- Divergence rate: <X>% over <window> (or "R3 not active / data unavailable")
- Assessment: HEALTHY (<5%) | MONITOR (5–10%) | ELEVATED (>10%)

---

## Intelligence Doc Alignment

- Most recent review: <doc name and date>
- Alignment with current findings: ALIGNED | DRIFT DETECTED | STALE
- Notes: <any specific discrepancy>

---

## Gaps / Anomalies

1. <finding — one line each>
2. ...

---

## Recommendation

<One sentence: overall scoring layer health and highest-priority action>

**Follow-on:**

- If calibration degraded → scoring sprint or intelligence review
- If null promotion_band found → hotfix GradingAgent.ts (see known failure mode)
- If CLV misaligned → factor contract review sprint
- If docs stale → doc reconciliation sprint
- If all healthy → no action required
```

---

## Failure Protocol

| Failure                                       | Action                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| MCP tools unavailable (no live DB)            | Note gap; proceed with static doc review only; flag LOW confidence |
| Calibration sample too small to be meaningful | Flag; recommend collecting more data before concluding             |
| `promotion_band = null` found                 | Escalate to P1; route to `/incident-triage` or `/prompt-compose`   |
| Shadow divergence > 10%                       | Flag as ELEVATED; recommend investigation sprint                   |
| Intelligence docs are stale (>30 days)        | Note doc staleness; do not treat as evidence of current state      |
| Cannot determine expected band distribution   | Note gap; do not claim a distribution anomaly without baseline     |

---

## Non-Goals

This skill does NOT:

- Modify scoring logic, calibration parameters, or grading agent code
- Claim statistical truth without supporting evidence from live data or proofs
- Replace a full quantitative validation pipeline or backtesting framework
- Diagnose Discord delivery failures (use `/discord-diagnose`)
- Diagnose Temporal workflow failures (use @temporal-workflow-guardian)
- Become a catch-all audit for the entire Unit Talk architecture

---

## Integration with Claude OS

| This skill uses                            | Purpose                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `mcp-intelligence` (compute_clv)           | CLV edge metrics by pick sample                                    |
| `mcp-intelligence` (compute_calibration)   | Brier/ECE/MCE calibration health                                   |
| `mcp-intelligence` (get_shadow_divergence) | Shadow scoring divergence rate                                     |
| `mcp-intelligence` (get_risk_metrics)      | Live portfolio risk for CLV cross-reference                        |
| `/incident-triage`                         | Route P1/P2 findings from this audit to structured triage          |
| `/discord-diagnose`                        | For posting failures tied to promotion_band null or routing issues |
| `/prompt-compose`                          | Compose implementation prompt when code fix is identified          |
| `docs/ai/`                                 | Intelligence review docs for cross-reference                       |
| `apps/api/src/lib/verification/`           | R3/R4/R5 simulation layer for shadow and strategy data             |
| `out/strategy-runs/`                       | Strategy evaluation outputs for CLV and bankroll comparison        |

---

## Notes

- Always check `promotion_band = null` early in any scoring audit — it is the
  most common known failure mode affecting the promotion pipeline
- Calibration parameters (`a=0.95, b=0.01` Platt scaling) must not be changed
  without a documented scoring sprint and accompanying proof bundle
- The three posting paths (processCapperPicks, processSystemPicks,
  processLegacyPicks) must all be traced when promotion accuracy looks wrong — a
  failure in one path does not always appear in the others
- If MCP tools are unavailable, the audit switches to static review mode; flag
  LOW confidence explicitly in the output
- This skill is read-only — it never modifies scoring logic, calibration
  parameters, lifecycle state, or unified_picks records
- Shadow divergence data lives in `shadow_scoring_runs` table; R3 must be active
  for this check to be meaningful
- See `docs/ai/LLM_DECISION_PLAYBOOK.md` for the broader intelligence decision
  context that this audit feeds into
