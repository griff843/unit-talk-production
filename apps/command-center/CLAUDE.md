# CLAUDE.md - Unit Talk Command Center

> **Governance**: See [../../CLAUDE.md](../../CLAUDE.md) for Docker rules,
> secrets, database architecture, and service boundaries.

---

## Service Overview

The Command Center is the operational monitoring dashboard. It provides
real-time visibility into system health and agent status.

---

## Service Boundaries

### This Service OWNS

- Real-time monitoring dashboards
- Agent health visualization
- Operational controls (start/stop/restart)
- Event stream monitoring
- Replay capabilities

### This Service MUST NOT

- Execute grading logic
- Process settlements
- Modify agent behavior directly
- Write to business tables
- Define professional betting rules

**This service has READ-ONLY access to business tables.**

**Agent controls communicate with API, not database directly.**

---

## Development Commands

```bash
# Development
docker-compose exec command-center npm run dev

# Build
docker-compose exec command-center npm run build

# Type check
docker-compose exec command-center npm run type-check

# Test
docker-compose exec command-center npm test
docker-compose exec command-center npm run test:e2e

# Lint
docker-compose exec command-center npm run lint
```

---

## Architecture

### Directory Structure

```
app/
├── dashboard/
│   ├── overview/
│   ├── agents/
│   ├── analytics/
│   └── settings/
└── api/
    ├── agents/
    ├── system/
    └── websocket/
```

### Technology Stack

- Next.js 14 (App Router)
- Supabase real-time subscriptions
- React Query
- Zustand
- D3.js, Recharts

---

## Real-Time Integration

### Supabase Subscriptions

```typescript
// Agent health monitoring (read-only)
supabase
  .channel('agent-health')
  .on(
    'postgres_changes',
    {
      event: '*',
      table: 'agent_health',
    },
    handler
  )
  .subscribe();
```

### Event Stream

- Server-Sent Events (SSE) for pipeline events
- Real-time filtering
- Replay capabilities

---

## API Endpoints

### Monitoring (Read-Only)

- `GET /api/events` - Pipeline events
- `GET /api/stream` - SSE stream
- `GET /api/monitoring/pipeline` - Pipeline metrics
- `GET /api/health` - Health status

### Control (via API proxy)

- `POST /api/agents/:id/restart` - Proxy to API
- `POST /api/admin/freeze` - Emergency freeze
- `POST /api/admin/safe-mode` - Safe mode

**Control endpoints proxy to API service - they do not write directly.**

---

## v3.0.0 Database Access

### Read Patterns

```typescript
// Correct Supabase syntax
const { data } = await supabase.from('unified_picks').select(`
    id, user_id, selection, odds,
    users!unified_picks_user_id_fkey (username, tier)
  `);
```

### Tables Accessed (Read-Only)

- `unified_picks`
- `agent_health`
- `agent_metrics`
- `agent_logs`
- `users`

---

## Security

### Role-Based Access

```typescript
enum Permission {
  VIEW_DASHBOARD = 'view:dashboard',
  CONTROL_AGENTS = 'control:agents',
  MANAGE_USERS = 'manage:users',
  EMERGENCY_CONTROLS = 'emergency:controls',
}
```

### Emergency Controls

- Require explicit permission
- Require confirmation dialog
- Logged to audit trail

---

**Status**: See CI/CD pipelines
