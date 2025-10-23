# Phase 7B – Online ML Serving & Shadow Deployment Guide

## Overview

Phase 7B implements safe production deployment of machine learning models through a comprehensive canary deployment pipeline. This guide covers the complete process from shadow mode testing to full production rollout.

## Architecture

### Components

1. **OnlineScoringService** - Real-time ML inference with <20ms P95 latency
2. **Shadow Mode Integration** - Parallel ML scoring in ScoringAgent 
3. **Canary Pipeline** - Automated rollout with monitoring
4. **Monitoring & Validation** - Comprehensive metrics and alerting

### Deployment Stages

```
Stage 1: Shadow Mode (0% traffic)
├─ Predictions logged, not published
├─ Full feature validation  
├─ Performance baseline establishment
└─ Safety verification

Stage 2: Canary (5% traffic)
├─ Gradual rollout: 1% → 2% → 5%
├─ Real-time SLO monitoring
├─ A/B testing validation
└─ Auto-rollback on violations

Stage 3: Production (100% traffic)  
├─ Gradual scale: 10% → 25% → 50% → 75% → 100%
├─ Extended monitoring periods
├─ Final validation checks
└─ Stable deployment marking
```

## Prerequisites

### Environment Setup

```bash
# Required environment variables
export ML_SHADOW_MODE_ENABLED=true
export ML_DEPLOYMENT_STAGE=stage1
export ML_MODEL_PATH=./ml/models
export ML_MAX_LATENCY_MS=20
export ML_BATCH_SIZE=10
export ML_CIRCUIT_BREAKER_THRESHOLD=5
export ML_CACHE_TTL_MS=300000

# Database configuration
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis configuration  
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=your_redis_password
```

### Database Migration

Apply the ML shadow predictions schema:

```bash
docker-compose exec api npm run db:migrate
```

This creates:
- `ml_shadow_predictions` table
- `ml_performance_metrics` materialized view
- `log_shadow_prediction()` function
- Automated triggers and policies

### Model Artifacts

Ensure trained models are available:

```bash
ml/models/
├── model-v1.0.0.json
├── model-v1.1.0.json
└── latest -> model-v1.1.0.json
```

Model artifact format:
```json
{
  "version": "v1.1.0",
  "metadata": {
    "accuracy": 0.87,
    "auc": 0.92,
    "trainingDate": "2025-10-23T00:00:00Z",
    "features": ["season_avg_points", "line_movement", "injury_status"],
    "hyperparameters": {
      "learning_rate": 0.001,
      "batch_size": 32,
      "epochs": 100
    }
  },
  "path": "./models/model-v1.1.0.pkl"
}
```

## Deployment Process

### Manual Deployment

#### Stage 1: Shadow Mode

```bash
# Deploy to shadow mode
cd scripts
npm run ml:deploy:shadow

# Or use CLI
tsx ml-canary-deploy.ts deploy \
  --stage stage1 \
  --model-version v1.1.0 \
  --monitoring-duration 300000 \
  --interactive
```

**Monitoring**:
```bash
# Monitor shadow metrics
npm run ml:monitor:shadow

# View logs
docker-compose logs -f api | grep "Shadow ML"

# Check database
psql -c "SELECT * FROM ml_shadow_predictions ORDER BY created_at DESC LIMIT 10"
```

**Success Criteria**:
- ✅ Error rate < 1%
- ✅ P95 latency < 20ms
- ✅ Predictions logged successfully
- ✅ Feature extraction working
- ✅ No critical discrepancies

#### Stage 2: Canary

```bash
# Deploy canary with 5% traffic
tsx ml-canary-deploy.ts deploy \
  --stage stage2 \
  --model-version v1.1.0 \
  --percentage 5 \
  --monitoring-duration 600000
```

**Monitoring**:
```bash
# Real-time monitoring
npm run ml:monitor:canary

# SLO validation
npm run ml:validate:slo --stage=stage2
```

**Success Criteria**:
- ✅ Error rate < 1% 
- ✅ P95 latency < 20ms
- ✅ Accuracy ≥ offline AUC - 2%
- ✅ No significant user impact
- ✅ A/B test shows improvement

