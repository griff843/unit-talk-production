# Sprint Closeout: SPRINT-084-CLAUDE-OS-CLOSEOUT-CONTRACT-ALIGNMENT

**Date**: 2026-03-17 **Status**: COMPLETE **Lane**: Governance/Docs (Lane 4) —
authority review + Implementation (Lane 1) — patch

## Summary

Aligned `sprint:close` implementation with
`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`. Three bugs fixed, all traceable to the
same root cause: the implementation treated scoped verification as the default
mode rather than the exception.

1. Default lane was `ops-submit` (scoped). Changed to `full` (type-check +
   test).
2. `proof_verify*` was always required. Now conditional: required only for
   `ops-submit` and `api` lanes, matching contract §4 which marks it
   CONDITIONAL.
3. Unknown `--lane` values silently fell back to `ops-submit`. Now fail closed
   before any verification runs, listing valid lanes.

## Files Changed

- `scripts/sprint-close.ts` — default lane, lane-aware artifact validation,
  unknown-lane gate, exhaustive switch, global mutation fix, exports + main
  guard
- `tools/claude-os/src/__tests__/sprint-close-regressions.test.ts` — 9
  behavioral tests + 2 source-level guards

## Governance Authority

Memo authored by governance/authority review lane (Claude). Implementation
reviewed and approved by governance lane before merge. Contract authority:
`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` §4, §5.
