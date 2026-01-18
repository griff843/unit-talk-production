# Runbook: Redis Cache Loss

**Severity:** High (Severity 2)
**Response Time:** 15 minutes
**Last Updated:** 2025-01-25
**Owner:** Platform SRE Team

---

## Overview

This runbook addresses Redis cache outages, connection failures, and performance degradation. The Unit Talk platform uses Redis for session storage, rate limiting, and application caching.

### Symptoms

- Redis connection errors in application logs
- Increased database query load
- API latency increase (cache misses)
- Session authentication failures
- Rate limiting not working
- Prometheus alert: `RedisCacheDown` or `HighRedisCacheMiss`

### Impact

- **High**: Degraded performance, increased database load
- **Business Impact**: Slower response times, potential database overload
- **SLO Impact**: API latency may exceed 150ms target

---

## Immediate Response (0-5 minutes)

### Step 1: Verify Redis Status

```bash
# 1.1 Check Redis pod status
kubectl get pods -n unit-talk -l app=redis

# 1.2 Test Redis connectivity
kubectl exec -n unit-talk deployment/redis -- redis-cli ping
# Expected: PONG

# 1.3 Check Redis memory usage
kubectl exec -n unit-talk deployment/redis -- redis-cli INFO memory

# 1.4 Check connection count
kubectl exec -n unit-talk deployment/redis -- redis-cli INFO clients | grep connected_clients
```

**Record findings:**
- Time of detection: _____________________
- Redis status: [ ] Running [ ] Crashed [ ] Degraded
- Memory usage: _____%
- Connected clients: _____
- Evicted keys: _____

### Step 2: Check Circuit Breaker

```bash
# 2.1 Verify if application enabled circuit breaker
kubectl logs -n unit-talk -l app=unit-talk-api --since=5m | grep -i "redis\|circuit"

# 2.2 Check if application is degrading gracefully
curl https://api.unit-talk.com/health
# Should still return 200 even without Redis
```

---

## Diagnosis (5-15 minutes)

### Step 3: Identify Root Cause

#### 3.1 Check Redis Logs

```bash
# View Redis logs
kubectl logs -n unit-talk deployment/redis --tail=100

# Look for:
# - Out of memory errors
# - Connection refused
# - Authentication failures
# - Network errors
# - Slow commands
```

#### 3.2 Check Resource Usage

```bash
# Check pod resources
kubectl top pod -n unit-talk -l app=redis

# Check node resources
kubectl describe node <node-running-redis>

# Check memory usage details
kubectl exec -n unit-talk deployment/redis -- redis-cli INFO stats
```

#### 3.3 Identify Failure Type

| Symptom | Root Cause | Scenario |
|---------|-----------|----------|
| Pod crashed/restarting | OOM or configuration issue | A: Redis Pod Crash |
| High memory usage (>90%) | Cache eviction needed | B: Memory Pressure |
| Connection timeout | Network policy/firewall | C: Network Issue |
| Slow commands | Large keys or blocking ops | D: Performance Degradation |
| Persistence errors | Disk full | E: Disk Space Issue |

---

## Resolution

### Scenario A: Redis Pod Crash

**Root Cause:** Pod crashed due to OOM or configuration error

```bash
# A.1 Check why pod crashed
kubectl describe pod -n unit-talk <redis-pod-name>
kubectl logs -n unit-talk <redis-pod-name> --previous

# A.2 If OOMKilled, increase memory limit
kubectl patch deployment redis -n unit-talk -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "redis",
          "resources": {
            "limits": {"memory": "2Gi"},
            "requests": {"memory": "1Gi"}
          }
        }]
      }
    }
  }
}'

# A.3 If config error, fix and restart
kubectl edit configmap redis-config -n unit-talk
kubectl rollout restart deployment/redis -n unit-talk

# A.4 Wait for Redis to be ready
kubectl rollout status deployment/redis -n unit-talk

# A.5 Test connectivity
kubectl exec -n unit-talk deployment/redis -- redis-cli ping

# A.6 Restart API pods to reconnect
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk
```

### Scenario B: Memory Pressure/Eviction

