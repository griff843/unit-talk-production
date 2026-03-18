# SPRINT-QA-FORMAT-NORMALIZATION

**Status**: COMPLETE **Date**: 2026-03-18

## Summary

Resolved pre-existing Prettier formatting drift across 12 files in MCP packages,
command-center, and discord-bot. Formatting-only — no logic changes. Clears the
CI Quality Assurance gate (`npm run format:check`).

## Root Cause

Files were committed with formatting that drifted from Prettier config
(`endOfLine: "lf"`, trailing newline rules, indentation). The drift predated
SPRINT-CI-GOVERNANCE-DEBT-NORMALIZATION and was exposed once workspace/build
issues were resolved in that sprint.

## Files Changed

- `apps/command-center/src/app/dashboard/capper-command-center/page.tsx`
- `apps/command-center/src/app/dashboard/picks/PicksTableCard.tsx`
- `apps/command-center/src/components/PermissionGate.tsx`
- `apps/discord-bot/src/index.ts`
- `packages/mcp-decision/src/resources/index.ts`
- `packages/mcp-decision/src/tools/index.ts`
- `packages/mcp-intelligence/src/resources/index.ts`
- `packages/mcp-intelligence/src/tools/index.ts`
- `packages/mcp-ops/src/resources/index.ts`
- `packages/mcp-ops/src/tools/index.ts`
- `packages/mcp-state/src/resources/index.ts`
- `packages/mcp-state/src/tools/index.ts`

## Verification

- `npm run format:check` — PASS
- `npm run type-check` — PASS (16/16 workspaces, 0 errors)
- Pre-commit hooks — PASS (docs validation, lint-staged, ESLint, TypeScript)

## Non-Blocking Follow-Up Debt

- 1939 files fail `prettier --check .` repo-wide, but CI gate only checks the
  scoped glob (`apps/*/src/**`, `packages/*/src/**`). The wider repo formatting
  debt (docs, tools/, config files) is out of CI scope and is a separate
  concern.
