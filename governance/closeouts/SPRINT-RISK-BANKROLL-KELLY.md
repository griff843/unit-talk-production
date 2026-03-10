# Closeout: SPRINT-RISK-BANKROLL-KELLY

**Date**: 2026-03-09 **Status**: COMPLETE **Proof**:
out/sprints/SPRINT-RISK-BANKROLL-KELLY/2026-03-09/SPRINT_CLOSEOUT_REPORT.md

## Summary

Implemented bankroll-aware Kelly criterion sizing module and wired it into the
RiskEngine promotion gate. Replaced hardcoded kelly_fraction: 0 in
ProfessionalPropProcessor with real Kelly computation. Added 36 tests.

## Deliverables

- KellySizer.ts: computeKellySize(), computeKellyFraction(), americanToDecimal()
- RiskEngine: evaluateForPromotion() now returns sizing with bankroll context
- ProfessionalPropProcessor: real kelly_fraction from pFinal + odds
- GradingAgent: passes sizing inputs to RiskEngine
- 36 new unit tests, 666 total passing

## Verification

- Type check: clean (API-scoped)
- Vitest: 666/666 passing
- Lifecycle gate: 0 violations
- Build: clean
