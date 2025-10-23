# Phase 6 – Performance Execution & Hardening Runbook

**Date**: 2025-10-23  
**Environment**: Staging → Production  
**Supabase Project**: cqfnsozknjzvyiziwicl  
**Status**: 🚀 EXECUTION IN PROGRESS

---

## 📋 Executive Summary

Phase 6 implements production-grade performance execution and hardening for Unit Talk platform. This phase validates SLO compliance, resilience under chaos conditions, cost efficiency, and zero-downtime deployment capabilities.

### Success Criteria (Hard Fail if Missed)
- ✅ **SLOs**: P95 API ≤ 150ms, P99 ≤ 400ms; error-rate < 0.5%; queue lag ≤ 20s
- ✅ **Resilience**: Pod failure recovery ≤ 60s; Redis outage no data loss; jobs idempotent
- ✅ **Cost**: Connections within budget; daily cost alert posted
- ✅ **Blue/Green**: Zero-downtime cutover, rollback plan validated

---

## 🎯 Phase 6 Objectives

### 1. Staging Infrastructure Deployment
- Apply k8s manifests with HPA targets from Phase 5
- Configure autoscaling thresholds: CPU 70%, queue lag 30s, P95 API < 200ms
- Enable back-pressure in QueueManager
- Add graceful shutdown hooks

### 2. Load & Soak Testing
- Execute k6/Locust profiles at 1k → 10k RPS ramps
- Test durations: 15min, 30min, 60min
- Capture: P95/P99 latency, error-rate, queue depth, DB CPU/IO

### 3. Reliability Drills (Chaos Engineering)
- Fail one API pod → verify auto-heal < 60s
- Fail one worker pod → verify auto-heal < 60s
- Redis outage (60s) → verify no data loss
- Validate Temporal recovery and at-least-once processing

### 4. Cost Guardrails
- Enforce connection pool/pgbouncer limits
- Set query budgets
- Enable daily cost summaries to Discord "ops-alerts"

### 5. Blue/Green Deployment
- Prepare blue-green infrastructure
- Canary rollout: 5% → 25% → 100%
- Validate SLOs at each stage (20min soak per stage)

### 6. Database Hygiene
- Run nightly-baseline.yml manually
- Verify grants/RLS/NOTIFY intact
- Refresh materialized views
- Verify index usage via pg_stat_statements

---

## 🔧 Pre-Execution Checklist

### Infrastructure Prerequisites
- [ ] Kubernetes cluster access (staging + production)
- [ ] kubectl configured with proper contexts
- [ ] Supabase project access (cqfnsozknjzvyiziwicl)
- [ ] Redis cluster access
- [ ] Temporal cluster access
- [ ] Prometheus/Grafana monitoring stack
- [ ] Discord webhook for ops-alerts channel
- [ ] Load testing tools installed (k6, Locust)

### Configuration Verification
- [ ] Phase 5 merged and stable on main branch
- [ ] All environment variables configured
- [ ] Secrets properly set in k8s
- [ ] Database migrations up to date
- [ ] Monitoring dashboards configured

### Safety Measures
- [ ] Rollback plan documented
- [ ] Emergency contacts list updated
- [ ] Incident response playbook ready
- [ ] Database backups verified (< 24h old)
- [ ] Communication channels established

---

## 📊 Execution Timeline

### Stage 1: Staging Deployment (Day 1)
**Duration**: 4 hours  
**Owner**: Release Engineer

1. **Apply k8s Manifests** (30min)
   ```bash
   kubectl apply -f kubernetes/base/deployment.yaml
   kubectl apply -f kubernetes/base/hpa.yaml
   kubectl apply -f kubernetes/base/service.yaml
   ```

2. **Configure Autoscaling** (30min)
   - CPU threshold: 70%
   - Queue lag threshold: 30s
   - P95 API latency threshold: 200ms

3. **Enable Back-Pressure** (1h)
   - Update QueueManager configuration
   - Add graceful shutdown hooks
   - Deploy and verify

