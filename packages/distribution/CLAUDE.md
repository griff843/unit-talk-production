# CLAUDE.md - Distribution Package

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Status**: AUTHORITATIVE **Role**:
> DISTRIBUTION INTERFACES **Last Updated**: 2026-03-06

---

## Overview

The distribution package defines canonical interfaces for pick/alert/recap
publishing across distribution channels (Discord, webhooks, etc.). Currently
types-only — no runtime implementations yet.

---

## Package Boundaries

### This Package OWNS

- `PublishPickPayload`, `PublishAlertPayload`, `PublishRecapPayload` types
- `DistributionChannel` interface
- `DistributionResult` type

### This Package MUST NOT

- Contain runtime implementations (future sprint)
- Import from `apps/` or service packages
- Import Supabase or other I/O libraries

---

## Key Exports

```typescript
import type {
  PublishPickPayload,
  PublishAlertPayload,
  PublishRecapPayload,
  DistributionChannel,
  DistributionResult,
} from '@unit-talk/distribution';
```

---

## Development Commands

```bash
pnpm --filter distribution type-check
pnpm --filter distribution build
```

---

## References

- Root Governance: `../../CLAUDE.md`

---

**Document Owner**: Engineering Team **Last Audit**: SPRINT-REPO-TRUTH-LOCK-002
