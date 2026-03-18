# Sprint Closeout: SPRINT-085-GOVERNANCE-SURFACE-HARDENING-AND-SPOA-CONSERVATIVE-MODE

**Date**: 2026-03-17 **Status**: COMPLETE **Lane**: Governance/Docs (Lane 4) —
authority review + Implementation (Lane 1) — patch

## Summary

Three governance surface bugs fixed, all traceable to the same root cause:
runtime components were not fail-closed against vacant or incorrect source
truth.

1. `AGENTS.md` contained six `.Codex/` directory path references (non-existent
   directory). All replaced with `.claude/`. §11 sprint ID corrected to
   `SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A`. §12 queue authority updated from
   roadmap to `docs/status/NEXT_5_SPRINTS.md`.

2. `scope-contract.ts` did not protect `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`
   (the authoritative sprint contract) from sprint-level modification. Added as
   exact-match `governance-default` forbidden path. Override semantic preserved:
   file is allowed when explicitly listed in `touchedAreas`.

3. SPOA emitted runner recommendations and next-sprint selections when the only
   available sprint truth was inferred from phase status docs (vacant queue).
   Conservative mode (`queuedCount === 0`) now suppresses
   `recommendedNextSprint` and `rankedNextSprints`, forces runner to
   `'Unassigned'` for all inferred/blocked entries, and prepends a notice to
   `limitations`. The Phase 4/11 Parallel-Safe keyword exception was also
   removed: all inferred sprints now fall to `Sequential Only` (fail-closed).

## Files Changed

- `AGENTS.md` — `.Codex` → `.claude` path correction; §11 sprint ID; §12 queue
  authority
- `tools/claude-os/src/scope-contract.ts` — governance contract added to
  `GOVERNANCE_FORBIDDEN_PATHS`
- `tools/claude-os/src/portfolio-audit-types.ts` — `conservativeMode: boolean`
  - `conservativeModeReason?: string` added to `PortfolioAuditResult`
- `tools/claude-os/src/portfolio-audit.ts` — conservative mode detection,
  suppression, runner assignment, notice prepend
- `tools/claude-os/src/portfolio-audit-classifier.ts` — Phase 4/11 Parallel-Safe
  exception removed; all inferred → Sequential Only
- `tools/claude-os/src/__tests__/governance-surface-regressions.test.ts` — 9
  regression tests across 4 describe blocks

## Governance Authority

Memo authored by governance/authority review lane (Claude). Implementation
reviewed and approved by governance lane before merge. Contract authority:
`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` §4, §5.
