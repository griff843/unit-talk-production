# Runbook: Database Failover

**Severity:** Critical (Severity 1)
**Response Time:** Immediate
**Last Updated:** 2025-01-25
**Owner:** Database/Platform SRE Team

---

## Overview

This runbook provides procedures for responding to Supabase PostgreSQL database failures, including connection issues, performance degradation, and full outages.

### Symptoms

- Database connection timeouts or errors
- Prometheus alert: `DatabaseLatencySLOViolation`
- Slow or hanging database queries
- Application errors: `ECONNREFUSED`, `connection pool exhausted`
- API 500 errors with database-related stack traces
- Supabase dashboard showing "degraded" or "down" status

### Impact

- **Critical**: All data read/write operations affected
- **Business Impact**: Complete service unavailability, data integrity risk
- **SLO Impact**: Database latency SLO violation (target: p95 < 50ms)

---

## Immediate Response (0-5 minutes)

### Step 1: Acknowledge and Assess

```bash
# 1.1 Check Supabase status
curl -f https://<supabase-project>.supabase.co/rest/v1/ \
  -H "apikey: $SUPABASE_ANON_KEY"
# Expected: 200 OK
# If 5xx or timeout: Database may be down

# 1.2 Check Supabase dashboard
# Open: https://app.supabase.com/project/<project-id>
# Look for: Health indicators, incident banners

# 1.3 Test direct database connection from kubectl
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql "$DATABASE_URL" -c "SELECT NOW();"
# Expected: Current timestamp
# If fails: Database unreachable

# 1.4 Check connection pool metrics
curl -s 'http://prometheus:9090/api/v1/query?query=database_connections_active{job="unit-talk-api"}' | jq '.'
curl -s 'http://prometheus:9090/api/v1/query?query=database_connections_max{job="unit-talk-api"}' | jq '.'
```

**Record findings:**
- Time of detection: _____________________
- Database status: [ ] Reachable [ ] Unreachable [ ] Degraded
- Connection pool saturation: _____%
- Query latency p95: _____ms
- Active connections: _____

### Step 2: Initiate Incident Response

```bash
# 2.1 Create incident ticket
# Use incident management system

# 2.2 Notify stakeholders
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 SEVERITY 1: Database Failover Required",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* INVESTIGATING\n*Impact:* Database connection/performance issue\n*Incident Commander:* @db-oncall"}
      }
    ]
  }'

# 2.3 Page database specialist
# Use PagerDuty or equivalent

# 2.4 Join war room
# Channel: #database-incident
```

---

## Diagnosis (5-15 minutes)

### Step 3: Identify Root Cause

#### 3.1 Check Database Metrics

```bash
# 3.1.1 Check query latency
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(database_query_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000'
# Expected: < 50ms
# If > 100ms: Severe degradation

# 3.1.2 Check connection pool saturation
curl -s 'http://prometheus:9090/api/v1/query?query=(database_connections_active{job="unit-talk-api"}/database_connections_max{job="unit-talk-api"})*100'
# Expected: < 80%
# If > 95%: Pool exhaustion

# 3.1.3 Check slow queries in Supabase
# Dashboard → Performance → Slow Queries
# Look for queries > 1s execution time

# 3.1.4 Check database CPU/memory
# Supabase Dashboard → Reports → Database
# Look for CPU > 80%, Memory > 90%
```

#### 3.2 Check Application Logs

```bash
# Check for database errors in API logs
kubectl logs -n unit-talk -l app=unit-talk-api --since=15m | grep -i "database\|sequelize\|postgres\|connection"

# Common error patterns:
# - "Connection terminated unexpectedly"
# - "connection pool exhausted"
# - "query timeout"
# - "deadlock detected"
# - "too many connections"
```

#### 3.3 Check Supabase Status Page

```bash
# Check official status
curl -s https://status.supabase.com/api/v2/status.json | jq '.'

# Check for incidents
curl -s https://status.supabase.com/api/v2/incidents.json | jq '.incidents[] | select(.status != "resolved")'
```

#### 3.4 Identify Failure Type

| Symptom | Root Cause | Action |
|---------|-----------|--------|
| Connection refused | Supabase outage | Scenario A: Supabase Outage |
| Connection pool exhausted | Too many connections | Scenario B: Connection Pool Exhaustion |
| Slow queries (> 1s) | Performance degradation | Scenario C: Query Performance Issue |
| Deadlock errors | Concurrent updates | Scenario D: Deadlock Resolution |
| Replication lag | Read replica delay | Scenario E: Replication Lag |
| Disk full errors | Storage exhaustion | Scenario F: Storage Exhaustion |

