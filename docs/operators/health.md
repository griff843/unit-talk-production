# System Health Monitoring Documentation

**OperatorAgent HealthWorkflow - Comprehensive System Health Monitoring**

## Overview

The HealthWorkflow is a comprehensive system health monitoring solution integrated into the OperatorAgent that provides real-time visibility into the health of all critical system components. It queries the `system_health_snapshot` view every 15 minutes to detect issues, create incidents, and maintain operational excellence.

## Architecture

### Core Components

1. **system_health_snapshot View**: Aggregates health data from 8 critical system sections
2. **agent_job_runs Table**: Tracks all workflow executions with comprehensive metadata
3. **system_incidents Table**: Manages incident lifecycle with automated detection
4. **HealthWorkflow Activities**: Modular activities for health operations
5. **Command Center Integration**: Real-time health dashboard updates

### Health Sections Monitored

The system monitors 8 critical sections for comprehensive coverage:

#### 1. HOT_PROPS
- **Purpose**: Real-time prop ingestion monitoring
- **Data Source**: `prop_ticks_hot` table
- **Critical Threshold**: 0 props in last 5 minutes
- **Incident**: `IngestionHalted` (Critical)
- **Details**: Recent books, sports coverage, tick rate

#### 2. WARM_FEATURES  
- **Purpose**: Feature computation pipeline health
- **Data Source**: `features_daily_agg` table
- **Critical Threshold**: 0 features computed in last 2 hours
- **Incident**: `FeaturePipelineStalled` (High)
- **Details**: Feature types, sports covered, computation time

#### 3. AGENT_JOBS
- **Purpose**: Agent workflow execution monitoring
- **Data Source**: `agent_job_runs` table
- **Critical Threshold**: Any failed job in last 15 minutes
- **Incident**: `AgentFailure` (Critical)
- **Details**: Success rate, failed jobs, running jobs, active agents

#### 4. RECAP_RUNS
- **Purpose**: Daily recap generation status
- **Data Source**: `unified_picks` table
- **Critical Threshold**: Failed recap on current day
- **Incident**: `RecapError` (Medium)
- **Details**: Today's success rate, 7-day performance

#### 5. ALERTS
- **Purpose**: Alert latency and processing monitoring
- **Data Source**: `system_incidents` table
- **Critical Threshold**: Average response time > 2000ms
- **Incident**: `AlertLatency` (High)
- **Details**: Response time, open alerts, resolution rate

#### 6. SYSTEM_PERFORMANCE
- **Purpose**: Overall system resource monitoring
- **Data Source**: System metrics (placeholder)
- **Thresholds**: CPU > 80%, Memory > 85%, Disk > 90%
- **Details**: Resource utilization, active connections

#### 7. DATABASE_HEALTH
- **Purpose**: Database connection and performance
- **Data Source**: PostgreSQL statistics
- **Thresholds**: Database size, connection count, slow queries
- **Details**: DB size, connections, query performance

#### 8. API_ENDPOINTS
- **Purpose**: API response times and availability
- **Data Source**: API metrics (placeholder)
- **Thresholds**: Response time > 1000ms, error rate > 5%
- **Details**: Response times, error rates, request volume

## Execution Flow

### 1. Job Initialization
```typescript
const jobResult = await logJobRun({
  agent: 'OperatorAgent',
  workflow: 'HealthWorkflow',
  jobName: 'system_health_check',
  status: 'running',
  metadata: { executionId, startTime }
});
```

### 2. Health Snapshot Query
```sql
SELECT * FROM system_health_snapshot;
```
Returns JSON with all 8 sections including:
- Status (healthy/warning/degraded/critical)
- Recent counts and totals
- Details and thresholds
- Active alerts

### 3. Incident Detection
For each alert in the health data:
```typescript
const incidents = healthData.flatMap(section => 
  section.alerts.map(alertType => ({
    kind: alertType,
    severity: getSeverityForAlert(alertType),
    details: { section: section.section, ... },
    section: section.section
  }))
);
```

### 4. Incident Creation (Idempotent)
```sql
SELECT create_health_incident(
  p_kind := 'IngestionHalted',
  p_severity := 'critical', 
  p_details := '{"section": "HOT_PROPS", ...}'
);
```

### 5. Command Center Integration
```typescript
await pushToCommandCenter({
  healthData,
  timestamp: new Date().toISOString(),
  executionMetrics: {
    totalSections, healthySections, 
    degradedSections, criticalSections,
    totalIncidents
  }
});
```

### 6. Job Completion
```sql
SELECT complete_job_run(
  p_job_id := 'job_12345',
  p_status := 'success',
  p_metadata := '{"healthSummary": {...}}'
);
```

## Threshold Configuration

### Critical Incidents (Immediate Response Required)
- **IngestionHalted**: No props received in 5 minutes
- **AgentFailure**: Any agent job failed in last 15 minutes

### High Severity (Response Within 1 Hour)
- **FeaturePipelineStalled**: No features computed in 2 hours
- **AlertLatency**: Average alert response > 2000ms

### Medium Severity (Response Within 4 Hours)
- **RecapError**: Daily recap generation failed

### Incident Deduplication
- Prevents duplicate incidents within 1-hour window
- Same incident type + status = deduplicated
- Uses `create_health_incident()` function for atomic operations

## Monitoring & Alerting

### Discord Integration
All incidents and health status updates are sent to Discord with:
- Color-coded embeds (Critical=Red, High=Orange, Medium=Gold, Low=Green)
- Structured details in JSON format
- Priority-based routing
- Alert type specific emojis

