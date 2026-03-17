# Closeout: SPRINT-073-PROMOTION-WIRING-CERTIFICATION

**Sprint**: SPRINT-073-PROMOTION-WIRING-CERTIFICATION **Date**: 2026-03-17
**Commit**: 4df4dd90 **Branch**: sprint/072-scoring-certification **Status**:
COMPLETE

## Summary

Fixed production promotion path in GradingEngine. Both CONSTITUTIONAL gates
(Gate 7: DATA-MOAT-ACTIVATION-002, Gate 8:
INTELLIGENCE-PROBABILITY-FOUNDATION-001) now receive required inputs at runtime.
Valid scored picks (S/A-tier) can complete the promotion evaluation pipeline.
Fail-closed behavior verified.

## Deliverables

- `buildPromotionMetadata()` private method in GradingEngine
- V2 primary path and shadow path `evaluatePromotion()` calls fixed
- 20 new certification tests (1041 → 1061 vitest)
- Lifecycle gate: PASS (0 violations)

## Proof Bundle

`out/sprints/SPRINT-073-PROMOTION-WIRING-CERTIFICATION/2026-03-17/`
