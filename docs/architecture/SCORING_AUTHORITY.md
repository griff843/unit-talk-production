# Scoring Authority Map

> **Sprint**: SPRINT-REPO-ARCHITECTURE-NORMALIZATION-001 **Status**:
> AUTHORITATIVE **Last Updated**: 2026-03-06

---

## Canonical Scorer

| Attribute       | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Function**    | `computeScoreV2`                                                         |
| **Location**    | `apps/api/src/agents/GradingAgent/scoring/computeScoreV2.ts`             |
| **Returns**     | `{ score, tier, ev, breakdown, feature_audit }`                          |
| **Feature map** | `apps/api/src/agents/GradingAgent/scoring/featureRegistry.ts`            |
| **Tier scale**  | `apps/api/src/agents/GradingAgent/scoring/TierScale.ts`                  |
| **Weights**     | `apps/api/src/scoring/config/weights/`                                   |
| **Consumers**   | GradingAgent, unified-edge-score.ts (V2 path), ProfessionalPropProcessor |

All new scoring work MUST build on `computeScoreV2`. Do not create parallel
scoring implementations.

---

## Active Supporting Modules (KEEP)

| Module               | Location                                         | Purpose                                          |
| -------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `edgeEngineV1`       | `agents/ScoringAgent/scoring/edgeEngineV1.ts`    | POST validation edge (used after pick selection) |
| `edgeEnginePre`      | `agents/ScoringAgent/scoring/edgeEnginePre.ts`   | PRE promotion edge gate                          |
| `canaryRouter`       | `agents/GradingAgent/scoring/canaryRouter.ts`    | V1/V2 canary routing                             |
| `driftLogger`        | `agents/GradingAgent/scoring/driftLogger.ts`     | V1-vs-V2 drift detection                         |
| `promotionPolicy`    | `agents/GradingAgent/scoring/promotionPolicy.ts` | Declarative promotion rules                      |
| `unified-edge-score` | `logic/scoring/unified-edge-score.ts`            | Routing layer (V1/V2 via canary)                 |

---

## Deprecated Modules (DO NOT EXTEND)

| Module                    | Location                                                 | Status | Reason                                           |
| ------------------------- | -------------------------------------------------------- | ------ | ------------------------------------------------ |
| `Enhanced45FactorEngine`  | `agents/ScoringAgent/scoring/Enhanced45FactorEngine.ts`  | STUB   | Never implemented; `computeScoreV2` is canonical |
| `FeatureStoreIntegration` | `agents/ScoringAgent/scoring/FeatureStoreIntegration.ts` | STUB   | Never implemented; feature registry covers this  |
| `MaterialChangeDetector`  | `agents/ScoringAgent/scoring/MaterialChangeDetector.ts`  | STUB   | Never implemented                                |
| `edgeScoring`             | `logic/scoring/edgeScoring.ts`                           | LEGACY | Sport-specific only (MLB HR), not generalizable  |
| `unifiedScoringService`   | `services/UnifiedScoringService.ts`                      | LEGACY | Predates `computeScoreV2`                        |

All deprecated modules have been annotated with `@deprecated` referencing this
document.

---

## Probability Layer (Extracted)

The devig/consensus probability modules have been extracted to
`packages/intelligence/`:

| Module               | Canonical Location                                            | Re-export Stub                                       |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `devigConsensus`     | `packages/intelligence/src/probability/devigConsensus.ts`     | `apps/api/src/lib/probability/devigConsensus.ts`     |
| `probabilityLayer`   | `packages/intelligence/src/probability/probabilityLayer.ts`   | `apps/api/src/lib/probability/probabilityLayer.ts`   |
| `calibrationCompute` | `packages/intelligence/src/probability/calibrationCompute.ts` | `apps/api/src/lib/probability/calibrationCompute.ts` |

Consumers can import from either location — the API stubs re-export from
`@unit-talk/intelligence`.

## Future Target

Per Blueprint v2, scoring will eventually move to `packages/intelligence/`. The
probability layer has been extracted (see above). `computeScoreV2` and scoring
weights remain at their current locations within `apps/api/` until a future
sprint extracts them.

---

## Rules

1. **One canonical scorer**: `computeScoreV2` is the single source of truth for
   pick scoring.
2. **No parallel implementations**: Do not create new scoring functions outside
   the GradingAgent scoring directory.
3. **Edge engines are validation, not scoring**: `edgeEngineV1`/`edgeEnginePre`
   compute edge metrics for validation gates, not pick scores.
4. **Deprecation path**: Deprecated modules will be removed when their last
   consumer is migrated. Do not add new consumers.
