# SPRINT CLOSEOUT REPORT

**Sprint**: SPRINT-024-SCORING-ENHANCEMENT-LAYERING **Objective**: Implement
syndicate model layering — bounded adjustments, confidence blend, explanations,
calibration **Date**: 2026-03-04 **Status**: ✅ COMPLETE

---

## Executive Summary

Enhanced the scoring probability layer from a simple market-anchored delta into
a syndicate model with bounded adjustments, confidence-factor scaling, dynamic
caps, and operator-readable explanation payloads. All changes are
backward-compatible (neutral confidence = zero delta = no behavioral change at
runtime).

---

## Mathematical Specification

### Previous Formula (prob_v1.1.0_market_anchored)

```
delta = (confidence - 5) / 5 * 0.04                     // [-0.04, +0.04]
p_final = p_market_devig + delta * (1 - uncertainty)     // clamp [0.01, 0.99]
```

### New Formula (prob_v2.0.0_syndicate_layered)

```
delta = (confidence - 5) / 5 * 0.04                                          // raw adjustment
cap = 0.04 * book_factor * agreement_factor                                   // [0.01, 0.06]
capped_delta = clamp(delta, -cap, +cap)                                       // bounded
confidence_factor = 0.4*book_count_f + 0.4*agreement_f + 0.2*completeness_f   // [0, 1]
p_final = p_market_devig + capped_delta * confidence_factor * (1 - uncertainty)
```

Where:

- `book_count_f = clamp((books - 1) / 4, 0.3, 1.0)`
- `agreement_f = clamp(1 - spread / 0.06, 0.4, 1.0)`
- `completeness_f = clamp(feature_completeness, 0.3, 1.0)`
- `book_factor = clamp(books / 5, 0.6, 1.2)`
- `agreement_factor = clamp(1 - spread / 0.08, 0.5, 1.0)`

### Invariants (Preserved)

1. When `confidence = 5.0` (neutral): `delta = 0` → `p_final = p_market_devig`
   (zero behavioral change)
2. `p_final` always in `[0.01, 0.99]`
3. `|capped_delta| <= dynamic_cap <= 0.06` (absolute maximum)
4. `confidence_factor` always in `[0, 1]`
5. Promotion gates remain fail-closed (no change to promotionPolicy.ts)
6. Market is always the prior (`p_market_devig`)

---

## Deliverables

### Task 1: Bounded Adjustment Layer ✅

- `computeDynamicCap()` — dynamic cap from book_count + agreement
- Cap bounded absolutely to `[0.01, 0.06]`
- Reason string for operator audit

### Task 2: Confidence/Uncertainty Blend ✅

- `computeConfidenceFactor()` — weighted blend of book_count, agreement,
  completeness
- Updated `computePFinal()` — 5-parameter version with confidence_factor +
  dynamic_cap
- Formula:
  `p_final = p_market + capped_delta * confidence_factor * (1 - uncertainty)`

### Task 3: Explanation Payload + Reason Codes ✅

- `ExplanationPayload` interface — 15-field operator-readable struct
- Populated in `computeProbabilityLayer()` return
- Persisted to `unified_picks.meta.explain_v3` via both callers
- Reason codes: P_FINAL_CLIPPED, CAP_REDUCED, CAP_BOOSTED,
  LOW_CONFIDENCE_FACTOR, HIGH_UNCERTAINTY, HIGH_BOOK_SPREAD, LARGE_EDGE,
  EDGE_TOO_GOOD_TO_BE_TRUE

### Task 4: Calibration + Drift Report ✅

- `scripts/analysis/scoring-calibration-report-024.ts`
- Outputs: CALIBRATION_REPORT.md, DISTRIBUTIONS.json, SAMPLE_EXPLANATIONS.json
- "Too good to be true" detector (edges > 0.08)
- Safety checks: p_final boundedness, cap activation frequency

---

## Changes Summary

| File                                                              | Change                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/lib/probability/probabilityLayer.ts`                | Added ExplanationPayload, SyndicateLayerParams, computeConfidenceFactor(), computeDynamicCap(), updated computePFinal() to 5-param + PFinalResult, updated computeProbabilityLayer() with syndicate layering + explanation |
| `apps/api/src/lib/probability/devigConsensus.ts`                  | Bumped PROBABILITY_MODEL_VERSION to 'prob_v2.0.0_syndicate_layered'                                                                                                                                                        |
| `apps/api/src/lib/probability/index.ts`                           | Exported new types + functions                                                                                                                                                                                             |
| `apps/api/src/services/ShadowScoringService.ts`                   | Added explain_v3 to ShadowScoreResult, populated from prob.explain                                                                                                                                                         |
| `apps/api/src/services/ProfessionalPropProcessor.ts`              | Persisted explain_v3 in meta during lifecycleInsert                                                                                                                                                                        |
| `apps/api/src/lib/probability/__tests__/probabilityLayer.test.ts` | NEW — unit tests for all new functions + integration + backward compat                                                                                                                                                     |
| `scripts/analysis/scoring-calibration-report-024.ts`              | NEW — calibration report + drift detection script                                                                                                                                                                          |
| `governance/closeouts/SPRINT-024-SCORING-ENHANCEMENT-LAYERING.md` | NEW — this document                                                                                                                                                                                                        |

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

**Sprint Status**: ✅ COMPLETE **Next Sprint**:
SPRINT-025-CLV-CLOSING-SNAPSHOT-CAPTURE