4. **Smoke Tests** (1h)
   - Health check endpoints
   - Basic API functionality
   - Queue processing
   - Database connectivity

5. **Monitoring Validation** (1h)
   - Verify Prometheus metrics
   - Check Grafana dashboards
   - Test alerting rules

### Stage 2: Load Testing (Day 1-2)
**Duration**: 8 hours  
**Owner**: Performance Engineer

1. **Baseline Measurement** (1h)
   - Capture current performance metrics
   - Document baseline SLOs

2. **Ramp Test 1: 1k → 2k RPS** (15min test + 30min analysis)
   ```bash
   k6 run --vus 100 --duration 15m scripts/load-tests/ramp-1k-2k.js
   ```

3. **Ramp Test 2: 2k → 5k RPS** (30min test + 1h analysis)
   ```bash
   k6 run --vus 250 --duration 30m scripts/load-tests/ramp-2k-5k.js
   ```

4. **Ramp Test 3: 5k → 10k RPS** (60min test + 2h analysis)
   ```bash
   k6 run --vus 500 --duration 60m scripts/load-tests/ramp-5k-10k.js
   ```

5. **Soak Test: Sustained 5k RPS** (2h test + 1h analysis)
   ```bash
   k6 run --vus 250 --duration 120m scripts/load-tests/soak-5k.js
   ```

### Stage 3: Chaos Engineering (Day 2)
**Duration**: 4 hours  
**Owner**: SRE Team

1. **API Pod Failure** (1h)
   ```bash
   kubectl delete pod -l app=unit-talk-api --field-selector=status.phase=Running | head -1
   # Monitor recovery time (target: < 60s)
   ```

2. **Worker Pod Failure** (1h)
   ```bash
   kubectl delete pod -l app=unit-talk-worker --field-selector=status.phase=Running | head -1
   # Verify job recovery and idempotency
   ```

3. **Redis Outage Simulation** (1h)
   ```bash
   kubectl scale deployment redis --replicas=0
   sleep 60
   kubectl scale deployment redis --replicas=1
   # Verify no data loss, cache rebuild
   ```

4. **Network Partition Test** (1h)
   - Simulate network latency
   - Verify circuit breaker activation
   - Confirm graceful degradation

### Stage 4: Cost Optimization (Day 2-3)
**Duration**: 4 hours  
**Owner**: FinOps Team

1. **Connection Pool Configuration** (1h)
   - Set pgbouncer max connections: 50
   - Configure idle timeout: 5min
   - Set connection timeout: 30s

2. **Query Budget Enforcement** (1h)
   - Set max query time: 5s
   - Configure slow query logging
   - Enable query cost tracking

3. **Cost Monitoring Setup** (1h)
   - Configure daily cost summaries
   - Set up Discord webhook alerts
   - Define cost thresholds

4. **Validation** (1h)
   - Verify connection limits enforced
   - Test cost alert delivery
   - Review cost projections

### Stage 5: Blue/Green Deployment (Day 3)
**Duration**: 6 hours  
**Owner**: Release Engineer

1. **Prepare Green Environment** (1h)
   ```bash
   kubectl apply -f kubernetes/blue-green/green-deployment.yaml
   # Wait for pods to be ready
   kubectl wait --for=condition=ready pod -l env=green --timeout=300s
   ```

2. **Canary 5% Traffic** (1h 20min)
   ```bash
   kubectl patch service unit-talk-api -p '{"spec":{"selector":{"env":"green","canary":"5"}}}'
   # Soak for 20min, monitor SLOs
   ```

3. **Canary 25% Traffic** (1h 20min)
   ```bash
   kubectl patch service unit-talk-api -p '{"spec":{"selector":{"env":"green","canary":"25"}}}'
   # Soak for 20min, monitor SLOs
   ```

4. **Full Cutover 100%** (1h 20min)
   ```bash
   kubectl patch service unit-talk-api -p '{"spec":{"selector":{"env":"green"}}}'
   # Soak for 20min, monitor SLOs
   ```

