# Sprint Closeout: SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT

**Date**: 2026-03-15 **Sprint**: SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT
**Branch**: sprint/054-replay-endpoint **Status**: ✅ COMPLETE

## Objective

Complete the replay loop in Command Center by wiring Temporal `startWorkflow`
into the replay route and delivering an operator-facing replay dashboard.

## Deliverables

### apps/command-center/src/app/api/replay/route.ts ✅

- **Change**: Replaced both `// TODO` stubs in `handleGradingReplay` and
  `handleAlertReemission` with live `temporalService.startWorkflow()` calls
- **Workflow types**: `'replayGradingWorkflow'` / `'alertReemissionWorkflow'`
  (string-based — not registered Temporal functions, graceful fallback to
  BridgeWorker on error)
- **Actor identity**: `actorId` sourced exclusively from
  `requireOperatorIdentity(request)` — never from request body

### apps/command-center/src/app/api/temporal/workflows/route.ts ✅

- Added `startWorkflow(workflowType, workflowId, args)` to
  `ServerTemporalService` using real `@temporalio/client` SDK:
  `client.workflow.start(workflowType, { taskQueue, workflowId, args })`
- Added `case 'start':` to POST handler with proper block scoping
- Fixed existing `case 'terminate':` block scope to resolve `const`
  redeclaration

### apps/command-center/src/lib/temporal.ts ✅

- Added `startWorkflow(workflowType, workflowId, args)` to client-side
  `TemporalService` API proxy — POSTs to `/api/temporal/workflows` with
  `{ action: 'start', workflowType, workflowId, args }`

### apps/command-center/src/app/dashboard/replay/page.tsx ✅ (NEW)

- Operator replay dashboard (Next.js App Router, `'use client'`)
- Controls: action selector (preview/rerun-grading/reemit-alerts), time range
  (1h/6h/24h/custom), batch size, priority, reason textarea (10-char min),
  dry-run toggle
- Result display: event count, estimated duration, workflow ID for monitoring
- Handles 503 feature-gate response gracefully

### apps/command-center/src/**tests**/replay-route.test.ts ✅ (NEW)

- 15 vitest tests: feature gate (503 ×2), auth (401), reason validation (400
  ×2 + 1 boundary), action validation (400 ×2), preview (200 ×2), grading replay
  (no events → false, with events → startWorkflow with actorId), actor identity
  binding, alert reemission → startWorkflow with actorId
- All 61 Command Center vitest tests pass

## Verification

| Gate                                         | Result                                  |
| -------------------------------------------- | --------------------------------------- |
| `cd apps/command-center && npx vitest run`   | 61/61 ✅                                |
| `cd apps/command-center && npx tsc --noEmit` | clean ✅                                |
| `cd apps/command-center && npx next build`   | success, `/dashboard/replay` 6.25 kB ✅ |
| Single-writer gate                           | N/A — no `unified_picks` writes         |
| Command Center read-only boundary            | MAINTAINED — no business-table writes   |

## Invariants Maintained

- Command Center writes NO business tables (`unified_picks`, `prop_settlements`)
- Actor identity sourced from `requireOperatorIdentity` (server-side auth),
  never from request body
- Temporal workflow start is wrapped in try/catch — failure falls back to
  BridgeWorker processing (graceful degradation)
- Feature gate (`ENABLE_REPLAY === 'true'`) enforced — returns 503 if unset

## Sign-off

- [x] All 61 vitest tests passing
- [x] TypeScript clean (no errors)
- [x] Next.js build passes with new replay page
- [x] No business-table writes introduced
- [x] Actor identity from auth context (not hardcoded)
- [x] Governance closeout filed
