# CLAUDE.md - Data Access Package

> **Sprint**: SPRINT-REPO-TRUTH-LOCK-002 **Status**: AUTHORITATIVE **Role**:
> DATABASE CLIENT FACTORY **Last Updated**: 2026-03-06

---

## Overview

The data-access package provides a canonical Supabase client factory. All apps
should use `createSupabaseClientFromConfig()` for consistent client creation.

---

## Package Boundaries

### This Package OWNS

- `createSupabaseClientFromConfig()` factory function
- `SupabaseClientConfig` and `ClientMode` types

### This Package MUST NOT

- Read environment variables directly (caller provides config)
- Contain business logic or query builders
- Import from `apps/` or service packages

---

## Key Exports

```typescript
import {
  createSupabaseClientFromConfig,
  type SupabaseClientConfig,
  type ClientMode,
} from '@unit-talk/data-access';
```

---

## Usage

```typescript
const client = createSupabaseClientFromConfig({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  mode: 'service',
});
```

---

## Development Commands

```bash
pnpm --filter data-access type-check
pnpm --filter data-access build
```

---

## References

- Root Governance: `../../CLAUDE.md`

---

**Document Owner**: Engineering Team **Last Audit**: SPRINT-REPO-TRUTH-LOCK-002
