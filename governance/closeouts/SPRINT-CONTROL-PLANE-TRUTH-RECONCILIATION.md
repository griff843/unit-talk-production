# Sprint Closeout: SPRINT-CONTROL-PLANE-TRUTH-RECONCILIATION

**Date**: 2026-03-17 **Status**: COMPLETE **Lane**: Implementation (Lane 1) +
Governance/Docs (Lane 4)

## Summary

Eight control-plane truth defects resolved across five scripts. All defects
traced to the same root cause: enforcement surfaces claimed fail-closed behavior
in docs but silently fell open in edge cases.

1. `sprint-gate.js` — removed `ROADMAP_PATH` + `getNextSprintFromRoadmap()`. All
   non-locked queue states (missing/vacant/unparseable) fail closed with
   distinct error messages. No secondary authority fallback remains.

2. `pre-sprint-check.mjs` — hasDrift `null`/`undefined`/unknown now blocks (was
   fail-open for non-`true` values). Backward walk added for incomplete baseline
   dirs. TypeScript/ESLint blockers labeled
   `(inherited — pre-existing repo debt)`.

3. `check-session-baseline.mjs` — age calculated from `baseline.json` JSON
   timestamp (not directory mtime). Backward walk added for incomplete runs.

4. `sprint-close.ts` — `validateRoutingDecision()` wired in. `--validate-only`
   mode no longer writes `proof_proof_inventory.txt` (was mutating).

5. `pnpm-workspace-mcp.mjs` — path separator normalized for Windows before
   `/apps/` and `/packages/` substring checks.

## Files Changed

- `tools/governance/sprint-gate.js`
- `scripts/pre-sprint-check.mjs`
- `scripts/check-session-baseline.mjs`
- `scripts/sprint-close.ts`
- `scripts/mcp-wrappers/pnpm-workspace-mcp.mjs`
- `tools/claude-os/src/__tests__/control-plane-truth-regressions.test.ts` — 15
  regression tests

## Governance Authority

Memo authored by implementation lane (Claude). Contract authority:
`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` §4, §5.
