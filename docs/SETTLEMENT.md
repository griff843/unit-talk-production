# SettlementAgent - Cache-Coordinated Multi-Sport Settlement System

## Overview

The SettlementAgent is a production-grade, cache-first settlement system integrated with the unified_picks architecture. It features L1/L2/L3 cache coordination, CLV tracking, and supports real-time settlement with sub-500ms query performance for comprehensive multi-sport coverage.

**Cache Integration**: L3 indexed settlement queries with cache coordination  
**Performance**: < 500ms settlement queries, CLV calculation with cached market data  
**Architecture**: unified_picks canonical source with intelligent cache invalidation  
**Scale**: Processes 1000+ picks/hour with cache-optimized batch processing

## Cache-First Settlement Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Cache-Coordinated SettlementAgent                     │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┤
│   L1 Cache      │   L2 Cache      │   L3 Cache      │  CLV Tracking   │
│   (Redis)       │  (Mat. Views)   │ (Indexed Queries)│  & Validation   │
│                 │                 │                 │                 │
│ • Hot Results   │ • Settlement    │ • Direct        │ • Market Data   │
│   < 5min        │   Aggregates    │   unified_picks │   Cache         │
│ • Player Stats  │ • Game Stats    │ • Historical    │ • CLV Calc      │
│ • < 50ms        │ • < 200ms       │ • < 500ms       │ • Line Movement │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        unified_picks Canonical Source                    │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┤
│  Sport          │  Settlement     │  Cache          │  Real-time      │
│  Adapters       │  Engine         │  Coordination   │  Updates        │
│                 │                 │                 │                 │
│ • MLB/NFL/NBA   │ • Cache-backed  │ • Invalidation  │ • Live Results  │
│ • Rate Limited  │   Validation    │ • Warming       │ • CLV Updates   │
│ • Retry Logic   │ • CLV Integration │ • Consistency  │ • Batch Coord   │
│ • Player Match  │ • Batch Process │ • Performance   │ • Alert Trigger │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

## Components

### 1. Cache-First SettlementAgent (`src/agents/SettlementAgent/`)

The main cache-coordinated orchestrator that:
- **Cache Integration**: L1/L2/L3 hierarchy for sub-500ms settlement queries
- **CLV Tracking**: Real-time closing line value calculation with cached market data
- **unified_picks Coordination**: Canonical source updates with cache invalidation
- **Batch Processing**: Cache-optimized batch settlement with intelligent warming
- **Real-time Updates**: Live results with cache coordination and alert triggering
- **Performance Monitoring**: Cache hit rates, query times, and settlement efficiency

### 2. Sport Adapters (`src/workflows/settlement/adapters/`)

**Base Adapter Features:**
- Rate limiting (configurable per provider)
- Retry logic with exponential backoff (1s, 2s, 4s)
- Player name normalization for flexible matching
- Error handling and circuit breaker patterns

**MLBAdapter** (`mlbAdapter.ts`)
- Uses MLB StatsAPI (statsapi.mlb.com)
- Rate limit: 10 RPS
- Supports both batting and pitching stats
- Calculates total bases accurately
- Handles game_pk resolution from various ID formats

**NFLAdapter** (`nflAdapter.ts`)
- Uses ESPN NFL API
- Rate limit: 4 RPS
- Parsing for passing, rushing, receiving, defensive stats
- Combined stat calculations (total yards, total TDs)
- Handles fractional stats (sacks, tackles for loss)

**NBAAdapter** (`nbaAdapter.ts`)
- Primary: BallDontLie API, Fallback: ESPN
- Rate limit: 6 RPS (BallDontLie allows 60/minute)
- Double-double and triple-double detection
- Advanced combined stats (PRA, STL+BLK)
- Minutes parsing from MM:SS format

**NCAAAdapter** (`ncaaAdapter.ts`)
- Uses ESPN NCAA APIs (football/basketball)
- Sport detection from game ID patterns
- Rate limit: 4 RPS
- Supports both college football and basketball

**WNBAAdapter** (`wnbaAdapter.ts`)
- Uses ESPN WNBA API
- Rate limit: 4 RPS
- Same stat structure as NBA with league-specific handling

### 3. Market Normalizers (`src/workflows/settlement/normalizers/`)

Sport-specific market normalization:

**MLB Markets:**
- `total_bases`, `hits`, `home_runs`, `runs`, `rbis`
- `walks`, `strikeouts`, `stolen_bases`, `doubles`, `triples`
- `pitching_outs`, `earned_runs`, `hits_allowed`, `walks_allowed`

**NFL Markets:**
- `passing_yards`, `passing_touchdowns`, `interceptions`
- `rushing_yards`, `rushing_touchdowns`, `receiving_yards`
- `receptions`, `total_yards`, `total_touchdowns`
- `tackles`, `sacks`, `field_goals_made`

**NBA/WNBA Markets:**
- `points`, `rebounds`, `assists`, `steals`, `blocks`
- `3_pointers_made`, `points_rebounds`, `points_assists`
- `points_rebounds_assists`, `double_double`, `triple_double`