#### Stage 3: Production

```bash
# Full production deployment
tsx ml-canary-deploy.ts deploy \
  --stage stage3 \
  --model-version v1.1.0 \
  --monitoring-duration 900000
```

**Monitoring**:
```bash
# Extended production monitoring
npm run ml:monitor:production

# Final validation
npm run ml:validate:production
```

**Success Criteria**:
- ✅ Error rate < 0.5%
- ✅ P95 latency < 15ms  
- ✅ Accuracy maintained
- ✅ 15-minute stability period
- ✅ No alerts triggered

### Automated Deployment (GitHub Actions)

#### Trigger Deployment

```bash
# Shadow mode
gh workflow run ml-canary.yml -f stage=stage1

# Canary  
gh workflow run ml-canary.yml -f stage=stage2

# Production
gh workflow run ml-canary.yml -f stage=stage3
```

#### Emergency Rollback

```bash
# Manual rollback
tsx ml-canary-deploy.ts rollback --force

# GitHub Actions rollback
gh workflow run ml-canary.yml -f rollback=true
```

## Monitoring & Alerting

### Key Metrics

**Performance Metrics**:
- `ml_prediction_latency_seconds` - Prediction latency histogram
- `ml_error_rate` - Prediction error rate by model/environment
- `ml_cache_hit_rate` - Cache effectiveness
- `ml_fallback_rate` - Fallback to heuristic rate

**Quality Metrics**:
- `ml_accuracy_delta` - Accuracy vs baseline
- `ml_discrepancy_rate` - ML vs heuristic discrepancies  
- `ml_drift_score` - Feature drift detection

**Deployment Metrics**:
- `ml_deployment_status` - Active deployment status
- `ml_predictions_total` - Total prediction count

### Grafana Dashboards

Import dashboard from `monitoring/grafana/ml-dashboard.json`:

**Panels**:
- Real-time prediction latency
- Error rates by deployment stage
- Shadow vs production comparison
- Feature drift visualization
- Deployment pipeline status

### Alerting Rules

**Critical Alerts**:
```yaml
- alert: MLHighErrorRate
  expr: ml_error_rate > 0.01
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "ML error rate too high: {{ $value }}"

- alert: MLHighLatency  
  expr: histogram_quantile(0.95, ml_prediction_latency_seconds) > 0.02
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "ML P95 latency too high: {{ $value }}s"

- alert: MLAccuracyDrift
  expr: abs(ml_accuracy_delta) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "ML accuracy drifting: {{ $value }}"
```

**Discord Integration**:
```bash
# Configure webhook
export DISCORD_ML_WEBHOOK=your_webhook_url

# Test alert
curl -X POST "$DISCORD_ML_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d '{
    "embeds": [{
      "title": "🚨 ML Alert Test",
      "description": "ML monitoring is active",
      "color": 15548997
    }]
  }'
```

## Troubleshooting

### Common Issues

#### 1. High Latency

**Symptoms**: P95 latency > 20ms

**Causes**:
- Model artifact too large
- Feature computation overhead
- Database connection issues
- Cache misses

**Solutions**:
```bash
# Check model size
ls -la ml/models/

# Monitor feature computation
DEBUG=feature-store npm run ml:test

# Verify cache connectivity
redis-cli ping

# Check database performance
npm run verify-slo
```

#### 2. High Error Rate

**Symptoms**: Error rate > 1%

**Causes**:
- Model compatibility issues
- Feature extraction failures
- Invalid input data
- Circuit breaker open

**Solutions**:
```bash
# Check model compatibility
npm run ml:validate:model

# Verify feature extraction
npm run ml:test:features

# Check circuit breaker state
psql -c "SELECT * FROM ml_circuit_breaker_state"

# Review error logs
docker-compose logs api | grep "ML Error"
```

#### 3. Accuracy Degradation

**Symptoms**: Accuracy delta > 2%

**Causes**:
- Feature drift
- Data quality issues
- Model staleness
- Training data mismatch

