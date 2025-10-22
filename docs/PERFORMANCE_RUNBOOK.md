# Performance Runbook

## Quick Reference

### Critical Metrics
- **API Latency SLO**: p95 < 100ms
- **DB Query SLO**: p95 < 50ms
- **Ingestion Rate**: > 10K props/min
- **Error Rate**: < 0.1%

### Emergency Contacts
- **On-Call Engineer**: Check PagerDuty
- **Platform Lead**: See team roster
- **Database Admin**: See team roster

## Performance Issues Playbook

### 1. High API Latency (>200ms p95)

**Symptoms**
- Grafana alerts firing for API latency
- User complaints about slow responses
- Increased timeout errors

**Diagnosis Steps**
```bash
# Check current latency
curl -s http://localhost:9090/api/v1/query?query=http_request_duration_seconds_histogram

# Check slow endpoints
docker-compose exec api npm run metrics:slow-endpoints

# Database connection pool status
docker-compose exec api npm run db:pool-status

# Redis hit rate
docker-compose exec redis redis-cli info stats | grep keyspace_hits
```

**Resolution Steps**
1. **Immediate**: Enable emergency caching
   ```bash
   docker-compose exec api npm run cache:emergency-mode
   ```

2. **Short-term**: Scale API replicas
   ```bash
   docker-compose scale api=5
   ```

3. **Investigation**:
   - Check for database locks
   - Review recent deployments
   - Analyze query patterns

### 2. Database Query Slowdown

**Symptoms**
- pg_stat_statements showing high query times
- Database CPU > 80%
- Connection pool exhaustion

**Diagnosis Steps**
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;
```

**Resolution Steps**
1. **Kill long-running queries**:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   AND now() - pg_stat_activity.query_start > interval '5 minutes';
   ```

2. **Emergency indexes**:
   ```sql
   -- Create missing indexes
   CREATE INDEX CONCURRENTLY idx_emergency_unified_picks_created 
   ON unified_picks(created_at) 
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Failover to read replica**:
   ```bash
   docker-compose exec api npm run db:failover-read
   ```

### 3. Queue Backlog

**Symptoms**
- BullMQ dashboard showing high queue depth
- Processing lag > 5 minutes
- Memory usage increasing

**Diagnosis Steps**
```typescript
// Check queue status
const queues = ['ingestion', 'scoring', 'alerts'];
for (const queueName of queues) {
  const queue = new Queue(queueName);
  const counts = await queue.getJobCounts();
  console.log(`${queueName}:`, counts);
}
```

**Resolution Steps**
1. **Scale workers**:
   ```bash
   docker-compose scale worker=10
   ```

2. **Pause non-critical queues**:
   ```bash
   docker-compose exec api npm run queue:pause-analytics
   ```

3. **Clear stuck jobs**:
   ```bash
   docker-compose exec api npm run queue:clean-failed
   ```

### 4. Memory Leak

**Symptoms**
- Gradual memory increase over time
- OOM kills in container logs
- Performance degradation

**Diagnosis Steps**
```bash
# Memory profiling
docker-compose exec api node --inspect=0.0.0.0:9229 dist/index.js

# Heap snapshot
docker-compose exec api npm run debug:heap-snapshot

# Memory stats
docker stats --no-stream
```

**Resolution Steps**
1. **Rolling restart**:
   ```bash
   docker-compose exec api npm run restart:rolling
   ```

2. **Analyze heap**:
   ```bash
   # Compare snapshots
   npm run analyze:heap-diff snapshot1.heapsnapshot snapshot2.heapsnapshot
   ```

3. **Apply memory limits**:
   ```yaml
   services:
     api:
       deploy:
         resources:
           limits:
             memory: 2G
   ```

### 5. Cache Issues

**Symptoms**
- Low cache hit rate (<80%)
- Redis memory full
- Stale data complaints

**Diagnosis Steps**
```bash
# Cache statistics
docker-compose exec redis redis-cli info stats

# Memory usage
docker-compose exec redis redis-cli info memory

# Key distribution
docker-compose exec redis redis-cli --scan --pattern '*' | head -1000 | cut -d: -f1 | sort | uniq -c
```

**Resolution Steps**
1. **Clear cache**:
   ```bash
   docker-compose exec redis redis-cli FLUSHDB
   ```

2. **Adjust TTLs**:
   ```typescript
   // Reduce TTL for less critical data
   await redis.setex('player:*', 1800, data); // 30 min instead of 1 hour
   ```

3. **Enable eviction**:
   ```bash
   docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

## Monitoring Commands

### Real-time Metrics
```bash
# API metrics
curl -s http://localhost:8080/metrics | grep http_

# Database metrics
docker-compose exec database psql -U postgres -c "SELECT * FROM pg_stat_database"

# Queue metrics
docker-compose exec api npm run queue:stats

# Cache metrics
docker-compose exec redis redis-cli monitor
```

### Performance Testing
```bash
# Load test
npm run test:load -- --rps=1000 --duration=300

# Stress test specific endpoint
npm run test:stress -- --endpoint=/api/v1/picks --concurrent=100

# Database benchmark
npm run test:db-benchmark
```

## Preventive Measures

### Daily Checks
1. Review Grafana dashboards
2. Check SLO compliance report
3. Verify backup completion
4. Review error logs

### Weekly Tasks
1. Analyze slow query report
2. Review resource utilization trends
3. Update capacity planning
4. Performance regression testing

### Monthly Tasks
1. Full system performance audit
2. Update runbook with new issues
3. Capacity planning review
4. Disaster recovery drill

## Escalation Path

1. **Level 1**: On-call engineer (0-30 min)
   - Follow runbook procedures
   - Basic diagnostics and resolution

2. **Level 2**: Senior engineer (30-60 min)
   - Complex troubleshooting
   - Architectural decisions

3. **Level 3**: Platform architect (60+ min)
   - Major system changes
   - Emergency scaling decisions

## Post-Incident

### Required Actions
1. Create incident report
2. Update runbook if new issue
3. Add monitoring for issue
4. Schedule post-mortem

### Report Template
```markdown
## Incident Report: [DATE]

**Duration**: [Start] - [End]
**Impact**: [User impact description]
**Root Cause**: [Technical root cause]

### Timeline
- [Time]: [Event]

### Resolution
[Steps taken to resolve]

### Action Items
- [ ] Add monitoring for X
- [ ] Update runbook section Y
- [ ] Implement fix Z
```

---

**Last Updated**: January 2025  
**Next Review**: Monthly