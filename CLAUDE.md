# CLAUDE.md - Unit Talk Platform Workspace

This file provides guidance to Claude Code (claude.ai/code) for the Unit Talk
Platform workspace.

## 🚀 UNIT TALK – AI CODING & ENVIRONMENT RULES (FOR CLAUDE & ALL AI TOOLS)

**DOCKER-FIRST, SAAS-GRADE DEVELOPMENT RULES**

### 1. Docker is the Only Supported Runtime

All app services, scripts, migrations, and dependencies MUST run in Docker
containers via docker-compose or ./dev.sh.

**Never suggest or generate instructions that run `npm run dev`, `npm start`,
`npm install`, `node`, or similar directly on the local machine or in any shell
outside Docker.**

### 2. All Environment Configuration is Managed via Docker

All environment variables must be set in `.env` and/or `docker-compose.yml`.

Any suggestion to update environment config must reference these files, not
local shells.

### 3. Dependencies and Package Management

When adding or updating dependencies, edit `package.json` and rebuild containers
using `./dev.sh restart` or `docker-compose build [service]`.

Never use or suggest global package installation or local-only dependency
changes.

### 4. Running Scripts & Commands

All commands/scripts must be run via Docker Compose, e.g.:

```bash
docker-compose exec app npm run <script>
```

If suggesting any "dev server" command, assume it's run by the Docker container
startup (CMD in Dockerfile) or via `docker-compose exec`.

### 5. Health Checks, Logs, and Service Management

Service health should be monitored using `./dev.sh status` and logs accessed via
`./dev.sh logs`.

Do not recommend using `ps`, `lsof`, or manual process management outside of
Docker context.

### 6. Adding or Modifying Services

Any new service, DB, or dependency must be integrated via `docker-compose.yml`
and, if needed, the Dockerfile.

Always ensure volume mounts and port mappings are consistent with existing
services.

### 7. Documentation and Prompts

All prompts, documentation, code examples, and onboarding for new devs or AI
tools must state that everything runs through Docker and is orchestrated by
`./dev.sh`.

Never provide instructions for local-only workflow.

### 8. Error Handling & Troubleshooting

All troubleshooting and debugging steps must be in the context of Docker
containers and `./dev.sh`.

Example: If you hit an error, run `./dev.sh logs` or
`docker-compose exec [service] bash` to debug inside the container.

### 9. Best Practice/Production Readiness

Assume the Docker-only workflow is used in all environments: dev, staging, and
production.

Never reference workflows or patterns that break parity between local/dev/prod.

### Docker Command Reference Table

| Action             | Correct Pattern                                      | Incorrect Pattern (Do NOT Use)  |
| ------------------ | ---------------------------------------------------- | ------------------------------- |
| Start stack        | `./dev.sh start`                                     | `npm run dev`, `node app.js`    |
| Run a script       | `docker-compose exec app npm run <script>`           | `npm run <script>`              |
| Add dependency     | Edit package.json + `./dev.sh restart`               | `npm install <pkg>` locally     |
| Set env vars       | Edit `.env` or `docker-compose.yml`                  | `export VAR=val` in local shell |
| See logs           | `./dev.sh logs`                                      | `tail -f` in local terminal     |
| Debug app          | `docker-compose exec app bash`                       | Local VSCode/terminal shell     |
| Add/modify service | Edit `docker-compose.yml`/Dockerfile, use `./dev.sh` | Manual/one-off local commands   |

## 🏗️ Workspace Architecture

This is a **SaaS-grade monorepo** following Fortune 100 architecture standards
with v3.0.0 unified database architecture.

### 📊 Platform Status (January 2025)

**Overall Assessment: 100/100 - PRODUCTION READY**

**🚨 PRODUCTION DEPLOYMENT PHASE ACTIVE** **All development from this point
forward is intended for real-world daily operations. No more experimental or
development-only changes.**

**✅ Production Readiness Verification:**

- **Data Pipeline**: 21,959 props ingested, grading persistence fixed, pipeline
  fully operational ✅
- **Database Excellence**: v3.0.0 unified schema operational with 42%
  optimization (77→45 tables) ✅
- **Agent System**: 5 agents healthy, GradingAgent processing with correct data
  types ✅
- **Command Center**: 100/100 production ready, TypeScript compilation clean,
  zero errors, database connections verified ✅
- **Real-Time Integration**: Live capper data (Griff843, Vicgo, Sauced,
  MoneyReef, Squirrel) ✅
- **Production Pipeline**: Event-driven architecture with BridgeWorker,
  Temporal workflows, and AlertAgent subscriptions ✅
- **Smart Form Integration**: Bridge outbox pattern for reliable event delivery ✅

**🎯 Production Deployment Priorities:**

- **Scale Grading Pipeline**: Process 21,954 remaining props for full production
  operation
- **Live Agent Orchestration**: Deploy all agents for real-time market
  processing
- **Performance Monitoring**: Establish production metrics and alerting
- **End-to-End Validation**: Complete system integration testing

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

- **Fortune 100 Standards**: Enterprise-grade code quality and patterns
- **v3.0.0 Unified Database**: Reduced from 77 to 45 tables for optimal
  performance
- **Microservices**: Each app is independently scalable
- **Event-Driven**: Agent-based architecture for business logic
- **Direct Integration**: No compatibility layers or SQL workarounds
- **Observability**: Built-in metrics, health checks, and monitoring

## 🗄️ v3.0.0 Database Architecture

### Unified Database Transformation

**Status**: ✅ **PRODUCTION READY** - All applications successfully migrated to
v3.0.0 unified structure

**Key Improvements**:

- **Performance Optimized**: Reduced from 77 to 45 tables (42% reduction)
- **Unified Pick Management**: Single `unified_picks` table replacing fragmented
  structure
- **Simplified Relationships**: Clear foreign key relationships with explicit
  naming
- **Production Verified**: Command Center operational with real capper data

### Core v3.0.0 Tables

- **`unified_picks`**: Central pick management (user_id → users via
  unified_picks_user_id_fkey)
- **`users`**: Unified user/capper management (Griff843, Vicgo, Sauced,
  MoneyReef, Squirrel)
- **`raw_props`**: Market data (stat_type, player_name, line, over_odds,
  under_odds)
- **`agent_health`**: Real-time agent monitoring
- **`agent_metrics`**: Performance tracking

### Critical Integration Notes

```typescript
// ✅ CORRECT v3.0.0 Supabase syntax
users!unified_picks_user_id_fkey (username, discord_id, tier)

// ❌ INCORRECT - causes "multiple relationships" error
users!user_id (username, discord_id, tier)
```

### Column Mapping Changes

- `prop_type` → `stat_type`
- `name` → `player_name`
- `league` → `sport`
- `daily_picks` → `unified_picks`

## 📖 Documentation Structure

- **[docs/architecture/](docs/architecture/)** - System architecture documents
- **[docs/api/](docs/api/)** - API documentation and specifications
- **[docs/deployment/](docs/deployment/)** - Deployment guides and procedures
- **[TECHNICAL_IMPLEMENTATION_PLAN.md](TECHNICAL_IMPLEMENTATION_PLAN.md)** -
  Complete 4-phase technical roadmap
- **[PRODUCT_REQUIREMENTS_DOCUMENT.md](PRODUCT_REQUIREMENTS_DOCUMENT.md)** -
  Product strategy and requirements

## 🎯 Current Implementation Status

### Phase 1 Readiness Assessment

Based on comprehensive codebase audit, the platform is **100% ready** for Phase 1
implementation:

**✅ Ready for Immediate Deployment:**

- **Command Center**: 100/100 production ready with zero TypeScript errors
- **v3.0.0 Database**: Operational with 3-10x performance improvements
- **Agent System**: 101 files implementing enterprise-grade BaseAgent pattern
- **Infrastructure**: Docker Compose with monitoring stack (Prometheus/Grafana)
- **TypeScript Excellence**: All compilation errors resolved across entire workspace

**🚀 Production Optimization Targets:**

- Performance baseline establishment (Command Center fully operational)
- API response time optimization to <100ms target
- Database query optimization to <50ms target
- Full agent orchestration deployment

## 🔧 Development Workflow

### Mandatory Pre/Post-Change Operations (Docker-Only)

**CRITICAL**: Always execute these Docker commands before and after making
changes:

```bash
# 1. Start Docker Environment (MANDATORY)
./dev.sh start        # Start all services in Docker

# 2. Database Operations (MANDATORY)
docker-compose exec api npm run db:status    # Check database migration status
docker-compose exec api npm run db:migrate   # Apply any pending migrations

# 3. Type & Build Verification (MANDATORY)
docker-compose exec api npm run type-check   # Verify TypeScript compiles without errors
docker-compose exec api npm run build       # Verify builds successfully

# 4. Development Testing (MANDATORY)
./dev.sh logs        # Monitor service logs
docker-compose exec api npm run test:e2e    # Run Playwright tests
```

### Standard Development Workflow (Docker-First)

1. **Start Development**: Run `./dev.sh start` to setup all Docker services
2. **Pre-Change Verification**: Execute mandatory Docker commands above
3. **Choose Application**: Use `docker-compose exec [service] bash` to access
   specific apps
4. **Follow App Patterns**: Refer to app-specific CLAUDE.md for guidance
5. **Maintain Quality**: Run tests and linting via Docker before commits
6. **Post-Change Verification**: Execute mandatory Docker testing workflow above
7. **Document Changes**: Update relevant CLAUDE.md files

### Quality Gates (Docker-Enforced)

- **Service Health**: Always run `./dev.sh status` to verify all services are
  healthy
- **Database Consistency**: Always run
  `docker-compose exec api npm run db:migrate`
- **Build Verification**: All builds must succeed within Docker containers
- **E2E Testing**: Playwright verification via
  `docker-compose exec api npm run test:e2e`
- **Container Logs**: Monitor `./dev.sh logs` for any service errors

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

1. **TypeScript Excellence** ✅ **COMPLETED**: All errors resolved in apps/api and
   apps/command-center - workspace now 100% production ready
2. **Performance Optimization** (HIGH): Establish baselines for <100ms API,
   <50ms DB targets
3. **Agent Orchestration** (MEDIUM): Deploy full agent system for live operations
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
The Unit Talk platform uses a sophisticated event-driven architecture for reliable, scalable processing:

**Core Components:**
- **BridgeWorker**: Dual-source event consumption from `events` and `bridge_outbox` tables
- **Temporal Workflows**: Idempotent grading workflows with individual leg processing
- **AlertAgent**: Event-driven subscriptions for injury, hedge, and middle opportunities
- **Command Center**: Real-time event stream with replay capabilities

**Key Features:**
- **Idempotent Processing**: All operations keyed by `bet_slip_id` to prevent duplicates
- **Circuit Breaker Pattern**: Automatic fallback for external service failures  
- **Exponential Backoff**: Retry logic with 1min, 5min, 15min intervals
- **Professional Grading**: 8 advanced features including steam detection, CLV, timing
- **Real-Time Monitoring**: Server-Sent Events (SSE) for live pipeline monitoring
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
