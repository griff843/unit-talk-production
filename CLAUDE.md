# CLAUDE.md - Unit Talk Platform

> **GOVERNANCE AUTHORITY**: This is the single source of truth for all AI coding
> rules. All app-level CLAUDE.md files defer to this document.

---

## 1. Absolute Rules

**NO STATIC CLAIMS ALLOWED:**

- No percentage readiness ("100%", "100/100")
- No "Production Ready" statements
- No date-based status
- No hard-coded test counts
- No agent counts
- No performance metrics

**ALL STATUS MUST REFERENCE:**

- CI/CD pipelines
- Health endpoints (`/health`)
- Database tables (`agent_health`)
- Monitoring dashboards

---

## 2. Docker-First Development

**All operations MUST run within Docker containers.**

### Rules

1. All services run via `docker-compose` or `./dev.sh`
2. Never run `npm`, `node`, `npx` directly on local machine
3. Environment variables in `.env` and `docker-compose.yml` only
4. Dependencies: Edit `package.json` then `./dev.sh restart`

### Command Reference

| Action       | Command                                          |
| ------------ | ------------------------------------------------ |
| Start        | `./dev.sh start`                                 |
| Stop         | `./dev.sh stop`                                  |
| Logs         | `./dev.sh logs`                                  |
| Status       | `./dev.sh status`                                |
| Run script   | `docker-compose exec <service> npm run <script>` |
| Shell access | `docker-compose exec <service> bash`             |

---

## 3. Secrets Management

**All credentials stored in GitHub Secrets, NOT local .env files.**

### Rules

1. GitHub Secrets = Source of Truth
2. Local `.env` = Templates only
3. Never hardcode secrets
4. Scripts requiring secrets run via GitHub Actions

### Categories

| Type     | Examples                                    |
| -------- | ------------------------------------------- |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Database | `DATABASE_DIRECT_URL`, `POSTGRES_PASSWORD`  |
| Discord  | `DISCORD_BOT_TOKEN`                         |
| APIs     | `OPTIMAL_API_KEY`, `ODDS_API_KEY`           |

---

## 4. Repository Structure

```
unit-talk-platform/
├── apps/
│   ├── api/              # Backend API & Agents
│   ├── command-center/   # Operations Dashboard
│   ├── dashboard/        # Analytics Frontend
│   ├── discord-bot/      # Discord Integration
│   └── smart-form/       # Ticket Submission
├── packages/             # Shared packages
├── docs/                 # Documentation
└── infrastructure/       # IaC
```

---

## 5. v3.0.0 Database Architecture

### Canonical Table

**`unified_picks`** is the single canonical pick management table.

`daily_picks` is **DEPRECATED** - do not use.

### Core Tables

| Table               | Purpose                 | Status     |
| ------------------- | ----------------------- | ---------- |
| `unified_picks`     | Central pick management | CANONICAL  |
| `users`             | User/capper management  | ACTIVE     |
| `raw_props`         | Market data ingestion   | ACTIVE     |
| `agent_health`      | Agent status            | ACTIVE     |
| `agent_metrics`     | Agent performance       | ACTIVE     |
| `bridge_outbox`     | Event outbox            | ACTIVE     |
| `prop_settlements`  | Settlement records      | ACTIVE     |
| `closing_snapshots` | Level 3 CLV snapshots   | ACTIVE     |
| `daily_picks`       | Legacy picks            | DEPRECATED |

### Foreign Key Syntax

```typescript
// CORRECT
users!unified_picks_user_id_fkey (username)

// INCORRECT - causes "multiple relationships" error
users!user_id (username)
```

---

## 6. Service Boundaries

### API (apps/api)

**OWNS:** Agents, Grading, Settlement, Data Pipeline, Temporal Workflows

**MUST NOT:** Serve UI, Handle Discord directly

### Command Center (apps/command-center)

**OWNS:** Monitoring UI, Agent Controls, Event Stream

**MUST NOT:** Execute grading, Process settlements, Write to business tables

### Smart Form (apps/smart-form)

**OWNS:** Ticket UI, Form Validation, Bridge Outbox Creation

**MUST NOT:** Process tickets, Execute grading, Update unified_picks directly

### Dashboard (apps/dashboard)

**OWNS:** Analytics UI, User Management UI

**MUST NOT:** Execute backend logic, Write to any tables

### Discord Bot (apps/discord-bot)

**OWNS:** Discord interactions, Commands, Notifications

**MUST NOT:** Execute grading, Write directly to database

---

## 6.5 Market Taxonomy

### stat_type Normalization

Market prop types are normalized at ingestion via `IngestionAgent/normalize.ts`:

| Input               | Normalized |
| ------------------- | ---------- |
| POINTS              | PTS        |
| ASSISTS             | AST        |
| REBOUNDS            | REB        |
| THREE_POINTERS_MADE | 3PM        |
| STEALS              | STL        |
| BLOCKS              | BLK        |
| TURNOVERS           | TO         |

**Enforcement Level**: Application (IngestionAgent)

**Gap Noted**: No database ENUM constraint exists. Invalid stat_types may enter
if bypass occurs.

**Required Fields** (per `validateRawProp()`):

- `player_name` OR `team`
- `stat_type`
- `line`

---

## 7. Single-Writer Policy

Each table has designated writer service(s).

