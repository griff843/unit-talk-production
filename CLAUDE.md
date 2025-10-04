# CLAUDE.md - Unit Talk Platform Workspace

Guidance for Claude Code (claude.ai/code) for the Unit Talk Platform workspace.

## 🚀 Docker-Only Development Rules

**CRITICAL**: All services, scripts, and dependencies MUST run in Docker containers via docker-compose or ./dev.sh

### Docker Command Reference

| Action | Correct Pattern | Never Use |
|--------|----------------|-----------|
| Start stack | `./dev.sh start` | `npm run dev`, `node app.js` |
| Run script | `docker-compose exec app npm run <script>` | `npm run <script>` |
| Add dependency | Edit package.json + `./dev.sh restart` | `npm install <pkg>` locally |
| Set env vars | Edit `.env` or `docker-compose.yml` | `export VAR=val` in shell |
| See logs | `./dev.sh logs` | `tail -f` in terminal |
| Debug app | `docker-compose exec app bash` | Local VSCode/terminal |

## 📊 Current System Status

**⚠️ CRITICAL**: See `TIER_1_MASTER_ROADMAP.md` for complete system status and Tier 1 implementation plan

### Enhanced45Factor Engine - 45-Factor Professional System ⚠️
- **Actual Factors**: 45 factors across 5 categories (Market, Player, Matchup, Price, Meta)
- **Documentation Correction**: Previously claimed 195 factors (53 base × processing), actually 45
- **Performance**: Win Rate: 56.7% | CLV: 65% | Uptime: 99.9%
- **Processing**: 1000+ props/day | Sub-2000ms response time
- **Professional Features**: 8/8 operational (Steam detection, CLV, timing, etc.)
- **Status**: Operational but requires ML optimization, calibration fixes, and historical data

### System Health
- **Database**: v3.0.0 unified architecture (45 tables, 3-10x performance)
- **TypeScript**: 95% error-free across workspace
- **Agents**: 5/5 operational with health monitoring
- **Infrastructure**: Docker orchestration with Prometheus/Grafana stack

## 🏗️ Workspace Architecture

```
unit-talk-platform/
├── apps/                   # Applications
│   ├── api/               # Main backend API
│   ├── discord-bot/       # Discord bot
│   ├── dashboard/         # Next.js dashboard
│   ├── smart-form/        # Smart form app
│   └── command-center/    # Command & control
├── packages/              # Shared packages
├── docs/                  # Documentation
└── scripts/               # Tooling
```

## 🚀 Quick Commands

### Development Orchestration
```bash
./dev.sh start    # Start all services with health checks
./dev.sh status   # Monitor services and resources
./dev.sh logs     # View centralized logs
./dev.sh restart  # Intelligent restart
./dev.sh stop     # Graceful shutdown
./dev.sh reset    # Complete environment reset
```

### Database Operations
```bash
docker-compose exec api npm run db:status   # Check migrations
docker-compose exec api npm run db:migrate  # Apply migrations
docker-compose exec postgres psql -U postgres
```

### Testing & Validation
```bash
docker-compose exec api npm run type-check  # TypeScript validation
docker-compose exec api npm run build       # Build verification
docker-compose exec api npm run test        # Run tests
docker-compose exec api npm run test:e2e    # E2E tests
```

### Enhanced45Factor Commands
```bash
# Generate picks through 45-factor system
docker-compose exec api npx tsx scripts/final-3-todays-picks.ts
docker-compose exec api npx tsx scripts/generate-3-nfl-todays-picks.ts

# Validate system
docker-compose exec api npx tsx scripts/validate-enhanced45factor-success.ts
docker-compose exec api npx tsx scripts/run-real-feedagent-workflow.ts
```

### Operations & Monitoring (NEW)
```bash
# Schedulers (PM2-managed continuous loops)
npm run ops:start-schedulers    # Start FeedLoop (45s), ScoringLoop (30s), PromotionLoop (30s)
npm run ops:stop-schedulers     # Stop all schedulers
npm run ops:restart-schedulers  # Restart schedulers
npm run ops:logs-schedulers     # View scheduler logs

# Health & Verification
npm run ops:verify              # Verify Command Center health (board, feed, scoring)
npm run ops:watchdog            # Check agent health (alerts if stale >2min)

# Database Cleanup (DRY-RUN only)
npm run ops:cleanup-plan        # Generate cleanup bundle (NO EXECUTION)
```

