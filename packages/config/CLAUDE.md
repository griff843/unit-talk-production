# CLAUDE.md - Config Package

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A **Status**: AUTHORITATIVE
> **Role**: ENVIRONMENT VALIDATION **Last Updated**: 2026-02-22

---

## Overview

The config package provides centralized environment validation using Zod
schemas. It enforces fail-closed behavior: if required environment variables are
missing or malformed, applications crash at startup.

---

## Package Boundaries

### This Package OWNS

- Zod environment schemas
- Environment validation functions
- Profile-based configuration (local/docker/ci/prod)
- Canonical Supabase host validation

### This Package MUST NOT

- Contain business logic
- Store secrets
- Define service-specific configurations (those go in service CLAUDE.md)

---

## Key Exports

```typescript
// Environment validation
import { validateEnv, getEnvProfile } from '@unit-talk/config';

// Schemas
import { baseEnvSchema, supabaseEnvSchema } from '@unit-talk/config';

// Helpers
import { isCanonicalSupabaseHost, assertEnvVar } from '@unit-talk/config';
```

---

## Usage Pattern

### At Service Boot

```typescript
import { validateEnv, supabaseEnvSchema } from '@unit-talk/config';

// This will throw if validation fails (fail-closed)
const env = validateEnv(supabaseEnvSchema);

// Use validated env
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
```

### Canonical Host Validation

```typescript
import { isCanonicalSupabaseHost } from '@unit-talk/config';

const url = process.env.SUPABASE_URL;
if (!isCanonicalSupabaseHost(url)) {
  throw new Error(
    `Invalid Supabase host. Expected: cqfnsozknjzvyiziwicl.supabase.co`
  );
}
```

---

## Environment Profiles

| Profile      | Detection                        | Behavior                                  |
| ------------ | -------------------------------- | ----------------------------------------- |
| `local`      | `NODE_ENV=development` + no `CI` | Relaxed validation, optional vars allowed |
| `docker`     | `DOCKER=true`                    | Standard validation                       |
| `ci`         | `CI=true`                        | Placeholders allowed, no secrets required |
| `production` | `NODE_ENV=production`            | Strict validation, all vars required      |

---

## Invariants Enforced

| Invariant                      | Enforcement                            |
| ------------------------------ | -------------------------------------- |
| #2 Fail-Closed Environment     | Zod validation throws on missing vars  |
| #3 Canonical Supabase Host     | `isCanonicalSupabaseHost()` validation |
| #5 Build vs Runtime Separation | Profile-aware schema selection         |

---

## Development Commands

```bash
# Type check
pnpm --filter config type-check

# Build
pnpm --filter config build

# Test
pnpm --filter config test
```

---

## References

- Root Governance: `../../CLAUDE.md`
- Env Contract: `../../docs/ENV_CONTRACT.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`

---

**Document Owner**: Engineering Team **Last Audit**:
SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
