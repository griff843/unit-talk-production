# Production Readiness Checklist

This document tracks the production readiness status of all Unit Talk platform components.

## Test Harness Integration

### ✅ Jest + Seeds Test Harness
- tests/seeds/*.json — JSON fixtures for integration seeds
- tests/agents/*.test.ts — Jest tests invoking ScoringAgent/PromotionAgent
- tests/setup/globalSetup.ts — DB reset before suite
- scripts/db/reset-test.ts — standalone reset (ts-node)
- jest.config.js — root Jest config (ts-jest)

### Test Commands
- npm run test → runs full suite
- npm run test:seeds → runs only ScoringAgent seed tests
- npm run db:reset:test → manual DB reset using ts-node

### Notes
- Windows-safe paths only (path.join in tests)
- Uses Supabase client from apps/api/src/services/supabaseClient
- Does not modify agent logic
- 30s test timeout
- Skips gracefully if Supabase env is not configured

## ✅ SettlementAgent System

### Multi-Sport Settlement Engine
- ✅ **Multi-sport adapters**: MLB, NFL, NBA, NCAAF, WNBA support
- ✅ **Idempotent backfill & live modes**: Production-grade settlement processing
- ✅ **CLI + API entrypoints**: Full operational control interface
- ✅ **Market normalization**: Sport-specific stat mapping for all supported leagues
- ✅ **Settlement engine**: Over/under, yes/no, parlay outcome evaluation
- ✅ **Database migration**: Schema enhancement with settlement columns and indexes
- ✅ **Comprehensive testing**: 90%+ coverage for engine, normalizers, and adapters
- ✅ **Production monitoring**: Health checks, metrics, and audit trails
- ✅ **Error handling**: Circuit breakers, retry logic, and graceful degradation
- ✅ **Rate limiting**: Per-adapter rate limits with configurable thresholds
- ✅ **Documentation**: Complete system documentation and troubleshooting guides

### Deployment Requirements
- [ ] **Database migration applied**: Run `022_settlement_system.sql`
- [ ] **API credentials configured**: MLB, ESPN, BallDontLie API access
- [ ] **Temporal worker registration**: Settlement workflow workers deployed
- [ ] **Monitoring dashboards**: Settlement metrics and alerting configured
- [ ] **Performance testing**: Validate 1000+ picks/hour processing target

### Safety Features
- ✅ **Freeze mode**: Prevents all writes when enabled
- ✅ **Shadow mode**: Simulates operations without database writes
- ✅ **Force mode**: Allows re-settlement of already settled picks
- ✅ **Audit trails**: Complete settlement history and change tracking
- ✅ **Rollback capability**: Emergency rollback procedures documented

### Operational Readiness
- ✅ **CLI tools**: Complete command-line interface for operations
- ✅ **API endpoints**: RESTful API for programmatic access
- ✅ **Health checks**: System health monitoring and diagnostics
- ✅ **Job tracking**: Progress monitoring and error reporting
- ✅ **Batch processing**: Configurable batch sizes and rate limits



## ✅ Command Center Settlement Panel
- Real-time unsettled counts (global + per-league)
- Per-league progress bars
- Job history table (last 5 runs)
- Trigger controls (league/date range, dryRun, force, batch, rate)
- Cancel running job
