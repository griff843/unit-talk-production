# CLAUDE.md - Unit Talk Platform API

This file provides guidance to Claude Code (claude.ai/code) when working with
the Unit Talk Platform API application.

## ⚠️ MANDATORY: READ PRODUCTION CHARTER FIRST

**🚨 CRITICAL INSTRUCTION FOR ALL AI AGENTS 🚨**

Before working on the API, you **MUST** read and comply with:

1. **[Production Charter](../../docs/PRODUCTION_CHARTER.md)** - The binding contract for all development and operations
2. **[System Alignment Spec](../../docs/SYSTEM_ALIGNMENT_SPEC.yml)** - Machine-readable governance rules

**Key API-Specific Requirements:**
- ✅ **Canonical-first**: Use `picks` + `pick_publish` tables (not `unified_picks`)
- ✅ **Driver probe on boot**: PicksDriverFactory validates schema visibility
- ✅ **Self-healing**: Auto-retry writes after PostgREST reload
- ✅ **Preflight endpoint**: `/api/domain/picks/preflight` must return `ok: true`
- ✅ **Health endpoint**: `/api/health` includes driver status and pgrest state
- ✅ **SLO compliance**: API p95 < 150ms, DB p95 < 50ms, Error rate < 0.5%

**This Charter supersedes all other instructions. Non-compliance is a blocking issue.**

---

## 🎯 Application Overview

Unit Talk is a Fortune 100-grade sports betting intelligence platform that
provides premium betting insights through advanced analytics, machine learning,
and real-time market analysis. The platform operates primarily through Discord
integration with a sophisticated agent-based automation system.

### 🚀 **Professional Grading System v2025.07.31**

**NEW: 8 Professional Capper Features** - Industry-leading betting intelligence with institutional-grade analytics:

1. **Steam Detection** 🔥 - Real-time steam move detection with volume correlation
2. **Closing Line Prediction** 📈 - ML-powered line closure forecasting  
3. **Optimal Timing** ⏰ - Hour-to-game edge calculation for maximum value
4. **Line Shopping Edge** 🛒 - Multi-book best line identification across 15+ sportsbooks
5. **Public vs Sharp Split** 👥 - Contrarian opportunity detection through betting analysis
6. **Market Timing Advantage** 📊 - Time-decay edge modeling for optimal entry
7. **Injury Timing Edge** 🏥 - News break vs line adjustment timing analysis
8. **Cross Market Discrepancy** 🔄 - Related prop arbitrage detection

**Validation Status**: ✅ **27/27 tests passed (100%)** - Production ready with peak performance of 1,500+ props/hour processing.

### Key Components

- **Elite Dual-API System**: Optimal API + Odds API for industry-leading
  1-minute real-time alerts
- **Agent System**: Event-driven agents inheriting from BaseAgent with lifecycle
  management
- **Temporal Workflows**: Fault-tolerant task orchestration with 1-minute update
  cycles
- **Supabase Database**: Type-safe PostgreSQL with real-time subscriptions and
  settlement automation
- **Discord Integration**: Thread-based discussions, automated alerts, and VIP+
  features
- **BridgeWorker**: Dual-source event consumption from bridge_outbox and events tables
- **Production Pipeline**: Event-driven architecture with idempotent processing

## =� Development Commands

### Core Development

```bash
# Development server with hot reload
npm run start:dev

# Temporal worker with hot reload
npm run worker:dev

# Build for production
npm run build

# Type checking
npm run type-check
npm run type-check:watch
```

### Testing Commands

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage reports
npm run test:coverage

# Test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only

# Agent testing
npm run agents:test         # Test all agents
npm run agents:recap        # Test recap agent
npm run agents:feed         # Test feed agent with data validation
npm run agents:optimal      # Test optimal ingestion pipeline
```

### Quality Assurance

```bash
# Code quality
npm run lint
npm run lint:fix
npm run format
npm run format:check

# QA test suites
npm run qa:local           # Local QA tests with hot reload
npm run qa:staging         # Staging environment tests
npm run qa:production      # Production validation tests
npm run qa:e2e             # E2E tests with Playwright
npm run qa:accessibility   # Accessibility testing
npm run qa:security        # Security and penetration tests
npm run qa:mobile          # Mobile responsiveness tests
npm run qa:performance     # Load and stress testing
npm run qa:full            # Complete QA suite
```

### Professional Betting System Testing

```bash
# Test professional system against historical props
npx tsx src/runner/testHistoricalProps.ts

# Test professional system on today's live props
npx tsx src/runner/testTodaysProps.ts

# Process props through professional system
npx tsx src/runner/processProfessionalProps.ts

