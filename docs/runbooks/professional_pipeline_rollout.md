# Professional Pipeline Rollout Runbook

**Document Version**: 1.0.0
**Last Updated**: 2025-01-29
**Owner**: Platform Engineering Team

---

## Overview

This runbook provides step-by-step instructions for safely deploying the new modular Professional Pipeline (Phase 2) to production environments. The new pipeline replaces the legacy monolithic professional grading system with 8 standalone, testable, and Temporal-ready feature modules.

**Key Benefits**:
- **Modularity**: 8 independent features for easier testing and maintenance
- **Observability**: 11 Prometheus metrics for comprehensive monitoring
- **Temporal-Ready**: Architecture prepared for Phase 3 workflow orchestration
- **Feature Flag Safety**: Zero-risk rollout with instant rollback capability

**Rollout Strategy**: Progressive feature flag rollout with comprehensive validation at each stage.

---

## Feature Flag Configuration

### Environment Variable

The professional pipeline is controlled by a single feature flag:

```bash
USE_NEW_PROFESSIONAL_PIPELINE=true   # Enable new modular pipeline
USE_NEW_PROFESSIONAL_PIPELINE=false  # Use legacy grading engine (default)
```

### How to Enable/Disable

#### Development Environment

**Enable**:
```bash
# In .env or .env.local
echo "USE_NEW_PROFESSIONAL_PIPELINE=true" >> .env

# Restart API service
docker-compose restart api
```

**Disable**:
```bash
# In .env or .env.local
echo "USE_NEW_PROFESSIONAL_PIPELINE=false" >> .env

# Restart API service
docker-compose restart api
```

#### Staging Environment

**Enable**:
```bash
# Update environment configuration
export USE_NEW_PROFESSIONAL_PIPELINE=true

# Redeploy API service
kubectl rollout restart deployment/api -n staging
```

**Disable**:
```bash
export USE_NEW_PROFESSIONAL_PIPELINE=false
kubectl rollout restart deployment/api -n staging
```

#### Production Environment

**Enable** (Canary Deployment):
```bash
# Update ConfigMap or Secret
kubectl edit configmap api-config -n production
# Add: USE_NEW_PROFESSIONAL_PIPELINE: "true"

# Rolling update deployment
kubectl rollout restart deployment/api -n production
kubectl rollout status deployment/api -n production
```

**Disable** (Emergency Rollback):
```bash
# Update ConfigMap or Secret
kubectl edit configmap api-config -n production
# Change to: USE_NEW_PROFESSIONAL_PIPELINE: "false"

# Immediate restart
kubectl rollout restart deployment/api -n production
```

---

## Rollout Stages

### Stage 1: Development/Test Environment

**Objective**: Validate new pipeline functionality and performance with realistic data.

**Duration**: 2-3 days

**Steps**:

1. **Enable Feature Flag**:
   ```bash
   echo "USE_NEW_PROFESSIONAL_PIPELINE=true" >> .env
   docker-compose restart api
   ```

2. **Verify Service Startup**:
   ```bash
   # Check logs for initialization message
   docker-compose logs api | grep "Professional pipeline initialized"

   # Expected output:
   # Professional pipeline initialized with new modular architecture
   # featureFlag: useNewProfessionalPipeline, enabled: true, featureCount: 8
   ```

3. **Run Unit Tests**:
   ```bash
   docker-compose exec api npm test -- professional

   # Expected: All tests pass (27/27)
   ```

4. **Run Integration Tests**:
   ```bash
   docker-compose exec api npm run test:integration -- ProfessionalPipeline

   # Expected: Full pipeline execution with all 8 features
   ```

5. **Process Test Props**:
   ```bash
   # Process today's props through professional system
   docker-compose exec api npx tsx src/runner/processProfessionalProps.ts

   # Monitor processing stats
   docker-compose exec api npx tsx src/runner/processProfessionalProps.ts --stats
   ```

6. **Run Comparison Script** (See "Comparison Script Usage" section):
   ```bash
   docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts

   # Review score differences between old and new pipelines
   ```

