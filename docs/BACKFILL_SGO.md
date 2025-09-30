# SportsGameOdds Backfill System

## Overview

The SportsGameOdds (SGO) backfill system provides comprehensive historical data ingestion during the 7-day trial period, with automatic settlement integration and SaaS-grade data architecture support.

## 🎯 Key Features

- **Multi-Sport Backfill**: MLB, NFL, NBA, NCAAF, NCAAB, WNBA, NHL support
- **Temporal Workflows**: Fault-tolerant, resumable backfill operations
- **Automatic Settlement**: Integrated SettlementAgent for prop resolution
- **Hot/Warm/Cold Architecture**: Enterprise data lifecycle management
- **Rate Limiting**: Trial-quota-aware API usage management
- **Idempotency**: Duplicate-safe operations with resumption support
- **Real-Time Monitoring**: Command Center integration with progress tracking

## 🚀 Quick Start

### Prerequisites

1. **SGO API Key**: Set `SPORTSGAMEODDS_KEY` environment variable
2. **Temporal Server**: Running at `TEMPORAL_SERVER_URL`
3. **Database**: PostgreSQL with v3.0.0 unified schema
4. **Docker Environment**: All operations via `./dev.sh`

```bash
# Set SGO API key
export SPORTSGAMEODDS_KEY="your-trial-key-here"

# Start development environment
./dev.sh start

# Verify database migrations
docker-compose exec api npm run db:migrate
```

### Basic Usage

```bash
# Backfill 7 days of all sports (trial default)
npm run db:backfill:sgo

# Test with 2 days of specific sports (dry run)
npm run db:backfill:sgo:test

# Continuous backfill for extended trial
npm run db:backfill:sgo:continuous

# Single sport backfill
SPORT=MLB npm run db:backfill:sgo:sport
```

## 📖 Commands Reference

### Core Backfill Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `npm run db:backfill:sgo` | Standard 7-day backfill | Trial default |
| `npm run db:backfill:sgo:test` | Test with MLB/NBA, 2 days | Dry run mode |
| `npm run db:backfill:sgo:continuous` | Long-running continuous backfill | 30-day window |
| `npm run db:backfill:sgo:sport` | Single sport backfill | Set `SPORT=` env var |

### Settlement Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `npm run sgo:settlement backfill` | Settle all SGO props | Date range filtering |
| `npm run sgo:settlement ids <ids>` | Settle specific props | Space-separated IDs |
| `npm run sgo:settlement unsettled` | Settle all unsettled props | Comprehensive settlement |

### Monitoring Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `npm run sgo:health` | System health check | Status verification |
| `npm run sgo:backfill -- --help` | Full command help | All options |

## 🏗️ Architecture

### Data Flow

```
SGO API → Temporal Workflow → Batch Processing → Database Tables
                            ↓
                      SettlementAgent → Prop Resolution
                            ↓
                    Command Center ← Progress Monitoring
```

### Database Schema

#### Core Tables

- **`raw_props`**: Ingested prop data with SGO source tagging
- **`games`**: Game information with external SGO game IDs
- **`settlement_jobs`**: Settlement tracking and progress
- **`historical_config`**: Data retention and lifecycle policies

#### SGO-Specific Tables

- **`sgo_backfill_jobs`**: SGO-specific job tracking and quota monitoring
- **`workflow_progress`**: Temporal workflow execution tracking
- **`archive_raw_props`**: Partitioned long-term storage
- **`data_lifecycle_log`**: Hot/Warm/Cold data movement audit

### Temporal Workflows

1. **`backfillSportsGameOdds`**: Primary backfill workflow
2. **`continuousSGOBackfill`**: Long-running background ingestion
3. **`backfillSportSpecific`**: Single-sport targeted backfill
4. **`settlementBackfillWorkflow`**: Automatic prop settlement

## 📊 Trial Period Optimization

### Quota Management

The 7-day trial typically provides **10,000 API requests**. Our system optimizes usage:

- **Rate Limiting**: 30-60 requests/minute (configurable)
- **Batch Processing**: 50-150 items per batch
- **Smart Retry**: Exponential backoff on rate limits
- **Quota Monitoring**: Real-time usage tracking

### Recommended Trial Schedule

| Day | Focus | API Calls | Expected Data |
|-----|-------|-----------|---------------|
| 1-2 | MLB + NBA | 2,000 | ~8,000 props |
| 3-4 | NFL + NCAAF | 1,500 | ~6,000 props |
| 5-6 | WNBA + NHL | 1,000 | ~4,000 props |
| 7 | Settlement + Archive | 500 | Full resolution |

## ⚙️ Configuration

### Environment Variables

```bash
# Required
SPORTSGAMEODDS_KEY="your-api-key"
TEMPORAL_SERVER_URL="localhost:7233"

# Optional
SGO_RATE_LIMIT=60                    # Requests per minute
SGO_BATCH_SIZE=100                   # Items per batch
SGO_MAX_RETRIES=3                    # Retry attempts
SGO_TIMEOUT=30000                    # Request timeout (ms)
```

### Historical Configuration

```sql
-- View current retention policies
SELECT * FROM historical_config WHERE enabled = true;

-- Update MLB retention (example)
UPDATE historical_config 
SET hot_window_days = 14, archive_window_days = 365
WHERE sport = 'MLB';
```

## 🔍 Monitoring & Troubleshooting

### Health Checks

```bash
# Comprehensive system health
npm run sgo:health

# Check workflow progress
echo "Visit: http://localhost:8088 (Temporal UI)"

# Database health
docker-compose exec api npm run db:status
```

### Common Issues

#### 1. Rate Limit Exceeded

**Symptoms**: `429` errors in logs  
**Solution**: Reduce rate limit or pause operations

```bash
npm run sgo:backfill -- --rate-limit=30 --batch-size=50
```

#### 2. Database Connection Issues

**Symptoms**: Settlement failures  
**Solution**: Verify database connectivity

```bash
./dev.sh status
docker-compose exec api npm run db:migrate
```

#### 3. Temporal Workflow Failures

**Symptoms**: Workflows stuck or failed  
**Solution**: Check Temporal UI and restart if needed

```bash
# Check workflow status
curl http://localhost:8088/api/v1/namespaces/default/workflows

# Restart worker if needed
docker-compose restart api
```

### Performance Monitoring

#### Key Metrics

- **API Quota Usage**: Track via `sgo_backfill_jobs.api_quota_used`
- **Settlement Rate**: Monitor via `settlement_stats_view`
- **Data Lifecycle**: Track via `data_lifecycle_summary`
- **Workflow Health**: Monitor via `workflow_progress`

#### Query Examples

```sql
-- API quota usage (last 24h)
SELECT 
  SUM(api_quota_used) as total_calls,
  AVG(api_calls_made / EXTRACT(EPOCH FROM (completed_at - started_at)) * 60) as avg_rpm
FROM sgo_backfill_jobs 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Settlement performance
SELECT 
  sport,
  COUNT(*) as total_props,
  COUNT(settled_at) as settled_props,
  ROUND((COUNT(settled_at)::NUMERIC / COUNT(*)) * 100, 2) as settlement_rate
FROM raw_props 
WHERE source = 'sgo' 
GROUP BY sport;

-- Workflow progress
SELECT 
  workflow_type,
  status,
  COUNT(*) as count,
  MAX(last_heartbeat) as last_active
FROM workflow_progress 
GROUP BY workflow_type, status;
```

## 📈 Advanced Usage

### Custom Backfill Scenarios

#### High-Volume Sports Focus

```bash
# Focus on high-prop-count sports
npm run sgo:backfill -- --sports=MLB,NBA,NFL --days=5 --batch-size=150
```

#### Conservative Trial Usage

```bash
# Minimal API usage for testing
npm run sgo:backfill -- --sports=MLB --days=3 --rate-limit=20 --batch-size=30
```

#### Settlement-First Approach

```bash
# Backfill with immediate settlement
npm run sgo:backfill -- --days=2 --sports=NBA
npm run sgo:settlement unsettled --league=NBA
```

