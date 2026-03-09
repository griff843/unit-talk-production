# SPRINT CLOSEOUT REPORT

**Sprint**: SPRINT-CANONICAL-SCORING-ACTIVATION-026 **Objective**: Activate
canonical scoring pipeline — V3 multi-book consensus as single writer **Date**:
2026-03-05 **Status**: COMPLETE

---

## Executive Summary

Unified the `ProfessionalPropProcessor` pipeline so multi-book consensus from
`provider_offers` drives scoring, tier assignment, and CLV tracking. Single-book
devig remains as fail-closed fallback for props without canonical IDs. This
eliminates the dual-path problem where Stages D (CLV tracking) and E (scoring)
consumed single-book results while Stage C independently fetched multi-book
data.

---

## Deliverables

### Task 1: Wire scoring_v3 into canonical pipeline

- New `resolveMarketData()` method at Stage B prefers multi-book from
  `provider_offers` via `MarketOfferAggregator.aggregateFromDB()`
- Falls back to single-book `DeviggingService.devigTwoWay()` when canonical IDs
  absent or < 2 offers
- Eliminated duplicate DB fetch (Stage C no longer fetches independently)

### Task 2: Ensure scoring outputs

- `p_final`, `edge_final`, `uncertainty_final`, `clv_forecast` — populated from
  probability layer (unchanged)
- `model_version` — `PROBABILITY_MODEL_VERSION` for multi-book, `MODEL_VERSION`
  for single-book
- `tier`, `confidence` — from `computeScoreV2()` now using consensus edge
- `explain_v3` — explanation payload in meta (unchanged)
- `feature_set_version` — `PROBABILITY_MODEL_VERSION` (unchanged)

### Task 3: Enforce single-writer

- All writes via `lifecycleInsert()` (unchanged, verified by gate)

### Task 4: Retire legacy raw_props

- `raw_props` remains as ingestion surface but scoring now driven by
  `provider_offers` when canonical IDs exist
- `processGradingFeatureSet()` backward compat: always single-book fallback (no
  `event_id`/`market_type_id`)

### Task 5: Promotion evaluates V3 tiers

- `promotionPolicy.ts` Gate 8 already evaluates probability primitives — no
  changes needed
- Single-sided HARD→SOFT downgrade preserved

### Task 6: Publish outbox is only path

- `pick_publish` outbox pattern unchanged — confirmed as sole publishing surface

### Task 7: CLV formula validated

- CLV computation from Sprint 025 works with V3 scoring data
- Stage D now uses `pFinal` from consensus for `modelProb` (was using
  single-book `trueProb`)

### Task 8: Runtime validation report

- `scripts/analysis/validate-scoring-pipeline-026.ts` — queries picks, validates
  probability completeness, compares distributions

---

## Changes Summary

| File                                                                           | Change                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `apps/api/src/services/ProfessionalPropProcessor.ts`                           | MODIFIED — new Stage B `resolveMarketData()`, updated Stages C/D/E/H signatures |
| `apps/api/src/services/__tests__/ProfessionalPropProcessor.scoring-v3.test.ts` | NEW — V3 scoring unit tests                                                     |
| `scripts/analysis/validate-scoring-pipeline-026.ts`                            | NEW — runtime validation script                                                 |
| `governance/closeouts/SPRINT-026-CANONICAL-SCORING-ACTIVATION.md`              | NEW — this document                                                             |

---

## Key Architecture Changes

### Before (dual-path)

```
Stage B: deviggOdds()           → single-book DevigTwoWayResult
Stage C: runProbabilityLayer()  → fetches multi-book from DB AGAIN
Stage D: uses Stage B output    ← wrong source
Stage E: uses Stage B output    ← wrong source
```

### After (unified)

```
Stage B: resolveMarketData()    → MarketResolution (multi-book preferred)
Stage C: runProbabilityLayer()  → uses pre-resolved bookOffers
Stage D: uses Stage C pFinal    ← correct source
Stage E: uses Stage C edgeFinal ← correct source
```

---

## Verification Results

### Tests

See `proof_tests.txt` for full output.

### Gate Status

See `proof_gate.txt` for lifecycle single-writer gate output.

---

## Sign-off

- [ ] All tests passing
- [ ] Gate passing
- [ ] Proofs generated
- [ ] Documentation updated

**Sprint Status**: COMPLETE **Next Sprint**: SPRINT-027 (TBD)