**Success Criteria**:
- ✅ All unit tests pass (27/27)
- ✅ Integration tests complete successfully
- ✅ Comparison script shows <5% score variance on average
- ✅ No errors in application logs
- ✅ Professional metrics appear in /metrics endpoint

**Verification Checklist**:
- [ ] Feature flag enabled and logged on startup
- [ ] All 8 features initialized successfully
- [ ] Unit tests: 27/27 passing
- [ ] Integration tests: Pipeline executes all features
- [ ] Comparison script: <5% average score difference
- [ ] Prometheus metrics: All 11 metrics reporting
- [ ] No ERROR logs related to professional pipeline

---

### Stage 2: Staging Environment

**Objective**: Validate performance, metrics, and behavior with production-like data volume.

**Duration**: 3-5 days

**Steps**:

1. **Enable Feature Flag**:
   ```bash
   export USE_NEW_PROFESSIONAL_PIPELINE=true
   kubectl rollout restart deployment/api -n staging
   ```

2. **Monitor Service Health**:
   ```bash
   # Check deployment status
   kubectl rollout status deployment/api -n staging

   # Check pod logs
   kubectl logs -f deployment/api -n staging | grep "Professional"
   ```

3. **Verify Metrics Collection**:
   ```bash
   # Query Prometheus for professional metrics
   curl http://prometheus.staging:9090/api/v1/query?query=professional_pipeline_duration_seconds

   # Check Grafana dashboard: "Professional Pipeline Monitoring"
   ```

4. **Load Testing**:
   ```bash
   # Run load test with realistic prop volume
   docker-compose exec api npm run qa:performance -- professional

   # Target: 1,500+ props/hour processing rate
   ```

5. **Compare Legacy vs New Pipeline Performance**:
   ```bash
   # Run side-by-side comparison on 1000 historical props
   docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts --limit=1000
   ```

**Success Criteria**:
- ✅ Processing time: <2 seconds per prop (p95)
- ✅ Score variance: <5% average difference vs legacy
- ✅ Error rate: <0.1% (target: 0%)
- ✅ All 11 Prometheus metrics reporting correctly
- ✅ No performance degradation vs legacy system

**Key Metrics to Monitor**:

**Feature-Level Metrics**:
```promql
# Average execution time per feature
rate(professional_feature_duration_seconds_sum[5m]) / rate(professional_feature_duration_seconds_count[5m])

# Feature score distribution (should match historical patterns)
histogram_quantile(0.95, professional_feature_score_bucket)

# Feature error rate (should be 0%)
rate(professional_feature_error_total[5m])

# Feature skip rate (check for data availability issues)
rate(professional_feature_skipped_total[5m])
```

**Pipeline-Level Metrics**:
```promql
# Total pipeline duration (target: p95 < 2 seconds)
histogram_quantile(0.95, professional_pipeline_duration_seconds_bucket)

# Composite score distribution (should match legacy distribution)
histogram_quantile(0.50, professional_pipeline_composite_score_bucket)

# Features executed per run (should be 8 for all props)
avg(professional_pipeline_features_executed)

# Pipeline error rate (should be 0%)
rate(professional_pipeline_error_total[5m])
```

**Integration Metrics**:
```promql
# CLV data availability (target: >90%)
professional_clv_available_total{has_clv="true"} / professional_clv_available_total

# Canonical ID usage (target: 100%)
professional_canonical_usage_total{has_canonical="true"} / professional_canonical_usage_total
```

**Verification Checklist**:
- [ ] Deployment successful in staging
- [ ] All pods healthy and running
- [ ] Processing time p95 < 2 seconds
- [ ] Score variance < 5% on 1000 prop sample
- [ ] Error rate < 0.1%
- [ ] All 11 metrics reporting in Prometheus
- [ ] Grafana dashboard showing healthy metrics
- [ ] No memory leaks or resource exhaustion
- [ ] CLV data available for >90% of props
- [ ] Canonical IDs used for 100% of props

---

### Stage 3: Production Canary (10% Traffic)

**Objective**: Validate production behavior with limited risk exposure.

**Duration**: 2-3 days

**Steps**:

1. **Deploy Canary**:
   ```bash
   # Update deployment with canary annotation
   kubectl patch deployment api -n production \
     --type=json -p='[{"op": "add", "path": "/spec/template/metadata/annotations/canary", "value": "10"}]'

   # Apply feature flag to canary pods only
   kubectl set env deployment/api USE_NEW_PROFESSIONAL_PIPELINE=true -n production
   ```

2. **Monitor Canary Health**:
   ```bash
   # Watch canary metrics
   kubectl top pods -n production -l app=api,canary=true

   # Compare error rates
   kubectl logs -f deployment/api -n production | grep -E "(ERROR|WARN)"
   ```

3. **Compare Canary vs Baseline**:
   ```bash
   # Use Grafana to compare:
   # - Processing time: Canary vs Baseline
   # - Error rate: Canary vs Baseline
   # - Score distribution: Canary vs Baseline
   ```

4. **Collect User Feedback**:
   - Monitor Discord for any user-reported issues
   - Check Sentry/error tracking for new error patterns
   - Review professional grading results for anomalies

**Success Criteria**:
- ✅ Canary error rate ≤ baseline error rate
- ✅ Canary processing time ≤ baseline processing time
- ✅ No user-reported issues related to grading quality
- ✅ Score distribution matches historical patterns
- ✅ All professional metrics healthy

**Verification Checklist**:
- [ ] Canary deployment successful (10% traffic)
- [ ] Error rate: Canary ≤ Baseline
- [ ] Processing time: Canary ≤ Baseline
- [ ] Score distribution: Matches historical (±5%)
- [ ] No user complaints about grading quality
- [ ] All metrics healthy in Prometheus/Grafana
- [ ] No new errors in Sentry

---

### Stage 4: Production Full Rollout (100% Traffic)

**Objective**: Complete migration to new professional pipeline.

**Duration**: 1 week monitoring period

**Steps**:

1. **Full Rollout**:
   ```bash
   # Enable for all production pods
   kubectl set env deployment/api USE_NEW_PROFESSIONAL_PIPELINE=true -n production

   # Rolling update
   kubectl rollout restart deployment/api -n production
   kubectl rollout status deployment/api -n production
   ```

2. **Intensive Monitoring** (First 24 Hours):
   ```bash
   # Watch all professional pipeline logs
   kubectl logs -f deployment/api -n production | grep "professional"

   # Monitor error rate every 5 minutes
   watch -n 300 'kubectl logs deployment/api -n production | grep -c ERROR'
   ```

3. **Daily Health Checks** (First Week):
   - Review Grafana dashboard: "Professional Pipeline Monitoring"
   - Check Sentry for new error patterns
   - Compare daily processing stats vs previous week
   - Monitor Discord for user feedback

4. **Performance Validation**:
   ```bash
   # Run weekly comparison script
   docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts --limit=10000

   # Analyze results for any drift
   ```

**Success Criteria**:
- ✅ Error rate < 0.5% (target: 0%)
- ✅ Processing time p95 < 2 seconds
- ✅ Score variance < 5% vs legacy baseline
- ✅ All professional metrics healthy
- ✅ User satisfaction maintained or improved

**Verification Checklist**:
- [ ] Full rollout completed successfully
- [ ] All production pods using new pipeline
- [ ] Error rate < 0.5%
- [ ] Processing time p95 < 2 seconds
- [ ] Score distribution stable
- [ ] No user complaints
- [ ] All metrics healthy
- [ ] Weekly comparison shows consistent results

---

## Metrics to Watch

### Critical Metrics (Monitor Every 5 Minutes)

**1. Pipeline Error Rate**:
```promql
# Should be 0% - any errors require immediate investigation
rate(professional_pipeline_error_total[5m])
```

**Alert Threshold**: > 0.1%
**Action**: Investigate logs immediately, consider rollback if sustained

**2. Processing Duration (p95)**:
```promql
# Should be < 2 seconds for 95th percentile
histogram_quantile(0.95, professional_pipeline_duration_seconds_bucket)
```

**Alert Threshold**: > 3 seconds
**Action**: Check for resource constraints or slow features

