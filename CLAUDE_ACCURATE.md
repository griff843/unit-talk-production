# CLAUDE.md - Unit Talk Platform Workspace (ACCURATE VERSION)

Corrected guidance for Claude Code (claude.ai/code) based on actual codebase
analysis.

## 🚀 Docker-Only Development Rules

**CRITICAL**: All services, scripts, and dependencies MUST run in Docker
containers via docker-compose or ./dev.sh

### Docker Command Reference

| Action         | Correct Pattern                            | Never Use                    |
| -------------- | ------------------------------------------ | ---------------------------- |
| Start stack    | `./dev.sh start`                           | `npm run dev`, `node app.js` |
| Run script     | `docker-compose exec app npm run <script>` | `npm run <script>`           |
| Add dependency | Edit package.json + `./dev.sh restart`     | `npm install <pkg>` locally  |
| Set env vars   | Edit `.env` or `docker-compose.yml`        | `export VAR=val` in shell    |
| See logs       | `./dev.sh logs`                            | `tail -f` in terminal        |
| Debug app      | `docker-compose exec app bash`             | Local VSCode/terminal        |

## 📊 Actual System Status (Code-Verified)

### Enhanced45Factor Engine - Professional 45-Factor System ✅

- **Implementation**: Sophisticated 45-factor scoring engine (verified in code)
- **Architecture**: Cache-first with Redis coordination
- **Processing**: Direct unified_picks writes (bypasses raw_props)
- **Professional Features**: Steam detection, CLV tracking, Kelly sizing,
  devigging

### Verified System Health

- **Database**: Modern unified_picks-centric architecture
- **Agents**: 20+ operational agents with BaseAgent inheritance
- **Cache Architecture**: 3-layer (Memory → Redis → Database)
- **Infrastructure**: Docker orchestration with Temporal workflows

## 🏗️ Actual Workspace Architecture

```
unit-talk-platform/
├── apps/                   # Applications
│   ├── api/               # Main backend API (20+ agents)
│   ├── discord-bot/       # Discord bot
│   ├── dashboard/         # Next.js dashboard
│   ├── smart-form/        # Smart form app
│   └── command-center/    # Command & control
├── packages/              # Shared packages
├── docs/                  # Documentation
└── scripts/               # Tooling
```

## 🔄 Real Data Flow Architecture

### Cache-First FeedAgent Flow (ACTUAL)

```
FeedAgent (Cache-First)
├── CachedProviders (Odds API, Optimal API)
├── Redis Cache (L2: 15-60min TTL)
├── Memory Cache (L1: 30s-5min TTL)
└── CacheFirstUnifiedPicksService
    └── unified_picks (Direct Write)
```

**Key Change**: Bypasses raw_props table entirely, writes directly to
unified_picks

### ScoringAgent (Replaces Legacy GradingAgent)

```
ScoringAgent
├── Enhanced45FactorEngine (45 sophisticated factors)
├── ProfessionalPropProcessor
├── scoringEngine (professional scoring logic)
└── Steam Detection & CLV Integration
```

**Critical**: GradingAgent was deprecated 2025-09-30 and replaced by
ScoringAgent. All grading functionality migrated to ScoringAgent with
Enhanced45Factor scoring.

### Event-Driven AlertAgent

```
AlertAgent
├── Discord Rich Embeds
├── Real-time Supabase Subscriptions
├── Steam Detection Integration
└── Hedge Detection Engine
```

## 📋 Verified Agent System (20+ Agents)

### Core Business Agents

- **ScoringAgent**: Professional 45-factor scoring (replaces GradingAgent)
- **FeedAgent**: Cache-first data ingestion with unified_picks direct writes
- **AlertAgent**: Event-driven Discord notifications and real-time alerts

### Data & Analytics Agents

- **AnalyticsAgent**: Data analysis and performance insights
- **DataLifecycleAgent**: Data archiving and lifecycle management
- **PerformanceOptimizationAgent**: System performance monitoring

### User & Campaign Agents

- **AutomatedOnboardingAgent**: Intelligent user onboarding
- **UserRetentionAgent**: Churn prediction and engagement
- **CampaignAgent**: Marketing campaign management
- **NotificationAgent**: Multi-channel notifications

### Operations Agents

- **OperatorAgent**: System operations and health monitoring
- **AuditAgent**: Compliance and audit trail
- **SettlementAgent**: Bet settlement automation

### Infrastructure Agents

- **CacheManagementAgent**: Cache coordination and optimization
- **HealthMonitorAgent**: System health monitoring
- **PipelineOrchestratorAgent**: Workflow orchestration
- **WorkflowTriggerAgent**: Event-driven workflow triggers

