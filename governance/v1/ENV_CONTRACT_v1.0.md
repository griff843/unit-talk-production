--------------------------------------------------
Governance Tier: TIER 1 — CONSTITUTIONAL LAW
Version: v1.0
Ratification Date: 2026-02-27
Approval Authority: Griff (Operator)
---

---

# Environment Variable Contract

> **Sprint**: SPRINT-SYNDICATE-FOUNDATION-REALIGN-114A **Status**: AUTHORITATIVE
> **Last Updated**: 2026-02-22

This document defines the authoritative contract for all environment variables
in the Unit Talk Platform. All apps MUST adhere to this contract.

---

## Core Principles

1. **Fail-Closed**: Missing required vars MUST crash at startup, not at runtime
2. **No Guessing**: All vars are explicitly documented
3. **Profile-Aware**: Different profiles have different requirements
4. **Build vs Runtime**: Clear separation of build-time and runtime vars
5. **No Secrets in Logs**: Sensitive vars MUST NOT be logged

---

## Profiles

| Profile      | Use Case                   | Database    | Discord  |
| ------------ | -------------------------- | ----------- | -------- |
| `local`      | Local dev without Docker   | Cloud/Local | Optional |
| `docker`     | Docker Compose development | Via DB_MODE | Optional |
| `ci`         | CI/CD pipelines            | None/Mock   | Disabled |
| `production` | Production deployment      | Cloud       | Required |

---

## Variable Categories

### 1. Core Application (All Profiles)

| Variable    | Type   | Required | Default       | Description                   |
| ----------- | ------ | -------- | ------------- | ----------------------------- |
| `NODE_ENV`  | enum   | Yes      | `development` | `development/production/test` |
| `LOG_LEVEL` | enum   | No       | `info`        | `error/warn/info/debug`       |
| `PORT`      | number | No       | Per app       | HTTP server port              |

### 2. Database (Runtime-Only)

| Variable                    | Type   | Required        | Default | Description                  |
| --------------------------- | ------ | --------------- | ------- | ---------------------------- |
| `DB_MODE`                   | enum   | No              | `cloud` | `cloud` or `local`           |
| `SUPABASE_URL`              | URL    | cloud mode      | -       | Supabase project URL         |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | cloud mode      | -       | Supabase service role key    |
| `SUPABASE_ANON_KEY`         | secret | cloud mode (FE) | -       | Supabase anon key for FE     |
| `DATABASE_URL`              | URL    | local mode      | -       | Direct PostgreSQL connection |

**Important**: Database variables are RUNTIME-ONLY. Builds MUST NOT require
them.

### 3. Build-Time Variables (Next.js)

| Variable                        | Type   | Required  | Description            |
| ------------------------------- | ------ | --------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL    | FE builds | Public Supabase URL    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | string | FE builds | Public anon key        |
| `NEXT_PUBLIC_API_URL`           | URL    | FE builds | API endpoint URL       |
| `NEXT_PUBLIC_ENV`               | string | No        | Environment identifier |

**Warning**: NEXT*PUBLIC*\* vars are embedded at BUILD TIME in Next.js. Docker
builds MUST provide these as build args or env vars.

### 4. Temporal (Runtime-Only)

| Variable              | Type   | Required | Default          | Description          |
| --------------------- | ------ | -------- | ---------------- | -------------------- |
| `TEMPORAL_ADDRESS`    | string | No       | `localhost:7233` | Temporal server addr |
| `TEMPORAL_NAMESPACE`  | string | No       | `default`        | Temporal namespace   |
| `TEMPORAL_TASK_QUEUE` | string | No       | `unit-talk-main` | Default task queue   |

### 5. Redis (Runtime-Only)

| Variable     | Type   | Required | Default                  | Description      |
| ------------ | ------ | -------- | ------------------------ | ---------------- |
| `REDIS_URL`  | URL    | No       | `redis://localhost:6379` | Redis connection |
| `REDIS_HOST` | string | No       | `localhost`              | Redis host       |
| `REDIS_PORT` | number | No       | `6379`                   | Redis port       |

### 6. Discord (Runtime-Only)