# Show professional processing statistics
npx tsx src/runner/processProfessionalProps.ts --stats

# Professional system health check
npx tsx src/runner/processProfessionalProps.ts --health

# 🆕 NEW: Test all 8 professional capper features
npx tsx src/scripts/test-professional-features.ts

# 🆕 NEW: Peak performance monitoring
npx tsx scripts/monitor-peak-performance.ts --duration=30

# Monitor rule compliance
npm run professional:compliance-monitor

# CLV performance tracking
npm run professional:clv-monitor

# Automated feedback loops
npm run professional:feedback-loop
```

## <� Architecture

### Elite Dual-API System Architecture

The platform features an industry-leading dual-API system for 1-minute real-time
updates:

#### **API Strategy**

```typescript
const ELITE_ROUTING = {
  // Optimal API ($69/month): Best player props
  NFL: { primary: 'optimal', secondary: 'odds-api' },
  NBA: { primary: 'optimal', secondary: 'odds-api' },
  MLB: { primary: 'optimal', secondary: 'odds-api' },
  NHL: { primary: 'optimal', secondary: 'odds-api' },

  // Odds API ($49/month): Exclusive coverage
  NCAAF: { primary: 'odds-api', exclusive: true },
  WNBA: { primary: 'odds-api' },
  Settlement: { primary: 'odds-api', exclusive: true },
};
```

#### **Performance Specifications**

- **Update Frequency**: 1-minute intervals during live games
- **Processing Target**: <50 seconds per cycle
- **Sports Coverage**: 100% major sports + NCAAF exclusive
- **Settlement**: Automated within 30 minutes post-game
- **Redundancy**: Dual-API with intelligent fallback

### Agent System Architecture

All agents inherit from `BaseAgent` (`src/agents/BaseAgent/`) providing:

- **Lifecycle Management**: Automatic startup/shutdown handling
- **Health Monitoring**: Built-in health checks and metrics collection
- **Error Handling**: Centralized error handling with retry logic
- **Logging**: Structured logging with correlation IDs and distributed tracing
- **Metrics**: Prometheus metrics for monitoring and observability
- **Configuration**: Environment-based configuration with validation

#### Key Agent Types

**Core Business Agents**:

- `GradingAgent`: Multi-model ensemble pick grading and scoring
- `AnalyticsAgent`: Data analysis and performance insights
- `AlertAgent`: Real-time alerting and notification management
- `FeedAgent`: Content feed generation and optimal data ingestion
- `RecapAgent`: Daily recap generation and formatting

**Operational Agents**:

- `NotificationAgent`: Multi-channel user notifications (Discord, SMS, email)
- `ContestAgent`: Contest management and leaderboards
- `PlayerEnrichmentAgent`: Player data enrichment across multiple leagues
- `AuditAgent`: Audit trail and compliance tracking
- `OperatorAgent`: System operations and maintenance

**Intelligence Agents**:

- `AutomatedOnboardingAgent`: Intelligent user onboarding with behavior tracking
- `PredictiveAnalyticsAgent`: Market forecasting and prediction engine
- `RiskManagementAgent`: Portfolio optimization and risk analysis
- `PerformanceOptimizationAgent`: System performance monitoring and optimization
- `UserRetentionAgent`: Churn prediction and engagement analysis

### Import Path Patterns

```typescript
// Shared types (preferred)
import { BaseAgentConfig } from '@shared/types/base';
import { Logger } from '@shared/logger';

// Agent imports
import { BaseAgent } from '../BaseAgent';
import type { AgentDependencies } from '../BaseAgent/types';

