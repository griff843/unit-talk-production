# CLAUDE.md - Dashboard

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A **Status**: AUTHORITATIVE
> **Role**: READ-ONLY ANALYTICS **Last Updated**: 2026-02-22

---

## Overview

The Dashboard is the analytics and management frontend. It provides read-only
visualization of platform data including user analytics, capper performance, and
contest metrics. **This service is READ-ONLY**.

---

## Service Boundaries

### This Service OWNS

- Analytics visualization
- User management UI
- Capper management UI
- Contest UI
- Performance charts

### This Service MUST NOT

- Execute backend logic
- Modify agent state
- Process settlements
- Write to any database tables
- Define grading rules
- Access service-role keys

**This service is READ-ONLY.**

---

## Read/Write Surfaces

### Write Authority

**NONE** - This service is read-only.

### Read Access

| Table           | Purpose           |
| --------------- | ----------------- |
| `unified_picks` | Analytics data    |
| `users`         | User display      |
| `cappers`       | Capper stats      |
| `contests`      | Contest data      |
| `analytics`     | Dashboard metrics |

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
pnpm --filter dashboard dev

# Docker
docker-compose exec dashboard npm run dev
```

### Build & Verify

```bash
pnpm --filter dashboard build
pnpm --filter dashboard type-check
pnpm --filter dashboard test
```

---

## Health Checks

### Endpoint

```
GET /api/system/health
```

### Expected Response

```json
{
  "status": "healthy",
  "service": "dashboard",
  "timestamp": "2026-02-22T12:00:00Z"
}
```

### Verification

```bash
# Local
curl http://localhost:3003/api/system/health

# Docker
curl http://localhost:3003/api/system/health

# Production
curl https://dashboard.unit-talk.com/api/system/health
```

---

## Common Failure Modes

| Failure                  | Cause                           | Prevention                    |
| ------------------------ | ------------------------------- | ----------------------------- |
| Build-time secret access | Requiring service-role at build | Only use anon key in frontend |
| Supabase host mismatch   | Wrong project URL               | Canonical host validation     |
| Stale analytics          | Data sync issue                 | Real-time subscriptions       |
| Auth redirect loop       | Session handling bug            | Middleware auth checks        |

---

## Technology Stack

- Next.js 14 (App Router)
- Zustand (client state)
- React Query (server state)
- Recharts, D3.js
- Radix UI
- Tailwind CSS

---

## References

- Root Governance: `../../CLAUDE.md`
- Execution Contract: `../../CLAUDE_EXECUTION_CONTRACT.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`
- Env Contract: `../../docs/ENV_CONTRACT.md`

---

**Document Owner**: Engineering Team **Last Audit**:
SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
