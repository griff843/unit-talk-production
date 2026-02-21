# Environment Contract

**Sprint**: SPRINT-FOUNDATION-TRUTH-LOCK-094A **Date**: 2026-02-21 **Status**:
CANONICAL

---

## Overview

This document defines ALL required environment variables for the Unit Talk
Platform. Compliance is enforced by `scripts/ops/env-audit.ts`.

---

## Environment Hierarchy

```
.env (root)                    # Primary source - all apps read from here
├── apps/smart-form/.env.local # Smart Form overrides (must match Supabase URL)
├── apps/command-center/.env.local # CC overrides (must match Supabase URL)
└── Docker compose env_file    # Uses root .env
```

**RULE**: All apps MUST point to the SAME Supabase instance.

---

## Key Categories

### 1. SUPABASE (Critical - All Apps)

| Key                             | Required | Used By                 | Failure Mode   |
| ------------------------------- | -------- | ----------------------- | -------------- |
| `SUPABASE_URL`                  | Yes      | API, Workers, Scripts   | Boot fails     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | API, Workers            | DB writes fail |
| `SUPABASE_ANON_KEY`             | Yes      | Smart Form, CC (client) | Auth fails     |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Smart Form, CC          | Client fails   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Smart Form, CC          | Client fails   |

### 2. DISCORD (Critical - Worker Pipeline)

| Key                                 | Required | Used By                       | Failure Mode                  |
| ----------------------------------- | -------- | ----------------------------- | ----------------------------- |
| `DISCORD_WEBHOOK_URL`               | Yes\*    | Worker, DiscordPromotionAgent | Posts fail (WEBHOOK_MISSING)  |
| `DEFAULT_DISCORD_TICKET_CHANNEL_ID` | Yes\*    | Smart Form enqueue            | Enqueue fails (ROUTE_MISSING) |
| `ENABLE_DISCORD_TICKET_WORKER`      | Yes      | API                           | Worker doesn't start          |
| `DISCORD_TOKEN`                     | Yes\*    | Discord Bot                   | Bot offline                   |
| `DISCORD_CLIENT_ID`                 | Yes\*    | Discord Bot                   | Bot auth fails                |

\*Required for Discord functionality; app runs without but Discord features
disabled.

### 3. DISCORD (Optional - Advanced)

| Key                            | Required | Used By            | Default     |
| ------------------------------ | -------- | ------------------ | ----------- |
| `TICKET_DISCORD_POLL_INTERVAL` | No       | Worker             | 10000 (10s) |
| `TICKET_DISCORD_BATCH_SIZE`    | No       | Worker             | 10          |
| `DISCORD_OPERATOR_WEBHOOK_URL` | No       | AlertAgent         | None        |
| `DISCORD_APPROVED_WEBHOOK_URL` | No       | AlertAgent         | None        |
| `OPS_DISCORD_CHANNEL_ID`       | No       | OpsDigestScheduler | None        |
| `OPS_DISCORD_WEBHOOK_URL`      | No       | Playbooks          | None        |

### 4. TEMPORAL (Required for Workflows)

| Key                   | Required | Used By      | Default        |
| --------------------- | -------- | ------------ | -------------- |
| `TEMPORAL_ADDRESS`    | Yes\*    | API, Workers | localhost:7233 |
| `TEMPORAL_NAMESPACE`  | No       | API, Workers | default        |
| `TEMPORAL_TASK_QUEUE` | No       | API, Workers | unit-talk-main |

\*Required if Temporal workflows are active.

### 5. REDIS (Required for Caching)

| Key         | Required | Used By      | Default                |
| ----------- | -------- | ------------ | ---------------------- |
| `REDIS_URL` | Yes\*    | API, Workers | redis://localhost:6379 |

\*Required if Redis caching is active.

### 6. EXTERNAL APIs

| Key               | Required | Used By       | Failure Mode             |
| ----------------- | -------- | ------------- | ------------------------ |
| `OPTIMAL_API_KEY` | No       | FeedAgent     | Optimal data unavailable |
| `ODDS_API_KEY`    | No       | FeedAgent     | Uses fallback key        |
| `OPENAI_API_KEY`  | No       | AI features   | AI features disabled     |
| `SGO_API_KEY`     | No       | SGO ingestion | SGO unavailable          |

### 7. SECURITY

| Key              | Required | Used By         | Failure Mode     |
| ---------------- | -------- | --------------- | ---------------- |
| `JWT_SECRET`     | Yes\*    | Auth            | Auth fails       |
| `ENCRYPTION_KEY` | Yes\*    | Data encryption | Encryption fails |

\*Required for security-sensitive deployments.

### 8. RUNTIME

| Key         | Required | Used By | Default     |
| ----------- | -------- | ------- | ----------- |
| `NODE_ENV`  | No       | All     | development |
| `PORT`      | No       | API     | 3000        |
| `LOG_LEVEL` | No       | All     | debug       |

---

## Validation Rules

### Boot-Time Validation

The API MUST fail to boot if these keys are missing:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### Runtime Warnings

The worker MUST log warnings if:

```
DISCORD_WEBHOOK_URL missing → Worker skips batch processing
DEFAULT_DISCORD_TICKET_CHANNEL_ID missing → Enqueue fails (ROUTE_MISSING)
ENABLE_DISCORD_TICKET_WORKER !== 'true' → Worker doesn't start
```

### Cross-App Consistency

All `.env` files MUST have matching:

```
SUPABASE_URL fingerprint (project ID)
NEXT_PUBLIC_SUPABASE_URL fingerprint (project ID)
```

---

## Audit Command

```bash
npm run env:audit
```

Outputs:

- Missing required keys
- Mismatched Supabase URLs
- Overall pass/fail status

---

## Environment-Specific Requirements

### Local Development

Minimum required:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

Discord features require:

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx
DEFAULT_DISCORD_TICKET_CHANNEL_ID=xxx
ENABLE_DISCORD_TICKET_WORKER=true
```

### CI/CD

Uses GitHub Secrets. Required:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### Production

All keys in Categories 1-2 are required.

---

## Source of Truth

| Source              | Priority | Used When           |
| ------------------- | -------- | ------------------- |
| `.env` (root)       | Primary  | Direct node, Docker |
| `apps/*/.env.local` | Override | Direct node only    |
| Docker env_file     | Primary  | Docker compose      |
| GitHub Secrets      | Primary  | CI/CD               |

---

## Sprint Reference

- SPRINT-FOUNDATION-TRUTH-LOCK-094A: Environment contract
- SPRINT-END-TO-END-TICKET-LIFECYCLE-TRUTH-093: Worker heartbeats
- SPRINT-DISCORD-OUTBOX-ROUTING-CLAIM-092: Channel routing
