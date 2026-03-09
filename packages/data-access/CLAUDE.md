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
  key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  mode: 'service_role',
});
```

### ClientMode Options

| Mode           | `persistSession` | `autoRefreshToken` | Use Case                |
| -------------- | ---------------- | ------------------ | ----------------------- |
| `service_role` | false            | false              | Server-side API, agents |
| `anon`         | false            | false              | Public/unauthenticated  |
| `user`         | true             | true               | Browser clients         |

---

## Adoption Status

| App            | Status  | Notes                                             |
| -------------- | ------- | ------------------------------------------------- |
| API            | ADOPTED | `services/supabaseClient.ts`, `utils/supabase.ts` |
| Command Center | PENDING | Complex wrapper (1000+ LOC)                       |
| Discord Bot    | N/A     | Placeholder only                                  |
| Smart Form     | PENDING | Minimal direct DB access                          |

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
