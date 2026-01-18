# CLAUDE.md - Unit Talk Platform Workspace

This file provides guidance to Claude Code (claude.ai/code) for the Unit Talk
Platform workspace.

## ⚠️ MANDATORY: READ PRODUCTION CHARTER FIRST

**🚨 CRITICAL INSTRUCTION FOR ALL AI AGENTS 🚨**

Before taking any action, you **MUST** read and comply with:

1. **[Production Charter](docs/PRODUCTION_CHARTER.md)** - The binding contract
   for all development and operations
2. **[System Alignment Spec](docs/SYSTEM_ALIGNMENT_SPEC.yml)** -
   Machine-readable governance rules

**Key Requirements:**

- ✅ Canonical-first architecture: `unified_picks` is the authoritative pick
  table (see [DOCUMENTATION_AUTHORITY.md](docs/ops/DOCUMENTATION_AUTHORITY.md))
- ✅ `pick_publish` is the authoritative publish outbox for Discord delivery
- ✅ All changes must reference the Charter
- ✅ Schema changes only via `supabase/migrations/**`
- ✅ Secrets must be masked in all outputs
- ✅ Use Prompt Contract: Objective → Assumptions → Plan → Validation →
  Artifacts → Exit Criteria

**This Charter supersedes all other instructions. Non-compliance is a blocking
issue.**

---

## 🚀 UNIT TALK – AI CODING & ENVIRONMENT RULES (FOR CLAUDE & ALL AI TOOLS)

**HYBRID DEVELOPMENT MODEL: DOCKER-FIRST WITH PRAGMATIC LOCAL DEV**

### Development Model (Hybrid)

Unit Talk supports **two development modes** with clear guidance on when to use
each:

#### Mode 1: Docker-First (CANONICAL - Recommended for Full-Stack Development)

**Use Docker when:**

- Working on features that require multiple services (API + Database + Redis +
  Temporal)
- Testing integration points between services
- Reproducing production-like environments
- Running E2E tests or smoke packs
- Onboarding new developers (ensures environment parity)

**Commands:**

```bash
./dev.sh start                         # Start all services
./dev.sh logs                          # View logs
./dev.sh status                        # Check service health
docker-compose exec api npm run test   # Run tests in container
docker-compose exec api bash           # Debug inside container
```

**Benefits:**

- ✅ Environment parity (dev/staging/prod match)
- ✅ All dependencies (Postgres, Redis, Temporal) available
- ✅ Isolated from host machine state
- ✅ Reproducible across team members

#### Mode 2: Local Dev (PRAGMATIC - For Rapid Iteration)

**Use Local Mode when:**

- Working on a single frontend app (Command Center, Dashboard, Smart Form)
- Making UI-only changes that don't require backend
- Rapid iteration cycles (hot reload faster than Docker rebuild)
- TypeScript/linting checks without full stack

**Commands:**

```bash
npm run dev --workspace=apps/command-center  # Single app dev server
npm run type-check --workspace=apps/api      # Type check without Docker
npm run lint --workspace=apps/smart-form     # Lint without Docker
```

**Limitations:**