### Specialized Agents

- **RiskManagementAgent**: Portfolio optimization and risk analysis
- **PredictiveAnalyticsAgent**: Market forecasting
- **PlayerEnrichmentAgent**: Multi-league player data enrichment
- **FeatureBuilderAgent**: Feature engineering and ML pipelines
- **ScoringCoordinatorAgent**: Scoring system coordination

**All agents inherit from BaseAgent** with:

- Lifecycle management
- Health monitoring
- Structured logging
- Metrics collection
- Error handling with retry logic

## 🚀 Verified Commands

### Core Development

```bash
./dev.sh start    # Start all services with health checks
./dev.sh status   # Monitor services and resources
./dev.sh logs     # View centralized logs
./dev.sh restart  # Intelligent restart
./dev.sh stop     # Graceful shutdown
```

### Enhanced45Factor Testing (VERIFIED WORKING)

```bash
# ScoringAgent commands (replaces GradingAgent)
docker-compose exec api npx tsx scripts/validate-enhanced45factor-success.ts
docker-compose exec api npx tsx scripts/run-real-feedagent-workflow.ts
docker-compose exec api npx tsx scripts/check-real-players.ts

# Cache-first FeedAgent testing
docker-compose exec api npx tsx src/runner/runCacheFirstFeedAgent.ts
```

### Database Operations

```bash
docker-compose exec api npm run db:status   # Check migrations
docker-compose exec api npm run db:migrate  # Apply migrations
docker-compose exec postgres psql -U postgres
```

## 📍 Service URLs (Verified)

| Service        | URL                   | Status                   |
| -------------- | --------------------- | ------------------------ |
| Command Center | http://localhost:3004 | ✅                       |
| API            | http://localhost:3000 | ✅                       |
| Smart Form     | http://localhost:3002 | ✅                       |
| Dashboard      | http://localhost:3003 | ✅                       |
| Temporal UI    | http://localhost:8088 | ✅                       |
| Prometheus     | http://localhost:9090 | ✅                       |
| Grafana        | http://localhost:3005 | admin/admin              |
| pgAdmin        | http://localhost:5050 | admin@unittalk.com/admin |

## 🗄️ Actual Database Architecture

### Verified Core Tables

- `unified_picks` - Central pick management (cache-first writes)
- `daily_picks` - Daily pick aggregation
- `capper_profiles` - User/capper management
- `sports_game_odds` - Game and odds data
- `analytics_events` - Event tracking
- `bridge_outbox` - Event processing queue (from code analysis)

### Cache Architecture (3-Layer)

```
L1: Memory Cache (30s-5min TTL)
    ↓
L2: Redis Cache (15-60min TTL)
    ↓
L3: Database (Permanent storage)
```

## 🔧 Development Workflow (Updated)

### Mandatory Operations

```bash
# 1. Start environment
./dev.sh start

# 2. Database verification
docker-compose exec api npm run db:status
docker-compose exec api npm run db:migrate

# 3. Type & build verification
docker-compose exec api npm run type-check
docker-compose exec api npm run build

# 4. Cache-first system testing
docker-compose exec api npx tsx src/runner/runCacheFirstFeedAgent.ts

# 5. ScoringAgent testing (not GradingAgent)
docker-compose exec api npx tsx scripts/validate-enhanced45factor-success.ts

# 6. Health validation
curl http://localhost:3000/health
curl http://localhost:3004/api/health
```

## 🏆 Professional Features (Verified)

### Enhanced45Factor Engine Features

```typescript
// 45 sophisticated factors across 5 categories
interface Factor45Config {
  marketFactors: 10; // EV, line movement, CLV, steam detection
  playerFactors: 10; // Form, matchup, injury, fatigue
  matchupFactors: 10; // Team vs team, pace, game script
  priceFactors: 10; // Kelly sizing, line shopping, risk
  metaFactors: 5; // Data quality, model agreement
}
```

### Professional Betting Compliance

- ✅ Universal devigging (all odds sources)
- ✅ CLV tracking (every pick)
- ✅ Kelly criterion sizing
- ✅ Steam detection integration
- ✅ Line shopping optimization
- ✅ Risk-adjusted scoring

## 🔄 Temporal Workflows (Verified)

### Event-Driven Processing

- **BridgeWorker**: Dual-source event consumption
- **EventDrivenGradingWorkflow**: Professional scoring with ScoringAgent
- **Settlement Workflows**: Automated bet settlement
- **Health Monitoring**: Agent lifecycle management

## 📚 Accurate Documentation Structure

### Application-Specific (Verified Paths)