**Solutions**:
```bash
# Check feature drift
npm run ml:analyze:drift

# Validate training data
npm run ml:validate:training-data

# Compare feature distributions
npm run ml:compare:features --baseline vs --current
```

#### 4. Shadow Mode Not Working

**Symptoms**: No shadow predictions logged

**Causes**:
- Environment variables not set
- ScoringAgent not configured
- Database permissions
- Service not running

**Solutions**:
```bash
# Verify environment
env | grep ML_

# Check agent status
docker-compose exec api npm run agents:status

# Verify database access
psql -c "SELECT COUNT(*) FROM ml_shadow_predictions"

# Restart scoring agent
docker-compose restart api
```

### Recovery Procedures

#### Emergency Rollback

**Immediate Actions**:
1. Execute emergency rollback
2. Disable ML scoring
3. Verify heuristic fallback
4. Alert operations team

```bash
# 1. Emergency rollback (< 2 minutes)
tsx ml-canary-deploy.ts rollback --force

# 2. Verify rollback
npm run ml:validate:rollback

# 3. Check system health
npm run health:check

# 4. Monitor recovery
npm run ml:monitor:recovery
```

#### Partial Rollback

**Canary Issues**:
1. Reduce traffic percentage
2. Monitor stability
3. Investigate root cause
4. Fix and re-deploy

```bash
# Reduce traffic to 1%
npm run ml:set-traffic --percentage 1

# Monitor for 10 minutes
npm run ml:monitor --duration 600000

# If stable, investigate
npm run ml:debug:canary
```

### Performance Optimization

#### Latency Optimization

**Model Optimization**:
```bash
# Model compression
npm run ml:compress:model --input model-v1.1.0.json --output model-v1.1.0-compressed.json

# Feature selection
npm run ml:optimize:features --target-latency 15

# Batch optimization
npm run ml:optimize:batch-size --target-throughput 1000
```

**Cache Optimization**:
```bash
# Cache warming
npm run ml:warm-cache --features "season_avg_points,line_movement"

# Cache analysis
npm run ml:analyze-cache --duration 1h

# Redis optimization
redis-cli config set maxmemory-policy allkeys-lru
```

#### Accuracy Optimization

**Feature Engineering**:
```bash
# Feature importance analysis
npm run ml:analyze:feature-importance

# Feature drift detection
npm run ml:detect:drift --baseline 7d --current 1d

# New feature validation
npm run ml:validate:new-features --features "injury_timing,weather_impact"
```

## Best Practices

### Development

1. **Model Versioning**: Use semantic versioning for models
2. **Feature Consistency**: Maintain feature compatibility across versions
3. **Testing**: Comprehensive offline validation before deployment
4. **Documentation**: Document all model changes and features

### Deployment

1. **Shadow Mode First**: Always start with shadow mode
2. **Gradual Rollout**: Use canary percentages (1%, 2%, 5%)
3. **Monitoring**: Continuous SLO validation during rollout
4. **Rollback Ready**: Have rollback plan tested and ready

### Operations

1. **Monitoring**: 24/7 monitoring of ML metrics
2. **Alerting**: Immediate alerts for SLO violations
3. **Regular Reviews**: Weekly ML performance reviews
4. **Drift Detection**: Daily feature drift monitoring

### Security

1. **Model Protection**: Secure model artifacts
2. **Data Privacy**: Ensure feature data privacy
3. **Access Control**: Limit deployment permissions
4. **Audit Trail**: Complete deployment audit logs

## Next Steps

### Phase 7C: Advanced ML Features

1. **Multi-Model Ensemble**: Deploy multiple models simultaneously
2. **Dynamic Feature Selection**: Runtime feature optimization
3. **Online Learning**: Continuous model updates
4. **Advanced A/B Testing**: Multi-variant testing framework

### Performance Targets

- **Latency**: P95 < 10ms (50% improvement)
- **Accuracy**: +5% over baseline
- **Throughput**: 10,000 predictions/second
- **Availability**: 99.99% uptime

---

**Created**: 2025-10-23  
**Version**: 1.0.0  
**Status**: Production Ready ✅