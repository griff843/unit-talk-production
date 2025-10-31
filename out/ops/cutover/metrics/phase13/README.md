# Phase 13: Model Serving Infrastructure - Deployment Artifacts

**Date:** 2025-11-01  
**Charter:** v3.0 → v4.0 Upgrade  
**Status:** ✅ READY FOR DEPLOYMENT

---

## 📋 Quick Reference

### SLO Targets
- **Inference Latency:** p95 < 150ms
- **Drift Score:** < 0.05
- **Accuracy:** ≥ baseline - 2%

### Deployment Command (Docker-First)
```bash
# 1. Apply migration
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -f /app/../../supabase/migrations/20251101_phase13_serving.sql
"

# 2. Restart API service
docker-compose restart api

# 3. Verify metrics
curl http://localhost:9464/metrics | grep model_serving

# 4. Run validation
bash scripts/ops/validate-phase13-deployment.sh
```

---

## 📁 Artifacts in This Directory

### 1. MODEL_SERVING_ATTESTATION_2025-11-01.md
**Purpose:** Comprehensive deployment attestation document  
**Contents:**
- Executive summary
- Database schema details
- Prometheus metrics specification
- Grafana dashboard configuration
- Alert rules documentation
- SLO validation procedures
- Governance compliance checklist

**Use:** Primary reference for deployment review and sign-off

---

### 2. MODEL_SERVING_ATTESTATION_2025-11-01.json
**Purpose:** Machine-readable attestation data  
**Contents:**
- Structured deployment metadata
- SLO targets and thresholds
- Metrics specifications
- Alert rule definitions
- Validation gates
- Compliance status

**Use:** Automated tooling, CI/CD integration, audit trails

---

### 3. DEPLOYMENT_CHECKLIST.md
**Purpose:** Step-by-step deployment guide  
**Contents:**
- Pre-deployment validation steps
- Deployment procedures (Docker-first)
- Post-deployment validation
- Rollback procedures
- Success criteria
- Sign-off template

**Use:** Follow during actual deployment execution

---

### 4. DEPLOYMENT_SUMMARY.md
**Purpose:** High-level deployment overview  
**Contents:**
- Artifacts created
- SLO targets
- Deployment steps
- Validation results
- Risk assessment
- Next steps

**Use:** Executive summary for stakeholders

---

### 5. README.md
**Purpose:** This file - directory navigation guide  
**Use:** Quick reference and orientation

---

### 6. validation_*.log
**Purpose:** Validation script execution logs  
**Contents:**
- Timestamped validation results
- Pass/fail/warning counts
- Detailed check outputs

**Use:** Troubleshooting and audit trail

---

## 🚀 Deployment Workflow

### Phase 1: Pre-Deployment Validation ✅
```bash
# Verify Docker environment
./dev.sh status

# Run validation script
bash scripts/ops/validate-phase13-deployment.sh
```

