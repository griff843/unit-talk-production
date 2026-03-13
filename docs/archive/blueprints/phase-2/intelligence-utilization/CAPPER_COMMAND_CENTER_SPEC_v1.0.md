---
title: 'Capper Command Center — Intelligence Utilization Layer'
version: '1.0'
status: 'Draft'
authority: 'Founder'
scope: 'Command Center (internal), Capper workflow, Smart Form validation'
depends_on:
  - 'PHASE 2B — Intelligence Superiority: PASS'
  - 'Probability primitives deployed (p_market_devig, p_final,
    uncertainty_final, edge_final, clv_forecast)'
  - 'Fail-closed promotion gates enforced'
last_updated: '2026-03-01'
---

# 1. Purpose

The Capper Command Center (CCC) is the Intelligence Utilization Layer.  
Its purpose is to compress capper research time from **4–6 hours** to **10–15
minutes** while preserving:

- market-anchored decision integrity
- human final authority
- model moat secrecy
- production-grade, fail-closed behavior

CCC is **not** a marketing surface.  
CCC is **not** an analytics playground.  
CCC is an operational compression engine.

# 2. Blueprint Position

CCC is a required sub-layer of **Phase 2 — Intelligence Superiority**:

- Phase 2A/2B ensures intelligence is _measurable and truthful_ (probability
  primitives, devig, calibration readiness)
- CCC ensures intelligence is _usable and time-compressing_ for
  operators/cappers

CCC must be implemented before expanding:

- Phase 3 (Risk Layer) beyond scaffolding
- Phase 4 (Automation & Selection)
- Phase 5 (SaaS Surface Excellence)

# 3. Core Principles

## 3.1 Compression Over Observability

CCC must:

- auto-eliminate **70–90%** of slate noise
- surface top-ranked plays without manual scanning
- reduce decisions to approve/reject/override

CCC must not:

- require scrolling large tables to identify candidates
- force cappers to mentally combine multiple raw metrics
- display “everything” as the default mode

## 3.2 Market-Anchored Authority

All surfaced decisions must be backed by:

- `p_market_devig`
- `p_final`
- `edge_final`
- `uncertainty_final`
- `clv_forecast`
- consensus requirements (e.g., books >= 2)

No confidence-only picks may be surfaced as “eligible” without probability
primitives.

## 3.3 Human Final Authority (v1)

In v1, the system may:

- rank
- suggest
- warn

But the capper must:

- approve
- reject
- override (with reason)

Posting eligibility requires a capper action (v1).

## 3.4 Moat Protection

CCC must not expose:

- feature weights
- model coefficients
- training details
- factor breakdowns that reveal IP

CCC may expose:

- derived outcomes (edge, uncertainty, CLV forecast)
- non-sensitive reason codes / badges

# 4. Operator Workflows

## 4.1 Morning Slate Workflow (Target: 10–15 Minutes)

### Step 1 — Open CCC

Default view shows **Top Ranked Plays** (Top 5–10).

### Step 2 — Auto-Disqualification

Before ranking, CCC removes plays that fail configured gates (Section 6).  
CCC must display a banner:

- “X plays removed automatically by intelligence filters.”

This banner is required to validate compression.

### Step 3 — Review Top Ranked Plays

For each play, CCC displays only the minimum decision set (Section 5).

### Step 4 — Capper Actions

Each play supports:

- Approve
- Reject
- Override (requires reason)

### Step 5 — Optional Discretionary Submission (Smart Form)

When a capper submits a pick via Smart Form, CCC returns immediate validation:

- VALIDATED
- HIGH RISK
- MARKET DISAGREES
- INSUFFICIENT BOOKS
- NEGATIVE CLV FORECAST (if enabled)
- HIGH UNCERTAINTY

Capper may override with reason.

# 5. Required Display Fields (Decision Surface)

For each surfaced play:

- identity: league, event, player/team, market, line
- `edge_final` (display as %)
- `p_final` and `p_market_devig` (display as delta, not raw internals)
- `uncertainty_final` (badge: Low / Med / High)
- `clv_forecast` (badge: + / 0 / -)
- consensus strength:
  - `books_used` (or derivable)
  - consensus badge (e.g., Weak/Normal/Strong)
- execution suggestion:
  - FIRE NOW / WAIT / AVOID (rule-based v1)
- promotion context:
  - tier/promotion_band (non-sensitive)

# 6. Auto-Disqualification Gates (v1)

CCC must exclude plays from the default slate if any of the following are true:

- `p_final` is NULL
- `p_market_devig` is NULL
- `uncertainty_final` is NULL
- `edge_final` is NULL
- `books_used < 2` (or consensus result fail)
- `uncertainty_final > U_MAX` (configurable)
- `edge_final < EDGE_MIN` (configurable)
- `clv_forecast < 0` (optional gate, configurable)

CCC must provide counts per exclusion reason.

# 7. Ranking (Internal Only)

CCC must compute an internal ranking score. The score must not be displayed.

Ranking inputs (minimum):

- `edge_final` (positive weight)
- `uncertainty_final` (penalty)
- `clv_forecast` (positive weight)
- books strength (positive weight)
- promotion_band/tier (tie-break)

The output shown to cappers is:

- rank order
- a concise badge set, not raw score

# 8. Logging and Accountability

CCC must record:

- time_opened_utc
- time_first_action_utc
- time_slate_completed_utc (optional v1)
- action log for each play:
  - approve/reject/override
  - override_reason (required on override)
  - actor_id / capper_id
  - timestamp

Override rate is a key diagnostic:

- high overrides indicate blind spots or over-filtering
- low overrides with strong CLV indicates confidence in model

# 9. Success Metrics (Definition of “10–15 Minutes”)

CCC is considered successful only if measured:

- median time to first approval ≤ 3 minutes
- median time to finalize slate ≤ 15 minutes
- ≥ 70% slate auto-eliminated by gates
- positive median CLV on approved plays vs baseline period
- override rate within expected band (target set later)

# 10. Failure Conditions

CCC fails blueprint alignment if any of the following occur:

- cappers must manually scan large tables to identify candidates
- default view exposes most of the slate (≤ 30% eliminated)
- plays without probability primitives are shown as eligible
- overrides do not require reasons
- time-to-slate does not materially improve over baseline

# 11. Evolution Path

- v1 (current): capper-confirmed posting, compression-first
- v2: risk overlay integration (Phase 3)
- v3: semi-autopilot approvals with kill switch (Phase 4)
- v4: outward-facing SaaS surfaces (Phase 5)

# 12. Implementation Boundaries (Non-Negotiable)

- No external provider calls inside CCC compute paths
- CCC consumes DB views / materialized views only
- Ranking/filtering logic must be deterministic and versioned
- Fail-closed behavior is mandatory
- Moat protection must be maintained