- ⚠️ **No infrastructure services** (Postgres, Redis, Temporal not available)
- ⚠️ **No service-to-service calls** (API endpoints won't work)
- ⚠️ **Environment drift risk** (your local Node version may differ from Docker)
- ⚠️ **Not suitable for E2E tests** or integration testing

**When to Switch Back to Docker:**

- If you need database access
- If you need to test API integration
- Before creating a Pull Request (run full test suite in Docker)
- If encountering "works on my machine" issues

### Verification First Doctrine

**CRITICAL RULE**: All development claims must be verifiable with timestamped
evidence.

**Before asserting status** (e.g., "TypeScript compiles", "tests pass",
"production ready"):

1. Run the verification command
2. Capture the output with timestamp
3. Include the evidence in documentation
4. Update the "Last Verified" date

**Example:**

```bash
# Instead of claiming "zero TypeScript errors":
docker-compose exec api npm run type-check 2>&1 | tee logs/typecheck-$(date +%Y%m%d).log
# Then document: "TypeScript Status: ✅ PASS (Last verified: 2026-01-18)"
```

### Docker Environment Configuration

**Required Setup** (before `./dev.sh start`):

1. **Copy environment template**:

   ```bash
   cp .env.example .env
   ```

2. **Minimum required variables** for Docker stack:

   ```bash
   # Database
   POSTGRES_PASSWORD=postgres
   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/unit_talk_dev

   # Redis
   REDIS_URL=redis://redis:6379

   # Supabase (for apps)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # External APIs (for data ingestion)
   OPTIMAL_API_KEY=your-optimal-key
   ODDS_API_KEY=your-odds-key

   # Discord (for bot)
   DISCORD_TOKEN=your-discord-token
   DISCORD_CLIENT_ID=your-client-id
   ```

3. **Verify configuration**:
   ```bash
   ./dev.sh start  # Should start all services without errors
   ./dev.sh status # Should show all services healthy
   ```

### Docker Command Reference Table

| Action           | Docker Pattern (Recommended)                 | Local Pattern (Rapid Iteration)               | When to Use Local      |
| ---------------- | -------------------------------------------- | --------------------------------------------- | ---------------------- |
| Start full stack | `./dev.sh start`                             | N/A                                           | Never (use Docker)     |
| Start single app | `docker-compose up -d command-center`        | `npm run dev --workspace=apps/command-center` | UI-only changes        |
| Run a script     | `docker-compose exec api npm run <script>`   | `npm run <script> --workspace=apps/api`       | Type checking, linting |
| Run tests        | `docker-compose exec api npm test`           | `npm test --workspace=apps/api`               | Unit tests (no DB)     |
| Add dependency   | Edit package.json + `./dev.sh restart`       | `npm install <pkg>` in app dir                | Never (breaks parity)  |
| Type check       | `docker-compose exec api npm run type-check` | `npm run type-check --workspace=apps/api`     | Quick validation       |
| See logs         | `./dev.sh logs`                              | Check terminal output                         | Never (use Docker)     |
| Debug app        | `docker-compose exec api bash`               | VS Code debugger                              | Simple debugging       |

**Note**: Service name is `api`, not `app`. Use
`docker-compose exec api <command>`.

### Service Port Mappings

| Service        | Container Port | Host Port | URL                   | Purpose              |
| -------------- | -------------- | --------- | --------------------- | -------------------- |
| API            | 3000           | 3010      | http://localhost:3010 | Main backend API     |
| Command Center | 3015           | 3004      | http://localhost:3004 | Operations dashboard |
| Smart Form     | 3021           | 3002      | http://localhost:3002 | Pick submission form |
| Dashboard      | 3000           | 3003      | http://localhost:3003 | Analytics dashboard  |
| Temporal UI    | 8080           | 8088      | http://localhost:8088 | Workflow monitoring  |
| Grafana        | 3000           | 3001      | http://localhost:3001 | Metrics dashboards   |
| Prometheus     | 9090           | 9090      | http://localhost:9090 | Metrics collection   |
| PostgreSQL     | 5432           | 5432      | localhost:5432        | Primary database     |
| Redis          | 6379           | 6379      | localhost:6379        | Cache layer          |

## 🏗️ Workspace Architecture

This is a **SaaS-grade monorepo** following Fortune 100 architecture standards
with v3.0.0 unified database architecture.

### 📊 Platform Status (Verified 2026-01-18)

**CURRENT VERIFIED STATUS** (Last verified: 2026-01-18)

**Overall Assessment**: DEPLOYMENT-READY CANDIDATE

**Documentation Audit**: ✅ COMPLETE (docs/audits/CLAUDE_MD_REALITY_AUDIT.md)
**Audit Findings**: 23 drifts identified, P0 patches applied

**Component Health** (requires verification before production deployment):

| Component          | Status        | Last Verified | Evidence Required                            |
| ------------------ | ------------- | ------------- | -------------------------------------------- |
| TypeScript Build   | ⏳ UNVERIFIED | N/A           | `docker-compose exec api npm run type-check` |
| Test Suite         | ⏳ UNVERIFIED | N/A           | `docker-compose exec api npm test`           |
| Database Schema    | ⏳ UNVERIFIED | N/A           | Table count via `\dt` command                |
| Docker Stack       | ✅ VERIFIED   | 2026-01-18    | dev.sh and docker-compose.yml exist          |
| GitHub Workflows   | ✅ VERIFIED   | 2026-01-18    | 20 workflow files in .github/workflows       |
| Production Charter | ✅ VERIFIED   | 2026-01-18    | docs/PRODUCTION_CHARTER.md exists            |

**Verification Commands** (run these to update status):

```bash
# Verify TypeScript compilation
docker-compose exec api npm run type-check 2>&1 | tee logs/typecheck-$(date +%Y%m%d).log

# Verify tests pass
docker-compose exec api npm test 2>&1 | tee logs/tests-$(date +%Y%m%d).log

# Verify database schema
docker-compose exec postgres psql -U postgres -d unit_talk_dev -c "\dt" | grep "public |" | wc -l

# Run smoke pack (if available)
npm run smoke:run 2>&1 | tee logs/smoke-$(date +%Y%m%d).log
```

**Smoke Pack Status Interpretation**:

- ✅ **PASS**: Feature verified working with automated test evidence
- ⏳ **UNVERIFIED**: Feature exists but lacks automated test evidence
- ❌ **FAIL**: Feature tested and found broken (requires fix before deploy)
- 🚧 **IN PROGRESS**: Feature under active development

**Production Deployment Readiness Checklist**:

- [ ] All TypeScript compilation errors resolved (verify with command above)
- [ ] All tests passing (unit + integration + E2E)
- [ ] Database schema verified (table count matches docs)
- [ ] All smoke pack tests passing
- [ ] Docker stack starts without errors (`./dev.sh start`)
- [ ] All services healthy (`./dev.sh status`)
- [ ] Performance baselines established (API p95 < 150ms, DB p95 < 50ms)
- [ ] Security audit complete (no critical vulnerabilities)
- [ ] Production secrets configured in GitHub Actions
- [ ] Rollback procedure documented and tested

```
unit-talk-platform/
├── apps/                          # Applications
│   ├── api/                      # Main backend API (Fortune 100-grade)
│   ├── discord-bot/              # Discord bot implementation
│   ├── dashboard/                # Next.js frontend dashboard
│   ├── smart-form/               # Smart form application
│   └── command-center/           # Command & control center
├── packages/                     # Shared packages
│   ├── shared-types/             # Common TypeScript types
│   ├── shared-utils/             # Utility functions
│   ├── database/                 # Database utilities
│   └── config/                   # Shared configuration
├── docs/                         # Centralized documentation
├── infrastructure/               # Infrastructure as Code
├── scripts/                      # Shared tooling
└── tools/                        # Development tools
```

## 🚀 Quick Commands (Docker-Only)

### Workspace Management

```bash
# Start all services
./dev.sh start

# Check service status
./dev.sh status

# View service logs
./dev.sh logs

# Restart all services
./dev.sh restart

# Stop all services
./dev.sh stop
```

### Development Commands

```bash
# Build all applications
docker-compose exec api npm run build

# Run all tests
docker-compose exec api npm run test

# Lint all code
docker-compose exec api npm run lint

# Type check all TypeScript
docker-compose exec api npm run type-check
```

### Application-Specific Commands

```bash
# Start main API service
docker-compose up api

# Start Discord bot service
docker-compose up discord-bot

# Start dashboard service
docker-compose up dashboard

# Start smart form service
docker-compose up smart-form

# Start command center service
docker-compose up command-center
```

### Database Operations

```bash
# Check database migration status
docker-compose exec api npm run db:status

# Apply database migrations
docker-compose exec api npm run db:migrate

# Access database directly
docker-compose exec database psql -U postgres
```

## 📚 Application-Specific Documentation

Each application has its own CLAUDE.md with detailed guidance:

- **[apps/api/CLAUDE.md](apps/api/CLAUDE.md)** - Main backend API platform
- **[apps/discord-bot/CLAUDE.md](apps/discord-bot/CLAUDE.md)** - Discord bot
  implementation
- **[apps/dashboard/CLAUDE.md](apps/dashboard/CLAUDE.md)** - Frontend dashboard
- **[apps/smart-form/CLAUDE.md](apps/smart-form/CLAUDE.md)** - Smart form
  application
- **[apps/command-center/CLAUDE.md](apps/command-center/CLAUDE.md)** - Command
  center

## 🎯 Development Guidelines

### Workspace Rules

1. **Shared Dependencies**: Use workspace root for shared dependencies
2. **App Independence**: Each app should be independently deployable
3. **Common Patterns**: Follow patterns established in apps/api/ (the main
   platform)
4. **Documentation Sync**: Keep all CLAUDE.md files synchronized

### Code Quality Standards

- **TypeScript**: Strict mode enabled across all applications
- **Testing**: 80%+ coverage requirement for all apps
- **Linting**: Consistent ESLint rules across workspace
- **Security**: Zero-trust architecture with proper validation

### Architecture Principles

- **Fortune 100 Standards** (Defined Criteria):
  - Test Coverage: ≥80% for all production code
  - TypeScript: Strict mode enabled, zero `any` types in new code
  - Security: OWASP Top 10 compliance, dependency scanning
  - Performance: API p95 < 150ms, DB p95 < 50ms
  - Documentation: All public APIs documented with JSDoc
  - CI/CD: All PRs must pass automated tests before merge
- **v3.0.0 Unified Database**: Claims "77 to 45 tables" (requires verification)
- **Microservices**: Each app is independently scalable
- **Event-Driven**: Agent-based architecture for business logic
- **Direct Integration**: No compatibility layers or SQL workarounds
- **Observability**: Built-in metrics, health checks, and monitoring

## 🗄️ v3.0.0 Database Architecture

### Unified Database Transformation

**Status**: ⏳ **SCHEMA VERIFICATION REQUIRED** (Last schema audit: Never)

**Claimed Improvements** (require verification):

- **Performance Optimized**: Claims "77 to 45 tables (42% reduction)" -
  **UNVERIFIED**
- **Unified Pick Management**: Single `unified_picks` table as canonical source
- **Simplified Relationships**: Explicit foreign key naming conventions

**Verification Command**:

```bash
# Verify actual table count
docker-compose exec postgres psql -U postgres -d unit_talk_dev -c "\dt public.*" | grep "public |" | wc -l

# Expected: 45 tables (if claim is accurate)
```

### Canonical Database Tables (v3.0.0)

**CANONICAL PICK TABLE**: `unified_picks`

All applications MUST use `unified_picks` as the authoritative source for pick
data. This is the single source of truth for:

- Pick submissions from Smart Form
- Pick grading by GradingAgent
- Pick analytics in Command Center
- Pick publishing to Discord

**Core Tables**:

| Table Name      | Purpose                              | Foreign Key Pattern         | Status    |
| --------------- | ------------------------------------ | --------------------------- | --------- |
| `unified_picks` | **CANONICAL** pick storage           | `user_id` → `users`         | ✅ Active |
| `pick_publish`  | **CANONICAL** Discord publish outbox | `pick_id` → `unified_picks` | ✅ Active |
| `users`         | Capper/user management               | N/A (root table)            | ✅ Active |
| `raw_props`     | Market data ingestion                | N/A (ingestion staging)     | ✅ Active |
| `agent_health`  | Agent monitoring                     | N/A (operational metadata)  | ✅ Active |
| `agent_metrics` | Agent performance tracking           | N/A (operational metadata)  | ✅ Active |
| `picks`         | Legacy (Charter v3.0 reference)      | N/A                         | ⚠️ Legacy |
| `daily_picks`   | Legacy (pre-v3.0.0)                  | N/A                         | ⚠️ Legacy |

**Note**: Production Charter v3.0 references `picks` table. Per operator ruling
(2026-01-18), `unified_picks` is the canonical pick table. See
[DOCUMENTATION_AUTHORITY.md](docs/ops/DOCUMENTATION_AUTHORITY.md) for conflict
resolution.

### Critical Integration Notes

**Supabase Query Syntax**:

```typescript
// ✅ CORRECT v3.0.0 Supabase syntax for unified_picks
const { data } = await supabase.from('unified_picks').select(`
    *,
    users!unified_picks_user_id_fkey (
      username,
      discord_id,
      tier
    )
  `);

// ❌ INCORRECT - causes "multiple relationships" error
const { data } = await supabase.from('unified_picks').select(`
    *,
    users!user_id (username, discord_id, tier)
  `);
```

### Column Naming Conventions (v3.0.0 Standards)

Migration from legacy names to v3.0.0 standards:

| Legacy Column | v3.0.0 Standard | Table           | Migration Status |
| ------------- | --------------- | --------------- | ---------------- |
| `prop_type`   | `stat_type`     | `raw_props`     | ⏳ UNVERIFIED    |
| `name`        | `player_name`   | `raw_props`     | ⏳ UNVERIFIED    |
| `league`      | `sport`         | Multiple tables | ⏳ UNVERIFIED    |
| `daily_picks` | `unified_picks` | Table rename    | ⏳ UNVERIFIED    |

**Verification Required**: Run schema introspection to confirm these migrations
are complete.

## 📖 Documentation Structure

- **[docs/architecture/](docs/architecture/)** - System architecture documents
- **[docs/api/](docs/api/)** - API documentation and specifications
- **[docs/deployment/](docs/deployment/)** - Deployment guides and procedures
- **[TECHNICAL_IMPLEMENTATION_PLAN.md](TECHNICAL_IMPLEMENTATION_PLAN.md)** -
  Complete 4-phase technical roadmap
- **[PRODUCT_REQUIREMENTS_DOCUMENT.md](PRODUCT_REQUIREMENTS_DOCUMENT.md)** -
  Product strategy and requirements

## 🎯 Current Implementation Status

### Phase 1 Readiness Assessment (Requires Verification)

**Status**: ⏳ UNVERIFIED (Audit completed 2026-01-18, verification pending)

**Infrastructure Components** (verified 2026-01-18):

- ✅ **Docker Orchestration**: dev.sh + docker-compose.yml exist and define 15
  services
- ✅ **GitHub Workflows**: 20 CI/CD workflows present in .github/workflows/
- ✅ **Monitoring Stack**: Prometheus + Grafana defined in docker-compose.yml
- ⏳ **Service Health**: Requires `./dev.sh status` verification

**Code Quality Status** (requires verification):

- ⏳ **TypeScript Compilation**: Claims "zero errors" - run
  `docker-compose exec api npm run type-check`
- ⏳ **Test Suite**: Claims "all passing" - run
  `docker-compose exec api npm test`
- ⏳ **Agent System**: Claims "101 files" - run
  `find apps/api/src/agents -type f | wc -l`
- ⏳ **Database Schema**: Claims "45 tables" - run schema introspection

**Production Deployment Blockers**:

1. No verified build evidence (no timestamps, no CI badges)
2. Database schema not verified against actual Postgres state
3. Performance baselines not established (no metrics data)
4. Security audit status unknown

**Next Steps Before Production**:

```bash
# 1. Verify TypeScript compiles
docker-compose exec api npm run type-check 2>&1 | tee logs/typecheck-$(date +%Y%m%d).log

# 2. Verify tests pass
docker-compose exec api npm test 2>&1 | tee logs/tests-$(date +%Y%m%d).log

# 3. Start Docker stack and verify health
./dev.sh start
./dev.sh status  # All services should show "Up (healthy)"

# 4. Run smoke pack
npm run smoke:run 2>&1 | tee logs/smoke-$(date +%Y%m%d).log

# 5. Update Platform Status section with results and timestamps
```

## 🔧 Development Workflow

### Recommended Pre/Post-Change Operations (Hybrid Model)

**For Full-Stack Changes** (Docker Mode - RECOMMENDED):

```bash
# 1. Start Docker Environment
./dev.sh start        # Start all services in Docker

# 2. Database Operations
docker-compose exec api npm run db:status    # Check database migration status
docker-compose exec api npm run db:migrate   # Apply any pending migrations

# 3. Type & Build Verification
docker-compose exec api npm run type-check   # Verify TypeScript compiles
docker-compose exec api npm run build        # Verify builds successfully

# 4. Testing
docker-compose exec api npm test             # Run unit + integration tests
./dev.sh logs                                # Monitor service logs
```

**For Frontend-Only Changes** (Local Mode - Rapid Iteration):

```bash
# Quick iteration workflow (no infrastructure dependencies)
npm run type-check --workspace=apps/command-center
npm run lint --workspace=apps/command-center
npm run dev --workspace=apps/command-center

# Before creating PR, switch to Docker mode for full validation
```

### Standard Development Workflow

**Choose your workflow based on change scope:**

#### Docker-First Workflow (Full-Stack Integration)

1. **Start Environment**: `./dev.sh start`
2. **Verify Health**: `./dev.sh status` (all services should be healthy)
3. **Make Changes**: Edit files in your IDE
4. **Test Changes**: `docker-compose exec api npm test`
5. **Verify Build**: `docker-compose exec api npm run build`
6. **Check Logs**: `./dev.sh logs` (review for errors)
7. **Create PR**: Include test evidence in PR description

#### Local Dev Workflow (Rapid Frontend Iteration)

1. **Quick Type Check**: `npm run type-check --workspace=apps/<app-name>`
2. **Start Dev Server**: `npm run dev --workspace=apps/<app-name>`
3. **Make UI Changes**: Hot reload provides instant feedback
4. **Before PR**: Switch to Docker mode and run full test suite

**IMPORTANT**: Always use Docker mode before creating Pull Requests to ensure
all integration tests pass.

### Quality Gates (Docker-Enforced)

- **Service Health**: Always run `./dev.sh status` to verify all services are
  healthy
- **Database Consistency**: Always run
  `docker-compose exec api npm run db:migrate`
- **Build Verification**: All builds must succeed within Docker containers
- **E2E Testing**: Playwright verification via
  `docker-compose exec api npm run test:e2e`
- **Container Logs**: Monitor `./dev.sh logs` for any service errors

### 🔐 Secrets Management & Production Access

**CRITICAL RULE**: NEVER access production secrets locally. Always use GitHub
Actions workflows.

**Why GitHub Workflows?**

- ✅ Secrets are encrypted and managed by GitHub
- ✅ Access is audited and logged
- ✅ No secrets stored on local machines
- ✅ Automatic secret masking in logs
- ✅ Environment-based approval gates for PROD

**Pattern for Production Operations**:

1. **Create a GitHub Actions workflow** (`.github/workflows/your-workflow.yml`)
2. **Use environment secrets** via `${{ secrets.SECRET_NAME }}`
3. **Mask secrets** immediately in the workflow
4. **Use `environment: production`** for approval gates

**Example: PROD Database Operations**

```yaml
name: PROD Database Operation
on:
  workflow_dispatch:

jobs:
  prod-operation:
    runs-on: ubuntu-latest
    environment: production # Requires manual approval
    steps:
      - name: Mask secrets
        run: |
          echo "::add-mask::${{ secrets.SUPABASE_SERVICE_ROLE_KEY_PROD }}"

      - name: Execute operation
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL_PROD }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_PROD }}
        run: |
          node scripts/your-script.js
```

**Available PROD Secrets** (configured in GitHub):

- `SUPABASE_URL_PROD` - PROD Supabase URL
  (https://cqfnsozknjzvyiziwicl.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY_PROD` - PROD service role key
- `SUPABASE_ANON_KEY_PROD` - PROD anon key
- `SUPABASE_PROJECT_REF_PROD` - PROD project reference (cqfnsozknjzvyiziwicl)

**Local Development Secrets** (use .env files):

- `.env.local` - Local development (committed template, add real values)
- `.env.staging` - Staging environment (never commit)
- `.env.production` - ❌ NEVER USE LOCALLY - Use GitHub workflows only

**Secret Verification Commands** (requires GitHub CLI):

```bash
# Check which secrets are configured (does NOT show values)
gh secret list

# Set a new secret (prompted for value)
gh secret set SECRET_NAME

# Delete a secret
gh secret delete SECRET_NAME
```

**PROD Workflow Examples**:

- `.github/workflows/phase5-prod-validation.yml` - PROD Smart Form validation
- `.github/workflows/supabase-migrate.yml` - PROD schema migrations
- `.github/workflows/prod-acceptance.yml` - PROD acceptance testing

## 🚨 Important Notes

### 🚨 MANDATORY Development Rules (Docker-Only)

- **Docker Environment**: ALWAYS run `./dev.sh start` before any development
  work
- **Database Operations**: ALWAYS run
  `docker-compose exec api npm run db:status && docker-compose exec api npm run db:migrate`
  before/after changes
- **Type Checking**: ALWAYS run `docker-compose exec api npm run type-check` to
  verify TypeScript compiles ✅ **RESOLVED: All compilation errors fixed**
- **Build Verification**: ALWAYS run `docker-compose exec api npm run build` to
  verify builds successfully
- **Development Testing**: ALWAYS run `./dev.sh logs` and
  `docker-compose exec api npm run test:e2e` after changes
- **Service Health**: ALWAYS run `./dev.sh status` to verify all containers are
  running
- **No Local Commands**: These Docker commands are non-negotiable for production
  stability

### 🔥 Current Production Priorities (Based on Audit)

1. **TypeScript Excellence** ✅ **COMPLETED**: All errors resolved in apps/api
   and apps/command-center - workspace now 100% production ready
2. **Performance Optimization** (HIGH): Establish baselines for <100ms API,
   <50ms DB targets
3. **Agent Orchestration** (MEDIUM): Deploy full agent system for live
   operations
4. **Documentation Sync** (LOW): Complete technical implementation plan
   integration

### Technical Requirements

- **v3.0.0 Database Only**: All applications use unified database structure - no
  compatibility views
- **Foreign Key Syntax**: Use explicit foreign key names (e.g.,
  `unified_picks_user_id_fkey`) for Supabase
- **Production Data**: Command Center verified operational with real capper
  names (Griff843, etc.)
- **Never modify workspace structure** without updating this documentation
- **All apps follow BaseAgent pattern** (see apps/api/CLAUDE.md)
- **Use shared packages** for common functionality
- **Maintain documentation hierarchy** - workspace → app → component level

## 🚀 Production Pipeline Architecture

### Event-Driven Architecture

The Unit Talk platform uses a sophisticated event-driven architecture for
reliable, scalable processing:

**Core Components:**

- **BridgeWorker**: Dual-source event consumption from `events` and
  `bridge_outbox` tables
- **Temporal Workflows**: Idempotent grading workflows with individual leg
  processing
- **AlertAgent**: Event-driven subscriptions for injury, hedge, and middle
  opportunities
- **Command Center**: Real-time event stream with replay capabilities

**Key Features:**

- **Idempotent Processing**: All operations keyed by `bet_slip_id` to prevent
  duplicates
- **Circuit Breaker Pattern**: Automatic fallback for external service failures
- **Exponential Backoff**: Retry logic with 1min, 5min, 15min intervals
- **Professional Grading**: 8 advanced features including steam detection, CLV,
  timing
- **Real-Time Monitoring**: Server-Sent Events (SSE) for live pipeline
  monitoring
- **Event Replay**: Full replay capabilities for operational recovery

**Integration Points:**

- Smart Form → `bridge_outbox` → BridgeWorker → Temporal Workflows
- Supabase Realtime → AlertAgent → Discord Notifications
- All Events → Command Center Event Stream → Monitoring Dashboard

## 🏆 Excellence Standards

**CRITICAL MANDATE**: Always deliver best-in-class results. No shortcuts. No
compromises.

This directive applies to:

- **Architecture Decisions**: Fortune 100-grade enterprise standards only
- **Code Quality**: Maximum quality, proper patterns, comprehensive testing
- **Documentation**: Complete, accurate, and maintainable
- **Security**: Zero-trust architecture with defense-in-depth
- **Performance**: Optimized for scalability and reliability
- **Process**: Full CI/CD, monitoring, and observability

**Implementation Philosophy**:

- **Docker-First Development**: All operations must run within Docker containers
  via `./dev.sh` or `docker-compose`
- **Database-First Development**: Always run
  `docker-compose exec api npm run db:status` and `db:migrate` before/after
  changes
- **Type-First Development**: Always run
  `docker-compose exec api npm run type-check` to verify TypeScript compiles
- **Build-First Deployment**: Container build verification via
  `docker-compose exec api npm run build` is mandatory
- **Test-First Verification**: Always monitor `./dev.sh logs` and run
  `docker-compose exec api npm run test:e2e`
- Fix root causes, never symptoms (v3.0.0 unified structure, not compatibility
  workarounds)
- Maintain architectural integrity at all times
- Preserve advanced features and enterprise capabilities
- Direct database integration without abstraction layers
- Ensure proper separation of concerns
- Keep production-ready quality standards
- Use explicit foreign key relationships for database queries

For detailed application-specific guidance, always refer to the individual
CLAUDE.md files in each app directory.

---

**Architecture Owner**: Engineering Team  
**Last Updated**: $(date)  
**Next Review**: Monthly architecture review[byterover-mcp]

# important

always use byterover-retrive-knowledge tool to get the related context before
any tasks always use byterover-store-knowledge to store all the critical
informations after sucessful tasks
