# SPRINT CLOSEOUT: SPRINT-RISK-ENGINE-INTEGRATION

**Objective**: Wire RiskEngine.evaluateForPromotion() into GradingAgent as a
fail-closed pre-flight gate before any unified_picks write with
writerRole=promoter.

**Date**: 2026-03-09 **Status**: COMPLETE **Issue**: UNI-52

---

## What Was Built

### Risk Pre-Flight Gate (1 file modified)

- `apps/api/src/agents/GradingAgent/GradingAgent.ts` — Added
  `RiskEngine.getInstance().evaluateForPromotion()` call in
  `promoteFromProviderOffer()` before `lifecycleInsert()`
- If `!riskDecision.allowed`: log warn (propId, decision, reasons, traceId) +
  return silently — no DB write
- If `riskDecision.allowed`: proceed unchanged with existing `lifecycleInsert()`
  path
- Import: `import { RiskEngine } from '../../services/risk'`

### Integration Tests (1 file created)

- `apps/api/src/services/risk/__tests__/risk-integration.test.ts` — 17 new tests
- Part 1: 10 RiskEngine scenario tests (Kelly thresholds, event-level, drift,
  bypass, fail-closed, defaults)
- Part 2: 7 GradingAgent gate tests (block→no write, allow→write, kelly passed,
  drift block, error block, writerRole=promoter, called exactly once)

---

## What Was Proven

| Criterion                | Gate                                                |
| ------------------------ | --------------------------------------------------- |
| Type check clean         | 0 TS errors                                         |
| Test suite passing       | 630/630 Vitest tests                                |
| Lifecycle gate           | 0 violations, 0 allowlisted                         |
| Fail-closed verified     | BLOCK → lifecycleInsert not called (test)           |
| Single-writer discipline | RiskEngine added pre-insert, never bypasses adapter |

---

## PASS / FAIL

**Status**: ✅ PASS

---

**Governance Owner**: Engineering Team
