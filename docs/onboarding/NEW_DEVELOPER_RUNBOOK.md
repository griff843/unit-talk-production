# New Developer Runbook

Status: CANONICAL Authority: Tier 1 Owner: Platform Architecture Last Verified:
2026-03-07 Sprint: SPRINT-DOCS-CANONICALIZATION-040

---

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- Git

---

## 1. Clone & Install

```bash
git clone <repo-url> unit-talk-production
cd unit-talk-production
pnpm install
```

---

## 2. Environment Setup

Copy the example env file and fill in required values:

```bash
cp .env.example .env
```

**Minimum required variables**:

| Variable                    | Source                   | Purpose               |
| --------------------------- | ------------------------ | --------------------- |
| `SUPABASE_URL`              | Supabase dashboard       | Database endpoint     |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard       | Server-side DB access |
| `SUPABASE_ANON_KEY`         | Supabase dashboard       | Client-side DB access |
| `ODDS_API_KEY`              | the-odds-api.com         | Odds data ingestion   |
| `OPTIMAL_API_KEY`           | optimal-bet.com          | Player props data     |
| `DISCORD_TOKEN`             | Discord developer portal | Bot token             |
| `DISCORD_CLIENT_ID`         | Discord developer portal | Bot client ID         |
| `DISCORD_WEBHOOK_URL`       | Discord channel settings | Webhook for posting   |

**Optional for local development**:

| Variable           | Default                  | Purpose                                      |
| ------------------ | ------------------------ | -------------------------------------------- |
| `DB_MODE`          | `cloud`                  | Set to `local` for local PostgreSQL          |
| `TEMPORAL_ADDRESS` | `localhost:7233`         | Temporal server                              |
| `REDIS_URL`        | `redis://localhost:6379` | Redis cache                                  |
| `LOG_LEVEL`        | `info`                   | Logging verbosity                            |
| `SHADOW_MODE`      | `false`                  | Set `true` to disable public Discord posting |

All environment variables are validated at startup via Zod schemas in
`packages/config/src/schemas.ts`. Missing required vars cause fail-closed boot.

---

## 3. Start Services

```bash
# Start all Docker services (canonical entrypoint)
pnpm ops:day

# Or with local PostgreSQL instead of Supabase cloud
pnpm ops:day local
```

This starts:

| Service        | Port | URL                                 |
| -------------- | ---- | ----------------------------------- |
| API            | 3010 | http://localhost:3010               |
| Temporal UI    | 8088 | http://localhost:8088               |
| Grafana        | 3001 | http://localhost:3001 (admin/admin) |
| Prometheus     | 9090 | http://localhost:9090               |
| Smart Form     | 3021 | http://localhost:3021               |
| Command Center | 3004 | http://localhost:3004               |
| Dashboard      | 3003 | http://localhost:3003               |
| Redis          | 6379 | —                                   |

**Optional tool services** (start with `--profile tools`):

| Service         | Port | Purpose                                  |
| --------------- | ---- | ---------------------------------------- |
| pgAdmin         | 5050 | Database UI (admin@unittalk.com / admin) |
| Redis Commander | 8081 | Redis UI                                 |
| Mailhog         | 8025 | Email testing                            |

---

## 4. Verify Setup

```bash
# Type check all packages
pnpm type-check

# Build API
pnpm build --workspace=apps/api

# Run tests
pnpm test

# Check lifecycle gate
pnpm lifecycle:single-writer -- --strict
```

All four should pass before starting development.

---

## 5. Repository Structure

```
unit-talk-production/
├── apps/
│   ├── api/              # Backend API, agents, Temporal worker (CANONICAL WRITER)
│   ├── command-center/   # Operations dashboard (READ-ONLY)
│   ├── dashboard/        # Analytics frontend (READ-ONLY)
│   ├── discord-bot/      # Discord slash commands, onboarding
│   └── smart-form/       # Ticket submission (writes to bridge_outbox ONLY)
├── packages/
│   ├── config/           # Zod env validation, fail-closed boot
│   ├── contracts/        # Centralized TypeScript types
│   ├── data-access/      # Supabase client factory
│   ├── distribution/     # Distribution channel interfaces
│   ├── intelligence/     # Pure computation: devig, CLV, calibration
│   ├── observability/    # OpenTelemetry tracing, structured logging
│   └── shared/           # Redis-backed autopilot freeze
├── supabase/migrations/  # 48 SQL migration files
├── docs/                 # Documentation (you are here)
├── architecture/         # Design-layer contracts (Constitution)
├── governance/           # Governance records, ratification locks
└── out/                  # Sprint proofs & artifacts (gitignored)
```

---