### 4. Settlement Engine (`src/workflows/settlement/engine.ts`)

Evaluates outcomes with comprehensive logic:

**Over/Under Markets:**
- Exact line matches result in `push`
- Proper win/loss evaluation
- Support for alternate lines (no push)

**Yes/No Markets:**
- Binary evaluation for anytime scorers
- Special handling for touchdown markets

**Parlay Logic:**
- Any loss = parlay loss
- All push = parlay push
- Push + wins = reduced win
- Void handling

**Validation:**
- Sport-specific stat range validation
- Suspicious value flagging with logging

### 5. Cache-Coordinated Settlement Store (`src/agents/SettlementAgent/store.ts`)

unified_picks operations with cache coordination:
- **L3 Cache Queries**: Indexed settlement queries < 500ms with optimal performance
- **Cache Invalidation**: Smart invalidation on settlement updates with coordinated warming
- **CLV Integration**: Real-time CLV calculation with cached market data and line movement
- **Batch Coordination**: Cache-optimized batch processing with intelligent warming strategies
- **Real-time Updates**: Live settlement updates with cache consistency and alert triggering
- **Performance Monitoring**: Cache hit rates, query optimization, and settlement efficiency tracking

**Cache Hierarchy Integration**:
```typescript
// L1 Cache (Redis) - Hot settlement data
const cacheKey = `settlement:${pickId}:${gameId}`;
const cachedResult = await redis.get(cacheKey);

// L2 Cache (Materialized Views) - Settlement aggregates  
const settlementData = await queryMaterializedView('mv_settlement_data', filters);

// L3 Cache (Indexed Queries) - Direct unified_picks with optimization
const directQuery = await queryUnifiedPicksWithIndexes(settlementCriteria);
```

## Cache-First Usage

### Enhanced API Endpoints with Cache Integration (`/api/settlement/`)

**Start Cache-Optimized Backfill:**
```bash
curl -X POST /api/settlement/backfill \
  -H "Content-Type: application/json" \
  -d '{
    "league": "MLB",
    "dateFrom": "2024-09-01",
    "dateTo": "2024-09-15",
    "batchSize": 100,
    "dryRun": false,
    "cacheOptimized": true,
    "enableCLV": true,
    "warmCache": true
  }'
```

**Settle Specific IDs:**
```bash
curl -X POST /api/settlement/run \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["uuid-1", "uuid-2", "uuid-3"],
    "dryRun": false,
    "force": false
  }'
```

**Check Job Status with Cache Metrics:**
```bash
curl "/api/settlement/status?jobId=backfill-1694808000000&includeCacheMetrics=true"
```

**Get Statistics with Cache Performance:**
```bash
curl "/api/settlement/stats?dateFrom=2024-09-01&dateTo=2024-09-15&includeCacheStats=true"
```

**Cache Performance Monitoring:**
```bash
# Cache hierarchy performance
curl "/api/settlement/cache/performance"

# CLV tracking statistics
curl "/api/settlement/clv/statistics?dateFrom=2024-09-01"

# Settlement query optimization
curl "/api/settlement/query/performance"
```

### CLI Runner (`bin/settlement-runner.ts`)

**Backfill Operations:**
```bash
# Full backfill for all sports
npx tsx bin/settlement-runner.ts backfill

# MLB only, specific date range
npx tsx bin/settlement-runner.ts backfill --league MLB --date-from 2024-09-01 --date-to 2024-09-15

# Dry run mode
npx tsx bin/settlement-runner.ts backfill --dry-run

# Custom batch size and rate limit
npx tsx bin/settlement-runner.ts backfill --batch 50 --rate 2
```

**Settle Specific IDs:**
```bash
# From command line
npx tsx bin/settlement-runner.ts ids --ids uuid-1 uuid-2 uuid-3

# From file
npx tsx bin/settlement-runner.ts ids --file pick-ids.txt

# Force re-settlement
npx tsx bin/settlement-runner.ts ids --ids uuid-1 --force
```

**System Health:**
```bash
# Check adapters and database
npx tsx bin/settlement-runner.ts health

# View statistics
npx tsx bin/settlement-runner.ts stats --date-from 2024-09-01
```

## Safety Features

### Runtime Configuration
- **Freeze Mode**: Prevents all writes, forces dry-run
- **Shadow Mode**: Simulates operations without database writes
- **Force Mode**: Allows re-settlement of already settled picks

### Idempotency Guarantees
- Database constraints prevent duplicate settlements
- Atomic operations with proper rollback
- Conflict detection and resolution
- Comprehensive audit trail

### Error Handling
- Circuit breaker pattern for external APIs
- Exponential backoff retry logic
- Graceful degradation on adapter failures
- Detailed error logging and job failure tracking

### Performance Optimization
- Configurable batch sizes
- Rate limiting per adapter
- Database connection pooling
- Efficient querying with proper indexes

## Database Schema

### New Columns Added to `unified_picks`