| Table                   | Writer(s)                   | Write Type                 | Readers        |
| ----------------------- | --------------------------- | -------------------------- | -------------- |
| `unified_picks`         | API (GradingAgent)          | INSERT                     | All            |
| `unified_picks`         | API (DiscordPromotionAgent) | UPDATE (posted_to_discord) | All            |
| `bridge_outbox`         | Smart Form                  | INSERT                     | API            |
| `agent_health`          | API (Agents)                | INSERT/UPDATE              | Command Center |
| `prop_settlements`      | API (SettlementAgent)       | INSERT/UPDATE              | All            |
| `closing_snapshots`     | API (SettlementAgent)       | INSERT                     | Analysis       |
| `shadow_promoted_picks` | API (ShadowModeService)     | INSERT                     | Analysis       |

---

## 8. Level 3 Close Infrastructure

### Shadow Mode System

The platform includes shadow mode for testing without public side effects.

**Configuration:**

```bash
SHADOW_MODE=false              # true = shadow only
SHADOW_PRIVATE_CHANNEL_ID=     # Optional preview channel
```

**Governance Rules:**

1. Shadow mode status is a runtime configuration, not documentation state
2. All promotions route through PublishGuard
3. When `SHADOW_MODE=true`, no public Discord messages are sent
4. Shadow data logs to `shadow_promoted_picks` table

### Settlement Immutability

**Rules:**

1. Once `settlement_result` is set, it cannot be modified except via dispute
2. Only `SettlementAgent` may write to settlement columns
3. Settlement confidence must be 0.0-1.0
4. Settlement source must be: 'oddsapi', 'optimal', 'manual', 'backup'

### Level 3 Database Artifacts

**closing_snapshots Table**:

- Stores CLV snapshots at multiple time points
- Fields: `prop_id`, `snapshot_type`, `closing_line`, `over_odds`, `under_odds`
- Snapshot types: 'opening', 'closing', 'hourly'

**calculate_weighted_close() Function**:

- Computes weighted closing line from multiple snapshots
- Default weights: t-5min: 0.5, t-15min: 0.3, t-30min: 0.2
- Used by SettlementAgent for CLV calculation

**Immutability Trigger**:

- `guard_closing_line_immutability()` prevents modification of `closing_line`
  once set
- Raises `CLV_IMMUTABILITY_VIOLATION` exception on violation
- Applies to `closing_snapshots` table

**Proof**: See `out/sprints/CLOSE-INFRA-LEVEL3-018/`

---

## 9. AI Execution Rules

**MANDATORY FOR ALL AI ASSISTANTS:**

1. **Never claim production readiness** - Reference CI/CD status
2. **Never invent agent counts** - Query `agent_health` table
3. **Never reference deprecated tables** - `daily_picks` is deprecated
4. **Always validate against schema** - Use `npm run db:status`
5. **Always verify via Docker** - No local npm commands
6. **Always respect single-writer policy** - Check service boundaries
7. **Never mutate settlement columns** - Only SettlementAgent writes
8. **Never bypass immutability** - Settlement and closing_line fields are
   protected
9. **Never hardcode metrics** - Query database or monitoring
10. **Always prefix commands with docker-compose exec**

---

## 10. Verification Sources

### CI/CD

| Check      | Source              |
| ---------- | ------------------- |
| TypeScript | CI `type-check` job |
| Tests      | CI `test` job       |
| Build      | CI `build` job      |
| E2E        | CI `test:e2e` job   |

### Health Endpoints

| Service  | Endpoint               |
| -------- | ---------------------- |
| API      | `/health`              |
| Pipeline | `/api/pipeline/health` |
| Agents   | `agent_health` table   |

### Monitoring

- Agent status: `agent_health` table
- Metrics: `agent_metrics` table
- Events: Command Center Event Stream

---

## 11. Development Workflow

```bash
# 1. Start environment
./dev.sh start

# 2. Database check
docker-compose exec api npm run db:status
docker-compose exec api npm run db:migrate

# 3. Type check
docker-compose exec api npm run type-check

# 4. Build
docker-compose exec api npm run build

# 5. Test
docker-compose exec api npm test
```

---

## 11.5 Architecture Verification

**Truth Sources** (in priority order):

1. SQL migrations (`migrations/*.sql`, `supabase/migrations/*.sql`)
2. Sprint verification artifacts (`out/sprints/**`)
3. CI/CD workflows (`.github/workflows/*.yml`)
4. Source code grep patterns

**Verification Commands**:

```bash
# Check single-writer compliance
rg "\.from\('unified_picks'\)\.(insert|update)" apps/ --type ts

# Check deprecated table usage
rg "daily_picks" apps/ --type ts

# Verify Level 3 artifacts
rg "closing_snapshots|weighted_close|immutability" supabase/migrations/
```

**Alignment Audit Location**: `out/alignment-audit/YYYY-MM-DD/`

---

## 12. Excellence Standards

- **TypeScript**: Strict mode, comprehensive types
- **Testing**: See CI coverage reports
- **Security**: Zero-trust architecture
- **Performance**: See monitoring dashboards

---

**Governance Owner**: Engineering Team **Status**: See CI/CD pipelines
**Architecture Verified**: 2026-02-16 (see `out/alignment-audit/2026-02-16/`)
