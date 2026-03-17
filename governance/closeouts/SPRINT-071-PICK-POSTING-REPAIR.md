# Sprint Closeout — SPRINT-071-PICK-POSTING-REPAIR

**Date**: 2026-03-16 **PR**: #278 **Status**: COMPLETE **Branch**:
sprint/071-pick-posting-repair

## Objective

Fix DEFECT-7 (P1): picks permanently stuck with `posted_to_discord=true` but no
Discord message when an exception occurs after `atomicClaimForPost` succeeds.

## Changes

- `apps/api/src/agents/DiscordPromotionAgent/index.ts`: 5 fixes —
  operator_override role in resetPostingOnFailure + try-catch in all 4 posting
  paths (capper-single, capper-parlay, system, legacy)
- `apps/api/src/lib/lifecycle/single-writer-gate.ts`: harness script exemption
  pattern

## Verification

- TypeCheck: exit 0
- Build: exit 0
- Tests: 1000/1000 vitest
- Single-writer gate: PASS, 0 violations
- sprint:close: ✅ ALL REQUIRED ARTIFACTS PRESENT

## Proof Bundle

`out/sprints/SPRINT-071-PICK-POSTING-REPAIR/2026-03-16/`
