# Governance Closeout: SPRINT-RISK-EXPOSURE-CORRELATION

**Sprint**: SPRINT-RISK-EXPOSURE-CORRELATION **Date**: 2026-03-10 **Status**:
COMPLETE **PR**: #142

## Summary

Added sport-level Kelly exposure caps, correlation detection (same-event and
same-participant clustering), and drawdown freeze controls to the RiskEngine.
All three new gate checks are wired into evaluateForPromotion() with fail-closed
semantics.

## Deliverables

- ExposureCalculator extended with sport-level breakdown via events join
- CorrelationDetector module: pending ticket_legs cluster detection
- DrawdownTracker module: daily P&L computation with configurable freeze
  threshold
- 5 new risk_engine_config fields with defaults
- 35 new unit tests (701 total passing)

## Verification

- TypeScript: clean
- Vitest: 701/701 passing
- Lifecycle gate: 0 violations
- API build: success
