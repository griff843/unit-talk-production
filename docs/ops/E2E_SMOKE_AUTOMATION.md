# E2E Smoke Test Automation

> **Sprint**: SPRINT-E2E-SMOKE-AUTOMATION-005 **Status**: ACTIVE **Last
> Updated**: 2026-02-22

---

## Overview

The E2E smoke test automation provides deterministic, fail-closed verification
of the canonical pick lifecycle:

```
Smart Form → bridge_outbox → BridgeWorker → unified_picks → Grading → Discord → Settlement
```

---

## Quick Start

```bash
# Run full smoke test (requires Supabase credentials)
pnpm e2e:smoke:full

# Environment variables required
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
```

---

## Lifecycle Stages Covered

| Stage      | Table/Component       | Verification                   |
| ---------- | --------------------- | ------------------------------ |
| 1. Seed    | `bridge_outbox`       | Test payload inserted          |
| 2. Process | BridgeWorker          | Event status → `completed`     |
| 3. Create  | `unified_picks`       | Pick entry created             |
| 4. Grade   | GradingAgent          | `tier` or `promotion_band` set |
| 5. Discord | DiscordPromotionAgent | Dry-run verification           |
| 6. Cleanup | All                   | Test data removed              |

---

## Proof Bundle Structure

Each smoke test run generates a proof bundle:

```
out/e2e-smoke/<timestamp>/
├── SMOKE_REPORT.json       # Structured JSON report
├── SMOKE_REPORT.md         # Human-readable summary
└── proofs/
    ├── proof_stage_1_seed_bridge_outbox.json
    ├── proof_stage_2_bridge_processed.json
    ├── proof_stage_3_unified_pick_created.json
    ├── proof_stage_4_grading_completed.json
    ├── proof_stage_5_discord_mock.json
    └── proof_stage_6_cleanup.json
```

---

## CI Integration

### Verification Job

The CI pipeline includes a `smoke-test-verify` job that:

- Type-checks the smoke test script
- Verifies the script structure compiles
- Does NOT require Supabase credentials

### Full Smoke Test (Staging)

Full smoke tests against staging infrastructure should be run:

- Before production deployments
- After major lifecycle changes
- During incident validation

---

## Fail-Closed Behavior

**The smoke test is FAIL-CLOSED:**

- Any stage failure exits non-zero
- No bypass paths or env hacks
- All assertions are hard requirements

---

## Autopilot Freeze Integration

The lifecycle adapters check autopilot freeze state before any write:

```typescript
// In lifecycle write-adapter.ts
await assertNotFrozen(traceId); // Throws AutopilotFrozenError if frozen
```

When autopilot is frozen:

- `lifecycleInsert` throws `AutopilotFrozenError`
- `lifecycleUpdate` throws `AutopilotFrozenError`
- `lifecycleSettle` throws `AutopilotFrozenError`
- `lifecycleClaimForPosting` throws `AutopilotFrozenError`

---

## Test Data Conventions

All smoke test data uses prefixes to prevent pollution:

- `TEST_SMOKE_` prefix for all identifiers
- `smoke_test_capper` as capper name
- Automatic cleanup after each run

---

## Troubleshooting

### Common Issues

| Issue               | Cause                    | Solution                             |
| ------------------- | ------------------------ | ------------------------------------ |
| Missing env vars    | `SUPABASE_URL` not set   | Export required variables            |
| Timeout on Stage 2  | BridgeWorker not running | Start the worker or increase timeout |
| Grading not applied | GradingAgent offline     | Verify agent health                  |
| Cleanup fails       | FK constraints           | Manual cleanup may be needed         |

### Debug Mode

```bash
# Enable verbose logging
DEBUG=smoke:* pnpm e2e:smoke:full
```

---

## Related Documents

- Lifecycle Contract: `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`
- Autopilot Freeze: `packages/shared-utils/CLAUDE.md`
- CI Pipeline: `.github/workflows/ci.yml`

---

**Document Owner**: Engineering Team **Sprint Reference**:
SPRINT-E2E-SMOKE-AUTOMATION-005