- [apps/api/CLAUDE.md](apps/api/CLAUDE.md) - Backend API
- [apps/api/src/agents/FeedAgent/README-CACHE-FIRST.md](apps/api/src/agents/FeedAgent/README-CACHE-FIRST.md) -
  Cache architecture
- [apps/api/src/agents/ScoringAgent/README.md](apps/api/src/agents/ScoringAgent/README.md) -
  Scoring system

### Architecture Documentation

- [apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorSystem.md](apps/api/src/agents/ScoringAgent/scoring/Enhanced45FactorSystem.md) -
  45-factor details

## 🎯 Development Guidelines (Updated)

### Core Principles

- **Docker-First**: Everything runs in containers
- **Cache-First**: All data access through cache layers
- **Event-Driven**: Real-time processing with Temporal workflows
- **Agent-Based**: All functionality through BaseAgent inheritance
- **ScoringAgent-Based**: All grading through ScoringAgent (not GradingAgent)

### Agent Development Standards

**CRITICAL**: GradingAgent was deprecated 2025-09-30. Use ScoringAgent for all
scoring/grading operations.

```typescript
// ✅ CORRECT: Use ScoringAgent for grading
import { ScoringAgent } from '../ScoringAgent';
import { Enhanced45FactorEngine } from '../ScoringAgent/scoring/Enhanced45FactorEngine';

// ❌ INCORRECT: GradingAgent deprecated (LEGACY_DISABLED 2025-09-30)
// import { GradingAgent } from '../GradingAgent'; // DEPRECATED - Use ScoringAgent
```

### Cache-First Data Access

```typescript
// ✅ CORRECT: Cache-first unified_picks writes
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';

// ❌ INCORRECT: Direct raw_props writes (old pattern)
// rawPropsRepo.insert(props); // Bypasses cache architecture
```

## 🚨 Critical Breaking Changes

### 1. GradingAgent Deprecation (LEGACY_DISABLED 2025-09-30)

- **Status**: Deprecated and replaced by ScoringAgent
- **Replacement**: ScoringAgent with Enhanced45FactorEngine
- **Action Required**: Update all references to use ScoringAgent
- **Feature Flags**: GRADING_AGENT_ENABLED=false (production default)

### 2. Cache-First Architecture

- **Change**: FeedAgent now writes directly to unified_picks
- **Old Flow**: Providers → raw_props → processing → unified_picks
- **New Flow**: CachedProviders → Redis → unified_picks (direct)

### 3. Agent System Expansion

- **Change**: System now has 20+ specialized agents
- **Old Count**: Documentation claimed "5/5 agents"
- **New Reality**: 20+ agents with specialized responsibilities

## 🔍 Verification Commands

### Verify ScoringAgent (Not GradingAgent)

```bash
# ✅ This works - ScoringAgent with Enhanced45Factor
docker-compose exec api npx tsx scripts/validate-enhanced45factor-success.ts

# ❌ DEPRECATED - GradingAgent disabled (LEGACY_DISABLED 2025-09-30)
# docker-compose exec api npx tsx src/runner/runGradingAgent.ts
# ✅ Use ScoringAgent instead:
docker-compose exec api npx tsx src/runner/runScoringAgent.ts
```

### Verify Cache-First Architecture

```bash
# ✅ This works - Cache-first FeedAgent
docker-compose exec api npx tsx src/runner/runCacheFirstFeedAgent.ts

# Verify Redis cache
docker-compose exec redis redis-cli info stats
```

### Verify Agent Count

```bash
# Count actual agents in codebase
find apps/api/src/agents -maxdepth 1 -type d | wc -l
# Result: 20+ agents (not 5)
```

## 🏆 Excellence Standards (Unchanged)

**CRITICAL**: Always deliver best-in-class results. No shortcuts. No
compromises.

- **Accurate Documentation**: Documentation must match actual implementation
- **Cache-First Architecture**: All data access through cache layers
- **ScoringAgent Integration**: Use ScoringAgent for all grading operations
- **Event-Driven Processing**: Leverage Temporal workflows for reliability
- **Professional Compliance**: Maintain advanced betting intelligence features

## ⚠️ Documentation Warnings

**Before making changes**:

1. Verify component exists in codebase
2. Check for cache-first architecture requirements
3. Use ScoringAgent instead of GradingAgent
4. Test with verified commands only

**Never reference**:

- GradingAgent (deprecated LEGACY_DISABLED 2025-09-30 - use ScoringAgent)
- Direct raw_props writes (bypasses cache - use CacheFirstUnifiedPicksService)
- Unverified performance metrics

---

**Last Updated**: September 27, 2025 (Post-Documentation Audit) **Accuracy
Status**: ✅ Code-Verified **Next Review**: Monthly with codebase sync
verification