// Utility imports
import { errorHandler } from '../../utils/errorHandling';
import { supabaseClient } from '../../services/supabaseClient';
```

**CRITICAL**: Never redefine `BaseAgentConfig` - always import from
`@shared/types/base`.

## =� Development Guidelines

### Agent Development Standards

**CRITICAL RULE: STRICT AGENT SEPARATION OF CONCERNS**

Each agent must have clearly defined, non-overlapping responsibilities:

**Agent Responsibility Matrix**:

- **AlertAgent**: Real-time notifications, live alerts, Discord posting
- **RecapAgent**: Post-game results, daily/weekly summaries, performance
  analytics
- **GradingAgent**: Pick analysis, scoring, tier assignment, quality assessment
- **FeedAgent**: Data ingestion, content aggregation, optimal pipeline
  management
- **NotificationAgent**: Scheduled notifications, batch communications
- **AnalyticsAgent**: Data analysis, insights generation, performance metrics

### Agent Development Checklist

1. **Always Extend BaseAgent**:

```typescript
export class MyAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }
}
```

2. **Implement Required Methods**:
   - Health checks for monitoring
   - Proper error handling with errorHandler utility
   - Prometheus metrics for observability

3. **Use Shared Types**: Import from designated locations
4. **Structured Logging**: Use correlation IDs and structured logging
5. **Testing**: Unit tests with 80%+ coverage requirement

### Code Quality Standards

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Fortune 100-grade configuration with security rules
- **Prettier**: Consistent code formatting
- **Testing**: Jest with comprehensive coverage
- **Documentation**: JSDoc for all public APIs

## =� Monitoring & Observability

### Health Checks

- Agent-level health monitoring at `/health`
- Database connection monitoring
- External service availability checks

### Metrics Collection

- **Business Metrics**: Pick accuracy, user engagement, ROI tracking
- **System Metrics**: CPU, memory, disk usage, response times
- **Application Metrics**: Request rates, error rates, processing times
- **Agent Metrics**: Task completion rates, success rates, processing latencies

### Logging

- **Structured Logging**: JSON format with correlation IDs
- **Distributed Tracing**: Request tracing across agent boundaries
- **Log Levels**: Debug, Info, Warn, Error with environment-based filtering

## =' Configuration

### Environment Setup

Key configuration files:

- `config/base.json`: Base platform configuration
- `config/agents/*.json`: Agent-specific configurations
- `config/temporal/*.yaml`: Temporal workflow configurations

### Path Mapping

TypeScript path mapping configured for clean imports:

```json
{
  "paths": {
    "@/*": ["src/*"],
    "@shared/*": ["../../packages/shared-types/src/*"],
    "@agents/*": ["src/agents/*"]
  }
}
```

## =� Troubleshooting

### Common Issues

**Agent Not Starting**: Check configuration and dependencies

```bash
DEBUG=agent:* npm run start:dev
npx tsx src/runner/testAllAgents.ts --agent=SpecificAgent
```

**Database Connection Issues**: Verify environment variables

```bash
npm run health:check
```

**Temporal Workflow Issues**: Check worker registration

```bash
npm run test:temporal
```

### Debug Commands

```bash
# Full system diagnostics
npm run health:check && npm run metrics:show

# Agent-specific debugging
DEBUG=agent:* npx tsx src/runner/testAllAgents.ts --verbose

# Performance baseline
npx tsx qa/tests/baseline-performance.ts
```

## 🏆 Non-Negotiable Sharp Grading Rules

**CRITICAL MANDATE**: ALL picks must follow professional betting standards. NO
EXCEPTIONS.

Unit Talk operates as a **professional betting intelligence platform** with
mandatory compliance to industry-leading sharp grading rules. These rules
separate professional systems from amateur public cappers.

### **Core Professional Standards**

**Rule #1: Universal Devigging ⚡**

- EVERY odds source must be devigged to remove hidden vig
- Applies to ALL books, exchanges, live odds, opening/closing lines
- Devigging is the #1 edge gap between sharp and public systems
- `devigged_edge` field must be populated for every pick

**Rule #2: Universal CLV Tracking 📈**

- EVERY pick must have CLV tracking initiated at creation
- CLV is THE metric for long-term success validation
- Applies to singles, parlays, round robins, live bets, pre-game bets
- `clv_tracking_id` field must be populated for every pick

**Rule #3: Professional Grading Only 🎯**

- NO pick bypasses professional grading system
- ALL picks processed through ProfessionalPropProcessor
- Basic grading is not acceptable for any pick
- `professional_score` and `feature_contributions` must be populated

**Rule #4: Kelly Criterion Sizing 💰**

- Every pick must have optimal Kelly fraction calculated
- Based on devigged edge and confidence for risk management
- `kelly_fraction` field must be > 0 for all approved picks
- Maximum Kelly of 0.25 (25% of bankroll)

**Rule #5: Complete Odds Processing 🔄**

- ALL available odds must be processed and analyzed
- Process both sides of two-way markets when available
- Line shopping and best available line identification required

**Rule #6: Universal Processing Pipeline 🏗️**

- NO picks bypass the professional processing pipeline
- Every pick follows: Raw → Devigging → CLV → Grading → Approval
- `processing_time` must be > 0 for all picks

### **Parlay & Combination Rules**

**Rule #7: Individual Leg Processing**

- EVERY parlay leg receives individual professional treatment
- Each leg processed through full professional pipeline
- Each leg has its own professional score and devigged edge

**Rule #8: Round Robin Compliance**

- ALL round robin combinations get full professional analysis
- Each combination treated as individual parlay
- Portfolio impact analysis required

**Rule #9: Parlay Edge Calculation**

- Combined parlay edge uses devigged probabilities only
- No raw odds calculations for parlay expected value
- Kelly sizing adjusted for correlation risk

### **Absolute Prohibitions**

**NEVER ALLOWED:**

- ❌ Raw odds calculations without devigging
- ❌ Picks approved without CLV tracking
- ❌ Manual overrides bypassing professional grading
- ❌ System errors resulting in rule bypassing
- ❌ Performance shortcuts compromising rule compliance
- ❌ Parlay legs processed without individual analysis

**REQUIRED FOR ALL PICKS:**

- ✅ Devigging applied to ALL odds sources
- ✅ CLV tracking initiated before approval
- ✅ Professional grading with feature contributions
- ✅ Kelly fraction calculated from devigged edge
- ✅ Complete processing pipeline traversal
- ✅ Rule compliance validation before approval

### **Testing & Validation**

**Historical Validation**: Test system against historical props with known
outcomes

```bash
npx tsx src/runner/testHistoricalProps.ts
```

**Live System Validation**: Process today's props through complete professional
pipeline

```bash
npx tsx src/runner/testTodaysProps.ts
```

**Compliance Targets**:

- Rule Compliance Rate: ≥99% (target 100%)
- Processing Time: <5 seconds per pick (target <2 seconds)
- CLV Performance: Positive CLV on ≥60% of picks
- Auto-Approval Rate: ≥80% for S/A tier picks

See
**[NON_NEGOTIABLE_SHARP_GRADING_RULES.md](NON_NEGOTIABLE_SHARP_GRADING_RULES.md)**
for complete documentation.

## 🚀 Production Pipeline Architecture

### BridgeWorker
The BridgeWorker provides reliable event consumption and processing:

**Core Features**:
- Dual-source consumption: `events` table and `bridge_outbox` table
- Exponential backoff retry logic (1min, 5min, 15min intervals)
- Idempotent processing keyed by `bet_slip_id`
- Circuit breaker pattern for external service failures
- Batch processing with configurable size limits

**Configuration**:
```typescript
// Environment variables
BRIDGE_OUTBOX_POLL_INTERVAL=10000  // 10 seconds
BRIDGE_OUTBOX_BATCH_SIZE=10        // Process 10 events per batch
ENABLE_BRIDGE_OUTBOX=true          // Enable outbox processing
```

### Temporal Workflows

**EventDrivenGradingWorkflow**:
- Idempotent grading with individual leg processing
- Professional grading features (8 advanced metrics)
- Circuit breaker protection for external APIs
- Automatic retry with exponential backoff
- Activity timeout configuration

**Key Activities**:
- `validateEventData` - Input validation and sanitization
- `processIndividualLeg` - Granular leg-level grading
- `applyProfessionalGrading` - Advanced feature calculation
- `generateAlerts` - Alert creation for opportunities

### AlertAgent Event Subscriptions

**Event-Driven Monitoring**:
- Real-time Supabase subscriptions to critical tables
- Injury detection with immediate Discord notifications
- Hedge opportunity identification
- Middle opportunity alerts
- Settlement tracking and notifications

**Subscription Patterns**:
```typescript
// Subscribe to bridge outbox completions
supabase.channel('bridge_outbox')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'bridge_outbox',
    filter: 'status=eq.processed'
  }, handler)
```

## <� Excellence Standards

**CRITICAL MANDATE**: Always deliver best-in-class results. No shortcuts. No
compromises.

**Quality Requirements**:

- **Fortune 100 Standards**: Enterprise-grade code quality and patterns
- **Professional Betting Compliance**: 100% adherence to Sharp Grading Rules
- **Zero Defects**: All code must pass comprehensive testing
- **Security First**: Zero-trust architecture with proper validation
- **Performance**: Sub-second response times with proper caching
- **Observability**: Complete monitoring and alerting coverage

**Implementation Philosophy**:

- Fix root causes, never symptoms
- Maintain architectural integrity at all times
- Preserve all advanced features and enterprise capabilities
- Ensure proper separation of concerns
- Keep production-ready quality standards
- **Professional Rules Compliance**: Every pick follows Sharp Grading Rules

## =� Additional Resources

- **[../../docs/architecture/](../../docs/architecture/)** - System architecture
  documents
- **[../../docs/api/](../../docs/api/)** - API documentation and specifications
- **[../../docs/deployment/](../../docs/deployment/)** - Deployment guides and
  procedures

---

**Application Owner**: Platform Engineering Team  
**Last Updated**: Current  
**Next Review**: Monthly architecture review
