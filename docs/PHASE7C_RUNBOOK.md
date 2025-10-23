# Phase 7C ML Retraining & Lifecycle Automation - Runbook

## Overview

Phase 7C implements autonomous ML model lifecycle management for the Unit Talk platform, providing:

- **Automated Retraining**: Weekly schedules and drift-triggered retraining
- **Model Registry**: Lightweight governance and versioning system  
- **A/B Testing**: Statistical model comparison and promotion logic
- **Canary Deployment**: Progressive rollout with automatic rollback
- **Lifecycle Management**: Full model versioning, approval, and archival

## Architecture Components

### 1. Automated Retraining Pipeline

**Trigger Mechanisms:**
- **Weekly Schedule**: Every Sunday at 2 AM UTC
- **Drift Detection**: When feature drift exceeds 0.5% threshold
- **Manual Trigger**: Via GitHub Actions workflow dispatch

**Workflow Steps:**
1. **Drift Analysis**: Compare last 30 days vs 90-day reference period
2. **Data Ingestion**: Pull latest labeled data from Supabase
3. **Training Pipeline**: Optuna hyperparameter tuning (100 trials)
4. **Model Evaluation**: A/B test against production model
5. **Registry Update**: Register and promote qualified models

### 2. Model Registry System

**Registry Structure:**
```
ml/registry/
├── manifest.json           # Central registry manifest
└── models/                 # Model artifacts storage
    ├── model_v20251023.pkl
    └── model_v20251023.json
```

**Governance Rules:**
- **Approval Required**: Models must meet performance criteria
- **Promotion Criteria**: AUC ≥ prod - 0.5%, ROI ≥ prod - 2%
- **Retention Policy**: Keep 10 archived models, 90-day retention

### 3. Deployment Pipeline

**Deployment Stages:**
1. **Shadow Mode**: 0% traffic, 100% logging for validation
2. **Canary Stage 1**: 5% traffic for 30 minutes
3. **Canary Stage 2**: 25% traffic for 30 minutes  
4. **Canary Stage 3**: 50% traffic for 30 minutes
5. **Production**: 100% traffic with monitoring

**SLO Thresholds:**
- Latency: P95 < 20ms
- Error Rate: < 1%
- Accuracy: ≥ 85%

## Operations Guide

### Monitoring Retraining Pipeline

#### Check Drift Status
```bash
# View latest drift analysis
cat ml/reports/drift_analysis_*.json | jq '.max_drift_score'

# Check retraining recommendations
cat ml/reports/drift_analysis_*.json | jq '.recommendation'
```

#### Monitor Training Progress
```bash
# Check GitHub Actions status
gh run list --workflow="ml-retrain.yml" --limit=5

# View specific run details
gh run view <run-id> --log
```

#### Registry Operations
```bash
# View current production model
cat ml/registry/manifest.json | jq '.production_model.version'

# List all models
cat ml/registry/manifest.json | jq '.models[].version'

# Check model approval status
cat ml/registry/manifest.json | jq '.models[] | select(.approval_status=="pending")'
```

### Manual Operations

#### Trigger Manual Retraining
```bash
# Force retraining regardless of drift
gh workflow run ml-retrain.yml \
  -f force_retrain=true \
  -f drift_threshold=0.001

# Custom drift threshold
gh workflow run ml-retrain.yml \
  -f drift_threshold=0.01
```

#### Manual Model Promotion
```bash
# Promote specific model version
gh workflow run ml-promotion.yml \
  -f model_version=v20251023_142030 \
  -f deployment_mode=production

# Deploy in canary mode
gh workflow run ml-promotion.yml \
  -f model_version=v20251023_142030 \
  -f deployment_mode=canary
```

#### Emergency Rollback
```bash
# Rollback to previous version
gh workflow run ml-promotion.yml \
  -f deployment_mode=rollback

# Rollback to specific version
gh workflow run ml-promotion.yml \
  -f deployment_mode=rollback \
  -f rollback_version=v20251020_090145
```

### Registry Management

#### Model Registry CLI Commands
```python
# Register new model manually
python ml/scripts/model_registry.py register \
  --model-path=/path/to/model.pkl \
  --metadata-file=/path/to/metadata.json

# Approve pending model
python ml/scripts/model_registry.py approve \
  --version=v20251023_142030 \
  --approved-by="operator-name"

# Promote to production
python ml/scripts/model_registry.py promote \
  --version=v20251023_142030

# Cleanup old models
python ml/scripts/model_registry.py cleanup
```

#### Registry Inspection
```python
# Get registry statistics
python -c "
from ml.scripts.model_registry import ModelRegistry
registry = ModelRegistry()
print(registry.get_registry_stats())
"

# List models by status
python -c "
from ml.scripts.model_registry import ModelRegistry
registry = ModelRegistry()
approved_models = registry.list_models('approved')
print([m['version'] for m in approved_models])
"
```

## Troubleshooting

### Common Issues

#### 1. Retraining Pipeline Failures

**Symptom**: GitHub Actions workflow fails
```bash
# Check workflow logs
gh run view <run-id> --log

# Common causes:
# - Insufficient data volume
# - Data quality issues
# - Supabase connection problems
# - Resource limits
```

**Resolution**:
```bash
# Check data availability
python -c "
from ml.pipeline.dataset_builder import DatasetBuilder
builder = DatasetBuilder()
dataset = builder.check_data_availability()
print(f'Available samples: {len(dataset)}')
"

# Test Supabase connectivity
python -c "
import os
from supabase import create_client
client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_ANON_KEY'])
result = client.table('unified_picks').select('count').execute()
print(f'Connection successful: {result}')
"
```