## 6. Key Concepts

### Single-Writer Discipline

All writes to `unified_picks` go through lifecycle adapters. Direct Supabase
inserts/updates are forbidden.

```typescript
// CORRECT
import { lifecycleInsert } from '../lib/lifecycle';
await lifecycleInsert(supabase, pick, { writerRole: 'promoter' });

// FORBIDDEN
await supabase.from('unified_picks').insert(pick);
```

Gate: `pnpm lifecycle:single-writer -- --strict`

### Temporal Workflows

The platform uses Temporal for workflow orchestration. The main workflow is
`syndicateSchedulerWorkflow` which runs on a 1-minute (live) / 5-minute (idle)
cycle:

1. **Ingest** — FeedAgent pulls odds from providers
2. **Grade** — GradingAgent scores and promotes picks
3. **Distribute** — DiscordPromotionAgent posts to Discord
4. **Settle** — SettlementAgent settles against outcomes

### Service Boundaries

- **API** (`apps/api`) is the ONLY app that writes to business tables
- **Smart Form** writes ONLY to `bridge_outbox`
- **Command Center** and **Dashboard** are READ-ONLY
- **Discord Bot** handles slash commands and onboarding

---

## 7. Common Development Commands

```bash
# Development
pnpm dev                    # Start all services in dev mode
pnpm type-check             # TypeScript verification
pnpm lint                   # Run linters
pnpm format:write           # Auto-format code

# Testing
pnpm test                   # All tests
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests only

# Building
pnpm build                  # Build all workspaces
pnpm build --workspace=apps/api  # Build API only

# Database
pnpm schema:types:gen       # Regenerate Supabase types
pnpm schema:check-drift     # Check for schema drift

# Verification (run before committing)
pnpm verify:merge           # Full merge readiness check

# Docker
pnpm docker:up              # Start containers
pnpm docker:down            # Stop containers
pnpm docker:logs            # Stream logs
pnpm dev:status             # Container status
```

---

## 8. Sprint Workflow

All significant changes follow the sprint protocol:

1. **Branch**: `sprint/<name>-###`
2. **Implement**: Smallest working change set
3. **Verify**:
   `pnpm type-check && pnpm test && pnpm lifecycle:single-writer -- --strict`
4. **Proof**: Generate artifacts to `out/sprints/<SPRINT>/<date>/`
5. **Commit**: With sprint reference in message
6. **Tag**: `SPRINT-<NAME>-###-COMPLETE`
7. **Merge**: Fast-forward to main

See `docs/claude/SPRINT_WORKFLOW_TEMPLATE.md` for full template.

---

## 9. Key Documentation

| Document             | Location                                       | Purpose                    |
| -------------------- | ---------------------------------------------- | -------------------------- |
| Project Rules        | `CLAUDE.md`                                    | Governance and conventions |
| Execution Contract   | `CLAUDE_EXECUTION_CONTRACT.md`                 | Non-negotiable invariants  |
| System Overview      | `docs/system/SYSTEM_OVERVIEW.md`               | Architecture summary       |
| Runtime Path         | `docs/system/CANONICAL_RUNTIME_PATH.md`        | Data pipeline flow         |
| Pick Lifecycle       | `docs/contracts/PICK_LIFECYCLE_CONTRACT.md`    | Pick state machine         |
| Table Classification | `docs/governance/TABLE_CLASSIFICATION_SPEC.md` | Table tiers & writers      |
| Agent Matrix         | `docs/governance/AGENT_OWNERSHIP_MATRIX.md`    | Agent responsibilities     |
| Provider Spec        | `docs/governance/PROVIDER_AUTHORITY_SPEC.md`   | Data source routing        |

---

## 10. Troubleshooting

**Type check fails**: Run `pnpm schema:types:gen` to regenerate Supabase types,
then retry.

**Lifecycle gate fails**: Search for direct `unified_picks` writes outside
`lib/lifecycle/`. Use lifecycle adapters instead.

**Temporal worker won't start**: Ensure Temporal server is running
(`docker-compose up temporal`) and `TEMPORAL_ADDRESS` is set.

**Build fails on `_archived/`**: These files are excluded from production
tsconfig. If they appear in errors, check `tsconfig.json` excludes.

**Missing env vars at boot**: The platform uses fail-closed boot. Check
`packages/config/src/schemas.ts` for required variables and ensure `.env` has
them.

---

## Related Documents

- [System Overview](../system/SYSTEM_OVERVIEW.md)
- [Current System Status](../system/CURRENT_SYSTEM_STATUS.md)
- [Sprint Workflow Template](../claude/SPRINT_WORKFLOW_TEMPLATE.md)
