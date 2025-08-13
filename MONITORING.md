# Production Monitoring Guide

**Unit Talk Production v3 - Comprehensive Production Monitoring Procedures**

This document provides complete guidance for monitoring the Unit Talk production system, including the settlement system, agent orchestration, and overall platform health.

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Settlement System Monitoring](#settlement-system-monitoring)
3. [Agent System Monitoring](#agent-system-monitoring)
4. [Database Monitoring](#database-monitoring)
5. [Performance Monitoring](#performance-monitoring)
6. [Production Validation](#production-validation)
7. [Health Checks & Dashboards](#health-checks--dashboards)
8. [Alerting & Notifications](#alerting--notifications)

## 🏗️ System Overview

### Monitoring Architecture

The Unit Talk production monitoring system provides comprehensive observability across:

- **Settlement System**: Real-time settlement processing health and performance
- **Agent System**: BaseAgent pattern monitoring with lifecycle tracking  
- **Database System**: v3.0.0 unified database performance and health
- **API System**: Request/response monitoring and performance metrics
- **Infrastructure**: Docker container health and resource utilization

### Key Monitoring Components

- **Heartbeat Tables**: Real-time system health logging
- **Docker Health Checks**: Container and service status monitoring
- **Database Metrics**: Query performance and connection health
- **API Monitoring**: Response times and error rates
- **External Service Monitoring**: MLB Stats API and other external dependencies

## 🎯 Settlement System Monitoring

### Real-Time Settlement Monitoring

**Heartbeat Monitoring** - Automatic health tracking via `settlement_heartbeat` table:

```bash
# Monitor current settlement system health  
docker-compose exec api npm run settlement:monitor

# Check settlement heartbeat status
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
client.from('settlement_heartbeat')
  .select('*')
  .eq('pipeline_name', 'mlb_settlement_backfill')
  .order('created_at', { ascending: false })
  .limit(5)
  .then(r => console.log(JSON.stringify(r.data, null, 2)));
"
```

### Settlement Performance Metrics

**Key Performance Indicators**:
- **Processing Rate**: Records processed per minute (target: ≥2 records/min)
- **Success Rate**: Percentage of successful settlements (target: ≥95%)
- **Error Rate**: Percentage of failed settlements (target: ≤5%) 
- **API Response Time**: External API response times (target: <2 seconds)

**Performance Monitoring Commands**:
```bash
# Settlement system performance analysis
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Calculate success rates over last 24 hours  
client.from('settlement_heartbeat')
  .select('processed_count, success_count, error_count, created_at')
  .eq('pipeline_name', 'mlb_settlement_backfill')
  .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
  .then(r => {
    const total_processed = r.data.reduce((sum, row) => sum + row.processed_count, 0);
    const total_success = r.data.reduce((sum, row) => sum + row.success_count, 0);
    const total_errors = r.data.reduce((sum, row) => sum + row.error_count, 0);
    console.log({
      period: 'Last 24 hours',
      total_processed,
      total_success,
      total_errors,
      success_rate: total_processed ? (100 * total_success / total_processed).toFixed(2) + '%' : 'N/A'
    });
  });
"
```

### Settlement Validation Procedures

**Pre-Execution Validation**:
```bash
# Validate settlement environment and dependencies
docker-compose exec api npm run settlement:validate

# Check for settlement candidates
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
client.from('shadow_decisions')
  .select('count')
  .eq('decision_type', 'settlement_backfill')
  .is('settled_at', null)
  .then(r => console.log('Unsettled candidates:', r.count));
"

# Test MLB Stats API connectivity
docker-compose exec api npx tsx -e "
fetch('https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + new Date().toISOString().slice(0,10))
  .then(r => r.ok ? console.log('✅ MLB Stats API accessible') : console.log('❌ MLB Stats API error:', r.status))
  .catch(e => console.log('❌ MLB Stats API connection failed:', e.message));
"
```

**Post-Execution Validation**:
```bash
# Verify settlement completion and accuracy
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Check recent settlements
client.from('shadow_decisions')
  .select('id, player, market, line, actual_result, settled_at, status')
  .eq('decision_type', 'settlement_backfill')
  .not('settled_at', 'is', null)
  .order('settled_at', { ascending: false })
  .limit(10)
  .then(r => console.log('Recent settlements:', JSON.stringify(r.data, null, 2)));
"
```

## 🤖 Agent System Monitoring

### BaseAgent Health Monitoring

**Agent Health Checks**:
```bash
# Monitor all agents health
docker-compose exec api npm run agents:monitor

# Test individual agent functionality
docker-compose exec api npm run agents:test

# Check agent health metrics
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
client.from('agent_health')
  .select('*')
  .order('last_heartbeat', { ascending: false })
  .limit(20)
  .then(r => console.log('Agent Health:', JSON.stringify(r.data, null, 2)));
"
```

### Agent Performance Metrics

**Key Agent Metrics**:
- **Agent Uptime**: Percentage of time agents are operational (target: ≥99%)
- **Processing Latency**: Time from event to processing completion (target: <30 seconds)
- **Error Rate**: Agent processing error rates (target: ≤2%)
- **Throughput**: Events processed per minute per agent (varies by agent type)

**Agent Monitoring Commands**:
```bash
# Agent performance analysis
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Get agent metrics summary
client.from('agent_metrics')
  .select('agent_name, processed_events, error_count, last_updated')
  .order('last_updated', { ascending: false })
  .then(r => {
    console.log('Agent Metrics Summary:');
    r.data.forEach(agent => {
      const error_rate = agent.processed_events ? 
        (100 * agent.error_count / agent.processed_events).toFixed(2) + '%' : 
        'N/A';
      console.log(\`\${agent.agent_name}: \${agent.processed_events} processed, \${error_rate} error rate\`);
    });
  });
"

# BridgeWorker monitoring
./dev.sh logs | grep -E "(BridgeWorker|bridge_outbox)" | tail -20
```

## 🗄️ Database Monitoring

### Database Health Checks

**Connection and Performance Monitoring**:
```bash
# Database health check
docker-compose exec api npm run health:check

# Check database performance metrics  
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Test database responsiveness
const start = Date.now();
client.from('users').select('count').limit(1).then(r => {
  const duration = Date.now() - start;
  console.log(\`Database response time: \${duration}ms\`);
  console.log(duration < 1000 ? '✅ Database performance OK' : '⚠️  Database performance slow');
});
"
```

### v3.0.0 Database Performance

**Key Database Metrics**:
- **Query Response Time**: Average query execution time (target: <100ms for simple queries)
- **Connection Pool Health**: Active connections vs. pool size
- **Table Performance**: Query performance on critical tables (`unified_picks`, `raw_props`)
- **Index Utilization**: Database index usage and effectiveness

**Database Performance Monitoring**:
```bash
# Monitor critical table performance
docker-compose exec api npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTablePerformance() {
  const tables = ['unified_picks', 'raw_props', 'shadow_decisions', 'users'];
  
  for (const table of tables) {
    const start = Date.now();
    const result = await client.from(table).select('count').limit(1);
    const duration = Date.now() - start;
    
    console.log(\`\${table}: \${duration}ms (\${duration < 100 ? '✅' : '⚠️'})\`);
  }
}

checkTablePerformance();
"
```

### Database Migration Monitoring

**Migration Status and Health**:
```bash
# Check database migration status
docker-compose exec api npm run db:status

# Apply pending migrations
docker-compose exec api npm run db:migrate  

# Validate database schema
docker-compose exec api npm run db:validate:schema
```

## ⚡ Performance Monitoring

### System Performance Metrics

**Resource Monitoring**:
```bash
# Monitor Docker container resource usage
docker stats --no-stream

# Check individual container performance
docker stats $(docker ps --format "table {{.Names}}" | grep -v NAMES)

# Monitor disk usage
df -h

# Monitor memory usage
free -h
```

### API Performance Monitoring

**Response Time and Throughput**:
```bash
# API health and performance check
docker-compose exec api npm run qa:health

# Load testing (if available)
docker-compose exec api npm run qa:performance

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/health"
```

**API Monitoring Script** (`curl-format.txt`):
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n  
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

### External Service Monitoring

**External API Health Checks**:
```bash
# Monitor MLB Stats API health and response time
docker-compose exec api npx tsx -e "
async function checkExternalAPIs() {
  const apis = [
    { name: 'MLB Stats API', url: 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-01-11' },
    // Add other external APIs as needed
  ];
  
  for (const api of apis) {
    try {
      const start = Date.now();
      const response = await fetch(api.url);
      const duration = Date.now() - start;
      
      console.log(\`\${api.name}: \${duration}ms, Status: \${response.status} (\${response.ok ? '✅' : '❌'})\`);
    } catch (error) {
      console.log(\`\${api.name}: Connection failed ❌ - \${error.message}\`);
    }
  }
}

checkExternalAPIs();
"
```

## ✅ Production Validation

### Pre-Deployment Validation

**Environment Validation Checklist**:
```bash
# 1. Docker Environment Health
./dev.sh status
# Expected: All services running and healthy

# 2. Database Connectivity  
docker-compose exec api npm run health:check
# Expected: Database connection successful

# 3. Environment Variables
docker-compose exec api env | grep -E "(SUPABASE|MLB|NODE)"
# Expected: All required variables present

# 4. External API Connectivity
docker-compose exec api npx tsx -e "fetch('https://statsapi.mlb.com').then(r => console.log('MLB API:', r.ok ? '✅' : '❌'))"
# Expected: ✅ MLB API accessible

# 5. Settlement System Test
docker-compose exec api npm run settlement:test
# Expected: Dry run completes without errors

# 6. Agent System Test  
docker-compose exec api npm run agents:test
# Expected: All agents report healthy
```

### Production Deployment Validation

**Post-Deployment Validation**:
```bash
# 1. Service Health Validation
./dev.sh status && echo "✅ All services running"

# 2. Database Migration Validation  
docker-compose exec api npm run db:migrate && echo "✅ Database migrations applied"

# 3. Settlement System Validation
docker-compose exec api npm run settlement:validate && echo "✅ Settlement system operational"

# 4. Agent System Validation
docker-compose exec api npm run agents:monitor && echo "✅ Agent system operational"

# 5. API Endpoint Validation
curl -f http://localhost:3000/health && echo "✅ API endpoints accessible"

# 6. End-to-End Pipeline Validation  
docker-compose exec api npm run test:production-pipeline && echo "✅ Production pipeline operational"
```

### Continuous Production Validation

**Daily Production Health Check**:
```bash
#!/bin/bash
# Daily production health validation script

echo "=== Unit Talk Production Health Check ==="
echo "Date: $(date)"
echo

# Check Docker services
echo "1. Docker Services:"
./dev.sh status || echo "❌ Docker services issue detected"
echo

# Check database health
echo "2. Database Health:"
docker-compose exec api npm run health:check || echo "❌ Database health issue detected"
echo

# Check settlement system
echo "3. Settlement System:"
docker-compose exec api npm run settlement:monitor || echo "❌ Settlement system issue detected"
echo

# Check agent system
echo "4. Agent System:"
docker-compose exec api npm run agents:monitor || echo "❌ Agent system issue detected"
echo

# Check external APIs
echo "5. External APIs:"
docker-compose exec api npx tsx -e "
fetch('https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + new Date().toISOString().slice(0,10))
  .then(r => console.log('MLB Stats API:', r.ok ? '✅' : '❌'))
  .catch(() => console.log('MLB Stats API: ❌'));
" || echo "❌ External API check failed"
echo

# Check recent errors
echo "6. Recent Errors:"
error_count=$(./dev.sh logs --since="24h" | grep -c ERROR)
if [ $error_count -gt 10 ]; then
    echo "⚠️ High error count detected: $error_count errors in last 24h"
else
    echo "✅ Error count acceptable: $error_count errors in last 24h"
fi
echo

echo "=== Health Check Complete ==="
```

## 📊 Health Checks & Dashboards

### Built-in Health Check Endpoints

**API Health Endpoints**:
```bash
# Primary health endpoint
curl http://localhost:3000/health

# Detailed health with dependencies  
curl http://localhost:3000/health/detailed

# Database-specific health check
curl http://localhost:3000/health/database

# Agent system health
curl http://localhost:3000/health/agents
```

### Command Center Monitoring

**Real-Time Monitoring Dashboard**:
```bash
# Start Command Center monitoring interface
docker-compose exec command-center npm run dev

# Access dashboard at: http://localhost:3001
# Features:
# - Real-time agent health monitoring
# - Settlement system status
# - Database performance metrics
# - Event stream monitoring
```

### Custom Monitoring Scripts

**Comprehensive System Status Script**:
```bash
#!/bin/bash
# comprehensive-status.sh - Complete system status check

echo "=== Unit Talk Production Status ==="

# Docker containers
echo "Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo

# Resource usage
echo "Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo

# Database connections
echo "Database Status:"
docker-compose exec api npm run health:check 2>/dev/null | grep -E "(database|Database)" || echo "Database check failed"
echo

# Settlement system
echo "Settlement System:"
docker-compose exec api npm run settlement:monitor 2>/dev/null | tail -5 || echo "Settlement monitoring unavailable"
echo

# Recent logs (errors only)
echo "Recent Errors:"
./dev.sh logs --since="1h" 2>/dev/null | grep ERROR | tail -5 || echo "No recent errors found"
echo

echo "=== Status Check Complete ==="
```

## 🚨 Alerting & Notifications

### Critical Alert Conditions

**Immediate Action Required**:
- Database connection failures
- All agent systems down
- Settlement system consecutive failures (>5)
- Docker container crashes
- External API outages affecting operations

**Warning Conditions**:
- High error rates (>5% in last hour)
- Slow response times (>2 seconds average)
- Low success rates (<90% in last 4 hours)
- Resource usage above 80%
- Individual agent failures

### Notification Setup

**Discord Monitoring Integration**:
```typescript
// Example Discord notification for critical alerts
const discordAlert = async (message: string, severity: 'critical' | 'warning') => {
  if (process.env.DISCORD_MONITORING_WEBHOOK) {
    await fetch(process.env.DISCORD_MONITORING_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `${severity === 'critical' ? '🚨' : '⚠️'} **Unit Talk Production Alert**\n${message}`,
        username: 'Unit Talk Monitor'
      })
    });
  }
};
```

**Email Notification Setup**:
```bash
# Configure email alerts for critical system failures
# Add to crontab for regular health checks with email notifications:
0 */4 * * * /path/to/health-check.sh | mail -s "Unit Talk Health Check" admin@unittalk.com
```

### Monitoring Schedule

**Automated Monitoring Schedule**:
- **Every 5 minutes**: Service health checks
- **Every 15 minutes**: Settlement system monitoring
- **Every 30 minutes**: Agent system health checks
- **Every hour**: Database performance validation
- **Every 4 hours**: Comprehensive system status
- **Daily**: Full production validation and reporting

### Response Procedures

**Alert Response Matrix**:

| Alert Type | Response Time | Actions Required |
|------------|---------------|------------------|
| Database Down | Immediate (5 min) | Check connectivity, restart containers, escalate |
| Settlement Failure | 15 minutes | Check logs, validate data, restart if needed |
| Agent System Down | 30 minutes | Check agent health, restart agents, validate |
| High Error Rate | 1 hour | Analyze error patterns, check external services |
| Performance Degradation | 4 hours | Monitor trends, check resources, plan optimization |

---

**Document Owner**: Platform Engineering Team  
**Last Updated**: January 2025  
**Next Review**: Monthly monitoring review  
**Version**: 3.0.0-production

For additional monitoring resources:
- [SETTLEMENT_SYSTEM.md](SETTLEMENT_SYSTEM.md) - Settlement system monitoring details
- [apps/api/CLAUDE.md](apps/api/CLAUDE.md) - API monitoring procedures
- [Root CLAUDE.md](CLAUDE.md) - Overall platform monitoring guidance