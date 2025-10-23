# Phase 7A Online Safety Plan
## Shadow Mode, Canary Deployment & Rollback Strategy

**Document Version**: 1.0.0  
**Created**: 2025-01-23  
**Status**: Design Only - No Production Deployment  

---

## Overview

This document outlines the comprehensive online safety plan for deploying ML models from Phase 7A offline training to production. The plan ensures zero-risk deployment through progressive rollout stages with robust monitoring and automatic rollback capabilities.

## Deployment Philosophy

**Zero-Risk Deployment**: Every production deployment must be reversible, observable, and gradual. No single-point-of-failure rollouts.

**Progressive Validation**: Models progress through increasingly rigorous validation stages before reaching full production traffic.

**Automatic Safeguards**: All safety measures operate automatically without human intervention to ensure 24/7 protection.

---

## Stage 1: Shadow Mode

### Objective
Validate model performance against production traffic without affecting user experience.

### Configuration

```yaml
shadow_mode:
  enabled: true
  duration_days: 14
  traffic_percentage: 100  # Shadow all traffic
  comparison_baseline: "current_professional_grading"
  
  monitoring:
    metrics_collection_interval: 60  # seconds
    alerting_threshold_minutes: 5
    dashboard_refresh_interval: 30  # seconds
    
  validation_criteria:
    min_samples_required: 10000
    min_auc_threshold: 0.7
    max_latency_p95_ms: 20
    max_error_rate: 0.01
    min_business_roi: 5.0  # percent
```

### Implementation

**Parallel Processing**:
- All incoming props receive both:
  1. Current professional grading (production path)
  2. ML model predictions (shadow path)
- User experience remains unchanged
- ML predictions logged for analysis only

**Data Collection**:
```typescript
interface ShadowModeLog {
  timestamp: Date;
  prop_id: string;
  current_grade: ProfessionalGrade;
  ml_prediction: MLPrediction;
  processing_time_ms: number;
  confidence_score: number;
  feature_values: Record<string, number>;
}
```

**Comparison Metrics**:
- **Agreement Rate**: Percentage of predictions within ±5% of current grading
- **Performance Delta**: AUC difference between ML and current system
- **Latency Impact**: P95 latency increase from ML processing
- **Business Impact**: Projected ROI improvement/degradation

### Success Criteria

All criteria must be met to proceed to canary deployment:

1. **Performance**: ML AUC ≥ 0.7 and ≥ current system
2. **Latency**: P95 latency ≤ 20ms for ML predictions
3. **Reliability**: Error rate ≤ 1%
4. **Business Value**: Projected ROI improvement ≥ 5%
5. **Stability**: No degradation in current system performance

### Failure Conditions

Automatic shadow mode termination if:
- ML model error rate > 5% for 15 minutes
- P95 latency > 50ms for 10 minutes
- System instability detected (current grading performance drops)

---

## Stage 2: Canary Deployment

### Objective
Gradually increase ML model traffic while maintaining rollback capability.

### Configuration

```yaml
canary_deployment:
  initial_percentage: 5
  increment_percentage: 10
  increment_interval_hours: 24
  max_percentage: 50  # Maximum before full rollout decision
  
  success_criteria:
    min_auc: 0.7
    max_latency_p95_ms: 20
    max_error_rate: 0.01
    min_roi_improvement: 3.0
    
  monitoring:
    metric_comparison_window_hours: 6
    alert_threshold_degradation: 0.05  # 5% degradation triggers alert
    automatic_rollback_threshold: 0.1  # 10% degradation triggers rollback
```

### Canary Traffic Routing

**User Segmentation**:
- Canary users selected by deterministic hash of `user_id`
- Ensures consistent experience per user
- Even distribution across user tiers and sports

**Traffic Split Logic**:
```typescript
function shouldUseMLModel(userId: string, canaryPercentage: number): boolean {
  const hash = createHash('md5').update(userId).digest('hex');
  const userBucket = parseInt(hash.substring(0, 8), 16) % 100;
  return userBucket < canaryPercentage;
}
```

### Progressive Rollout Schedule

| Phase | Duration | Traffic % | Minimum Success Period |
|-------|----------|-----------|------------------------|
| 1     | 24h      | 5%        | 6h stable performance  |
| 2     | 24h      | 15%       | 12h stable performance |
| 3     | 24h      | 25%       | 18h stable performance |
| 4     | 48h      | 35%       | 24h stable performance |
| 5     | 48h      | 50%       | 36h stable performance |

### Monitoring & Alerting