**3. Features Executed per Prop**:
```promql
# Should consistently be 8 (all features)
avg(professional_pipeline_features_executed)
```

**Alert Threshold**: < 7
**Action**: Investigate why features are being skipped

### Important Metrics (Monitor Every 15 Minutes)

**4. Feature Skip Rate**:
```promql
# Should be < 5% - indicates data availability issues
rate(professional_feature_skipped_total[15m])
```

**Alert Threshold**: > 10%
**Action**: Check data pipeline health (CLV, market data, etc.)

**5. Composite Score Distribution**:
```promql
# Should match historical distribution (bell curve centered ~0.5)
histogram_quantile(0.50, professional_pipeline_composite_score_bucket)
```

**Alert Threshold**: Median outside 0.4-0.6 range
**Action**: Run comparison script to identify scoring drift

**6. CLV Data Availability**:
```promql
# Should be > 90%
professional_clv_available_total{has_clv="true"} / professional_clv_available_total
```

**Alert Threshold**: < 80%
**Action**: Check CLV tracking service health

### Informational Metrics (Monitor Hourly)

**7. Per-Feature Duration**:
```promql
# Identify slow features
topk(3, avg(professional_feature_duration_seconds) by (feature_id))
```

**8. Per-Feature Confidence**:
```promql
# Monitor confidence levels
avg(professional_feature_confidence) by (feature_id)
```

**9. Canonical ID Usage**:
```promql
# Should be 100% for production
professional_canonical_usage_total{has_canonical="true"} / professional_canonical_usage_total
```

---

## How to Spot Regressions

### Scoring Regressions

**Symptom**: Tier distribution changes significantly
```promql
# Compare tier distribution before/after rollout
rate(professional_pipeline_composite_score_bucket{le="0.2"}[1h])  # D/C tiers
rate(professional_pipeline_composite_score_bucket{le="0.4"}[1h])  # C tier
rate(professional_pipeline_composite_score_bucket{le="0.6"}[1h])  # B tier
rate(professional_pipeline_composite_score_bucket{le="0.8"}[1h])  # A tier
rate(professional_pipeline_composite_score_bucket{le="1.0"}[1h])  # S tier
```

**Expected Distribution** (based on historical data):
- S tier (0.8-1.0): ~5%
- A tier (0.6-0.8): ~15%
- B tier (0.4-0.6): ~50%
- C tier (0.2-0.4): ~20%
- D tier (0.0-0.2): ~10%

**Action**: If distribution shifts > 10% in any tier, run comparison script and investigate

### Performance Regressions

**Symptom**: Processing time increases
```promql
# Compare p95 processing time before/after
histogram_quantile(0.95, professional_pipeline_duration_seconds_bucket)
```

**Expected**: p95 < 2 seconds
**Action**: If p95 > 3 seconds, check:
- Resource constraints (CPU, memory)
- Slow features (check per-feature duration metrics)
- Database query performance
- External API latency

### Data Quality Regressions

**Symptom**: Feature skip rate increases
```promql
# Monitor skip rate by feature
rate(professional_feature_skipped_total[5m]) by (feature_id)
```

**Action**: If skip rate > 10% for any feature:
- Check data pipeline health
- Verify market data availability
- Check CLV tracking service
- Review logs for data validation errors

### User-Reported Issues

**Indicators**:
- Increase in Discord complaints about pick quality
- Sentry errors related to professional grading
- Support tickets mentioning "scoring" or "tier"

**Action**:
- Review specific props mentioned by users
- Run comparison script on those props
- Check if issue affects specific leagues/stat types
- Consider temporary rollback if widespread

---

## Quick Rollback Procedure

### When to Roll Back

Rollback immediately if:
- ❌ Error rate > 1% sustained for 5+ minutes
- ❌ Processing time p95 > 5 seconds sustained
- ❌ Widespread user complaints about grading quality
- ❌ Tier distribution shifts > 20% in any tier
- ❌ Critical features consistently skipped (< 6 features executed)

### Rollback Steps