```sql
-- Settlement results
actual_stat NUMERIC,                    -- The actual statistical value
outcome TEXT CHECK (outcome IN ('win','loss','void','push')),
settled_at TIMESTAMPTZ,                 -- When settlement occurred
settlement_source TEXT,                 -- Which adapter was used
settlement_version INTEGER DEFAULT 1,   -- Settlement system version
settlement_notes TEXT,                  -- Additional settlement info

-- External IDs for resolution
external_game_id TEXT,                  -- Provider's game identifier
external_player_id TEXT,                -- Provider's player identifier
sport TEXT,                             -- Sport/league
stat_type TEXT,                         -- Market type being bet
player_name TEXT,                       -- Player name for matching
game_date DATE                          -- Game date for queries
```

### Supporting Tables

**settlement_jobs**
- Job tracking with progress monitoring
- Error reporting and job history
- Status management (running/completed/failed)

**settlement_audit_log**
- Complete audit trail of all settlements
- Before/after value tracking
- Settlement source and notes

### Performance Indexes

```sql
-- Core settlement queries
idx_unified_picks_unsettled         -- WHERE settled_at IS NULL
idx_unified_picks_settled_at        -- Settlement timestamp queries
idx_unified_picks_external_game_id  -- Game resolution
idx_unified_picks_player_lookup     -- Player name + sport
idx_unified_picks_recent_unsettled  -- Recent games optimization
```

## Testing

### Unit Tests (`src/tests/settlement/`)

**Engine Tests** (`engine.test.ts`)
- Over/under outcome evaluation
- Yes/no market handling
- Push scenarios and edge cases
- Parlay settlement logic
- Input validation

**Normalizer Tests** (`normalizers.test.ts`)
- Sport-specific stat mapping
- Case variation handling
- Combined stat calculations
- Error scenarios
- Real-world player examples

**Adapter Tests** (`adapters.test.ts`)
- Rate limiting behavior
- Retry logic with exponential backoff
- Player name normalization
- API response parsing (mocked)
- Fallback handling

### Test Coverage Requirements
- Unit tests: 90%+ coverage
- Integration tests for API endpoints
- End-to-end backfill simulation

## Monitoring & Observability

### Metrics
- Settlement rate (picks/hour)
- Success/failure rates by sport
- API response times per adapter
- Error rates and retry counts
- Job completion times

### Health Checks
```bash
# System health check
curl /api/settlement/health

# Database function
SELECT * FROM settlement_system_health();
```

### Alerting
- Failed settlements above threshold
- API adapter failures
- Long-running jobs
- Database constraint violations

## Production Deployment

### Prerequisites
1. Database migration applied (`022_settlement_system.sql`)
2. External API credentials configured
3. Temporal worker registration
4. Monitoring dashboards configured

### Deployment Steps
1. **Pre-deployment:**
   ```bash
   # Test on subset
   npx tsx bin/settlement-runner.ts backfill --limit 100 --dry-run
   ```

2. **Staged Rollout:**
   ```bash
   # Start with recent games
   npx tsx bin/settlement-runner.ts backfill --date-from 2024-09-10
   
   # Expand to full backfill
   npx tsx bin/settlement-runner.ts backfill
   ```

3. **Monitor:**
   ```bash
   # Watch progress
   curl /api/settlement/stats
   
   # Check for errors
   curl /api/settlement/status?jobId=<job-id>
   ```

### Rollback Plan
```sql
-- Emergency rollback (removes all settlement data)
\i migrations/rollback_022_settlement_system.sql

-- Selective rollback (void recent settlements)
UPDATE unified_picks SET 
  outcome = NULL, 
  settled_at = NULL,
  settlement_notes = 'Rolled back due to issue'
WHERE settled_at > '2024-09-15 12:00:00';
```

## Performance Targets

- **Throughput**: 1000+ picks/hour during backfill
- **Latency**: <2 seconds per pick (including API calls)
- **Accuracy**: 99.9%+ settlement accuracy
- **Availability**: 99.5% uptime for settlement operations

## Future Enhancements

1. **Additional Sports**: Tennis, Soccer, MMA
2. **Provider Expansion**: Paid APIs (OddsAPI Pro, SportRadar)
3. **Real-time Settlement**: Live game monitoring
4. **Machine Learning**: Stat prediction and validation
5. **Advanced Markets**: Same-game parlays, prop combos

## Troubleshooting

### Common Issues

**Settlement Agent Not Starting**
```bash
# Check adapter initialization
npx tsx bin/settlement-runner.ts health
```

**API Rate Limiting**
- Increase delay between requests
- Check adapter rate limits
- Verify API credentials

**Database Lock Timeouts**
- Reduce batch sizes
- Check for long-running queries
- Monitor database connections

**Incorrect Outcomes**
- Verify market normalization
- Check stat mapping for sport
- Review settlement engine logic

### Debug Mode
```bash
# Enable debug logging
DEBUG=settlement:* npx tsx bin/settlement-runner.ts backfill
```

## Support

For issues, questions, or feature requests:
- Check logs: `./dev.sh logs settlement`
- Health check: `npx tsx bin/settlement-runner.ts health`
- Status monitoring: API `/settlement/stats`
- Database queries: Use settlement views and functions