**Real-Time Dashboards**:
- Side-by-side performance comparison (ML vs Current)
- User experience metrics (grading accuracy, tier distributions)
- Business metrics (ROI, win rates by tier)
- Technical metrics (latency, error rates, throughput)

**Automated Alerts**:
- Slack/PagerDuty integration for immediate notification
- Escalation paths for different severity levels
- Integration with existing Unit Talk monitoring infrastructure

---

## Stage 3: Rollback Mechanisms

### Automatic Rollback Triggers

**Immediate Rollback (< 2 minutes)**:
- ML model error rate > 10%
- P95 latency > 100ms
- Complete ML service failure
- Database connection failures

**Rapid Rollback (< 15 minutes)**:
- AUC degradation > 10% compared to baseline
- User complaints > threshold
- Business metric degradation > 15%

**Scheduled Rollback (next deployment window)**:
- Gradual performance degradation
- Operational complexity issues
- Strategic business decision

### Rollback Implementation

**Traffic Switching**:
```typescript
interface RollbackConfig {
  trigger: 'automatic' | 'manual';
  rollback_percentage: number;
  rollback_duration_hours: number;
  monitoring_period_hours: number;
}

class RollbackManager {
  async executeRollback(config: RollbackConfig) {
    // 1. Immediately reduce ML traffic
    await this.updateTrafficSplit(100 - config.rollback_percentage);
    
    // 2. Monitor stability
    await this.monitorStability(config.monitoring_period_hours);
    
    // 3. Full rollback if needed
    if (this.isSystemUnstable()) {
      await this.updateTrafficSplit(0);  // Complete rollback
    }
  }
}
```

**State Persistence**:
- All configuration changes logged in audit table
- Ability to replay exact system state before deployment
- Instant restoration of previous grading algorithms

**Communication Protocol**:
1. Automatic Slack notification to #engineering and #operations
2. Email alert to on-call engineer and ML team
3. Dashboard status update with clear rollback reason
4. Post-incident review scheduled automatically

---

## Online Feature Serving

### Architecture

**Real-Time Feature Pipeline**:
```
Request → Feature Cache (Redis) → Feature Store → ML Model → Response
     ↓           ↓                     ↓              ↓
Cache Miss → Database Query → Feature Engineering → Prediction
```

### Performance Requirements

**Latency Budget**:
- Total request latency: ≤ 20ms (P95)
- Feature retrieval: ≤ 5ms (P95)
- Model inference: ≤ 10ms (P95)
- Result processing: ≤ 5ms (P95)

**Throughput Requirements**:
- Peak load: 1,500 props/hour (current peak)
- Sustained load: 800 props/hour (typical)
- Burst capacity: 3,000 props/hour (2x peak)

### Feature Freshness

**Real-Time Features** (≤ 1 minute staleness):
- Line movements
- Market volume indicators
- Odds changes

**Near Real-Time Features** (≤ 5 minutes staleness):
- Player status updates
- Injury reports
- Weather conditions

**Batch Features** (≤ 1 hour staleness):
- Historical performance metrics
- Seasonal adjustments
- User performance metrics

### Caching Strategy

```yaml
feature_cache:
  redis_cluster: 3_nodes
  ttl_seconds:
    real_time_features: 60
    market_features: 300
    player_features: 900
    historical_features: 3600
    
  cache_warming:
    enabled: true
    pre_load_popular_props: true
    batch_size: 100
```

---

## Monitoring & Observability

### Key Performance Indicators

**Technical KPIs**:
- Model prediction latency (P50, P95, P99)
- Feature serving latency
- Cache hit rates by feature type
- Error rates by component
- System throughput (predictions/second)

**Business KPIs**:
- Prediction accuracy vs actual outcomes
- ROI impact compared to current system
- User tier distribution changes
- Pick approval rates by tier
- Professional grading agreement rates

**User Experience KPIs**:
- Time to grade (from submission to approval)
- Grading consistency across similar props
- User satisfaction with tier assignments
- Pick success rates by confidence level

### Alerting Framework

**Alert Levels**:

1. **INFO**: Performance within expected ranges
2. **WARN**: Minor degradation, manual review recommended
3. **ERROR**: Significant degradation, immediate attention required
4. **CRITICAL**: System failure, automatic rollback triggered

**Alert Routing**:
```yaml
alert_routing:
  INFO: 
    - ml_team_slack
  WARN:
    - ml_team_slack
    - engineering_slack
  ERROR:
    - ml_team_slack
    - engineering_slack
    - on_call_pager
  CRITICAL:
    - all_channels
    - executive_escalation
    - automatic_rollback
```

### Dashboards