**Expected:** Some failures (tables don't exist yet) - this is normal

---

### Phase 2: Database Deployment
```bash
# Apply migration (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -f /app/../../supabase/migrations/20251101_phase13_serving.sql
"

# Verify tables created
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -c \"
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('model_predictions_live', 'model_performance_history');
  \"
"
```

**Expected Output:**
```
 table_name
--------------------------
 model_performance_history
 model_predictions_live
```

---

### Phase 3: Metrics Deployment
```bash
# Restart API service to load new metrics
docker-compose restart api

# Wait for startup
sleep 10

# Verify metrics endpoint
curl http://localhost:9464/metrics | grep model_serving | head -20
```

**Expected Output:**
```
# HELP model_serving_inference_requests_total Total number of model inference requests
# TYPE model_serving_inference_requests_total counter
...
```

---

### Phase 4: Dashboard & Alerts
```bash
# Import Grafana dashboard (manual or API)
# See DEPLOYMENT_CHECKLIST.md for detailed steps

# Load Prometheus alert rules
# See DEPLOYMENT_CHECKLIST.md for detailed steps
```

---

### Phase 5: Post-Deployment Validation
```bash
# Run validation script again
bash scripts/ops/validate-phase13-deployment.sh
```

**Expected:** All checks pass (or only minor warnings)

---

## 📊 Monitoring & Validation

### Real-Time SLO Monitoring

**Grafana Dashboard:**
- URL: http://localhost:3000/d/model-serving
- Refresh: 30 seconds
- Panels: 12 (3 SLO + 9 operational)

**Prometheus Alerts:**
- Total Rules: 13
- SLO Alerts: 6 (latency, drift, accuracy)
- Operational Alerts: 6 (errors, confidence, canary)
- Capacity Alerts: 1 (p99 latency)

### SQL-Based SLO Check

```sql
-- Check SLO compliance for a model
SELECT * FROM check_model_slo_compliance(
  'model-uuid-here'::UUID,
  1 -- last 1 hour
);
```

**Expected Output:**
```
 slo_name      | current_value | threshold | compliant | severity
---------------+---------------+-----------+-----------+----------
 p95_latency   |          120  |       150 | t         | ok
 max_drift_score|         0.03 |      0.05 | t         | ok
```

---

## 🔧 Troubleshooting

### Issue: Migration Fails

**Symptom:** SQL errors during migration  
**Cause:** Missing dependencies (tenants, predictive_models, picks, props tables)  
**Solution:**
```bash
# Verify dependencies exist
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -c \"
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('tenants', 'predictive_models', 'picks', 'props');
  \"
"
```

---

### Issue: Metrics Endpoint Not Responding

**Symptom:** `curl http://localhost:9464/metrics` fails  
**Cause:** Metrics server not started or port conflict  
**Solution:**
```bash
# Check API logs
docker-compose logs api | grep -i "metrics"

# Verify port not in use
netstat -an | grep 9464

# Restart API service
docker-compose restart api
```

---

### Issue: Dashboard Panels Show "No Data"

**Symptom:** Grafana panels empty  
**Cause:** No predictions recorded yet or Prometheus not scraping  
**Solution:**
```bash
# Verify Prometheus is scraping metrics
curl http://localhost:9090/api/v1/targets | grep model_serving

# Generate test prediction (if integrated)
# See integration documentation
```

---

## 📚 Related Documentation

### Repository Files
- **Migration:** `supabase/migrations/20251101_phase13_serving.sql`
- **Metrics:** `apps/api/src/monitoring/ModelServingMetrics.ts`
- **Dashboard:** `infrastructure/dashboards/model-serving-dashboard.json`
- **Alerts:** `infrastructure/monitoring/prometheus-rules-model-serving.yaml`
- **Validation:** `scripts/ops/validate-phase13-deployment.sh`

### Charter Documents
- **Production Charter:** `docs/PRODUCTION_CHARTER.md`
- **System Alignment:** `docs/SYSTEM_ALIGNMENT_SPEC.yml`

### Related Phases
- **Phase 11:** Analytics & Scoring Infrastructure
- **Phase 12:** AI Assist & Observability
- **Phase 14:** Partner API (if applicable)

---

## ✅ Success Criteria

### Deployment Complete When:
- [x] All artifacts created
- [ ] Migration applied successfully
- [ ] Tables and indexes created
- [ ] Metrics server running on port 9464
- [ ] Dashboard imported to Grafana
- [ ] Alert rules loaded in Prometheus
- [ ] Validation script passes all checks
- [ ] SLO monitoring active

### Production Ready When:
- [ ] Baseline metrics established (1 week of data)
- [ ] Alert thresholds tuned
- [ ] Runbooks documented
- [ ] Team trained on dashboards
- [ ] On-call integration complete
- [ ] Canary deployment tested

---

## 🔐 Security & Compliance

### Charter v4.0 Compliance ✅
- Idempotent migrations
- PostgREST schema reload
- SLO-based monitoring
- Continuous evaluation
- Drift detection
- Canary support

### Data Privacy
- No PII in metrics labels
- Aggregated data only in dashboards
- Secure database connections
- Masked credentials in logs

---

## 📞 Support

### Issues or Questions?
1. Check DEPLOYMENT_CHECKLIST.md for detailed procedures
2. Review validation logs in this directory
3. Consult MODEL_SERVING_ATTESTATION_2025-11-01.md for specifications
4. Run validation script for diagnostic information

### Escalation
- **Technical Issues:** Review logs and validation output
- **Charter Compliance:** Refer to docs/PRODUCTION_CHARTER.md
- **SLO Violations:** Check alert runbooks (when created)

---

**Last Updated:** 2025-11-01  
**Maintained By:** Engineering Team  
**Charter Version:** v4.0

---

**END OF README**

