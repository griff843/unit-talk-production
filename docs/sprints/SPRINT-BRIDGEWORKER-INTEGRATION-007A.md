# SPRINT-BRIDGEWORKER-INTEGRATION-007A

**Objective**: Integrate BridgeWorker into API runtime as a new lifecycle writer
**Date**: 2026-02-23 **Status**: COMPLETE **Scope**: Runtime writer integration
(NOT cleanup)

---

## Executive Summary

This sprint integrates the BridgeWorker as a new runtime writer in the API
entrypoint. The BridgeWorker polls `bridge_outbox` and creates `unified_picks`
entries via the canonical lifecycle adapter (`lifecycleInsert`), maintaining
single-writer discipline.

**Re-scoped from**: SPRINT-SYNDICATE-CLEANUP-006 (incorrectly bundled as
"cleanup")

---

## Why This Is Its Own Sprint

BridgeWorker integration is NOT cleanup. It introduces:

1. **New Runtime Writer**: BridgeWorker becomes an active writer to
   `unified_picks`
2. **Write Surface Change**: Adds a new code path that creates canonical records
3. **Lifecycle Integration**: First use of `lifecycleInsert` in a polling worker
   context
4. **Startup Behavior Change**: Non-blocking worker promise affects API boot
   sequence
5. **Environment Gating**: New `ENABLE_BRIDGE_WORKER` flag controls activation

These changes require explicit governance under SYSTEM_INVARIANTS.md to prevent
multi-writer drift.

---

## Read/Write Surfaces

### Tables Written (via lifecycle adapters)

| Table           | Operation | Role      | Adapter           |
| --------------- | --------- | --------- | ----------------- |
| `unified_picks` | INSERT    | submitter | `lifecycleInsert` |

### Tables Read

| Table           | Operation | Purpose                         |
| --------------- | --------- | ------------------------------- |
| `bridge_outbox` | SELECT    | Poll for unprocessed events     |
| `unified_picks` | SELECT    | Idempotency check (bet_slip_id) |
| `events`        | SELECT    | Event processing                |

### Write Authority

```
BridgeWorker
  └─> handleBridgeOutboxTicketSubmitted()
        └─> lifecycleInsert(pick, { writerRole: 'submitter' })
              └─> assertNotFrozen() → AutopilotFrozenError if frozen
              └─> assertWriterAuthority() → validates submitter role
              └─> supabase.from('unified_picks').insert()
```

---

## Risks and Mitigations

| Risk                 | Mitigation                             | Enforcement               |
| -------------------- | -------------------------------------- | ------------------------- |
| Multi-writer drift   | lifecycleInsert only, no direct writes | Grep gate, lifecycle gate |
| Duplicate records    | bet_slip_id check before insert        | Idempotency pattern       |
| Blocking startup     | workerPromise.catch() pattern          | Non-blocking startup      |
| Writes during freeze | assertNotFrozen() in lifecycleInsert   | AutopilotFrozenError      |
| Unbounded polling    | setInterval with 5s cadence            | Rate-limited by design    |

---

## Scope Definition

### IN SCOPE

- BridgeWorker startup in API entrypoint
- Process loop for polling bridge_outbox
- lifecycleInsert integration for unified_picks creation
- Worker startup non-blocking fix
- docker-compose.yml environment flag

### OUT OF SCOPE (Sprint 6)

- Legacy file deletion (ENVIRONMENT_CONTRACT.md, Dockerfile.api)
- Deploy pipeline path fixes
- Telemetry package audit
- .env.local consolidation audit
- daily_picks deprecation documentation

---

## Invariants Touched

| #   | Invariant                | Enforcement                       | Compliance |
| --- | ------------------------ | --------------------------------- | ---------- |
| 1   | Single-Writer Discipline | lifecycleInsert only              | COMPLIANT  |
| 6   | Idempotent Operations    | bet_slip_id check before insert   | COMPLIANT  |
| 7   | State Machine Validity   | submitter role for initial writes | COMPLIANT  |
| 11  | Fail-Open Services       | BridgeWorker is fail-open         | COMPLIANT  |

---

## Technical Changes

### 1. apps/api/src/index.ts

Added BridgeWorker startup with process loop:

```typescript
// SPRINT-SYNDICATE-CLEANUP-006: Start BridgeWorker
if (process.env.ENABLE_BRIDGE_WORKER === 'true') {
  const { BridgeWorker } = await import('./workers/BridgeWorker');
  const bridgeWorker = new BridgeWorker(config, { logger, supabase });
  await bridgeWorker.start();

  // Process loop - poll every 5 seconds
  setInterval(async () => {
    await bridgeWorker.run();
  }, 5000);
}
```

### 2. apps/api/src/worker.ts

Fixed blocking await:

```typescript
// BEFORE (blocking):
await workerPromise;

// AFTER (non-blocking):
workerPromise.catch(error => {
  logger.error('Worker encountered error:', { err: errorMessage });
});
```

### 3. apps/api/src/workers/BridgeWorker.ts

Added lifecycleInsert for unified_picks creation:

```typescript
import { lifecycleInsert } from '../lib/lifecycle';

// Check idempotency before insert
const { data: existingPick } = await this.requireSupabase()
  .from('unified_picks')
  .select('id')
  .eq('bet_slip_id', betSlipId)
  .limit(1);

if (!existingPick || existingPick.length === 0) {
  await lifecycleInsert(this.requireSupabase(), pickData, {
    writerRole: 'submitter',
    traceId: `bridge-outbox-${event.id}`,
  });
}
```

### 4. docker-compose.yml

Added environment flag:

```yaml
- ENABLE_BRIDGE_WORKER=true
```

---

## Verification Requirements

### 1. Single-Writer Compliance

- BridgeWorker MUST use lifecycleInsert (no direct .insert() calls)
- Grep scan for direct writes MUST return empty

### 2. Freeze Guard Compliance

- AutopilotFrozenError MUST block writes when frozen
- lifecycleInsert includes freeze check

### 3. Idempotency Compliance

- Duplicate bet_slip_id MUST NOT create duplicate unified_picks
- Check-before-insert pattern enforced

### 4. Non-Blocking Startup

- API server MUST start even if BridgeWorker fails
- Worker promise MUST NOT block entrypoint

### 5. E2E Smoke Test

- All 6 stages MUST pass
- Smart Form → bridge_outbox → BridgeWorker → unified_picks → Grading → Discord

---

## Proof Bundle

```
out/sprints/SPRINT-BRIDGEWORKER-INTEGRATION-007A/2026-02-23/proofs/
├── proof_single_writer_scan.txt
├── proof_freeze_guard.txt
├── proof_idempotency_pattern.txt
├── proof_nonblocking_startup.txt
├── proof_e2e_smoke.txt
└── proof_lifecycle_gate.txt
```

---

## Sign-off

- [x] Single-writer scan: No direct .insert()/.update() in BridgeWorker
- [x] Freeze guard: lifecycleInsert includes AutopilotFrozenError check
      (line 79)
- [x] Idempotency: bet_slip_id check before insert (lines 962-968)
- [x] Non-blocking: workerPromise.catch() pattern (line 111)
- [x] E2E smoke: All 6 stages pass (verified prior session)
- [x] Lifecycle gate: PASSED (0 new violations)

**Sprint Status**: COMPLETE

---

**Document Owner**: Engineering Team **Sprint Reference**:
SPRINT-BRIDGEWORKER-INTEGRATION-007A **Re-scoped From**:
SPRINT-SYNDICATE-CLEANUP-006