**Operations Dashboard**:
- Real-time traffic split percentage
- Current performance metrics vs baseline
- Error rates and latency percentiles
- Feature freshness indicators

**Business Dashboard**:
- ROI tracking by time period
- Pick performance by tier
- Model confidence calibration
- User experience metrics

**Engineering Dashboard**:
- Model performance trends
- Feature importance drift
- System resource utilization
- A/B test statistical significance

---

## Data Drift Detection

### Monitoring Strategy

**Feature Drift Detection**:
- Statistical tests run every 6 hours
- Kolmogorov-Smirnov test for distribution changes
- Alert if p-value < 0.01 for critical features

**Concept Drift Detection**:
- Model performance tracking over rolling windows
- Alert if AUC drops > 5% over 7-day period
- Automatic retraining trigger if drift confirmed

**Implementation**:
```python
class DriftDetector:
    def __init__(self):
        self.baseline_distributions = {}
        self.drift_thresholds = {
            'ks_test_pvalue': 0.01,
            'performance_drop_threshold': 0.05,
            'monitoring_window_days': 7
        }
    
    def detect_feature_drift(self, feature_name: str, current_values: np.ndarray):
        baseline = self.baseline_distributions[feature_name]
        ks_stat, p_value = stats.ks_2samp(baseline, current_values)
        
        return {
            'drift_detected': p_value < self.drift_thresholds['ks_test_pvalue'],
            'ks_statistic': ks_stat,
            'p_value': p_value,
            'severity': self.calculate_drift_severity(ks_stat)
        }
```

---

## Model Versioning & Registry

### Version Management

**Model Artifacts**:
- Trained model files (XGBoost, LightGBM, Neural Net)
- Feature preprocessing pipelines
- Hyperparameter configurations
- Training metadata and performance metrics

**Registry Structure**:
```
models/
├── {dataset_id}/
│   ├── {model_type}/
│   │   ├── v1.0.0/
│   │   │   ├── model.joblib
│   │   │   ├── feature_processor.joblib
│   │   │   ├── metadata.json
│   │   │   └── evaluation_report.json
│   │   └── v1.1.0/
│   └── ensemble/
└── registry.json
```

**Deployment Tracking**:
- Active model versions in each environment
- Rollback history and success rates
- Performance comparison across versions
- Resource utilization by model version

---

## Security & Compliance

### Data Protection

**Feature Data Security**:
- Encryption at rest for all feature stores
- TLS 1.3 for all data transmission
- Access logging for all feature retrievals
- PII handling compliance for user data

**Model Security**:
- Signed model artifacts to prevent tampering
- Access controls for model deployment
- Audit trail for all model changes
- Secure communication between services

### Operational Security

**Deployment Security**:
- Multi-factor authentication for production deployments
- Code review requirements for ML infrastructure changes
- Automated security scanning of ML dependencies
- Regular penetration testing of ML endpoints

**Monitoring Security**:
- Secure dashboard access with role-based permissions
- Encrypted metric transmission
- Audit logging for all administrative actions
- Incident response procedures for security events

---

## Testing Strategy

### Pre-Deployment Testing

**Unit Tests**:
- Feature engineering logic
- Model inference correctness
- Caching layer functionality
- Error handling paths

**Integration Tests**:
- End-to-end prediction pipeline
- Database connectivity and queries
- Cache coherency across updates
- Performance under load

**Shadow Mode Validation**:
- Automated comparison testing
- Performance regression detection
- Business metric impact analysis
- User experience validation

### Production Testing

**Canary Validation**:
- A/B test statistical significance
- Gradual rollout safety checks
- Real-time performance monitoring
- Automatic quality gates

**Continuous Testing**:
- Daily model performance validation
- Weekly business metric review
- Monthly model drift assessment
- Quarterly full system audit

---

## Incident Response

### Incident Classification

**Severity Levels**:

**P0 - Critical**:
- Complete ML system failure
- Data corruption or loss
- Security breach
- User-facing service outage

**P1 - High**:
- Significant performance degradation
- Partial feature unavailability
- High error rates (>5%)
- Business metric degradation >15%

**P2 - Medium**:
- Minor performance issues
- Non-critical feature failures
- Moderate error rates (1-5%)
- Business metric degradation 5-15%

**P3 - Low**:
- Performance anomalies
- Non-blocking issues
- Minor error rates (<1%)
- Business metric degradation <5%

### Response Procedures

**Immediate Response (0-15 minutes)**:
1. Automated rollback if triggered
2. Page on-call engineer for P0/P1 incidents
3. Create incident in tracking system
4. Begin initial investigation