5. **Cleanup Blue Environment** (1h)
   ```bash
   kubectl delete deployment unit-talk-api-blue
   # Verify green is stable
   ```

### Stage 6: Database Hygiene (Day 3)
**Duration**: 2 hours  
**Owner**: Database Administrator

1. **Run Nightly Baseline** (30min)
   ```bash
   psql $DATABASE_URL -f scripts/nightly-baseline.yml
   ```

2. **Verify Grants/RLS/NOTIFY** (30min)
   ```sql
   SELECT * FROM pg_roles WHERE rolname LIKE 'unit_talk%';
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   SELECT * FROM pg_trigger WHERE tgname LIKE 'notify%';
   ```

3. **Refresh Materialized Views** (30min)
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_lag_24h;
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_capper_performance;
   ```

4. **Index Usage Analysis** (30min)
   ```sql
   SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
   SELECT * FROM pg_stat_user_indexes WHERE idx_scan < 100;
   ```

---

## 🚨 Rollback Procedures

### Immediate Rollback Triggers
- Error rate > 1% for 5 consecutive minutes
- P95 latency > 500ms for 5 consecutive minutes
- Database connection pool exhaustion
- Critical security vulnerability detected
- Data integrity issues

### Rollback Steps

#### Blue/Green Rollback
```bash
# Immediate traffic switch back to blue
kubectl patch service unit-talk-api -p '{"spec":{"selector":{"env":"blue"}}}'

# Verify blue is serving traffic
kubectl get endpoints unit-talk-api

# Scale down green
kubectl scale deployment unit-talk-api-green --replicas=0
```

#### Database Rollback
```bash
# Restore from latest backup
pg_restore -d $DATABASE_URL latest_backup.dump

# Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM unified_picks;"
```

#### Configuration Rollback
```bash
# Revert to previous k8s manifests
git checkout HEAD~1 kubernetes/
kubectl apply -f kubernetes/

# Verify rollback
kubectl rollout status deployment/unit-talk-api
```

---

## 📈 Success Metrics

### Performance SLOs
| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| P95 API Latency | ≤ 150ms | TBD | ⏳ |
| P99 API Latency | ≤ 400ms | TBD | ⏳ |
| Error Rate | < 0.5% | TBD | ⏳ |
| Queue Lag | ≤ 20s | TBD | ⏳ |

### Resilience Metrics
| Test | Target | Measured | Status |
|------|--------|----------|--------|
| API Pod Recovery | < 60s | TBD | ⏳ |
| Worker Pod Recovery | < 60s | TBD | ⏳ |
| Redis Recovery | No data loss | TBD | ⏳ |
| Temporal Recovery | At-least-once | TBD | ⏳ |

### Cost Metrics
| Resource | Budget | Actual | Status |
|----------|--------|--------|--------|
| DB Connections | ≤ 50 | TBD | ⏳ |
| Query Time | ≤ 5s avg | TBD | ⏳ |
| Daily Cost | Alert enabled | TBD | ⏳ |

---

## 📝 Post-Execution Checklist

- [ ] All SLOs met or exceeded
- [ ] Chaos tests passed with auto-heal < 60s
- [ ] Cost guardrails enforced and validated
- [ ] Blue/Green deployment successful
- [ ] Database hygiene verified
- [ ] All artifacts generated and committed
- [ ] Executive summary written
- [ ] PR created and reviewed
- [ ] Production deployment scheduled

---

## 🔗 Related Documentation

- [Phase 5 Optimization Plan](../../docs/PHASE5_OPTIMIZATION_PLAN.md)
- [Kubernetes Deployment Guide](../../kubernetes/README.md)
- [Load Testing Guide](../../docs/PERFORMANCE_RUNBOOK.md)
- [Incident Response Playbook](../../docs/INCIDENT_RESPONSE_PLAYBOOK.md)
- [Database Optimization](../../scripts/database_optimization.sql)

---

**Last Updated**: 2025-10-23  
**Next Review**: Post-execution (Day 4)

