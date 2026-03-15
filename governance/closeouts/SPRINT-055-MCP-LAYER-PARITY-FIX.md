# Sprint Closeout: SPRINT-055-MCP-LAYER-PARITY-FIX

**Date**: 2026-03-15 **Sprint**: SPRINT-055-MCP-LAYER-PARITY-FIX **Branch**:
sprint/055-mcp-layer-parity-fix **Merge Commit**: 390761cf **PR**: #238
**Status**: ✅ COMPLETE

## Objective

Fix all verified parity issues in the Unit Talk MCP layer before observability
skills are implemented. Commit all 4 MCP packages to git for the first time.

## Deliverables

### Fix 1: mcp-state lifecycle derivation parity ✅

- `packages/mcp-state/src/adapters/index.ts` — `deriveStage()` completely
  rewritten
- Before: 5/6 scenarios wrong (non-canonical stages, wrong field checks)
- After: 10/10 parity with `apps/api/src/lib/lifecycle/transition-validator.ts`
- Added CANCELLED, DISPUTED; removed SETTLEMENT_FROZEN, APPROVED, REJECTED,
  UNKNOWN
- Blocked/Failed now checked via `blocked_reason`/`failed_reason` fields (not
  `status`)
- POSTED now requires both `posted_to_discord` AND `discord_message_id`

### Fix 2: mcp-intelligence risk endpoint ✅

- `packages/mcp-intelligence/src/adapters/index.ts` — `/api/risk` →
  `/api/risk/status`
- `packages/mcp-intelligence/src/tools/index.ts` — tool description updated to
  match
- Added math drift documentation comment explaining the 2% vig approximation

### Fix 3: .mcp.json OPERATOR_TOKEN ✅

- `.mcp.json` — added `"OPERATOR_TOKEN": "${OPERATOR_TOKEN}"` to `unit-talk-ops`
  env block
- Without this, `get_operator_workflows` and `get_slo_status` threw auth errors

### Fix 4: mcp-ops pipeline status outbox conditional ✅

- `packages/mcp-ops/src/tools/index.ts` — removed
  `health.agents.length === 0 ? null :` conditional
- Outbox and agent health queries are independent; outbox must never be nulled

### Initial git commit of all 4 MCP packages ✅

- mcp-state, mcp-intelligence, mcp-ops, mcp-decision — all source files
  committed
- 34 files, 3,037 insertions (packages were on disk but never staged)

## Verification

- tsc exit 0 for all 4 packages
- Parity test: 10/10 pass
- TypeScript Compile Check: ✅ SUCCESS
- Lifecycle Contract Gate: ✅ SUCCESS
- E2E Smoke Test: ✅ SUCCESS
- R3 Shadow Guardrails: ✅ SUCCESS
- R4 Fault Suite: ✅ SUCCESS
- Pre-existing failures: Quality Assurance, Notion sync, Smart Form compliance,
  Quarantine gate (all pre-existing, unrelated to MCP changes)

## Subsystem Impact

- **MCP Layer** (unit-talk-state, unit-talk-intelligence, unit-talk-ops,
  unit-talk-decision): VERIFIED → all 4 servers committed and parity-correct
- No impact on unified_picks, lifecycle adapters, or any other subsystem

## Sign-off

- [x] All parity fixes implemented and verified
- [x] tsc exit 0 for all 4 packages
- [x] PR #238 merged to main (390761cf)
- [x] Governance closeout filed
