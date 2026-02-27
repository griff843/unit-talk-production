# CLAUDE.md - Command Center

> **Sprint**: SPRINT-DEMO-MODE-REMOVAL **Status**: AUTHORITATIVE **Role**:
> READ-ONLY DASHBOARD **Last Updated**: 2026-02-23

---

## Overview

The Command Center is the operational monitoring dashboard. It provides
real-time visibility into system health, agent status, and pipeline events.
**This service is READ-ONLY** - it does not write to business tables.

---

## Service Boundaries

### This Service OWNS

- Real-time monitoring dashboards
- Agent health visualization
- Operational controls UI (proxied to API)
- Event stream monitoring
- Replay capabilities

### This Service MUST NOT

- Execute grading logic
- Process settlements
- Modify agent behavior directly
- Write to business tables (`unified_picks`, `prop_settlements`)
- Define professional betting rules
- Access service-role keys at build time

**Agent controls communicate with API via proxy - they do not write directly.**

---

## Read/Write Surfaces

### Write Authority

**NONE** - This service is read-only.

### Read Access

| Table           | Purpose                    |
| --------------- | -------------------------- |
| `unified_picks` | Display picks in dashboard |
| `agent_health`  | Agent status monitoring    |
| `agent_metrics` | Performance metrics        |
| `agent_logs`    | Log visualization          |
| `users`         | User info display          |

### Control Endpoints (API Proxy)

| Endpoint                       | Action           | Proxied To  |
| ------------------------------ | ---------------- | ----------- |
| `POST /api/agents/:id/restart` | Restart agent    | API service |
| `POST /api/admin/freeze`       | Emergency freeze | API service |
| `POST /api/admin/safe-mode`    | Safe mode toggle | API service |

---

## Environment Requirements

### All Profiles

| Variable   | Required | Description                         |
| ---------- | -------- | ----------------------------------- |
| `NODE_ENV` | Yes      | `development`, `test`, `production` |

### Local Profile

| Variable                        | Required | Source |
| ------------------------------- | -------- | ------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | `.env` |

### Docker Profile

| Variable                        | Required | Source     |
| ------------------------------- | -------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Build args |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Build args |

**Note**: `NEXT_PUBLIC_*` vars are embedded at BUILD time, not runtime.

### CI Profile

| Variable                        | Required    | Notes      |
| ------------------------------- | ----------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Placeholder | Build-only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Placeholder | Build-only |

### Production Profile

| Variable                        | Required | Source           |
| ------------------------------- | -------- | ---------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Baked into image |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Baked into image |
| `NEXT_PUBLIC_API_URL`           | Yes      | Baked into image |

---

## Development Commands

### Development

```bash
# Local
pnpm --filter command-center dev

# Docker
docker-compose exec command-center npm run dev
```

### Build & Verify

```bash
pnpm --filter command-center build
pnpm --filter command-center type-check
pnpm --filter command-center test
```

### Gates

```bash
# No-mocks gate (REQUIRED before merge)
npm run cc:no-mocks
```

---

## Health Checks

### Endpoint

```
GET /api/health
```

### Expected Response

```json
{
  "status": "healthy",
  "service": "command-center",
  "supabase": "connected",
  "timestamp": "2026-02-23T12:00:00Z"
}
```

### Verification

```bash
# Local
curl http://localhost:3004/api/health

# Docker
curl http://localhost:3004/api/health

# Production
curl https://command.unit-talk.com/api/health
```

---

## Common Failure Modes

| Failure                    | Cause                           | Prevention                    |
| -------------------------- | ------------------------------- | ----------------------------- |
| SupabaseConfigurationError | Missing Supabase config         | Fail-closed, explicit error   |
| Build-time secret access   | Requiring service-role at build | Only use anon key in frontend |
| Supabase host mismatch     | Wrong project URL               | Canonical host validation     |
| Stale dashboard data       | Subscription disconnect         | Real-time reconnection logic  |
| API proxy failure          | API service down                | Health check + error boundary |

### Fail-Closed Behavior

```typescript
// If Supabase config missing:
// → SupabaseConfigurationError thrown (fail-closed)
// → No mock data, no silent fallbacks
// → Explicit error surfaced to user
```

---

## Technology Stack

- Next.js 14 (App Router)
- Supabase real-time subscriptions
- React Query
- Zustand
- D3.js, Recharts

---

## References

- Root Governance: `../../CLAUDE.md`
- Execution Contract: `../../CLAUDE_EXECUTION_CONTRACT.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`
- Env Contract: `../../docs/ENV_CONTRACT.md`
- Ops Wiring Plan: `../../docs/OPS_WIRING_PLAN.md`

---

**Document Owner**: Engineering Team **Last Audit**: SPRINT-DEMO-MODE-REMOVAL
