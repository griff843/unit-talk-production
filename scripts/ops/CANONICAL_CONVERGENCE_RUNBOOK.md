# Canonical Convergence Production Runbook
**Date:** 2025-01-28  
**Version:** 1.0.0  
**Status:** Production Ready

## 🎯 Objective
Converge permanently on canonical picks + pick_publish architecture with:
- Idempotent schema migration
- Runtime safety nets (blue/green, canary, auto-rollback)
- Full observability (OTel, Grafana, SLO dashboards)
- Production security (RLS, rate limits, circuit breakers)
- Mandatory CI/CD gates

## 📋 Prerequisites

### Required Access
- [ ] Supabase project admin access
- [ ] DATABASE_DIRECT_URL (non-pooled, port 5432)
- [ ] Docker environment running
- [ ] GitHub Actions secrets configured

### Required Environment Variables
```bash
DATABASE_DIRECT_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
PICK_DRIVER=canonical
PUBLISH_MODE=outbox
SHADOW_MODE=false
```

## 🚀 Execution Steps

### Phase 1: Schema Migration (15 minutes)

#### 1.1 Backup Current State
```bash
# Backup unified_picks table
psql "$DATABASE_DIRECT_URL" -c "\COPY (SELECT * FROM unified_picks ORDER BY created_at DESC LIMIT 10000) TO 'backup_unified_picks_$(date +%Y%m%d).csv' CSV HEADER"

# Backup environment
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
```

#### 1.2 Run Canonical Migration
```bash
# Execute idempotent migration
psql "$DATABASE_DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/2025-01-28_canonical_convergence.sql

# Verify migration
psql "$DATABASE_DIRECT_URL" -c "SELECT COUNT(*) FROM picks;"
psql "$DATABASE_DIRECT_URL" -c "SELECT COUNT(*) FROM pick_publish;"
```

#### 1.3 Force PostgREST Schema Reload
```bash
# Trigger schema cache refresh
psql "$DATABASE_DIRECT_URL" -c "select pg_notify('pgrst','reload schema');"

# Wait for propagation
sleep 5

# Verify via Supabase Studio (check if picks/pick_publish tables visible)
```

**✅ Checkpoint:** Canonical tables exist, backfill complete, PostgREST reloaded

---

### Phase 2: Runtime Configuration (10 minutes)

#### 2.1 Update Environment Variables
```bash
# Update .env
cat >> .env << EOF

# ============================================================================
# CANONICAL CONVERGENCE - 2025-01-28
# ============================================================================
PICK_DRIVER=canonical
PUBLISH_MODE=outbox
SHADOW_MODE=false
LOG_MODE=sync

# Rate Limiting
RATE_LIMIT_WRITE_RPM=60
RATE_LIMIT_READ_RPM=300

# Circuit Breaker
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=60000

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
PROMETHEUS_ENABLED=true
EOF
```

#### 2.2 Update docker-compose.yml
```bash
# Ensure api service has correct env vars
# Already configured in docker-compose.yml lines 283-286
```

#### 2.3 Restart Services
```bash
# Restart with new configuration
./dev.sh restart

# Wait for services to be healthy
sleep 15

# Verify health
curl -sf http://localhost:3010/api/health || echo "API not healthy"
curl -sf http://localhost:3002/api/health || echo "Smart Form not healthy"
curl -sf http://localhost:3004/api/health || echo "Command Center not healthy"
```

**✅ Checkpoint:** All services healthy with canonical driver active

---

### Phase 3: Security Enablement (10 minutes)

#### 3.1 Enable RLS and Security Features
```bash
# Run security enablement script
psql "$DATABASE_DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/ops/enable-production-security.sql

# Verify RLS enabled
psql "$DATABASE_DIRECT_URL" -c "
SELECT 
  schemaname, 
  tablename, 
  CASE WHEN rowsecurity THEN '✓ ENABLED' ELSE '✗ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_publish', 'audit_log')
ORDER BY tablename;
"
```

#### 3.2 Test RLS Policies
```bash
# Test tenant isolation
psql "$DATABASE_DIRECT_URL" -c "
SELECT set_tenant_context('12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a');
SELECT COUNT(*) FROM picks;  -- Should return picks for this tenant only
"
```

**✅ Checkpoint:** RLS enabled, audit log active, rate limiting configured

---

### Phase 4: Observability Setup (15 minutes)

#### 4.1 Deploy Grafana Dashboard
```bash
# Import dashboard to Grafana
curl -X POST http://localhost:3001/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin:admin" \
  -d @infra/observability/canonical-picks-dashboard.json

# Verify dashboard accessible
open http://localhost:3001/d/canonical-picks-slo
```

#### 4.2 Configure Prometheus Scraping
```bash
# Verify Prometheus is scraping API metrics
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="api")'

# Check metrics availability
curl -s http://localhost:3010/metrics | grep "api_picks_insert"
```

#### 4.3 Setup Alerting
```bash
# Configure Discord webhook for alerts (already in .env.shared)
# Test alert
curl -X POST "$DISCORD_OPERATOR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content":"🔔 Canonical Convergence: Observability Active"}'
```

