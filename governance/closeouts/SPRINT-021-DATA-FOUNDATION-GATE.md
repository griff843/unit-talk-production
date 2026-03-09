# SPRINT CLOSEOUT: SPRINT-021-DATA-FOUNDATION-GATE

**Objective**: Prove provider_offers has real multi-book data and
computeConsensus() produces real probabilities.

**Date**: 2026-03-04 **Status**: PENDING EXECUTION (scripts written, awaiting
runtime proof)

---

## What Was Built

### Task 1 — Provider Offers Health Script

`scripts/analysis/provider-offers-health-021.ts`

- Queries `provider_offers` for configurable league + window
- Produces book_count distribution per market (event × market_type ×
  participant)
- Identifies markets with >= 3 books
- Saves structured artifacts:
  - `PROVIDER_OFFERS_BOOK_COUNTS.json`
  - `MARKET_SAMPLE_OFFERS.json`

### Task 2 — Consensus Gate Proof Script

`scripts/analysis/consensus-gate-proof-021.ts`

- Loads sampled market offers (from Task 1 or queries directly)
- Dedupes to latest offer per provider
- Computes per-book implied probabilities from American odds
- Runs `computeConsensus()` with proportional devig
- Outputs:
  - Per-book implied + devigged fair probs
  - Weighted consensus p_market_devig
  - Average overround
  - Gate checks (PASS/FAIL)
- Saves: `CONSENSUS_OUTPUT.json`, `CONSENSUS_GATE_REPORT.md`

### Task 3 — Proof Bundle

All artifacts written to:

```
out/sprints/SPRINT-021-DATA-FOUNDATION-GATE/<date>/
├── PROVIDER_OFFERS_BOOK_COUNTS.json
├── MARKET_SAMPLE_OFFERS.json
├── CONSENSUS_OUTPUT.json
├── CONSENSUS_GATE_REPORT.md
└── proofs/
    ├── proof_typecheck.txt
    ├── proof_tests.txt
    └── proof_git_status.txt
```

---

## What Was Proven

| Criterion                            | Gate                                       |
| ------------------------------------ | ------------------------------------------ |
| provider_offers has data             | Health script queries real DB              |
| At least 1 market with >= 3 books    | Distribution artifact shows count          |
| computeConsensus() runs on real data | Consensus output shows real p_market_devig |
| p_market_devig is finite (0 < p < 1) | Gate check in CONSENSUS_GATE_REPORT.md     |
| overround > 0 and plausible          | Gate check in CONSENSUS_GATE_REPORT.md     |

---

## PASS / FAIL

**Status**: PENDING — requires runtime execution against live Supabase.

Execute:

```bash
npx tsx scripts/analysis/provider-offers-health-021.ts
npx tsx scripts/analysis/consensus-gate-proof-021.ts
```

---

## Dependencies Confirmed

- `computeConsensus()` from `apps/api/src/lib/probability/devigConsensus.ts` —
  verified functional
- `americanToImplied()`, `calculateOverround()`, `applyDevig()` — imported and
  used
- Provider profile weights (liquidity, sharp, data quality) — hardcoded
  defaults + registry lookup
- `provider_offers` table schema — confirmed via migrations + TypeScript types

---

## Next Sprint Recommendation

**SPRINT-022 — V3 Scoring Shadow Mode**

Once SPRINT-021 proves that provider_offers has real multi-book data and
consensus is computable:

1. Wire `ScoringAgent` to run shadow scoring from `provider_offers` →
   `computeConsensus()` → shadow primitives
2. Write shadow results to `unified_picks.meta.shadow_*` (no promotion impact)
3. Generate comparison report: legacy scoring vs shadow scoring distributions
4. Safety gates: shadow must not affect promotion_band or posting

**SPRINT-023 — Publish Outbox + Operator Audit (P0 Production Surface Lock)**

Given the audit P0 findings (Command Center direct DB writes, missing outbox,
missing snapshots):

- `publish_outbox` table + idempotency tokens + receipts
- API finalize endpoints with RBAC (approve/reject/override)
- Audit log for operator actions (before/after + reason codes)
- E2E publish proof (outbox → discord → receipt)

Sprint 023 should be treated as a **hard production-surface lock** to prevent
"months-broken" issues from recurring.

---

**Governance Owner**: Engineering Team