---

## Resolution

### Scenario A: Supabase Complete Outage

**Root Cause:** Supabase infrastructure failure or maintenance

```bash
# A.1 Verify Supabase is down (not application issue)
curl -f https://<supabase-project>.supabase.co/rest/v1/
# If this fails, Supabase is down

# A.2 Check Supabase status page
# https://status.supabase.com

# A.3 Contact Supabase support immediately
# Email: support@supabase.io
# Dashboard: Support ticket system
# Include: Project ID, error messages, impact

# A.4 Enable maintenance mode in application
kubectl set env deployment/unit-talk-api-green \
  MAINTENANCE_MODE=true -n unit-talk

# A.5 Show maintenance page to users
kubectl apply -f infrastructure/kubernetes/maintenance-mode-ingress.yaml

# A.6 Monitor Supabase status for recovery
watch -n 60 'curl -s https://<supabase-project>.supabase.co/rest/v1/ && echo "Database UP"'

# A.7 When Supabase recovers, disable maintenance mode
kubectl set env deployment/unit-talk-api-green \
  MAINTENANCE_MODE=false -n unit-talk

kubectl apply -f infrastructure/kubernetes/api-ingress.yaml

# A.8 Restart pods to reset connections
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk
```

### Scenario B: Connection Pool Exhaustion

**Root Cause:** Too many active database connections

```bash
# B.1 Check current connection count
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';"

# B.2 Identify connection sources
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT application_name, state, count(*)
    FROM pg_stat_activity
    WHERE datname = 'postgres'
    GROUP BY application_name, state
    ORDER BY count DESC;
  "

# B.3 Terminate idle connections (careful!)
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'postgres'
      AND state = 'idle'
      AND state_change < NOW() - INTERVAL '5 minutes';
  "

# B.4 Reduce connection pool size temporarily
kubectl set env deployment/unit-talk-api-green \
  DATABASE_POOL_MAX=50 \
  DATABASE_POOL_MIN=5 \
  -n unit-talk

# B.5 Restart pods to apply new pool settings
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# B.6 Scale down replicas if needed
kubectl scale deployment unit-talk-api-green --replicas=2 -n unit-talk

# B.7 Monitor connection usage
watch 'kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '\''postgres'\'';"'
```

### Scenario C: Query Performance Degradation

**Root Cause:** Slow or expensive queries

```bash
# C.1 Identify slow queries
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT pid, now() - query_start AS duration, query
    FROM pg_stat_activity
    WHERE state = 'active'
      AND now() - query_start > INTERVAL '5 seconds'
    ORDER BY duration DESC;
  "

# C.2 Kill long-running queries (if blocking)
# First identify the PID from above, then:
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "SELECT pg_cancel_backend(<PID>);"

# C.3 Check for missing indexes
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT schemaname, tablename, attname, n_distinct, correlation
    FROM pg_stats
    WHERE schemaname = 'public'
      AND n_distinct > 100
      AND correlation < 0.5
    ORDER BY n_distinct DESC
    LIMIT 10;
  "

# C.4 Enable query caching if available
kubectl set env deployment/unit-talk-api-green \
  QUERY_CACHE_ENABLED=true \
  QUERY_CACHE_TTL=300 \
  -n unit-talk

# C.5 Restart application
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# C.6 If specific query is problematic, add to blocklist
# Add to application config or kill at database level
```

### Scenario D: Deadlock Resolution

**Root Cause:** Concurrent transactions causing deadlocks

```bash
# D.1 Check for deadlocks
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT blocked_locks.pid AS blocked_pid,
           blocked_activity.usename AS blocked_user,
           blocking_locks.pid AS blocking_pid,
           blocking_activity.usename AS blocking_user,
           blocked_activity.query AS blocked_statement,
           blocking_activity.query AS blocking_statement
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks blocking_locks
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted;
  "

# D.2 Terminate blocking query
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(<BLOCKING_PID>);"

# D.3 Enable deadlock detection logging
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "ALTER SYSTEM SET deadlock_timeout = '1s';"

# D.4 Review transaction isolation levels
# Check application code for SERIALIZABLE transactions
# Consider lowering to READ COMMITTED if appropriate

# D.5 Restart application with reduced concurrency
kubectl set env deployment/unit-talk-api-green \
  DATABASE_POOL_MAX=20 \
  -n unit-talk

kubectl rollout restart deployment/unit-talk-api-green -n unit-talk
```

