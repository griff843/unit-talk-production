# Settlement System Documentation

**Unit Talk Production v3 - Comprehensive Settlement System Guide**

This document provides complete documentation for the Unit Talk settlement system architecture, production deployment procedures, monitoring, and maintenance.

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture) 
3. [Production Deployment](#production-deployment)
4. [Monitoring & Maintenance](#monitoring--maintenance)
5. [Troubleshooting](#troubleshooting)
6. [API Reference](#api-reference)
7. [Safety & Recovery](#safety--recovery)

## 🏗️ System Overview

### Purpose

The Unit Talk Settlement System provides automated settlement of sports betting picks using external data sources (primarily MLB Stats API). The system is designed for production deployment with comprehensive safety controls, monitoring, and recovery procedures.

### Key Features

- **Self-Contained Architecture**: No external dependencies, includes integrated logger and database client
- **Production Guardrails**: Built-in safety controls including dry-run mode, shadow mode, and idempotency checks
- **Comprehensive Monitoring**: Real-time heartbeat logging and success/failure tracking
- **Docker-First Execution**: All operations run within Docker containers for consistency
- **Idempotent Processing**: Automatic duplicate prevention and safe re-execution
- **Batch Processing**: Configurable batch sizes for controlled resource usage

### Current Status

✅ **PRODUCTION READY** - Comprehensive cleanup completed, single source of truth established

**Major Changes Implemented (January 2025)**:
- **Script Consolidation**: Removed duplicate/broken scripts, single settlement script at `apps/api/scripts/settlement-backfill.ts`
- **Production Guardrails**: Added safety controls and validation
- **Monitoring System**: Integrated heartbeat logging and production validation
- **Clean Architecture**: Eliminated all script conflicts and technical debt

## 🏛️ Architecture

### Core Components

#### Primary Settlement Script
**Location**: `apps/api/scripts/settlement-backfill.ts`

**Design Principles**:
- **Self-Contained**: Includes local logger, Supabase client, and all necessary utilities
- **Production-Ready**: Built with production deployment and monitoring in mind  
- **Idempotent**: Safe to run multiple times without side effects
- **Configurable**: Environment variable driven with sensible defaults

#### Database Schema

**Source Table**: `shadow_decisions`
```sql
-- Settlement candidates filtered by:
decision_type = 'settlement_backfill'
settled_at IS NULL  -- Idempotency control
```

**Monitoring Table**: `settlement_heartbeat`
```sql
CREATE TABLE settlement_heartbeat (
    id SERIAL PRIMARY KEY,
    pipeline_name VARCHAR(255) NOT NULL,
    processed_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    error_count INTEGER NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### External API Integration

**MLB Stats API**:
- **Base URL**: `https://statsapi.mlb.com`
- **Schedule Endpoint**: `/api/v1/schedule?sportId=1&date=YYYY-MM-DD`
- **Live Game Feed**: `/api/v1.1/game/{gamePk}/feed/live`
- **Rate Limits**: Reasonable usage, no explicit limits documented

### Data Flow

```
1. Seed Data Query (shadow_decisions)
   ↓
2. Game Resolution (MLB Stats API schedule)
   ↓ 
3. Live Game Data (MLB Stats API feed)
   ↓
4. Statistical Calculation (local processing)
   ↓
5. Settlement Decision (Win/Loss/Push/Void)
   ↓
6. Database Update (settlement data + heartbeat)
```

### Processing Logic

#### Game Resolution
1. Extract date from `event_time` (ISO format)
2. Fetch day's schedule from MLB Stats API
3. Match games using team abbreviations from `external_game_id`
4. Fallback to first game of day if specific matching fails

#### Statistical Calculation
Supports all major baseball betting markets:

- **Hits**: `stats.batting.hits`
- **RBIs**: `stats.batting.rbi` 
- **Runs**: `stats.batting.runs`
- **Total Bases**: `(hits - doubles - triples - home_runs) + (doubles * 2) + (triples * 3) + (home_runs * 4)`
- **Home Runs**: `stats.batting.homeRuns`
- **Walks**: `stats.batting.baseOnBalls`

#### Settlement Decision Logic
```typescript
function decide(direction: string, line: number, actual: number): 'Win'|'Loss'|'Push'|'Void' {
  if (actual == null || line == null) return 'Void';
  
  const isEqual = Math.abs(actual - line) < 1e-9;
  
  if (direction.toLowerCase() === 'over') {
    return actual > line ? 'Win' : isEqual ? 'Push' : 'Loss';
  } else {
    return actual < line ? 'Win' : isEqual ? 'Push' : 'Loss';
  }
}
```

## 🚀 Production Deployment

### Environment Setup

**Required Environment Variables**:
```bash
# Database Configuration (Production)
SUPABASE_URL=<production-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>

# API Configuration
MLB_STATSAPI_BASE=https://statsapi.mlb.com

# Processing Configuration
SCORING_FINAL_BUFFER_MIN=20      # Wait time after game end
BATCH_MAX=10                     # Records per batch
LOOKBACK_HOURS=168               # 7 days lookback window
LEAGUE=MLB

# Safety Controls (Override as needed)
DRY_RUN=true                     # Default: dry-run mode
SHADOW_MODE=true                 # Default: shadow mode (no Discord)
PUBLISH_TO_DISCORD=false         # Default: no Discord publishing
```

### Deployment Commands (Docker-First)

**All settlement operations MUST be executed via Docker containers:**

#### Testing & Validation
```bash
# Test settlement system (dry-run mode, safe)
docker-compose exec api npm run settlement:test

# Validate settlement environment and data
docker-compose exec api npm run settlement:validate

# Manual testing with specific parameters
docker-compose exec api npx tsx scripts/settlement-backfill.ts --dry-run
```

#### Production Operations
```bash
# Execute production settlement (shadow mode by default)  
docker-compose exec api npm run settlement:backfill

# Execute with full production mode (Discord publishing enabled)
docker-compose exec api env PUBLISH_TO_DISCORD=true SHADOW_MODE=false npm run settlement:backfill

# Monitor settlement system health
docker-compose exec api npm run settlement:monitor

# Execute with custom batch size
docker-compose exec api env BATCH_MAX=5 npm run settlement:backfill
```

### Pre-Deployment Checklist

**Environment Validation**:
- [ ] Production database credentials configured
- [ ] MLB Stats API accessible from production environment
- [ ] Docker containers built and running
- [ ] Settlement heartbeat table exists
- [ ] Shadow decisions table contains settlement candidates

**Safety Validation**:
- [ ] `DRY_RUN=true` for initial testing
- [ ] `SHADOW_MODE=true` for staging deployment  
- [ ] `PUBLISH_TO_DISCORD=false` to prevent unwanted notifications
- [ ] Batch size configured appropriately (`BATCH_MAX=10` recommended)
- [ ] Monitoring and alerting systems active

**System Validation**:
- [ ] All settlement commands execute without errors
- [ ] Database connections established successfully
- [ ] External API connectivity verified
- [ ] Logging and monitoring systems operational

### Deployment Procedure

1. **Pre-Deployment Testing**
   ```bash
   # Start Docker environment
   ./dev.sh start
   
   # Verify all services healthy
   ./dev.sh status
   
   # Test settlement system in dry-run mode
   docker-compose exec api npm run settlement:test
   ```

2. **Staging Deployment** 
   ```bash
   # Execute settlement in shadow mode
   docker-compose exec api npm run settlement:backfill
   
   # Verify heartbeat logging
   docker-compose exec api npm run settlement:monitor
   
   # Check settlement results in database
   ```

3. **Production Deployment**
   ```bash
   # Execute settlement with production settings
   docker-compose exec api env PUBLISH_TO_DISCORD=true SHADOW_MODE=false npm run settlement:backfill
   
   # Monitor execution and results
   docker-compose exec api npm run settlement:monitor
   ```

4. **Post-Deployment Validation**
   ```bash
   # Verify settlement results
   # Check heartbeat status
   # Monitor for any errors or failures
   # Validate Discord notifications (if enabled)
   ```

## 📊 Monitoring & Maintenance

### Production Monitoring

#### Heartbeat Monitoring
The settlement system automatically logs operational metrics to the `settlement_heartbeat` table:

```sql
-- Check recent settlement runs
SELECT * FROM settlement_heartbeat 
WHERE pipeline_name = 'mlb_settlement_backfill' 
ORDER BY created_at DESC 
LIMIT 10;

-- Monitor success rates
SELECT 
  DATE(created_at) as settlement_date,
  SUM(processed_count) as total_processed,
  SUM(success_count) as total_successful,
  SUM(error_count) as total_errors,
  ROUND(100.0 * SUM(success_count) / SUM(processed_count), 2) as success_rate
FROM settlement_heartbeat 
WHERE pipeline_name = 'mlb_settlement_backfill'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY settlement_date DESC;
```

#### Real-Time Monitoring Commands
```bash
# Monitor current settlement system health
docker-compose exec api npm run settlement:monitor

# Check settlement heartbeat status  
docker-compose exec api npm run settlement:heartbeat

# Validate settlement data integrity
docker-compose exec api npm run settlement:validate

# Monitor Docker container health
./dev.sh status

# Check settlement system logs
./dev.sh logs | grep settlement
```

### Key Performance Indicators

**Processing Metrics**:
- **Processed Count**: Total settlement records processed per run
- **Success Rate**: Percentage of successfully settled records (target: ≥95%)
- **Error Rate**: Percentage of failed settlement attempts (target: ≤5%)
- **Processing Time**: Average time per settlement record (target: <5 seconds)

**System Health Metrics**:
- **API Response Time**: MLB Stats API response times (target: <2 seconds)
- **Database Performance**: Settlement query and update times (target: <1 second)
- **Container Health**: Docker container status and resource usage
- **Memory Usage**: Settlement script memory consumption (target: <512MB)

**Business Metrics**:
- **Settlement Coverage**: Percentage of eligible picks settled (target: ≥90%)
- **Void Rate**: Percentage of picks marked as void (target: ≤10%)
- **Push Rate**: Percentage of picks resulting in pushes (expected: 5-15% depending on markets)
- **Data Accuracy**: Settlement accuracy compared to manual verification (target: ≥99%)

### Maintenance Procedures

#### Daily Maintenance
```bash
# Check settlement system health
docker-compose exec api npm run settlement:monitor

# Verify no stuck/failed settlements  
docker-compose exec api npm run settlement:validate

# Monitor resource usage
docker stats $(docker ps -q)

# Check logs for errors or warnings
./dev.sh logs | grep -E "(ERROR|WARN|settlement)" | tail -50
```

#### Weekly Maintenance
```bash
# Full settlement system validation
docker-compose exec api npm run settlement:test

# Database cleanup (remove old heartbeat records)
# SQL: DELETE FROM settlement_heartbeat WHERE created_at < NOW() - INTERVAL '30 days'

# Performance analysis  
docker-compose exec api npm run settlement:performance-report

# Backup settlement configuration
cp apps/api/scripts/settlement-backfill.ts backups/settlement-backfill-$(date +%Y%m%d).ts
```

#### Monthly Maintenance
```bash
# Comprehensive settlement system audit
docker-compose exec api npm run settlement:audit

# Update MLB Stats API integration (if needed)
# Review settlement accuracy metrics
# Update documentation with any system changes
# Review and update monitoring thresholds
```

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Settlement Script Not Running
**Symptoms**: Script fails to start or exits immediately
**Diagnosis**:
```bash
# Check Docker container status
./dev.sh status

# Check environment variables
docker-compose exec api env | grep -E "(SUPABASE|MLB|BATCH)"

# Test script manually
docker-compose exec api npx tsx scripts/settlement-backfill.ts --dry-run
```
**Solutions**:
- Verify all required environment variables are set
- Ensure Docker containers are running and healthy
- Check database connectivity with health check commands
- Validate MLB Stats API accessibility

#### Database Connection Issues  
**Symptoms**: "Database query failed" errors
**Diagnosis**:
```bash
# Test database connection
docker-compose exec api npm run health:check

# Check Supabase credentials
docker-compose exec api env | grep SUPABASE

# Test manual database query
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
client.from('shadow_decisions').select('count').then(console.log);
"
```
**Solutions**:
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check network connectivity to Supabase
- Validate database schema and table existence
- Review Supabase service status

#### MLB Stats API Issues
**Symptoms**: "schedule fetch failed" or "box fetch failed" errors
**Diagnosis**:
```bash
# Test API connectivity manually
docker-compose exec api npx tsx -e "
fetch('https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-01-11')
.then(r => r.json())
.then(console.log)
.catch(console.error);
"

# Check API base URL configuration  
docker-compose exec api env | grep MLB_STATSAPI_BASE
```
**Solutions**:
- Verify MLB Stats API is accessible from production environment
- Check for API rate limiting or temporary outages
- Validate `MLB_STATSAPI_BASE` configuration
- Consider implementing API retry logic with exponential backoff

#### No Settlement Candidates  
**Symptoms**: "candidates 0" in logs
**Diagnosis**:
```bash
# Check for settlement candidates in database
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
client.from('shadow_decisions')
  .select('count')
  .eq('decision_type', 'settlement_backfill')
  .is('settled_at', null)
  .then(r => console.log('Unsettled candidates:', r.data));
"
```
**Solutions**:
- Verify `shadow_decisions` table contains records with `decision_type='settlement_backfill'`
- Check that records haven't already been settled (`settled_at IS NULL`)
- Review data ingestion pipeline to ensure settlement candidates are being created
- Consider expanding `LOOKBACK_HOURS` if looking for older candidates

#### High Error Rates
**Symptoms**: Many failed settlements in heartbeat monitoring
**Diagnosis**:
```bash
# Check recent settlement errors
./dev.sh logs | grep -E "(ERROR|settlement)" | tail -20

# Analyze error patterns in heartbeat
# SQL query to check error distribution
```
**Solutions**:
- Identify common error patterns from logs
- Review individual failed records for data quality issues
- Check for systematic problems with API integration
- Consider adjusting batch sizes or processing timeouts

### Error Recovery Procedures

#### Partial Settlement Failure
1. **Identify Failed Records**: Check logs and database for specific failures
2. **Analyze Root Cause**: Determine if issue is data-related, API-related, or systematic
3. **Fix Underlying Issue**: Address root cause (API access, data quality, etc.)
4. **Re-run Settlement**: Execute settlement command again (idempotency ensures safe retry)
5. **Validate Results**: Confirm failed records are now properly settled

#### System-Wide Settlement Failure
1. **Stop Settlement Operations**: Ensure no settlement commands are running
2. **System Health Check**: Verify Docker containers, database, and API connectivity
3. **Review Logs**: Analyze comprehensive logs for failure patterns
4. **Address Root Cause**: Fix identified issues (configuration, connectivity, etc.)
5. **Gradual Restart**: Begin with small batch sizes and dry-run mode
6. **Monitor Recovery**: Watch system metrics and gradually return to normal operations

#### Data Corruption Recovery
1. **Identify Affected Records**: Query database for potentially corrupted settlement data
2. **Backup Current State**: Create backup of current settlement data
3. **Reset Affected Records**: Clear `settled_at` and related fields for re-processing  
4. **Validate Data Sources**: Ensure external data sources are providing correct information
5. **Re-process Records**: Run settlement with verified data sources
6. **Verify Accuracy**: Manual spot-checking of settlement results against known outcomes

## 📖 API Reference

### Settlement Script Parameters

#### Command Line Arguments
```bash
npx tsx scripts/settlement-backfill.ts [options]

Options:
  --dry-run          Execute in dry-run mode (no database updates)
  --help             Display help information
```

#### Environment Variables

**Database Configuration**:
- `SUPABASE_URL` (required): Production Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (required): Service role key with database access

**API Configuration**:
- `MLB_STATSAPI_BASE` (optional): MLB Stats API base URL (default: `https://statsapi.mlb.com`)

**Processing Configuration**:
- `SCORING_FINAL_BUFFER_MIN` (optional): Minutes to wait after game end before settlement (default: `20`)
- `BATCH_MAX` (optional): Maximum records to process per batch (default: `10`) 
- `LOOKBACK_HOURS` (optional): Hours to look back for settlement candidates (default: `168`)
- `LEAGUE` (optional): League to process (default: `MLB`)

**Safety Controls**:
- `DRY_RUN` (optional): Force dry-run mode via environment (default: `true`)
- `SHADOW_MODE` (optional): Prevent Discord publishing (default: `true`)
- `PUBLISH_TO_DISCORD` (optional): Enable Discord notifications (default: `false`)

**Debug Configuration**:
- `DEBUG` (optional): Enable debug logging (set to any truthy value)

### Database Schema Reference

#### `shadow_decisions` Table Structure
```sql
-- Settlement source records
id                UUID PRIMARY KEY
player           VARCHAR(255)      -- Player name for settlement
market           VARCHAR(255)      -- Betting market (e.g., 'HITS', 'RUNS')
line             DECIMAL           -- Betting line value  
additional_data  JSONB            -- Contains direction, external_game_id, etc.
event_time       TIMESTAMP        -- Game/event timestamp
decision_type    VARCHAR(50)      -- Filter: 'settlement_backfill'
settled_at       TIMESTAMP        -- Settlement completion timestamp (NULL = unsettled)
status           VARCHAR(50)      -- Settlement status
settlement_source VARCHAR(100)    -- Settlement data source
settlement_details JSONB          -- Settlement execution details
actual_result    DECIMAL          -- Actual statistical outcome
created_at       TIMESTAMP        -- Record creation timestamp
```

#### `settlement_heartbeat` Table Structure  
```sql
-- Settlement monitoring and health tracking
id               SERIAL PRIMARY KEY
pipeline_name    VARCHAR(255) NOT NULL  -- Pipeline identifier
processed_count  INTEGER NOT NULL       -- Total records processed
success_count    INTEGER NOT NULL       -- Successfully settled records  
error_count      INTEGER NOT NULL       -- Failed settlement attempts
last_run         TIMESTAMP NOT NULL     -- Execution timestamp
status           VARCHAR(50) NOT NULL   -- Overall execution status
created_at       TIMESTAMP DEFAULT NOW() -- Heartbeat creation timestamp
```

### API Endpoints (External)

#### MLB Stats API Integration

**Schedule Endpoint**:
```http
GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={YYYY-MM-DD}

Response Structure:
{
  "dates": [{
    "games": [{
      "gamePk": 12345,
      "teams": {
        "home": {"team": {"name": "Team Name"}},
        "away": {"team": {"name": "Team Name"}}
      },
      "gameData": {
        "status": {"codedGameState": "F"}  // F = Final
      }
    }]
  }]
}
```

**Live Game Feed**:
```http
GET https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live

Response Structure:
{
  "liveData": {
    "boxscore": {
      "teams": {
        "home|away": {
          "players": {
            "ID{playerId}": {
              "person": {"fullName": "Player Name"},
              "stats": {
                "batting": {
                  "hits": 2,
                  "rbi": 1,
                  "runs": 1,
                  "doubles": 0,
                  "triples": 0, 
                  "homeRuns": 1,
                  "baseOnBalls": 1
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## 🛡️ Safety & Recovery

### Production Safety Features

#### Built-in Safety Controls
1. **Dry Run Mode**: All executions default to dry-run unless explicitly overridden
2. **Shadow Mode**: Discord publishing disabled by default to prevent accidental notifications  
3. **Idempotency Protection**: Automatic duplicate prevention via database constraints
4. **Batch Processing**: Limited batch sizes prevent system overload
5. **Graceful Error Handling**: Individual failures don't halt entire batch processing
6. **Comprehensive Logging**: Detailed logging for audit trails and debugging

#### Environmental Safeguards
1. **Docker Isolation**: All operations run within controlled Docker containers
2. **Environment Variable Validation**: Required variables checked at startup
3. **Database Transaction Safety**: Updates wrapped in appropriate transaction scopes
4. **API Rate Limiting**: Reasonable delays between external API calls
5. **Resource Monitoring**: Memory and CPU usage monitoring during execution

### Recovery Procedures

#### Immediate Recovery Actions
1. **Stop Current Operations**: Halt any running settlement processes
2. **Assess System State**: Check Docker containers, database connectivity, logs
3. **Identify Root Cause**: Analyze logs and system metrics for failure patterns
4. **Address Critical Issues**: Fix database connections, API access, or configuration problems  
5. **Validate System Health**: Ensure all components operational before restart

#### Data Recovery Procedures
1. **Backup Current State**: Create snapshot of current settlement data
2. **Identify Affected Records**: Query for potentially corrupted or incomplete settlements
3. **Reset Settlement State**: Clear settlement flags for affected records
4. **Validate Data Sources**: Confirm external APIs providing accurate data
5. **Incremental Re-processing**: Re-settle affected records with validated data
6. **Verification**: Manual spot-checks and automated validation of results

#### System Recovery Testing
```bash
# Recovery validation checklist
docker-compose exec api npm run settlement:test          # Basic functionality
docker-compose exec api npm run settlement:validate      # Data integrity  
docker-compose exec api npm run health:check            # System health
./dev.sh status                                         # Container health
./dev.sh logs | tail -100                               # Recent log analysis
```

### Backup & Restore

#### Configuration Backup
```bash
# Backup settlement script and configuration
cp apps/api/scripts/settlement-backfill.ts backups/
cp .env backups/env-$(date +%Y%m%d)
cp docker-compose.yml backups/docker-compose-$(date +%Y%m%d).yml
```

#### Database Backup (Settlement Data)
```sql
-- Backup settlement candidates
COPY (
  SELECT * FROM shadow_decisions 
  WHERE decision_type = 'settlement_backfill'
    AND created_at >= NOW() - INTERVAL '30 days'
) TO '/backups/settlement_candidates.csv' WITH CSV HEADER;

-- Backup settlement heartbeat
COPY (
  SELECT * FROM settlement_heartbeat
  WHERE created_at >= NOW() - INTERVAL '30 days'  
) TO '/backups/settlement_heartbeat.csv' WITH CSV HEADER;
```

#### Restore Procedures
1. **Verify Backup Integrity**: Confirm backup files are complete and uncorrupted
2. **Prepare Target Environment**: Ensure Docker containers and database are ready
3. **Restore Configuration**: Copy configuration files to appropriate locations
4. **Restore Database Data**: Import settlement data using appropriate SQL commands
5. **Validate Restoration**: Run settlement tests to confirm system operational
6. **Monitor Initial Operations**: Watch first few settlement runs for any issues

---

**Document Owner**: Platform Engineering Team  
**Last Updated**: January 2025  
**Next Review**: Monthly system review  
**Version**: 3.0.0-production

For additional support or questions, refer to:
- [Root CLAUDE.md](CLAUDE.md) - Overall platform guidance
- [apps/api/CLAUDE.md](apps/api/CLAUDE.md) - API-specific documentation  
- [MONITORING.md](MONITORING.md) - Production monitoring procedures