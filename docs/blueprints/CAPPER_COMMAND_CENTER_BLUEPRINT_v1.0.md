# CAPPER COMMAND CENTER — SLATE COMPRESSION BLUEPRINT v1.0

Blueprint Type: Operator Intelligence Surface  
Applies To: Command Center (READ-ONLY), Scoring outputs, Execution outputs  
Status: DRAFT (Post Phase 2B PASS)  
Primary Goal: Compress research time from 4–6 hours to 10–15 minutes  
Moat Policy: No model internals / no feature weights exposed

---

## 1. Purpose

This blueprint defines the capper-facing intelligence surface inside Command
Center that:

- Compresses slate evaluation to 10–15 minutes
- Surfaces probability primitives as decisive, explainable UI
- Improves timing and CLV capture through explicit execution guidance
- Automatically hides low-quality candidates
- Allows capper override with auditable reasons
- Measures adoption + effectiveness objectively

This is not backend math.  
This is the Intelligence Consumption Layer.

---

## 2. Inputs (Truth Primitives)

### 2.1 Required (must be non-null for eligibility)

- `p_final`
- `p_market_devig`
- `edge_final`
- `uncertainty_final`
- `clv_forecast`

### 2.2 Required display/compression fields

- `books_used` (count) and/or book list
- `consensus_strength` (Strong / Medium / Weak)
- `market_resistance` flag
- `steam` flag
- `volatility` flag
- `execution_state` (FIRE_NOW / WAIT / AVOID)
- `risk_tier` (Phase 3-ready)
- `exposure_warning` (Phase 3-ready)
- `correlation_cluster` (Phase 3-ready)

### 2.3 Moat enforcement

- No feature weights
- No factor contribution breakdowns
- No model internals
- Only reason-codes and high-level badges

---

## 3. System Positioning

```text
market_snapshot (devig normalized)
        │
        ▼
ScoringAgent
  → p_final
  → p_market_devig
  → edge_final
  → uncertainty_final
  → clv_forecast
        │
        ▼
Execution Engine
  → execution_state (FIRE_NOW / WAIT / AVOID)
        │
        ▼
Command Center — Capper Console (READ-ONLY)

Command Center must not write to scoring tables or lifecycle tables.

4. Capper Workflow (10–15 minute playbook)
Step 0 — Preflight (≤ 30s)

Open Capper Console → Slate

Confirm Slate Health = GREEN (fresh rows, required primitives present)

Step 1 — Autopilot Shortlist (≈ 2m)

Default filters auto-hide disqualified plays

Target: reduce slate by 60–80%

Step 2 — Scan Top Ranked (≈ 3–5m)

Sort by Edge Rank

Validate top 10–15 plays using Deep Card (≈ 10 seconds per play)

Step 3 — Build Pick Queue (≈ 2–3m)

Select 3–7 plays

WAIT plays moved to Watchlist

Risk/Correlation warnings visible

Step 4 — Timing Decision (≈ 1–2m)

FIRE_NOW → ready to submit/post

WAIT → track trigger conditions

AVOID → hidden unless explicitly revealed

Step 5 — Submit / Validate (≤ 1m)

Autopilot picks can be sent to Smart Form prefilled

Smart Form submissions route back into Validation inbox with verdict

5. Screen Map (Tabs)

Command Center → Capper Console

Slate

Autopilot Ranking (default)

All Scored (power mode)

Disqualified (reasons)

Watchlist

WAIT plays + triggers + refresh timers

Pick Validation

Smart Form submission inbox

Verdicts: Approved / Needs Review / Rejected

Primary reason surfaced

Risk & Exposure (Phase 3-ready)

Exposure map by player/team/event

Correlation clusters

Performance

CLV by rank decile

Hit rate by confidence bucket

Override performance delta

Ops / Health

Freshness

Missing field counts

Consensus coverage stats

6. Slate Table (Exact Metrics Shown)
6.1 Identity

Event (teams, start time)

Market + selection + line

6.2 Truth block (always visible)

Edge Rank

edge_final

p_final

p_market_devig

Δp = p_final - p_market_devig (display-only)

uncertainty_final

6.3 Timing

clv_forecast (direction + magnitude)

execution_state badge: FIRE_NOW / WAIT / AVOID

6.4 Consensus

books_used

consensus_strength badge

book icons (if available)

6.5 Market conditions

resistance / steam / volatility flags

6.6 Risk (Phase 3-ready)

risk_tier

exposure_warning

correlation_cluster

7. Deep Card (Right Panel)

Always shows, in this order:

Truth Block

p_final

p_market_devig

edge_final

uncertainty_final

clv_forecast

Execution

FIRE / WAIT / AVOID

non-sensitive reason codes

Consensus

books_used + coverage summary

dispersion indicator

Market Conditions

resistance / steam / volatility

Risk

exposure deltas

correlation members

Override

override allowed

requires reason selection (audited)

8. Auto-Disqualify Rules (Hide ~80% by default)

These are display rules inside Command Center (not backend math changes).

8.1 Hard disqualify (hidden)

Any required primitive null

edge_final < E_MIN

uncertainty_final > U_MAX

clv_forecast < CLV_MIN (negative beyond tolerance)

execution_state = AVOID

consensus_strength = Weak AND books_used < B_MIN

data quality not good (if present)

8.2 Soft disqualify (collapsed “Show Risky”)

WAIT plays

moderate uncertainty

thin liquidity

high volatility flags

9. Smart Form Integration (Instant Validation)

On Smart Form submit:

Pick scores through V3 adapter

Appears in Pick Validation inbox

Displays truth block + verdict

Verdicts:

Approved (add to queue)

Needs Review

Rejected (show one primary reason)

No silent failures.

10. Success Metrics
10.1 Time compression

Start: Slate open

End: Queue finalized

Target median: ≤ 15 minutes

10.2 Pick quality

CLV by rank decile

Hit rate and ROI vs baseline

10.3 Operator behavior

Adoption rate of Autopilot

Override rate + override performance delta

11. Failure Conditions

Slate reduction < 50%

Override rate > 40% for multiple slates

Top-ranked decile does not outperform on CLV

WAIT/FIRE advice ignored due to poor clarity

END
```