**✅ Checkpoint:** Grafana dashboard live, Prometheus scraping, alerts configured

---

### Phase 5: E2E Validation (20 minutes)

#### 5.1 Run Comprehensive E2E Tests
```bash
# Execute E2E validation script
pwsh scripts/ops/canonical-convergence-e2e.ps1

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ E2E validation PASSED"
else
  echo "❌ E2E validation FAILED - review artifacts"
  exit 1
fi
```

#### 5.2 Review Attestations
```bash
# View latest attestation
cat out/ops/cutover/metrics/100/CANONICAL_CONVERGENCE_*.md

# Check SLO compliance
jq '.SLOs' out/ops/cutover/metrics/100/CANONICAL_CONVERGENCE_*.json
```

#### 5.3 Manual Smoke Tests
```bash
# Test 1: Submit pick via Smart Form
open http://localhost:3002/submit-ticket

# Test 2: Verify in Command Center
open http://localhost:3004

# Test 3: Check outbox processing
psql "$DATABASE_DIRECT_URL" -c "
SELECT status, COUNT(*) 
FROM pick_publish 
GROUP BY status;
"
```

**✅ Checkpoint:** E2E tests pass, SLOs met, manual verification complete

---

### Phase 6: Production Cutover (10 minutes)

#### 6.1 Final Pre-Flight Checks
```bash
# Verify driver status
curl -s http://localhost:3010/api/domain/picks/status | jq '.currentDriver'
# Expected: "canonical"

# Verify publish mode
curl -s http://localhost:3010/api/domain/picks/status | jq '.publishMode'
# Expected: "outbox"

# Check database connections
psql "$DATABASE_DIRECT_URL" -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'postgres';"
```

#### 6.2 Enable Production Traffic
```bash
# Update SHADOW_MODE to false (already done in Phase 2)
# Restart services to ensure all workers pick up new config
./dev.sh restart

# Monitor logs for errors
./dev.sh logs | grep -i error
```

#### 6.3 Monitor Initial Traffic
```bash
# Watch Grafana dashboard for 10 minutes
open http://localhost:3001/d/canonical-picks-slo

# Monitor SLO metrics
watch -n 5 'curl -s http://localhost:9090/api/v1/query?query=api_picks_insert_duration_seconds | jq'

# Check circuit breaker status
psql "$DATABASE_DIRECT_URL" -c "SELECT * FROM circuit_breaker_state;"
```

**✅ Checkpoint:** Production traffic flowing, SLOs within targets, no errors

---

## 📊 Success Criteria

### Must Pass (GO/NO-GO)
- [x] Canonical tables created and backfilled
- [x] PostgREST schema reloaded
- [x] All services healthy with canonical driver
- [x] RLS enabled and tested
- [x] E2E tests pass for all leagues (NBA/NFL/MLB/NHL)
- [x] API p95 latency < 150ms
- [x] DB p95 latency < 50ms
- [x] Error rate < 0.5%
- [x] Outbox publish lag p95 < 60s

### Should Pass (Warnings)
- [ ] Grafana dashboard accessible
- [ ] Prometheus scraping metrics
- [ ] Circuit breakers configured
- [ ] Rate limiting active
- [ ] Audit log capturing events

## 🚨 Rollback Procedure

If any critical issue occurs:

### Immediate Rollback
```bash
# 1. Restore previous .env
cp .env.backup.YYYYMMDD_HHMMSS .env

# 2. Update to unified driver
sed -i 's/PICK_DRIVER=canonical/PICK_DRIVER=unified/' .env

# 3. Restart services
./dev.sh restart

# 4. Verify rollback
curl -s http://localhost:3010/api/domain/picks/status | jq '.currentDriver'
# Expected: "unified"
```

### Post-Rollback
1. Investigate root cause in logs: `./dev.sh logs`
2. Review E2E attestations in `out/ops/cutover/metrics/100/`
3. Check Grafana for SLO violations
4. Document issue in GitHub issue
5. Schedule retry after fixes

## 📞 Support Contacts

- **Engineering Lead:** @griff843
- **Database Admin:** Supabase Support
- **DevOps:** GitHub Actions logs
- **Monitoring:** Grafana (http://localhost:3001)

## 📝 Post-Deployment Tasks

### Day 1
- [ ] Monitor Grafana dashboard every hour
- [ ] Review audit_log for anomalies
- [ ] Check circuit breaker trips
- [ ] Verify rate limiting effectiveness

### Week 1
- [ ] Analyze SLO trends
- [ ] Optimize slow queries
- [ ] Review error logs
- [ ] Update documentation

### Month 1
- [ ] Deprecate unified_picks table (after validation)
- [ ] Archive old data
- [ ] Optimize indexes based on usage
- [ ] Conduct retrospective

---

**Last Updated:** 2025-01-28  
**Next Review:** 2025-02-28  
**Owner:** Unit Talk Engineering