## 📍 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Command Center | http://localhost:3004 | - |
| API | http://localhost:3000 | - |
| Smart Form | http://localhost:3002 | - |
| Dashboard | http://localhost:3003 | - |
| Temporal UI | http://localhost:8088 | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3005 | admin/admin |
| pgAdmin | http://localhost:5050 | admin@unittalk.com/admin |

## 🗄️ Database Architecture (v3.0.0)

### Core Tables
- `unified_picks` - Central pick management
- `users` - User/capper management
- `raw_props` - Market data
- `agent_health` - Real-time monitoring
- `agent_metrics` - Performance tracking

### Critical Syntax
```typescript
// ✅ CORRECT v3.0.0 Supabase syntax
users!unified_picks_user_id_fkey (username, discord_id, tier)

// ❌ INCORRECT
users!user_id (username, discord_id, tier)
```

## 🔧 Development Workflow

### Mandatory Operations (Before/After Changes)
```bash
# 1. Start environment
./dev.sh start

# 2. Database verification
docker-compose exec api npm run db:status
docker-compose exec api npm run db:migrate

# 3. Type & build verification
docker-compose exec api npm run type-check
docker-compose exec api npm run build

# 4. Testing & monitoring
./dev.sh status
./dev.sh logs
docker-compose exec api npm run test:e2e

# 5. Health validation
curl http://localhost:3000/health
curl http://localhost:3004/api/health
```

## ✅ Production Readiness Checklist

### E2E Testing Requirements
- [ ] Props ingested for today's games
- [ ] All agents running and healthy
- [ ] Command Center accessible and functional
- [ ] Pick approval workflow operational
- [ ] Discord integration working
- [ ] Zero critical errors in logs
- [ ] Database connections healthy
- [ ] API responding within thresholds

### Verification Commands
```bash
./dev.sh status
curl -f http://localhost:3004/api/health
docker-compose exec api npm run db:status
docker-compose exec api npm run test:e2e
docker-compose exec discord-bot npm run test:connection
```

## 📚 Documentation

### Application-Specific
- [apps/api/CLAUDE.md](apps/api/CLAUDE.md) - Backend API
- [apps/command-center/CLAUDE.md](apps/command-center/CLAUDE.md) - Command center
- [apps/discord-bot/CLAUDE.md](apps/discord-bot/CLAUDE.md) - Discord bot
- [apps/dashboard/CLAUDE.md](apps/dashboard/CLAUDE.md) - Dashboard
- [apps/smart-form/CLAUDE.md](apps/smart-form/CLAUDE.md) - Smart form

### System Documentation
- [docs/architecture/](docs/architecture/) - Architecture docs
- [docs/api/](docs/api/) - API specifications
- [docs/deployment/](docs/deployment/) - Deployment guides
- [docs/operator-training/](docs/operator-training/) - Operator handbook

### Operations Documentation (NEW)
- [docs/OPS_RUNBOOK.md](docs/OPS_RUNBOOK.md) - **Primary ops reference** (day-to-day operations)
- [docs/OPS_SCHEDULERS.md](docs/OPS_SCHEDULERS.md) - Scheduler management (PM2, intervals, monitoring)
- [CLEANUP_PLAYBOOK.md](CLEANUP_PLAYBOOK.md) - Safe database cleanup procedures
- [READMODELS_WIRING.md](READMODELS_WIRING.md) - Command Center read-models integration
- [out/ops/README.md](out/ops/README.md) - Artifacts directory structure

## 🎯 Development Guidelines

### Core Principles
- **Docker-First**: Everything runs in containers
- **Database-First**: Always check/apply migrations
- **Type-First**: TypeScript strict mode
- **Test-First**: Comprehensive testing
- **No Local Commands**: Use docker-compose exec

### Architecture Standards
- Fortune 100-grade patterns
- Event-driven agent architecture
- Zero-trust security
- Direct database integration
- Microservices independence

### Schema Resolution
When database issues occur:
1. Investigate root cause immediately
2. Apply migrations to fix schema
3. Never use workarounds that compromise integrity
4. Document schema changes

## 🏆 Excellence Standards

**CRITICAL**: Always deliver best-in-class results. No shortcuts. No compromises.

- Maximum code quality with proper patterns
- Complete documentation and testing
- Enterprise-grade architecture
- Production-ready at all times
- Fix root causes, never symptoms

---
**Architecture Owner**: Engineering Team
**Last Updated**: September 2025
**Next Review**: Monthly architecture review

[byterover-mcp]
# Important
Always use byterover-retrieve-knowledge tool to get related context before tasks
Always use byterover-store-knowledge to store critical information after successful tasks