### Scenario E: Replication Lag (Read Replica)

**Root Cause:** Read replica falling behind primary

```bash
# E.1 Check replication lag
# Supabase Dashboard → Database → Replication

# E.2 Disable read replica temporarily
kubectl set env deployment/unit-talk-api-green \
  READ_REPLICA_ENABLED=false \
  -n unit-talk

# E.3 Route all reads to primary
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# E.4 Monitor primary database load
watch 'curl -s "http://prometheus:9090/api/v1/query?query=database_query_duration_seconds_sum" | jq "."'

# E.5 If primary can't handle load, scale up Supabase tier
# Supabase Dashboard → Settings → Subscription → Upgrade

# E.6 Once replication catches up, re-enable read replica
kubectl set env deployment/unit-talk-api-green \
  READ_REPLICA_ENABLED=true \
  -n unit-talk
```

### Scenario F: Storage Exhaustion

**Root Cause:** Database disk full

```bash
# F.1 Check storage usage
# Supabase Dashboard → Settings → Database → Storage

# F.2 Identify large tables
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT schemaname, tablename,
           pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
  "

# F.3 Identify old data to archive
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT 'agent_metrics' AS table_name,
           COUNT(*) AS old_rows,
           pg_size_pretty(pg_total_relation_size('agent_metrics')) AS size
    FROM agent_metrics
    WHERE created_at < NOW() - INTERVAL '90 days'
    UNION ALL
    SELECT 'unified_picks', COUNT(*), pg_size_pretty(pg_total_relation_size('unified_picks'))
    FROM unified_picks
    WHERE created_at < NOW() - INTERVAL '365 days';
  "

# F.4 Archive old data (example)
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    DELETE FROM agent_metrics
    WHERE created_at < NOW() - INTERVAL '90 days';

    VACUUM FULL agent_metrics;
  "

# F.5 Upgrade storage tier (immediate relief)
# Supabase Dashboard → Settings → Database → Upgrade storage

# F.6 Implement data retention policy
# Add to application: automatic archival/deletion of old data
```

---

## Verification (15-20 minutes)

### Step 4: Confirm Resolution

```bash
# 4.1 Test database connectivity
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql "$DATABASE_URL" -c "SELECT NOW(), version();"

# 4.2 Check query latency
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(database_query_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000' | jq '.data.result[0].value[1]'
# Expected: < 50ms

# 4.3 Check connection pool health
curl -s 'http://prometheus:9090/api/v1/query?query=(database_connections_active{job="unit-talk-api"}/database_connections_max{job="unit-talk-api"})*100' | jq '.data.result[0].value[1]'
# Expected: < 80%

# 4.4 Run database health check
npm run db:health

# 4.5 Test write operations
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    CREATE TABLE IF NOT EXISTS test_write (id SERIAL, data TEXT, created_at TIMESTAMP DEFAULT NOW());
    INSERT INTO test_write (data) VALUES ('test');
    SELECT * FROM test_write ORDER BY id DESC LIMIT 1;
    DROP TABLE test_write;
  "

# 4.6 Verify API database endpoints
curl https://api.unit-talk.com/api/v1/health/database
# Expected: {"status": "healthy", "latency_ms": <50}

# 4.7 Check for database errors in logs
kubectl logs -n unit-talk -l app=unit-talk-api --since=5m | grep -i "database\|error" | wc -l
# Expected: 0 or very low
```

### Step 5: Monitor Stability

```bash
# Monitor database metrics for 15 minutes
watch -n 30 '
  echo "=== Database Latency p95 ===" && \
  curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(database_query_duration_seconds_bucket{job=\"unit-talk-api\"}[5m]))by(le))*1000" | jq ".data.result[0].value[1]" && \
  echo "=== Connection Pool Usage ===" && \
  curl -s "http://prometheus:9090/api/v1/query?query=(database_connections_active{job=\"unit-talk-api\"}/database_connections_max{job=\"unit-talk-api\"})*100" | jq ".data.result[0].value[1]"
'

# Monitor Grafana Database Performance dashboard
# http://grafana.unit-talk.com/d/database-performance

# Check for slow queries
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "
    SELECT pid, state, now() - query_start AS duration, query
    FROM pg_stat_activity
    WHERE state = 'active'
    ORDER BY duration DESC
    LIMIT 5;
  "
```

