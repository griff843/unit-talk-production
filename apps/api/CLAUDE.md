# CLAUDE.md - API Service

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A **Status**: AUTHORITATIVE
> **Role**: CANONICAL WRITER **Last Updated**: 2026-02-22

---

## Overview

The API is the **canonical writer** for all business tables. It owns agent
orchestration, grading, settlement, and the data pipeline. All writes to
`unified_picks` MUST go through this service via lifecycle adapters.

---

## Service Boundaries

### This Service OWNS

- Agent orchestration (BaseAgent framework)
- Grading logic (GradingAgent, ProfessionalPropProcessor)
- Settlement processing (SettlementAgent)
- Data pipeline (FeedAgent, BridgeWorker)
- Temporal workflows
- Lifecycle adapters (single-writer enforcement)
- Discord posting (DiscordPromotionAgent)

### This Service MUST NOT

- Serve UI assets
- Handle direct Discord interactions (bot commands)
- Define database schema (infrastructure concern)
- Bypass lifecycle adapters for `unified_picks` writes

---

## Read/Write Surfaces

### Write Authority

| Table              | Writer Role                          | Adapter                              |
| ------------------ | ------------------------------------ | ------------------------------------ |
| `unified_picks`    | submitter, promoter, poster, settler | `lifecycleInsert`, `lifecycleUpdate` |
| `prop_settlements` | settler                              | `lifecycleSettle`                    |
| `agent_health`     | agents                               | Direct (internal table)              |
| `agent_metrics`    | agents                               | Direct (internal table)              |

### Read Access

- All tables (canonical reader for business logic)

### Forbidden Patterns

```typescript
// NEVER do this:
await supabase.from('unified_picks').insert(data);
await supabase.from('unified_picks').update(data);

// ALWAYS do this:
await lifecycleInsert(supabase, data, { writerRole: 'submitter' });
await lifecycleUpdate(supabase, id, data, { writerRole: 'poster' });
```

---

## Environment Requirements

### All Profiles

| Variable   | Required | Description                         |
| ---------- | -------- | ----------------------------------- |
| `NODE_ENV` | Yes      | `development`, `test`, `production` |
| `PORT`     | No       | Default: 3000                       |

### Local Profile

| Variable                    | Required | Source |
| --------------------------- | -------- | ------ |
| `SUPABASE_URL`              | Yes      | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | `.env` |

### Docker Profile

| Variable                    | Required | Source               |
| --------------------------- | -------- | -------------------- |
| `SUPABASE_URL`              | Yes      | `docker-compose.yml` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | `docker-compose.yml` |
| `REDIS_URL`                 | Yes      | `redis://redis:6379` |

### CI Profile

| Variable       | Required    | Notes             |
| -------------- | ----------- | ----------------- |
| `CI`           | Yes         | Set automatically |
| `SUPABASE_URL` | Placeholder | Build-only        |

### Production Profile

| Variable                    | Required | Source      |
| --------------------------- | -------- | ----------- |
| `SUPABASE_URL`              | Yes      | K8s Secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | K8s Secrets |
| `REDIS_URL`                 | Yes      | K8s Secrets |
| `JWT_SECRET`                | Yes      | K8s Secrets |
| `DISCORD_TOKEN`             | Yes      | K8s Secrets |
| `DISCORD_WEBHOOK_URL`       | Yes      | K8s Secrets |

---

## Development Commands

### Development

```bash
# Local
pnpm --filter api dev

# Docker
docker-compose exec api npm run start:dev
docker-compose exec api npm run worker:dev
```

### Build & Verify

```bash
pnpm --filter api build
pnpm --filter api type-check
pnpm --filter api test
```

### Gates

```bash
# Single-writer gate (REQUIRED before merge)
npm run lifecycle:single-writer -- --strict
```

---

## Health Checks

### Endpoint

```
GET /health
```

### Expected Response

```json
{
  "status": "healthy",
  "service": "api",
  "supabase": "connected",
  "redis": "connected",
  "timestamp": "2026-02-22T12:00:00Z"
}
```

### Verification

```bash
# Local
curl http://localhost:3010/health

# Docker
docker-compose exec api curl http://localhost:3000/health

# Production
curl https://api.unit-talk.com/health
```

---

## Common Failure Modes

| Failure                      | Cause                       | Prevention                                             |
| ---------------------------- | --------------------------- | ------------------------------------------------------ |
| Direct `unified_picks` write | Bypassing lifecycle adapter | CI gate: `npm run lifecycle:single-writer -- --strict` |
| Missing env var              | Incomplete configuration    | Zod validation at boot                                 |
| Supabase host mismatch       | Wrong project URL           | Canonical host validation                              |
| Settlement double-write      | Race condition              | Idempotency via `atomicClaimForPost`                   |
| Agent health stale           | Agent crash                 | Health check polling                                   |

---

## Agent System

All agents extend `BaseAgent` from `src/agents/BaseAgent/`.

### Import Pattern

```typescript
import { BaseAgentConfig } from '@shared/types/base';
import { BaseAgent } from '../BaseAgent';
```

**Never redefine `BaseAgentConfig`** - always import from `@shared/types/base`.

### Agent Categories

| Category              | Agents                                                             |
| --------------------- | ------------------------------------------------------------------ |
| Business Intelligence | GradingAgent, AnalyticsAgent, AlertAgent, FeedAgent, RecapAgent    |
| Operational           | NotificationAgent, ContestAgent, PlayerEnrichmentAgent, AuditAgent |
| Lifecycle             | DiscordPromotionAgent, SettlementAgent                             |

---

## References

- Root Governance: `../../CLAUDE.md`
- Execution Contract: `../../CLAUDE_EXECUTION_CONTRACT.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`
- Env Contract: `../../docs/ENV_CONTRACT.md`
- Lifecycle Contract: `../../docs/contracts/PICK_LIFECYCLE_CONTRACT.md`

---

**Document Owner**: Engineering Team **Last Audit**:
SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
