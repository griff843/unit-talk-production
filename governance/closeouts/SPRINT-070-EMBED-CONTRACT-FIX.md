# Governance Closeout: SPRINT-070-EMBED-CONTRACT-FIX

**Sprint**: SPRINT-070-EMBED-CONTRACT-FIX **Date**: 2026-03-16 **Status**: ✅
COMPLETE **Commit**: f7f46dd1 **Branch**: sprint/070-embed-contract-fix

## Summary

Fixed all 5 Discord embed contract defects identified in
SPRINT-063_EMBED_CONTRACT_AUDIT.md (DRIFT-H7):

1. `build:unknown` footer leakage — suppressed when commitShort is 'unknown'
2. `env:development` footer leakage — suppressed in non-production environments
3. Inconsistent capper visibility — `buildParlayEmbed` and `buildEliteEmbed` now
   match `buildEmbedFromPresentation` rule
4. Silent headshot lookup failures — `console.warn` added with player_name +
   error context
5. Raw SNAKE_CASE stat type leakage — expanded STAT_TYPE_DISPLAY_MAP +
   `snakeToTitleCase` fallback

## Verification

- TypeCheck: exit 0
- Build: exit 0
- Tests: 1000/1000 vitest
- sprint:close: ✅ ALL REQUIRED ARTIFACTS PRESENT

## Proof Bundle

`out/sprints/SPRINT-070-EMBED-CONTRACT-FIX/2026-03-16/`