### Data Lifecycle Management

#### Archive Old Data

```sql
-- Archive props older than 30 days
SELECT archive_to_cold_storage('MLB', CURRENT_DATE - INTERVAL '30 days');

-- Check archive statistics
SELECT * FROM data_lifecycle_summary WHERE lifecycle_stage = 'cold';
```

#### Hot Data Optimization

```sql
-- Move warm data for specific sport
SELECT move_to_warm_storage('NFL', CURRENT_DATE - INTERVAL '14 days');

-- Verify hot data performance
SELECT COUNT(*) FROM raw_props WHERE created_at >= CURRENT_DATE - INTERVAL '14 days';
```

### Command Center Integration

The SGO backfill system integrates with the Command Center for real-time monitoring:

- **Job Progress**: Real-time workflow status updates
- **API Quota**: Live quota usage dashboard
- **Settlement Tracking**: Automatic prop resolution monitoring
- **System Health**: Comprehensive health status display

## 🔧 Development & Testing

### Local Development

```bash
# Start development environment
./dev.sh start

# Run type checking
docker-compose exec api npm run type-check

# Run tests
docker-compose exec api npm run test

# Lint and format
docker-compose exec api npm run lint:fix
```

### Testing Scenarios

```bash
# Dry run testing
npm run sgo:backfill -- --days=1 --sports=MLB --dry-run

# Small batch testing
npm run sgo:backfill -- --days=1 --sports=NBA --batch-size=10

# Settlement testing
npm run sgo:settlement backfill --league=MLB --date-from=2024-01-01 --dry-run
```

## 📋 Acceptance Criteria

### ✅ Trial Integration Success

- [ ] 7 days of all sports loaded into `raw_props` and `games` tables
- [ ] SettlementAgent processes backfilled data with outcomes
- [ ] No duplicates on re-run (idempotent operations)
- [ ] Command Center displays progress and job history
- [ ] Historical config and partitioning operational
- [ ] API quota usage within trial limits (<10,000 requests)

### ✅ Production Readiness

- [ ] All workflows registered in Temporal
- [ ] Database migrations applied successfully
- [ ] Docker integration via `./dev.sh` working
- [ ] Health checks passing
- [ ] Settlement rate >90% for processed props
- [ ] Data archival system functional

## 🚨 Production Deployment

### Deployment Checklist

1. **Environment Setup**
   - [ ] `SPORTSGAMEODDS_KEY` configured
   - [ ] Database migrations applied
   - [ ] Temporal workers running

2. **System Validation**
   - [ ] Health checks passing
   - [ ] Test backfill successful
   - [ ] Settlement integration working

3. **Monitoring Setup**
   - [ ] Command Center monitoring active
   - [ ] Quota alerts configured
   - [ ] Performance metrics collecting

### Post-Deployment Verification

```bash
# Verify system health
npm run sgo:health

# Test small backfill
npm run sgo:backfill -- --days=1 --sports=MLB --batch-size=10

# Verify settlement
npm run sgo:settlement unsettled --league=MLB --dry-run

# Check Command Center
curl http://localhost:3004/api/health
```

## 📞 Support & Troubleshooting

### Log Analysis

```bash
# View SGO-specific logs
./dev.sh logs | grep -i sgo

# Check Temporal worker logs
./dev.sh logs api | grep -i temporal

# Monitor settlement progress
./dev.sh logs | grep -i settlement
```

### Emergency Procedures

#### Stop All SGO Operations

```bash
# Stop continuous workflows via Temporal UI
# http://localhost:8088

# Or restart entire system
./dev.sh restart
```

#### Data Recovery

```bash
# Check data integrity
npm run sgo:health

# Re-run settlement if needed
npm run sgo:settlement unsettled

# Archive old data if space needed
docker-compose exec api npx tsx -e "
  import { supabaseClient } from './src/services/supabaseClient';
  // Archive old data query here
"
```

---

**Last Updated**: Current  
**System Version**: 1.0.0  
**Compatible With**: Unit Talk Platform v3.0.0+