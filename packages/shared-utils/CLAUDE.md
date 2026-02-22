# CLAUDE.md - Shared Utils Package

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
> **Status**: AUTHORITATIVE
> **Role**: SHARED UTILITIES
> **Last Updated**: 2026-02-22

---

## Overview

The shared-utils package provides utility functions used across services. Key functionality includes the Redis-backed autopilot freeze mechanism.

---

## Package Boundaries

### This Package OWNS

- Autopilot freeze state management (Redis-backed)
- Common utility functions
- Shared helper functions

### This Package MUST NOT

- Contain business logic
- Define service-specific utilities
- Access database directly (except Redis for state)

---

## Key Exports

### Autopilot Freeze

```typescript
import {
  isAutopilotFrozen,
  isAutopilotFrozenAsync,
  getAutopilotState,
  getAutopilotStateAsync,
  setAutopilotState,
  isRedisHealthy,
  disconnectRedis
} from '@unit-talk/shared-utils';
```

---

## Autopilot Freeze Mechanism

### Behavior

The autopilot freeze is a safety mechanism that halts automated operations.

```typescript
// Check if frozen (async, distributed)
const frozen = await isAutopilotFrozenAsync();
if (frozen) {
  // Skip automated operation
  return;
}
```

### Storage

| Environment | Storage | Fallback |
|-------------|---------|----------|
| Production | Redis | Frozen (fail-closed) |
| Local (LOCAL_FILE_STATE=true) | File | None |
| CI | None | Not frozen |

### Fail-Closed Behavior

```typescript
// If Redis unavailable in production:
// → Returns frozen=true (safe default)
// → Logs warning
// → Does NOT allow operations to proceed
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Redis connection string |
| `LOCAL_FILE_STATE` | Use file-based state (dev only) |

---

## Invariants Enforced

| Invariant | Enforcement |
|-----------|-------------|
| #2 Fail-Closed Environment | Redis failure → frozen (safe default) |

---

## Commands

```bash
# Type check
pnpm --filter shared-utils type-check

# Build
pnpm --filter shared-utils build

# Test
pnpm --filter shared-utils test
```

---

## References

- Root Governance: `../../CLAUDE.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`
- Ops Wiring Plan: `../../docs/OPS_WIRING_PLAN.md`

---

**Document Owner**: Engineering Team
**Last Audit**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