### Command Center Dashboard
Real-time health visualization showing:
- 8 section health status with color indicators
- Incident badges for sections with active alerts
- Execution metrics and performance data
- Historical trends and patterns

## Resilience Features

### Exponential Backoff Retry
```typescript
while (retryCount <= maxRetries && !querySuccess) {
  try {
    const result = await executeHealthSnapshot();
    // ... success handling
  } catch (error) {
    retryCount++;
    const delayMs = Math.min(2 ** retryCount * 1000, 10000);
    await sleep(delayMs);
  }
}
```

### Graceful Degradation
- Continues execution if Command Center push fails
- Logs errors without failing entire workflow
- Provides fallback job IDs for tracking

### Error Recovery
- Comprehensive error logging in `agent_job_runs`
- Failed job status with detailed error messages
- Critical alerts for workflow failures

## Performance Characteristics

### Execution Targets
- **Target Execution Time**: < 15 seconds
- **Query Performance**: < 500ms for health snapshot
- **Command Center Push**: < 200ms response time
- **Alert Dispatch**: < 100ms for Discord notifications

### Resource Usage
- **Memory**: ~50MB during execution
- **CPU**: <5% during health checks
- **Database**: 1-2 connections for duration
- **Network**: Minimal bandwidth for API calls

## Configuration

### Environment Variables
```env
# Command Center Integration
COMMAND_CENTER_API_URL=http://localhost:3004/api/system/health

# Discord Alerting
DISCORD_HEALTH_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Health Check Intervals
HEALTH_CHECK_INTERVAL_MINUTES=15
HEALTH_CHECK_RETRY_COUNT=3
```

### Workflow Schedules
- **Regular**: Every 15 minutes via ScheduledHealthWorkflow
- **Express**: Event-triggered for rapid assessment
- **Manual**: On-demand via OperatorAgent API

## Operational Procedures

### Daily Health Review
1. Check Command Center dashboard at start of day
2. Review overnight incidents in Discord
3. Validate all sections show "healthy" status
4. Investigate any degraded or critical sections

### Incident Response
1. **Critical Incidents**: Immediate response required
   - IngestionHalted: Check data sources, restart ingestion
   - AgentFailure: Review agent logs, restart failed agents

2. **High Severity**: Response within 1 hour
   - FeaturePipelineStalled: Check feature computation jobs
   - AlertLatency: Review alert processing pipeline

3. **Medium Severity**: Response within 4 hours
   - RecapError: Check daily recap generation process

### Weekly Maintenance
1. Review health trends and patterns
2. Update thresholds based on system growth
3. Clean up resolved incidents
4. Performance optimization review

## API Endpoints

### Health Status Query
```http
GET /api/system/health/status
```
Returns current system health snapshot

### Manual Health Check
```http
POST /api/system/health/check
Content-Type: application/json

{
  "priority": "normal|high|critical",
  "dryRun": false
}
```

### Health History
```http
GET /api/system/health/history
Query Parameters:
- timeRange: 1h, 24h, 7d, 30d
- sections: comma-separated section names
- status: healthy,warning,degraded,critical
```

## Troubleshooting

### Common Issues

#### Health Check Failing
**Symptoms**: HealthWorkflow shows failed status
**Causes**: Database connectivity, view compilation errors
**Resolution**:
1. Check database connection
2. Verify `system_health_snapshot` view exists
3. Test view query manually
4. Check agent permissions

#### No Incidents Created
**Symptoms**: Alerts present but no incidents in system_incidents
**Causes**: Incident creation function errors, permission issues
**Resolution**:
1. Test `create_health_incident()` function manually
2. Verify api_service has execute permissions
3. Check system_incidents table constraints

#### Command Center Not Updating
**Symptoms**: Health dashboard shows stale data
**Causes**: API endpoint errors, network connectivity
**Resolution**:
1. Verify COMMAND_CENTER_API_URL configuration
2. Test endpoint connectivity
3. Check Command Center service status

#### High Execution Time
**Symptoms**: Health checks taking > 30 seconds
**Causes**: Database performance, network latency
**Resolution**:
1. Analyze `system_health_snapshot` query performance
2. Check database indexes
3. Review network connectivity
4. Optimize view queries

### Debugging Commands

```sql
-- Test health snapshot view directly
SELECT * FROM system_health_snapshot;

-- Check recent job runs
SELECT * FROM agent_job_runs 
WHERE agent = 'OperatorAgent' 
  AND workflow = 'HealthWorkflow' 
ORDER BY started_at DESC 
LIMIT 10;

-- Review recent incidents
SELECT * FROM system_incidents 
WHERE incident_type IN ('IngestionHalted', 'AgentFailure', 'FeaturePipelineStalled') 
ORDER BY start_time DESC 
LIMIT 20;

-- Test incident creation
SELECT create_health_incident('TestIncident', 'medium', '{"test": true}');

-- Monitor view performance
EXPLAIN ANALYZE SELECT * FROM system_health_snapshot;
```

## Best Practices

### Monitoring
- Set up alerts for HealthWorkflow failures
- Monitor execution time trends
- Track incident creation patterns
- Review health status distribution

### Maintenance
- Regular view performance optimization
- Incident cleanup and archival
- Threshold tuning based on system growth
- Documentation updates for new sections

### Security
- Limit access to health endpoints
- Secure Discord webhook URLs
- Monitor for unauthorized health queries
- Audit incident creation patterns

---

**Document Version**: 1.0  
**Last Updated**: 2025-09-11  
**Review Schedule**: Monthly  
**Owner**: Platform Engineering Team