---

## Communication

### During Incident

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🔄 Database Failover Update - [TIME]",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* MITIGATING\n*Root Cause:* [DESCRIPTION]\n*Current Actions:* [ACTIONS]\n*Database Latency:* [X]ms\n*Connection Pool:* [X]%"}
      }
    ]
  }'
```

### Resolution Announcement

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ Database Failover RESOLVED",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* RESOLVED\n*Duration:* [MINUTES] minutes\n*Root Cause:* [SUMMARY]\n*Resolution:* [ACTIONS]\n*Current Latency:* [X]ms (Target: <50ms)\n*Post-Mortem:* [DATE]"}
      }
    ]
  }'
```

---

## Post-Incident

### Database Health Report

```sql
-- Run comprehensive health check
SELECT
  'Connection Count' AS metric,
  count(*) AS value
FROM pg_stat_activity
WHERE datname = 'postgres'
UNION ALL
SELECT
  'Active Queries',
  count(*)
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT
  'Idle Connections',
  count(*)
FROM pg_stat_activity
WHERE state = 'idle'
UNION ALL
SELECT
  'Database Size',
  pg_size_pretty(pg_database_size('postgres'))::text;
```

### Action Items Template

```markdown
## Database Incident Action Items

### Immediate (< 24 hours)
- [ ] Review and optimize slow queries
- [ ] Adjust connection pool settings
- [ ] Add missing indexes
- [ ] Update monitoring thresholds

### Short-term (< 1 week)
- [ ] Implement query caching
- [ ] Set up automated failover
- [ ] Create database backup automation
- [ ] Add query performance tests to CI/CD

### Long-term (< 1 month)
- [ ] Consider database sharding
- [ ] Evaluate read replica strategy
- [ ] Implement data archival policy
- [ ] Database capacity planning review
```

---

## Prevention

### Connection Pool Configuration

```typescript
// Optimal connection pool settings
const poolConfig = {
  max: Math.ceil(process.env.DATABASE_POOL_MAX || 20),
  min: Math.ceil(process.env.DATABASE_POOL_MIN || 5),
  idle: 10000, // 10 seconds
  acquire: 30000, // 30 seconds
  evict: 1000, // 1 second
  handleDisconnects: true,
  validate: (client) => {
    return client.query('SELECT 1');
  }
};
```

### Automated Monitoring

```yaml
# Add Prometheus alerts for database issues
- alert: DatabaseConnectionPoolNearLimit
  expr: (database_connections_active / database_connections_max) * 100 > 80
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Database connection pool approaching limit"
    runbook_url: "https://docs.unit-talk.com/runbooks/db-failover"

- alert: SlowDatabaseQueries
  expr: histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m])) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Database queries are slow"
    runbook_url: "https://docs.unit-talk.com/runbooks/db-failover"
```

### Regular Maintenance

```bash
# Weekly database maintenance (schedule via cron)
# 0 2 * * 0 (Every Sunday at 2 AM)

#!/bin/bash
# scripts/db/weekly-maintenance.sh

# Vacuum analyze all tables
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

# Update table statistics
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "ANALYZE;"

# Check for bloated indexes
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -f scripts/db/check-bloat.sql

# Archive old data
npm run db:archive-old-data
```

---

## Escalation

### When to Escalate

- Supabase outage > 15 minutes
- Unable to restore database connectivity
- Data corruption suspected
- Storage exhaustion cannot be resolved

### Escalation Path

1. **Level 1:** Database on-call (0-5 min)
2. **Level 2:** Senior Database Engineer (15 min)
3. **Level 3:** Supabase Support + VP Engineering (30 min)
4. **Level 4:** CEO + legal (data loss)

### External Support

- **Supabase Support:** support@supabase.io (Priority support via dashboard)
- **Supabase Status:** https://status.supabase.com
- **Supabase Community:** https://github.com/supabase/supabase/discussions

---

## Related Runbooks

- [API Outage](API_OUTAGE.md) - For API-level failures
- [Redis Loss](REDIS_LOSS.md) - For cache layer issues

---

**Runbook Version:** 1.0
**Last Tested:** [DATE]
**Test Frequency:** Quarterly
**Next Test:** [DATE]
