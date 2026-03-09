# SPRINT CLOSEOUT: SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING-COMPLETE

**Tag Name**: SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING-COMPLETE **Date**:
2026-03-09 **Sprint**: SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING — Settlement
Idempotency Hardening

---

## Scope

Fixed 3 HIGH-severity gaps in the settlement path identified by
PICK-LIFECYCLE-E2E-TRUTH-AUDIT: optimistic lock on `lifecycleSettle` (GAP-04),
`checkSettleIdempotency` pre-flight in `SettlementAgent` (GAP-01), and outbox
receipt retry (GAP-03). No changes to lifecycle FSM or governance contracts.

### Files Changed

| File                                                            | Change                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/api/src/lib/lifecycle/write-adapter.ts`                   | Add optimistic lock to `lifecycleSettle` (GAP-04)            |
| `apps/api/src/agents/SettlementAgent/index.ts`                  | Add idempotency pre-flight + concurrent skip (GAP-01)        |
| `apps/api/src/agents/DiscordPromotionAgent/index.ts`            | Add retry + warn downgrade to `recordOutboxReceipt` (GAP-03) |
| `apps/api/src/lib/lifecycle/__tests__/settlement-guard.test.ts` | Add 4 transition protection tests + import check             |

---

## Gates Executed

| Gate                  | Result                            |
| --------------------- | --------------------------------- |
| TypeScript type-check | PASS (0 errors)                   |
| Lint                  | PASS (pre-existing warnings only) |
| Unit tests            | PASS — 643 tests, 35 suites       |
| API build             | PASS                              |
| Single-writer gate    | PASS — 0 new violations           |

---

## Verification Verdict

**Settlement Stage**: HARDENED — all 3 HIGH gaps closed

- GAP-04 (TOCTOU race): CLOSED — optimistic lock on `settlement_status`
- GAP-01 (no idempotency pre-flight): CLOSED — `checkSettleIdempotency`
  pre-flight
- GAP-03 (outbox receipt swallowed): CLOSED — single retry + warn downgrade

---

## Proof Bundle

Local artifacts:
`out/sprints/SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING/2026-03-09/`

- `proofs/proof_typecheck.txt`
- `proofs/proof_tests.txt`
- `proofs/proof_gate.txt`
- `proofs/proof_build.txt`
- `proofs/proof_git_status.txt`
- `notes/plan.md`
- `SPRINT_CLOSEOUT_REPORT.md`

---

## CI Tag Request

CI MUST mint tag `SPRINT-SETTLEMENT-IDEMPOTENCY-HARDENING-COMPLETE` on the merge
SHA after verifying this closeout marker is present and all required gates pass.
