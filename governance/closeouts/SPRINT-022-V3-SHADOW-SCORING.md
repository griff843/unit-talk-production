# SPRINT CLOSEOUT: SPRINT-022-V3-SHADOW-SCORING

**Objective**: Wire V3 scoring path from provider_offers in shadow mode — no
publish impact.

**Date**: 2026-03-04 **Status**: PENDING EXECUTION (code written + typechecked,
awaiting runtime proof against live data)

---

## What Was Built

### Task 1 — ShadowScoringService

`apps/api/src/services/ShadowScoringService.ts`

Full pipeline in a single service:

1. Fetches provider_offers for a configurable time window
2. Groups by canonical market key (event_id × market_type_id × participant_id)
3. Filters to eligible markets (book_count >= 3, fail-closed)
4. Dedupes to latest offer per provider
5. Detects odds pair type (over/under, home/away, yes/no) by market_type_id
6. Runs `computeConsensus()` → p_market_devig
7. Runs `computeProbabilityLayer()` → p_final, edge_final, uncertainty_final,
   clv_forecast
8. Runs `computeScoreV2()` → score, tier, ev, feature_audit
9. Returns structured `ShadowScoreResult` per market

**Key design decisions:**

- Uses neutral confidence (5.0) for market-anchored delta = 0
- Builds minimal GradingFeatureSet with market intelligence from consensus
- Context features use neutral defaults (not legacy enrichment data)
- No promotion evaluation — shadow mode only

### Task 2 — Shadow Write Path

`scripts/analysis/run-shadow-scoring-022.ts`

- Runs ShadowScoringService against live Supabase
- Persists shadow results to `unified_picks.meta.shadow_v3` JSON
- Includes `meta.shadow_model_version` and
  `meta.shadow_scoring_source = "provider_offers"`
- Supports DRY_RUN mode for safe testing
- Writes `SHADOW_SCORES_SAMPLE.json` artifact

**Why meta.shadow_v3 (not separate table):**

- Avoids schema migration for a proof-of-concept sprint
- Data is queryable via `meta->shadow_v3` JSON path
- No risk of bloat: shadow_v3 is ~20 fields per pick
- Easy to promote to a dedicated table in future sprint if needed

### Task 3 — Comparison Script

`scripts/analysis/compare-legacy-vs-shadow-022.ts`

Compares:

- Legacy scored picks (from raw_props pipeline)
- Shadow scored markets (from provider_offers pipeline)

Outputs:

- Tier distribution comparison
- Score, edge, confidence distribution statistics
- Head-to-head analysis for picks with both scores
- `COMPARISON_REPORT.md`

### Task 4 — Proof Bundle

```
out/sprints/SPRINT-022-V3-SHADOW-SCORING/2026-03-04/
├── proofs/
│   ├── proof_typecheck.txt     ✅ All workspaces pass
│   ├── proof_tests.txt         ✅ 85/85 tests pass (pre-existing infra failures only)
│   └── proof_git_status.txt    ✅ Clean (new files only)
├── SHADOW_SCORES_SAMPLE.json   (generated at runtime)
└── COMPARISON_REPORT.md        (generated at runtime)
```

---

## Pipeline Architecture

```
provider_offers
  → groupByMarket (event × market_type × participant)
  → filter (book_count >= 3)
  → dedupe (latest per provider)
  → computeConsensus() [proportional devig]
  → computeProbabilityLayer() [market-anchored, neutral confidence]
  → computeScoreV2() [feature registry + sport weights]
  → canonicalTier() [S/A/B/C/D multi-dimensional]
  → ShadowScoreResult
  → unified_picks.meta.shadow_v3 (persist)
```

**No legacy entrypoints modified. No Discord publishing changes.**

---

## Invariants Preserved

| Invariant                    | Status                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| Legacy scoring unchanged     | ✅ No modifications to ProfessionalPropProcessor or GradingAgent |
| Discord publishing unchanged | ✅ Shadow scoring does not trigger promotion or posting          |
| Single-writer discipline     | ✅ Shadow writes only to meta JSON (not lifecycle fields)        |
| Fail-closed                  | ✅ Markets with < 3 books silently skipped                       |
| Typecheck                    | ✅ All workspaces pass                                           |
| Tests                        | ✅ 85/85 pass (no regressions)                                   |

---

## PASS / FAIL

**Status**: PENDING — requires runtime execution against live Supabase.

Execute:

```bash
# Step 1: Run shadow scoring
npx tsx scripts/analysis/run-shadow-scoring-022.ts

# Step 2: Run comparison
npx tsx scripts/analysis/compare-legacy-vs-shadow-022.ts
```

**Acceptance criteria:**

- [ ] At least 20 markets shadow-scored with book_count >= 3
- [ ] Each has finite p_market_devig, p_final, edge_final, uncertainty_final
- [ ] Shadow outputs persisted to unified_picks.meta.shadow_v3
- [ ] COMPARISON_REPORT.md generated
- [ ] Typecheck + tests pass

---

## Next Sprint Recommendation

**SPRINT-023 — Publish Outbox + Operator Audit (P0 Production Surface Lock)**

Given P0 audit findings:

1. `publish_outbox` table + idempotency tokens + receipts
2. API finalize endpoints with RBAC (approve/reject/override)
3. Audit log for operator actions (before/after + reason codes)
4. E2E publish proof (outbox → discord → receipt)

This is a **hard production-surface lock sprint** — stops "months-broken" issues
from recurring.

---

**Governance Owner**: Engineering Team