**Root Cause:** Redis memory full, evicting keys

```bash
# B.1 Check memory stats
kubectl exec -n unit-talk deployment/redis -- redis-cli INFO memory | grep -E "used_memory_human|maxmemory|evicted_keys"

# B.2 Check eviction policy
kubectl exec -n unit-talk deployment/redis -- redis-cli CONFIG GET maxmemory-policy
# Should be: allkeys-lru or volatile-lru

# B.3 If eviction policy is wrong, fix it
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET maxmemory-policy allkeys-lru

# B.4 Analyze key distribution
kubectl exec -n unit-talk deployment/redis -- redis-cli --bigkeys

# B.5 Clear unnecessary keys
kubectl exec -n unit-talk deployment/redis -- redis-cli FLUSHDB
# WARNING: Only if acceptable to clear cache!

# B.6 Increase Redis memory limit
kubectl patch deployment redis -n unit-talk -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "redis",
          "resources": {
            "limits": {"memory": "4Gi"}
          }
        }]
      }
    }
  }
}'

# B.7 Set maxmemory in Redis
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET maxmemory 3gb
```

### Scenario C: Network/Connection Issue

**Root Cause:** Redis unreachable due to network policies or DNS

```bash
# C.1 Check network policies
kubectl get networkpolicies -n unit-talk
kubectl describe networkpolicy redis-network-policy -n unit-talk

# C.2 Test DNS resolution
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  nslookup redis.unit-talk.svc.cluster.local

# C.3 Test direct connection
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  nc -zv redis.unit-talk.svc.cluster.local 6379

# C.4 Check service endpoints
kubectl get endpoints redis -n unit-talk
kubectl describe service redis -n unit-talk

# C.5 If network policy blocking, update
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-network-policy
  namespace: unit-talk
spec:
  podSelector:
    matchLabels:
      app: redis
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: unit-talk-api
    ports:
    - protocol: TCP
      port: 6379
EOF

# C.6 Restart Redis service if needed
kubectl delete service redis -n unit-talk
kubectl apply -f infrastructure/kubernetes/redis-service.yaml
```

### Scenario D: Performance Degradation (Slow Commands)

**Root Cause:** Blocking operations or large keys

```bash
# D.1 Check slow log
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli SLOWLOG GET 10

# D.2 Check for long-running commands
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CLIENT LIST | grep -v "idle=0"

# D.3 Identify large keys
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli --bigkeys

# D.4 Kill long-running client (if needed)
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CLIENT KILL ID <client-id>

# D.5 Disable expensive commands temporarily
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET rename-command "KEYS" ""

# D.6 Enable lazy eviction for better performance
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET lazyfree-lazy-eviction yes
```

### Scenario E: Disk Space Issue (Persistence)

**Root Cause:** Disk full, can't write RDB/AOF

```bash
# E.1 Check disk usage
kubectl exec -n unit-talk deployment/redis -- df -h

# E.2 Check persistence status
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli INFO persistence

# E.3 Disable persistence temporarily (if needed)
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET save ""
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET appendonly no

# E.4 Clean up old RDB/AOF files
kubectl exec -n unit-talk deployment/redis -- \
  sh -c "rm -f /data/dump.rdb.old /data/appendonly.aof.old"

# E.5 Increase PVC size
kubectl patch pvc redis-data -n unit-talk -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'

# E.6 Re-enable persistence
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli CONFIG SET appendonly yes
```

---

## Graceful Degradation

### Enable Circuit Breaker

```bash
# If Redis completely unavailable, enable circuit breaker
kubectl set env deployment/unit-talk-api-green \
  REDIS_CIRCUIT_BREAKER=true \
  REDIS_CIRCUIT_BREAKER_THRESHOLD=5 \
  REDIS_CIRCUIT_BREAKER_TIMEOUT=60000 \
  -n unit-talk

kubectl rollout restart deployment/unit-talk-api-green -n unit-talk
```

### Application Behavior Without Redis