**Short-term Response (15 minutes - 2 hours)**:
1. Assess scope and impact
2. Implement temporary mitigation
3. Communicate status to stakeholders
4. Begin detailed root cause analysis

**Long-term Response (2+ hours)**:
1. Implement permanent fix
2. Conduct post-incident review
3. Update runbooks and procedures
4. Schedule follow-up actions

---

## Success Metrics & Criteria

### Phase 7A Success Criteria

**Technical Success**:
- [ ] Shadow mode runs successfully for 14 days
- [ ] ML model AUC ≥ 0.7 on production data
- [ ] P95 latency ≤ 20ms maintained
- [ ] Error rate ≤ 1% consistently
- [ ] Zero production incidents during shadow mode

**Business Success**:
- [ ] Projected ROI improvement ≥ 5%
- [ ] Model agreement with professional grading ≥ 80%
- [ ] Tier distribution maintains balance (S: 5%, A: 10%, B: 20%)
- [ ] No degradation in current system performance
- [ ] Successful automated rollback demonstration

**Operational Success**:
- [ ] All monitoring dashboards operational
- [ ] Alert systems tested and functional
- [ ] Team trained on new procedures
- [ ] Documentation complete and accessible
- [ ] Incident response procedures validated

### Progression Criteria

**Shadow Mode → Canary**:
- All technical and business success criteria met
- 14-day stable operation
- Stakeholder approval
- No outstanding P0/P1 incidents

**Canary → Full Production**:
- Successful 50% canary deployment
- 7-day stable operation at 50% traffic
- Business metrics show positive impact
- User experience maintained or improved
- Engineering team confidence in system

---

## Rollout Timeline

### Phase 7A Implementation Schedule

**Week 1-2: Shadow Mode Preparation**
- Deploy ML infrastructure
- Configure monitoring and alerting
- Set up comparison framework
- Conduct pre-deployment testing

**Week 3-4: Shadow Mode Execution**
- 14-day shadow mode operation
- Daily performance reviews
- Continuous monitoring and tuning
- Documentation of findings

**Week 5: Canary Preparation**
- Shadow mode results analysis
- Canary deployment configuration
- Stakeholder review and approval
- Final pre-deployment checks

**Week 6-8: Canary Deployment**
- Progressive traffic increase
- Continuous monitoring
- Performance optimization
- User feedback collection

**Week 9: Full Deployment Decision**
- Comprehensive results analysis
- Business impact assessment
- Engineering recommendation
- Executive approval for full rollout

---

## Risk Mitigation

### Identified Risks & Mitigations

**Risk**: Model Performance Degradation
- **Mitigation**: Comprehensive baseline comparison, automatic rollback
- **Detection**: Real-time AUC monitoring, business metric tracking
- **Response**: Immediate traffic reduction, investigation, model retraining

**Risk**: Latency Impact on User Experience
- **Mitigation**: Aggressive performance testing, latency budgets
- **Detection**: P95 latency monitoring, user experience metrics
- **Response**: Caching optimization, infrastructure scaling, rollback

**Risk**: Feature Drift Affecting Predictions
- **Mitigation**: Automated drift detection, baseline monitoring
- **Detection**: Statistical tests, performance degradation alerts
- **Response**: Feature pipeline investigation, model retraining

**Risk**: Infrastructure Failure
- **Mitigation**: Redundant systems, graceful degradation
- **Detection**: Health checks, service monitoring
- **Response**: Automatic failover, service restoration

**Risk**: Business Impact Uncertainty
- **Mitigation**: Conservative rollout, extensive A/B testing
- **Detection**: Business metric monitoring, ROI tracking
- **Response**: Strategy adjustment, rollback to safe state

---

## Conclusion

This comprehensive online safety plan ensures zero-risk deployment of Phase 7A ML models through:

1. **Progressive Validation**: Shadow mode → Canary → Full deployment
2. **Automatic Protection**: Real-time monitoring with automatic rollback
3. **Performance Assurance**: Strict latency and accuracy requirements
4. **Business Alignment**: ROI tracking and user experience protection
5. **Operational Excellence**: Comprehensive monitoring and incident response

The plan prioritizes system stability and user experience while enabling controlled innovation in the Unit Talk platform's ML capabilities.

**Next Steps**: Implementation begins with shadow mode infrastructure setup, requiring no changes to production grading systems until full validation is complete.

---

**Document Approval**:
- [ ] ML Team Lead
- [ ] Engineering Team Lead  
- [ ] Platform Engineering Team
- [ ] Product Owner
- [ ] Head of Engineering