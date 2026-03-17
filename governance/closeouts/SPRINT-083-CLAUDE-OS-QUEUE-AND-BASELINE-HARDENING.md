# Sprint Closeout: SPRINT-083-CLAUDE-OS-QUEUE-AND-BASELINE-HARDENING

**Date**: 2026-03-17 **Status**: COMPLETE **Lane**: Governance/Docs (Lane 4) —
authority review + Implementation (Lane 1) — patch

## Summary

Hardened the Claude OS control plane against two fail-open bugs:

1. `sprint-gate.js` fell through to a stale legacy roadmap (`SPRINT-042`) when
   the queue was intentionally vacant. Now fails informatively on vacancy;
   roadmap fallback removed entirely.

2. `pre-sprint-check.mjs` and `check-session-baseline.mjs` stopped at the newest
   directory even when it contained no valid `baseline.json`, causing false "no
   baseline" failures when an incomplete run existed. Both now walk
   newest-to-oldest and skip incomplete/unparseable folders.

## Files Changed

- `tools/governance/sprint-gate.js` — sole queue authority, vacancy detection,
  unknown-lane gate
- `scripts/pre-sprint-check.mjs` — backward-walk baseline selection
- `scripts/check-session-baseline.mjs` — backward-walk + JSON timestamp for age
- `CLAUDE.md` §12 — queue authority reference updated
- `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` — historical-record
  banner
- `tools/claude-os/src/__tests__/governance-cli-regressions.test.ts` — 10
  regression tests

## Governance Authority

Memo authored by governance/authority review lane (Claude). Implementation
reviewed and approved by governance lane before merge.