#### 2. Model Loading Failures

**Symptom**: OnlineScoringService fails to load model
```bash
# Check service logs
docker-compose logs api | grep "OnlineScoringService"

# Verify registry integrity
python -c "
import json
with open('ml/registry/manifest.json') as f:
    registry = json.load(f)
    prod_model = registry.get('production_model')
    if prod_model:
        print(f'Production model: {prod_model[\"version\"]}')
        print(f'Model path: {prod_model[\"path\"]}')
        print(f'Path exists: {os.path.exists(prod_model[\"path\"])}')
"
```

**Resolution**:
```bash
# Reload model from registry
curl -X POST http://localhost:3000/api/ml/reload-model

# Manual model verification
python -c "
import pickle
import os
model_path = 'ml/registry/models/model_v20251023.pkl'
if os.path.exists(model_path):
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
        print(f'Model loaded successfully: {type(model)}')
else:
    print(f'Model file not found: {model_path}')
"
```

#### 3. Canary Deployment SLO Breaches

**Symptom**: Canary deployment fails SLO checks
```bash
# Check deployment logs
gh run view <deployment-run-id> --log

# Monitor current SLOs
curl http://localhost:3000/api/ml/health | jq '.details'
```

**Resolution**:
```bash
# Immediate rollback
gh workflow run ml-promotion.yml \
  -f deployment_mode=rollback

# Investigate performance issues
python -c "
from apps.api.src.ml.OnlineScoringService import OnlineScoringService
service = OnlineScoringService(...)
metrics = service.getMetrics()
print(f'Average latency: {metrics[\"avgLatencyMs\"]}ms')
print(f'Error rate: {metrics[\"errorCount\"] / metrics[\"totalRequests\"]}')
"
```

### Performance Optimization

#### 1. Retraining Performance
```bash
# Optimize hyperparameter tuning
# Reduce n_trials in .github/workflows/ml-retrain.yml
sed -i 's/n_trials=100/n_trials=50/' .github/workflows/ml-retrain.yml

# Parallel processing
# Update workflow to use multiple jobs
```

#### 2. Registry Performance
```bash
# Regular cleanup
python ml/scripts/model_registry.py cleanup

# Monitor registry size
python -c "
from ml.scripts.model_registry import ModelRegistry
registry = ModelRegistry()
stats = registry.get_registry_stats()
print(f'Registry size: {stats[\"registry_size_mb\"]} MB')
"
```

### Health Checks

#### System Health Verification
```bash
# End-to-end health check
python -c "
# 1. Check retraining pipeline
import requests
response = requests.get('https://api.github.com/repos/OWNER/REPO/actions/workflows/ml-retrain.yml/runs')
print(f'Last retraining status: {response.json()[\"workflow_runs\"][0][\"status\"]}')

# 2. Check registry integrity
import json
with open('ml/registry/manifest.json') as f:
    registry = json.load(f)
    print(f'Total models: {len(registry[\"models\"])}')
    print(f'Production model: {registry[\"production_model\"][\"version\"] if registry[\"production_model\"] else \"None\"}')

# 3. Check online scoring service
response = requests.get('http://localhost:3000/api/ml/health')
print(f'Scoring service health: {response.json()[\"status\"]}')
"
```

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Retraining Pipeline**:
   - Training success rate
   - Model promotion rate  
   - Feature drift scores
   - Data quality metrics

2. **Model Registry**:
   - Model approval latency
   - Registry size growth
   - Deployment success rate

3. **Online Serving**:
   - Prediction latency (P95 < 20ms)
   - Error rate (< 1%)
   - Model accuracy (≥ 85%)
   - Cache hit rate (> 80%)

### Alert Conditions

```yaml
# .github/workflows/monitoring.yml
alerts:
  - name: "High Feature Drift"
    condition: "drift_score > 0.1"
    action: "trigger_retraining"
  
  - name: "Model Promotion Failure"
    condition: "promotion_success_rate < 0.8"
    action: "notify_ml_team"
  
  - name: "Serving Latency Breach"
    condition: "p95_latency > 25ms"
    action: "trigger_rollback"
```

## Best Practices

### 1. Model Development
- Always validate models on held-out test data
- Use stratified sampling for training/test splits
- Monitor feature importance changes between versions
- Document all model changes and decisions

### 2. Deployment Safety
- Never bypass canary deployment for production
- Always test rollback procedures before deployment
- Monitor business metrics alongside technical metrics
- Keep rollback window under 2 minutes

### 3. Registry Management
- Regular cleanup of old models (automated via retention policy)
- Maintain clear model versioning and tagging
- Document approval criteria and exceptions
- Backup registry manifest before major changes

### 4. Operational Excellence
- Automate as much as possible while maintaining oversight
- Set up comprehensive monitoring and alerting
- Regular disaster recovery testing
- Keep runbooks updated with operational changes

## Support Contacts

- **ML Engineering Team**: ml-team@company.com
- **Platform Engineering**: platform-team@company.com  
- **On-Call Engineer**: +1-xxx-xxx-xxxx
- **Escalation**: engineering-manager@company.com

## Change Log

| Date | Change | Author |
|------|--------|---------|
| 2025-10-23 | Initial Phase 7C implementation | Claude Code |
| | Add automated retraining pipeline | |
| | Implement model registry system | |
| | Add canary deployment workflow | |