| Variable                            | Type   | Required    | Description               |
| ----------------------------------- | ------ | ----------- | ------------------------- |
| `DISCORD_TOKEN`                     | secret | discord-bot | Bot authentication token  |
| `DISCORD_CLIENT_ID`                 | string | discord-bot | Discord application ID    |
| `DISCORD_WEBHOOK_URL`               | URL    | posting     | Main posting webhook      |
| `DISCORD_OPERATOR_WEBHOOK_URL`      | URL    | No          | Operator alerts webhook   |
| `DEFAULT_DISCORD_TICKET_CHANNEL_ID` | string | posting     | Default channel for posts |
| `ENABLE_DISCORD_TICKET_WORKER`      | bool   | No          | Enable ticket worker      |

### 7. External APIs (Runtime-Only)

| Variable          | Type   | Required | Description      |
| ----------------- | ------ | -------- | ---------------- |
| `ODDS_API_KEY`    | secret | No       | The Odds API key |
| `OPTIMAL_API_KEY` | secret | No       | Optimal API key  |
| `SGO_API_KEY`     | secret | No       | SGO API key      |
| `OPENAI_API_KEY`  | secret | AI       | OpenAI API key   |

### 8. Professional Scoring (Runtime-Only)

| Variable         | Type | Required | Default | Description              |
| ---------------- | ---- | -------- | ------- | ------------------------ |
| `USE_PRO_SCORER` | bool | No       | `false` | Enable pro scoring       |
| `SCORING_DEBUG`  | bool | No       | `false` | Enable scoring debug log |

### 9. Security (Runtime-Only)

| Variable         | Type   | Required   | Description                    |
| ---------------- | ------ | ---------- | ------------------------------ |
| `JWT_SECRET`     | secret | auth       | JWT signing secret (32+ chars) |
| `ENCRYPTION_KEY` | secret | encryption | AES encryption key (32 chars)  |

---

## Profile Requirements Matrix

### Local Profile

```bash
# Required
NODE_ENV=development

# Optional (defaults work)
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379
TEMPORAL_ADDRESS=localhost:7233

# Database (pick one mode)
DB_MODE=cloud
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Docker Profile

```bash
# Required
NODE_ENV=development
DB_MODE=cloud  # or local

# Database (cloud mode)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Frontend builds (REQUIRED for Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_API_URL=http://localhost:3010
```

### CI Profile

```bash
# Required
NODE_ENV=test
CI=true

# Frontend builds (placeholder values OK for type-check)
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder

# Database NOT required - mocked in tests
```

### Production Profile

```bash
# Required
NODE_ENV=production
DB_MODE=cloud

# Database (ALL required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Frontend (embedded at build)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_API_URL=https://api.unittalk.com

# Discord (required for posting)
DISCORD_TOKEN=xxx
DISCORD_WEBHOOK_URL=xxx
DEFAULT_DISCORD_TICKET_CHANNEL_ID=xxx

# Security (required)
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx
```

---

## Validation Rules

### Build-Time Checks

The following checks run at build time:

1. **Type-check**: All apps MUST pass `tsc --noEmit`
2. **Lint**: All apps MUST pass ESLint without errors
3. **Build**: All apps MUST produce valid build artifacts

### Runtime Checks

The following checks run at startup:

1. **Required vars**: App crashes if missing required vars for profile
2. **Format validation**: URLs must be valid URLs, numbers must parse
3. **Supabase endpoint**: MUST match canonical host (SPRINT-110A)

### Health Endpoint Validation

Health endpoints MUST:

1. Check actual database connectivity (no mocks)
2. Report accurate Redis status
3. Report "unhealthy" if required services unavailable
4. Never use demo/fake data

---

## Canonical Supabase Host

Per SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A:

```
CANONICAL_HOST: cqfnsozknjzvyiziwicl.supabase.co
```

Any other host is rejected. This is enforced by:

- `apps/smart-form/lib/env.ts`
- `apps/command-center/src/lib/env.ts`
- Health endpoints

---

## Adding New Variables

To add a new environment variable:

1. Document in this file (ENV_CONTRACT.md)
2. Add to `.env.example` with description
3. Add to Zod schema in `packages/config/src/env-schema.ts`
4. Update relevant profile requirements
5. Update Dockerfile build args if build-time required

---

## Enforcement

This contract is enforced by:

1. **CI Pipeline**: Runs `pnpm ops:env:check` before merge
2. **Runtime Validation**: Apps validate on startup
3. **Health Endpoints**: Report configuration status
4. **Pre-Sprint Check**: Validates baseline before sprint work

---

## References

- `.env.example` - Template with all variables
- `packages/config/src/env-schema.ts` - Zod validation schema
- `governance/v1/CLAUDE_EXECUTION_CONTRACT_v1.0.md` - Execution rules
- `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` - Sprint governance