- **Session Storage**: Fallback to stateless JWT-only auth
- **Rate Limiting**: Disable or use in-memory (per-pod) rate limiting
- **Caching**: Direct database queries (increased load)
- **Performance**: Expect 2-3x latency increase

---

## Verification (10-15 minutes)

### Step 4: Confirm Resolution

```bash
# 4.1 Test Redis connectivity
kubectl exec -n unit-talk deployment/redis -- redis-cli ping
# Expected: PONG

# 4.2 Test read/write operations
kubectl exec -n unit-talk deployment/redis -- redis-cli SET test "hello"
kubectl exec -n unit-talk deployment/redis -- redis-cli GET test
# Expected: "hello"

# 4.3 Check cache hit rate
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# 4.4 Check API latency improvement
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000'
# Should return to < 150ms with Redis working

# 4.5 Check database query reduction
# Compare before/after Redis recovery
curl -s 'http://prometheus:9090/api/v1/query?query=rate(database_queries_total[5m])'

# 4.6 Test session authentication
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://api.unit-talk.com/api/v1/users/me
```

### Step 5: Monitor Stability

```bash
# Monitor Redis metrics for 15 minutes
watch -n 30 'kubectl exec -n unit-talk deployment/redis -- \
  redis-cli INFO stats | grep -E "total_connections_received|total_commands_processed|evicted_keys|keyspace_hits|keyspace_misses"'

# Check memory usage trend
watch -n 60 'kubectl exec -n unit-talk deployment/redis -- \
  redis-cli INFO memory | grep used_memory_human'
```

---

## Communication

### During Incident

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "⚠️ Redis Cache Issue - [TIME]",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* INVESTIGATING\n*Impact:* Degraded cache performance\n*Workaround:* Circuit breaker enabled\n*DB Load:* Increased by [X]%"}
      }
    ]
  }'
```

### Resolution Announcement

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ Redis Cache RESOLVED",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* RESOLVED\n*Duration:* [MINUTES] minutes\n*Root Cause:* [SUMMARY]\n*Hit Rate:* [X]%\n*Latency Improvement:* [X]ms"}
      }
    ]
  }'
```

---

## Prevention

### Monitoring Alerts

```yaml
# Add Prometheus alerts
- alert: RedisCacheDown
  expr: redis_up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Redis cache is down"
    runbook_url: "https://docs.unit-talk.com/runbooks/redis-loss"

- alert: RedisHighMemoryUsage
  expr: (redis_memory_used_bytes / redis_memory_max_bytes) * 100 > 80
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Redis memory usage > 80%"

- alert: RedisHighEvictionRate
  expr: rate(redis_evicted_keys_total[5m]) > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Redis evicting keys rapidly"
```

### Circuit Breaker Implementation

```typescript
// Application-level Redis circuit breaker
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000, // 3s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30s
};

const redisBreaker = new CircuitBreaker(async (key: string) => {
  return await redisClient.get(key);
}, options);

redisBreaker.fallback(() => {
  // Fallback to database or return null
  logger.warn('Redis circuit breaker open, using fallback');
  return null;
});
```

### Regular Maintenance

```bash
# Weekly Redis maintenance script
#!/bin/bash
# scripts/redis/weekly-maintenance.sh

# Check memory fragmentation
FRAGMENTATION=$(kubectl exec -n unit-talk deployment/redis -- \
  redis-cli INFO memory | grep mem_fragmentation_ratio | cut -d: -f2)

if (( $(echo "$FRAGMENTATION > 1.5" | bc -l) )); then
  echo "High fragmentation detected, restarting Redis..."
  kubectl rollout restart deployment/redis -n unit-talk
fi

# Clear old keys (if using TTL)
kubectl exec -n unit-talk deployment/redis -- \
  redis-cli --scan --pattern "temp:*" | xargs kubectl exec -n unit-talk deployment/redis -- redis-cli DEL
```

---

## Related Runbooks

- [API Outage](API_OUTAGE.md) - For API-level failures
- [Database Failover](DB_FAILOVER.md) - For database issues

---

**Runbook Version:** 1.0
**Last Tested:** [DATE]
**Test Frequency:** Quarterly
**Next Test:** [DATE]