**Development/Staging**:
```bash
# 1. Disable feature flag
echo "USE_NEW_PROFESSIONAL_PIPELINE=false" >> .env

# 2. Restart service
docker-compose restart api

# 3. Verify rollback
docker-compose logs api | grep "Using legacy professional grading engine"
```

**Production** (Emergency - <5 minutes):
```bash
# 1. Immediate rollback via ConfigMap
kubectl edit configmap api-config -n production
# Change: USE_NEW_PROFESSIONAL_PIPELINE: "false"

# 2. Force rolling restart
kubectl rollout restart deployment/api -n production

# 3. Monitor rollback status
kubectl rollout status deployment/api -n production

# 4. Verify legacy system is active
kubectl logs deployment/api -n production | grep "legacy professional grading"

# 5. Check error rate returns to baseline
watch -n 30 'kubectl logs deployment/api -n production | grep -c ERROR'
```

**Post-Rollback**:
1. Document the issue that triggered rollback
2. Collect diagnostic data (logs, metrics, props that failed)
3. Create incident report
4. Fix root cause before re-attempting rollout
5. Run comparison script to identify differences
6. Add regression test for the failure scenario

---

## Comparison Script Usage

The comparison script validates scoring consistency between old and new pipelines.

### Running the Script

**Basic Usage**:
```bash
# Compare on 100 random historical props
docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts

# Compare on specific number of props
docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts --limit=1000

# Compare on specific date range
docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts \
  --start-date=2025-01-01 \
  --end-date=2025-01-29

# Compare specific league
docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts --league=NFL
```

### Interpreting Results

**Sample Output**:
```
Professional Pipeline Comparison Report
========================================

Props Analyzed: 1000
Date Range: 2025-01-01 to 2025-01-29

Score Variance:
  Average Difference: 2.3%
  Max Difference: 8.7% (prop_id: abc123)
  Min Difference: 0.1%
  Std Deviation: 1.8%

Tier Distribution Comparison:
  S Tier: Old: 5.2% | New: 5.0% | Diff: -0.2%
  A Tier: Old: 14.8% | New: 15.2% | Diff: +0.4%
  B Tier: Old: 50.1% | New: 49.8% | Diff: -0.3%
  C Tier: Old: 20.0% | New: 20.5% | Diff: +0.5%
  D Tier: Old: 9.9% | New: 9.5% | Diff: -0.4%

Feature-Specific Differences:
  Steam Detection: 98.5% agreement
  CLV Prediction: 99.2% agreement
  Public vs Sharp: 97.8% agreement
  Optimal Timing: 99.5% agreement
  Line Shopping: 98.9% agreement
  Market Timing: 99.1% agreement
  Injury Timing: 97.3% agreement
  Cross Market: 99.0% agreement

Outliers (>10% score difference): 12 props
  [List of prop IDs with significant differences]

RESULT: ✅ PASS - Score variance within acceptable range (<5% average)
```

**Interpretation Guide**:

**✅ Acceptable Variance** (No Action Needed):
- Average score difference < 5%
- Tier distribution differences < 2% per tier
- Feature agreement > 95%
- Outliers < 2% of total props

