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

## 🎯 Tier 1 Dual-Track Pipeline - Market Props Architecture

**Status**: ✅ OPERATIONAL - All 5 Gates Passing

### Overview
The dual-track pipeline separates **market props** (no user) from **user picks** to enable professional betting intelligence without user_id constraints.

### Database Pooler URL
```
postgresql://postgres.lxqmuzmqtnnlpfapvief:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Pipeline Architecture

**Track 1: Market Props (Professional Feed)**
```
raw_props → market_props → scored_props → promotion_queue (source='market') → Discord
```

**Track 2: User Picks (Community Submissions)**
```
picks_submissions → unified_picks → scoring → promotion_queue (source='user') → Discord
```

### Core Tables

**market_props** (33 columns, NO user_id):
- `id` (UUID, primary key)
- `sport`, `market`, `selection`, `line`, `odds`, `over_odds`, `under_odds`
- `bookmaker_key`, `external_prop_id` (unique constraint for deduplication)
- `player_name`, `game_date`, `team`, `opponent`
- `metadata` (JSONB for extensibility)

**promotion_queue** (source discriminator):
- `source` ENUM('market', 'user') - distinguishes market vs user props
- `prop_ref` (UUID) - references market_props.id or unified_picks.id
- `status`, `priority`, `published_at`

**scored_props** (professional scoring):
- `prop_ref` (UUID) - references market_props.id
- `professional_score`, `tier`, `edge`, `confidence`
- `kelly_fraction`, `clv_pct`

### Required Views

**v_prop_read_model** (Command Center feed):
```sql
CREATE OR REPLACE VIEW public.v_prop_read_model AS
SELECT
  mp.id AS prop_ref,
  'market'::TEXT AS source,
  mp.sport, mp.market, mp.selection, mp.line, mp.odds,
  sp.edge, sp.prob_win, sp.professional_score, sp.tier,
  pq.status AS queue_status
FROM public.market_props mp
LEFT JOIN public.scored_props sp ON sp.prop_ref = mp.id
LEFT JOIN public.promotion_queue pq ON pq.prop_ref = mp.id
WHERE mp.game_date >= (NOW()::DATE);
```

**v_daily_board** (scored props only):
```sql
CREATE OR REPLACE VIEW public.v_daily_board AS
SELECT
  mp.id AS prop_ref,
  mp.sport, mp.market, mp.selection, mp.line, mp.odds,
  sp.professional_score, sp.tier, sp.edge, sp.confidence,
  pq.published_at
FROM public.market_props mp
INNER JOIN public.scored_props sp ON sp.prop_ref = mp.id
LEFT JOIN public.promotion_queue pq ON pq.prop_ref = mp.id
WHERE mp.game_date >= (NOW()::DATE)
ORDER BY sp.tier, sp.edge DESC;
```

### Helper Functions

**get_unscored_market_props** (scoring agent helper):
```sql
CREATE OR REPLACE FUNCTION public.get_unscored_market_props(limit_count INT DEFAULT 100)
RETURNS TABLE (
  id UUID, sport TEXT, market TEXT, selection TEXT, line NUMERIC,
  odds INTEGER, game_date TIMESTAMPTZ, player_name TEXT, metadata JSONB
) AS $
BEGIN
  RETURN QUERY
  SELECT mp.id, mp.sport, mp.market, mp.selection, mp.line, mp.odds,
         mp.game_date, mp.player_name, mp.metadata
  FROM public.market_props mp
  LEFT JOIN public.scored_props sp ON sp.prop_ref = mp.id
  WHERE mp.game_date >= (NOW()::DATE)
    AND (sp.id IS NULL OR sp.updated_at < NOW() - INTERVAL '1 hour')
  ORDER BY mp.game_date, mp.created_at DESC
  LIMIT limit_count;
