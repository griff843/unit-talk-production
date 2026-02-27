# CLAUDE.md - Shared Types Package

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A **Status**: AUTHORITATIVE
> **Role**: TYPE DEFINITIONS **Last Updated**: 2026-02-22

---

## Overview

The shared-types package provides centralized TypeScript type definitions for
the entire platform. All services import types from here to ensure consistency.

---

## Package Boundaries

### This Package OWNS

- TypeScript interfaces and types
- Zod schemas for runtime validation
- Type exports for all shared entities

### This Package MUST NOT

- Contain runtime logic (beyond Zod schemas)
- Import from service packages
- Contain environment-specific code

---

## Key Exports

```typescript
// Base types
import { BaseAgentConfig, AgentStatus } from '@unit-talk/shared-types';

// Pick types
import {
  UnifiedPick,
  PickStatus,
  LifecycleStage,
} from '@unit-talk/shared-types';

// User types
import { User, UserTier, CapperProfile } from '@unit-talk/shared-types';

// Event types
import { BridgeOutboxEvent, EventType } from '@unit-talk/shared-types';

// Settlement types
import { Settlement, SettlementStatus } from '@unit-talk/shared-types';
```

---

## Type Categories

| Category   | Purpose             | Key Types                                       |
| ---------- | ------------------- | ----------------------------------------------- |
| Agent      | Agent configuration | `BaseAgentConfig`, `AgentStatus`, `AgentHealth` |
| Pick       | Pick lifecycle      | `UnifiedPick`, `PickStatus`, `LifecycleStage`   |
| User       | User management     | `User`, `UserTier`, `CapperProfile`             |
| Event      | Bridge events       | `BridgeOutboxEvent`, `EventType`                |
| Settlement | Settlements         | `Settlement`, `SettlementStatus`                |

---

## Usage Pattern

### In Services

```typescript
// Import from shared-types, never redefine
import { BaseAgentConfig } from '@unit-talk/shared-types';

// Extend if needed
interface MyAgentConfig extends BaseAgentConfig {
  customField: string;
}
```

### With Zod Validation

```typescript
import { UnifiedPickSchema } from '@unit-talk/shared-types';

// Runtime validation
const validatedPick = UnifiedPickSchema.parse(rawData);
```

---

## Invariants Enforced

| Invariant                         | Enforcement                                  |
| --------------------------------- | -------------------------------------------- |
| #10 Schema Single Source of Truth | Centralized type definitions                 |
| #7 State Machine Validity         | `LifecycleStage` enum with valid transitions |

---

## Development Commands

```bash
# Type check
pnpm --filter shared-types type-check

# Build
pnpm --filter shared-types build
```

---

## References

- Root Governance: `../../CLAUDE.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`

---

**Document Owner**: Engineering Team **Last Audit**:
SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