**⚠️ Review Recommended** (Investigate But Don't Block):
- Average score difference 5-10%
- Tier distribution differences 2-5% per tier
- Feature agreement 90-95%
- Outliers 2-5% of total props

**❌ Blocking Issue** (Do Not Rollout):
- Average score difference > 10%
- Tier distribution differences > 5% per tier
- Feature agreement < 90%
- Outliers > 5% of total props

**Action Items for Outliers**:
1. Review specific props with large differences
2. Check if differences are legitimate improvements (e.g., better CLV data)
3. Verify all features executed successfully for outlier props
4. Check for edge cases in legacy system that new system handles better
5. Document any intentional scoring changes

---

## Troubleshooting Guide

### Issue: Feature Flag Not Taking Effect

**Symptoms**:
- Logs show "Using legacy professional grading engine" despite flag set to true
- New metrics not appearing in /metrics endpoint

**Diagnosis**:
```bash
# Check environment variable
docker-compose exec api env | grep USE_NEW_PROFESSIONAL_PIPELINE

# Check config loading
docker-compose exec api npx tsx -e "console.log(require('./src/config').apiConfig.features)"
```

**Solution**:
1. Verify environment variable is set correctly
2. Restart service: `docker-compose restart api`
3. Check for typos in variable name
4. Ensure .env file is loaded by docker-compose

### Issue: High Feature Skip Rate

**Symptoms**:
- `professional_feature_skipped_total` increasing rapidly
- `professional_pipeline_features_executed` < 8

**Diagnosis**:
```bash
# Check which features are being skipped
docker-compose logs api | grep "Feature skipped"

# Check data availability in context
docker-compose logs api | grep "canCalculate.*false"
```

**Solution**:
1. Check market data pipeline health
2. Verify CLV tracking service is operational
3. Review `canCalculate()` conditions for skipped features
4. Ensure canonical IDs are populated in raw_props

### Issue: Processing Time Degradation

**Symptoms**:
- p95 processing time > 3 seconds
- API response times increasing

**Diagnosis**:
```bash
# Check per-feature durations
curl http://localhost:9090/api/v1/query?query=topk(5,professional_feature_duration_seconds)

# Check database query performance
docker-compose logs api | grep "DB query"
```

**Solution**:
1. Identify slow features from metrics
2. Optimize slow database queries
3. Add caching for frequently accessed data
4. Consider parallel feature execution (already supported)
5. Check for external API latency issues

### Issue: Score Distribution Drift

**Symptoms**:
- Tier distribution changes significantly
- User complaints about pick quality

**Diagnosis**:
```bash
# Run comparison script on recent props
docker-compose exec api npx tsx scripts/compare_professional_pipelines.ts --limit=500

# Check composite score distribution
curl http://localhost:9090/api/v1/query?query=professional_pipeline_composite_score_bucket
```

**Solution**:
1. Review comparison script output for patterns
2. Check if feature weights need adjustment
3. Verify CLV data quality
4. Review recent changes to grading features
5. Consider if scoring improvement is intentional

---

## Success Metrics & KPIs

### Technical KPIs

**Performance**:
- Processing time p95: < 2 seconds ✅
- Processing time p99: < 3 seconds ✅
- Throughput: > 1,500 props/hour ✅

**Reliability**:
- Error rate: < 0.5% (target: 0%) ✅
- Feature skip rate: < 5% ✅
- Uptime: 99.9% ✅

**Data Quality**:
- CLV data availability: > 90% ✅
- Canonical ID usage: 100% ✅
- All 8 features executed: > 95% of props ✅

### Business KPIs

**Grading Quality**:
- Score variance vs legacy: < 5% average ✅
- Tier distribution stable: ±2% per tier ✅
- User satisfaction: No significant complaints ✅

**Observability**:
- All 11 metrics reporting: 100% ✅
- Grafana dashboard operational: ✅
- Alerting configured and tested: ✅

---

## Post-Rollout Cleanup

**After 2 weeks of stable production operation**:

1. **Archive Legacy Code**:
   ```bash
   # Move legacy grading engine to archive
   git mv src/agents/GradingAgent/scoring/SyndicateGradingEngine.ts \
          archive/legacy/SyndicateGradingEngine.ts

   # Remove feature flag check
   # Update ProfessionalPropProcessor to always use new pipeline
   ```

2. **Remove Feature Flag**:
   - Remove `USE_NEW_PROFESSIONAL_PIPELINE` from config
   - Remove conditional logic in ProfessionalPropProcessor
   - Update documentation to reflect new pipeline as standard

3. **Update Documentation**:
   - Mark Phase 2 Step 3 as complete
   - Archive this runbook as historical reference
   - Update API documentation with new pipeline details

4. **Metrics Cleanup**:
   - Remove legacy grading metrics if any
   - Consolidate Grafana dashboards
   - Archive comparison scripts

---

## Support & Escalation

### Contact Information

**Primary Contact**: Platform Engineering Team
**Escalation**: CTO / Engineering Lead

### Emergency Procedures

**Critical Issues** (Error rate > 1%, widespread outages):
1. Immediately rollback using emergency procedure above
2. Page on-call engineer
3. Create incident report
4. Assemble war room for root cause analysis

**Non-Critical Issues** (Score drift, performance degradation):
1. Document issue in GitHub
2. Run comparison script for diagnostics
3. Schedule investigation during business hours
4. Consider temporary rollback if user impact significant

---

## Appendix A: Metric Reference

### Complete Metric List

**Feature-Level Metrics** (5):
1. `professional_feature_duration_seconds` - Histogram of execution time per feature
2. `professional_feature_score` - Histogram of score distribution per feature
3. `professional_feature_confidence` - Histogram of confidence levels per feature
4. `professional_feature_error_total` - Counter of errors per feature
5. `professional_feature_skipped_total` - Counter of skips with reasons per feature

**Pipeline-Level Metrics** (4):
6. `professional_pipeline_duration_seconds` - Histogram of total pipeline execution time
7. `professional_pipeline_composite_score` - Histogram of final composite scores
8. `professional_pipeline_features_executed` - Histogram of features executed per run
9. `professional_pipeline_error_total` - Counter of pipeline-level errors

**Integration Metrics** (2):
10. `professional_clv_available_total` - Counter of CLV data availability
11. `professional_canonical_usage_total` - Counter of canonical ID usage

### Grafana Dashboard Queries

**Pipeline Health Overview**:
```promql
# Processing rate
rate(professional_pipeline_duration_seconds_count[5m])

# Error rate
rate(professional_pipeline_error_total[5m])

# Average duration
rate(professional_pipeline_duration_seconds_sum[5m]) / rate(professional_pipeline_duration_seconds_count[5m])
```

**Feature Performance**:
```promql
# Slowest features
topk(3, avg(professional_feature_duration_seconds) by (feature_id))

# Most skipped features
topk(3, rate(professional_feature_skipped_total[5m]) by (feature_id))

# Feature error distribution
sum(professional_feature_error_total) by (feature_id)
```

---

## Appendix B: Rollout Checklist

### Pre-Rollout Checklist

- [ ] All unit tests passing (27/27)
- [ ] Integration tests passing
- [ ] Comparison script shows < 5% variance
- [ ] Grafana dashboard configured
- [ ] Alerts configured in Prometheus/PagerDuty
- [ ] Rollback procedure tested in staging
- [ ] Documentation reviewed and updated
- [ ] Stakeholders notified of rollout schedule
- [ ] On-call engineer assigned for rollout window

### Stage 1: Development
- [ ] Feature flag enabled
- [ ] Service startup verified
- [ ] Unit tests: 27/27 passing
- [ ] Integration tests successful
- [ ] Comparison script < 5% variance
- [ ] Metrics reporting in /metrics
- [ ] No errors in logs

### Stage 2: Staging
- [ ] Feature flag enabled in staging
- [ ] All pods healthy
- [ ] Processing time p95 < 2 seconds
- [ ] Load test: 1,500+ props/hour
- [ ] Comparison script on 1000 props < 5% variance
- [ ] All 11 metrics in Prometheus
- [ ] Grafana dashboard healthy
- [ ] CLV availability > 90%
- [ ] Canonical ID usage 100%

### Stage 3: Production Canary (10%)
- [ ] Canary deployment successful
- [ ] Error rate: Canary ≤ Baseline
- [ ] Processing time: Canary ≤ Baseline
- [ ] Score distribution matches historical
- [ ] No user complaints
- [ ] Metrics healthy

### Stage 4: Production Full Rollout
- [ ] Full rollout completed
- [ ] All pods using new pipeline
- [ ] Error rate < 0.5%
- [ ] Processing time p95 < 2 seconds
- [ ] Score distribution stable
- [ ] Weekly comparison consistent
- [ ] User satisfaction maintained

### Post-Rollout (After 2 Weeks)
- [ ] Legacy code archived
- [ ] Feature flag removed
- [ ] Documentation updated
- [ ] Metrics consolidated
- [ ] Runbook archived

---

**Document End**

For questions or issues, contact Platform Engineering Team.