END;
$ LANGUAGE plpgsql STABLE;
```

### Agent Wiring

**NormalizerAgent** (write to market_props):
- On raw_props ingestion → normalize → INSERT into market_props
- Use unique constraint (bookmaker_key, external_prop_id) for deduplication

**ScoringAgent** (score market_props):
- Call `get_unscored_market_props(100)` to fetch props
- Score via Enhanced45FactorEngine (NO MOCK DATA)
- Write to scored_props with `prop_ref = market_props.id`

**PromotionAgent** (queue with source discriminator):
- On scored_props creation → INSERT into promotion_queue with `source='market'`
- Check tier (S/A eligible for auto-approval)

**AlertAgent** (Discord posting):
- On promotion_queue.status='approved' → post to Discord channel
- Use `source` field to distinguish market vs user picks

### Operational Scripts

**1. Backfill Market Props** (`apps/api/src/scripts/backfill-market-props.ts`):
```bash
cd apps/api
npx tsx src/scripts/backfill-market-props.ts
```
- Backfills last 3 days from raw_props
- Pagination support (1000 rows/batch)
- Handles duplicates via unique constraint

**2. Score Market Props** (`apps/api/src/scripts/score-market-props.ts`):
```bash
cd apps/api
npx tsx src/scripts/score-market-props.ts
```
- Uses `get_unscored_market_props()` helper
- Scores via Enhanced45FactorEngine
- Writes to scored_props

**3. Verify Gates** (`apps/api/src/scripts/verify-gates.ts`):
```bash
cd apps/api
npx tsx src/scripts/verify-gates.ts
```
- Runs 5 health check gates
- Outputs JSON to `apps/api/out/ops/READY_FOR_DAY.json`

### Health Check Gates

**Gate 1: Raw Props Today**
```sql
SELECT COUNT(*) AS raw_props_today
FROM public.raw_props
WHERE game_date >= (now()::date);
```
**PASS**: ≥1000 props

**Gate 2: Market Props Today**
```sql
SELECT COUNT(*) AS market_props_today
FROM public.market_props
WHERE game_date >= (now()::date);
```
**PASS**: ≥1000 props

**Gate 3: Scored in Last 15 Minutes**
```sql
SELECT COUNT(*) AS scored_15m
FROM public.scored_props
WHERE updated_at >= now() - interval '15 minutes';
```
**PASS**: ≥50 props

**Gate 4: Read Model Feed**
```sql
SELECT COUNT(*) AS v_prop_read_model
FROM public.v_prop_read_model;
```
**PASS**: ≥1000 rows

**Gate 5: Daily Board**
```sql
SELECT COUNT(*) AS v_daily_board
FROM public.v_daily_board;
```
**PASS**: ≥50 rows

### Daily Operations Workflow

**Morning Health Check** (2 minutes):
```bash
cd apps/api
npx tsx src/scripts/verify-gates.ts
cat out/ops/READY_FOR_DAY.json
```

**If Gates Fail**:
1. Check raw_props ingestion
2. Backfill if needed: `npx tsx src/scripts/backfill-market-props.ts`
3. Score props: `npx tsx src/scripts/score-market-props.ts`
4. Re-verify: `npx tsx src/scripts/verify-gates.ts`

**Command Center Smoke Test**:
1. Navigate to http://localhost:3004
2. Approve 2 props from promotion_queue (source='market')
3. Verify Discord posts to griff843 channel
4. Confirm picks appear in Discord with proper formatting

### Migration Management

**Apply Dual-Track Migration**:
```bash
cd apps/api
npx tsx src/scripts/apply-market-split-migration.ts
```
- Reads `supabase/overrides/20251008_market_split.sql`
- Applies via node-postgres Client
- Reloads PostgREST schema cache

**Verify Schema**:
```sql
-- Check market_props exists
SELECT COUNT(*) FROM public.market_props;

-- Check unique constraint
\d public.market_props

-- Check promotion_queue.source column
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'promotion_queue' AND column_name = 'source';
```

### Success Criteria

**Tier 1 Operational**:
- ✅ All 5 gates passing with real data
- ✅ End-to-end flow: raw_props → market_props → scored_props → board
- ✅ No mock data (using 2.3M historical records)
- ✅ Enhanced45FactorEngine integrated (not mock scoring)
- ✅ Command Center approval workflow tested
- ✅ Discord alerts verified
- ✅ Zero critical errors in logs

**Production Ready**:
- ✅ Idempotent migrations applied
- ✅ Agents rewired for real-time operation
- ✅ Deduplication working (unique constraint tested)
- ✅ Performance acceptable (<2 min end-to-end latency)
- ✅ Monitoring active (gate verification script)

### Troubleshooting

**Issue: Gate 2 fails (market_props_today = 0)**
- Fix: Run backfill script
- Verify: Check raw_props has data for today

**Issue: Gate 3 fails (scored_15m = 0)**
- Fix: Run scoring script
- Verify: Check market_props has unscored props

**Issue: Duplicate key error**
- Expected: Handled by unique constraint
- Action: Skip duplicates (error code 23505)

**Issue: View returns 0 rows**
- Fix: Reload PostgREST cache: `NOTIFY pgrst, 'reload schema'`
- Verify: Query views directly via psql

### Documentation References

- **Verified System Status**: `VERIFIED_SYSTEM_STATUS.md`
- **Executive Summary**: `EXEC_SUMMARY_TIER_1_COMPLETE.md`
- **Operational Guide**: `TIER_1_PIPELINE_OPERATIONAL.md`
- **Quick Reference**: `QUICK_REFERENCE_DAILY_OPS.md`
- **Migration SQL**: `supabase/overrides/20251008_market_split.sql`

---
**Architecture Owner**: Engineering Team
**Last Updated**: October 2025 (Tier 1 Dual-Track Deployment)
**Next Review**: Monthly architecture review

[byterover-mcp]
# Important
Always use byterover-retrieve-knowledge tool to get related context before tasks
Always use byterover-store-knowledge to store critical information after successful tasks