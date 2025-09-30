# Performance Monitoring & SLO Management

## 🎯 Overview

This document provides comprehensive guidance for performance monitoring and Service Level Objective (SLO) management in the Unit Talk syndicate-grade platform. It covers SLO definitions, monitoring strategies, alerting policies, and operational procedures.

## 📊 Service Level Objectives (SLOs)

### Primary SLOs

#### API Performance SLO
- **Metric**: API response time
- **Target**: 95th percentile < 100ms
- **Measurement Window**: 24 hours
- **Error Budget**: 5% (432 minutes/month)
- **Business Impact**: Customer experience, real-time responsiveness

#### Database Performance SLO
- **Metric**: Database query execution time
- **Target**: 95th percentile < 50ms
- **Measurement Window**: 24 hours
- **Error Budget**: 5% (432 minutes/month)
- **Business Impact**: System responsiveness, data integrity

#### Steam Detection Latency SLO
- **Metric**: Steam detection processing time
- **Target**: 95th percentile < 5 seconds
- **Measurement Window**: 1 hour
- **Error Budget**: 2% (14.4 minutes/day)
- **Business Impact**: Market opportunity capture, competitive advantage

#### System Availability SLO
- **Metric**: Service uptime
- **Target**: 99.9% availability
- **Measurement Window**: 30 days
- **Error Budget**: 0.1% (43.2 minutes/month)
- **Business Impact**: Business continuity, revenue protection

#### Feature Computation Rate SLO
- **Metric**: Features computed per second
- **Target**: > 1000 features/second
- **Measurement Window**: 1 hour
- **Error Budget**: 10% degraded performance allowed
- **Business Impact**: Real-time analysis capabilities

### Secondary SLOs

#### Data Quality SLO
- **Metric**: Data validation success rate
- **Target**: > 95% of ingested data passes validation
- **Measurement Window**: 24 hours
- **Error Budget**: 5% data quality issues allowed

#### Alert Delivery SLO
- **Metric**: Alert notification delivery time
- **Target**: < 30 seconds from trigger to delivery
- **Measurement Window**: 1 hour
- **Error Budget**: 5% of alerts may exceed target

#### Incident Response SLO
- **Metric**: Time to first response
- **Target**: < 5 minutes for critical incidents
- **Measurement Window**: Per incident
- **Error Budget**: 10% of incidents may exceed target

## 🔍 Monitoring Architecture

### Metrics Collection Stack

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "slo_rules.yml"
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'api-metrics'
    static_configs:
      - targets: ['api:9464']
    scrape_interval: 10s
    metrics_path: '/metrics'

  - job_name: 'agent-metrics'
    static_configs:
      - targets: ['feedagent:9465', 'gradingagent:9466', 'alertagent:9467']
    scrape_interval: 15s

  - job_name: 'database-metrics'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s

  - job_name: 'system-metrics'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 30s
```

#### Custom Metrics Implementation
```typescript
// Performance metrics collection
export class PerformanceMetrics {
  private static instance: PerformanceMetrics;
  private registry: prometheus.Registry;
  
  // API Response Time Histogram
  private apiResponseTime = new prometheus.Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request duration in seconds',
    labelNames: ['method', 'endpoint', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });

  // Database Query Time Histogram
  private dbQueryTime = new prometheus.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
  });

  // Steam Detection Latency
  private steamDetectionLatency = new prometheus.Histogram({
    name: 'steam_detection_latency_seconds',
    help: 'Steam detection processing latency',
    labelNames: ['sport', 'detection_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });

  // Feature Computation Rate
  private featureComputationRate = new prometheus.Gauge({
    name: 'feature_computation_rate_per_second',
    help: 'Features computed per second',
    labelNames: ['computation_type']
  });

  // Error Counters
  private errorCounter = new prometheus.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['service', 'error_type', 'severity']
  });

  public recordAPIRequest(
    method: string, 
    endpoint: string, 
    status: number, 
    duration: number
  ): void {
    this.apiResponseTime
      .labels(method, endpoint, status.toString())
      .observe(duration);
  }

  public recordDatabaseQuery(
    queryType: string, 
    table: string, 
    duration: number
  ): void {
    this.dbQueryTime
      .labels(queryType, table)
      .observe(duration);
  }

  public recordSteamDetection(
    sport: string, 
    detectionType: string, 
    latency: number
  ): void {
    this.steamDetectionLatency
      .labels(sport, detectionType)
      .observe(latency);
  }

  public updateFeatureComputationRate(
    computationType: string, 
    rate: number
  ): void {
    this.featureComputationRate
      .labels(computationType)
      .set(rate);
  }
}
```

### SLO Monitoring Rules

#### Prometheus SLO Rules
```yaml
# slo_rules.yml
groups:
  - name: api_performance_slo
    interval: 30s
    rules:
      - record: api:request_rate
        expr: rate(api_request_duration_seconds_count[5m])
      
      - record: api:error_rate
        expr: rate(api_request_duration_seconds_count{status=~"5.."}[5m]) / rate(api_request_duration_seconds_count[5m])
      
      - record: api:latency_p95
        expr: histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))
      
      - record: api:slo_compliance
        expr: (api:latency_p95 < 0.1) * 100

  - name: database_performance_slo
    interval: 30s
    rules:
      - record: db:query_rate
        expr: rate(database_query_duration_seconds_count[5m])
      
      - record: db:latency_p95
        expr: histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))
      
      - record: db:slo_compliance
        expr: (db:latency_p95 < 0.05) * 100

  - name: steam_detection_slo
    interval: 15s
    rules:
      - record: steam:detection_rate
        expr: rate(steam_detection_latency_seconds_count[5m])
      
      - record: steam:latency_p95
        expr: histogram_quantile(0.95, rate(steam_detection_latency_seconds_bucket[5m]))
      
      - record: steam:slo_compliance
        expr: (steam:latency_p95 < 5) * 100

  - name: feature_computation_slo
    interval: 30s
    rules:
      - record: features:computation_rate
        expr: avg(feature_computation_rate_per_second)
      
      - record: features:slo_compliance
        expr: (features:computation_rate > 1000) * 100

  - name: availability_slo
    interval: 60s
    rules:
      - record: system:availability
        expr: avg(up{job=~"api-metrics|agent-metrics"})
      
      - record: system:slo_compliance
        expr: (system:availability > 0.999) * 100
```

### Error Budget Calculation

#### Error Budget Tracking
```typescript
export class ErrorBudgetTracker {
  private static readonly SLO_TARGETS = {
    api_response_time: 0.1, // 100ms
    database_query_time: 0.05, // 50ms
    steam_detection_latency: 5, // 5 seconds
    system_availability: 0.999, // 99.9%
    feature_computation_rate: 1000 // features/second
  };

  private static readonly ERROR_BUDGETS = {
    api_response_time: 0.05, // 5%
    database_query_time: 0.05, // 5%
    steam_detection_latency: 0.02, // 2%
    system_availability: 0.001, // 0.1%
    feature_computation_rate: 0.1 // 10%
  };

  public calculateErrorBudget(
    sloName: string, 
    windowHours: number = 24
  ): ErrorBudgetStatus {
    const target = ErrorBudgetTracker.SLO_TARGETS[sloName];
    const budget = ErrorBudgetTracker.ERROR_BUDGETS[sloName];
    
    // Query Prometheus for current metrics
    const currentValue = this.getCurrentMetricValue(sloName);
    const violationRate = this.getViolationRate(sloName, windowHours);
    
    const budgetConsumed = violationRate;
    const budgetRemaining = Math.max(0, budget - budgetConsumed);
    const burnRate = this.calculateBurnRate(violationRate, budget);
    
    return {
      slo_name: sloName,
      target,
      current_value: currentValue,
      error_budget_total: budget,
      error_budget_consumed: budgetConsumed,
      error_budget_remaining: budgetRemaining,
      consumption_rate: budgetConsumed / budget,
      burn_rate: burnRate,
      status: this.getBudgetStatus(budgetRemaining, budget),
      time_to_exhaustion: this.calculateTimeToExhaustion(burnRate, budgetRemaining)
    };
  }

  private calculateBurnRate(violationRate: number, budget: number): string {
    const rate = violationRate / budget;
    if (rate > 10) return 'critical';
    if (rate > 5) return 'high';
    if (rate > 2) return 'moderate';
    return 'low';
  }

  private getBudgetStatus(remaining: number, total: number): string {
    const percentage = remaining / total;
    if (percentage > 0.5) return 'healthy';
    if (percentage > 0.25) return 'warning';
    if (percentage > 0.1) return 'critical';
    return 'exhausted';
  }
}
```

## 🚨 Alerting Strategy

### Alert Rules Configuration

#### Critical Alerts (Immediate Response)
```yaml
# alert_rules.yml
groups:
  - name: critical_alerts
    rules:
      - alert: APIResponseTimeCritical
        expr: api:latency_p95 > 0.5
        for: 30s
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "API response time critically high"
          description: "API P95 response time is {{ $value }}s, exceeding critical threshold of 500ms"
          runbook_url: "https://docs.unittalk.com/runbooks/api-performance"

      - alert: DatabaseQueryTimeCritical
        expr: db:latency_p95 > 0.25
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Database query time critically high"
          description: "Database P95 query time is {{ $value }}s, exceeding critical threshold of 250ms"

      - alert: SystemAvailabilityDown
        expr: system:availability < 0.95
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "System availability below critical threshold"
          description: "System availability is {{ $value | humanizePercentage }}, below 95%"

      - alert: SteamDetectionDown
        expr: steam:detection_rate == 0
        for: 2m
        labels:
          severity: critical
          team: trading
        annotations:
          summary: "Steam detection completely stopped"
          description: "No steam detection events in the last 2 minutes"
```

#### Warning Alerts (Monitor Closely)
```yaml
  - name: warning_alerts
    rules:
      - alert: APIResponseTimeWarning
        expr: api:latency_p95 > 0.1
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "API response time above SLO target"
          description: "API P95 response time is {{ $value }}s, exceeding SLO target of 100ms"

      - alert: DatabaseQueryTimeWarning
        expr: db:latency_p95 > 0.05
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Database query time above SLO target"
          description: "Database P95 query time is {{ $value }}s, exceeding SLO target of 50ms"

      - alert: ErrorBudgetBurnRateHigh
        expr: (1 - api:slo_compliance / 100) > 0.02
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Error budget burn rate high for API SLO"
          description: "API SLO error budget burning at {{ $value | humanizePercentage }} rate"

      - alert: FeatureComputationRateLow
        expr: features:computation_rate < 1000
        for: 5m
        labels:
          severity: warning
          team: trading
        annotations:
          summary: "Feature computation rate below target"
          description: "Feature computation rate is {{ $value }} features/second, below target of 1000"
```

### Alert Routing & Escalation

#### Alertmanager Configuration
```yaml
# alertmanager.yml
global:
  discord_api_url: 'https://discord.com/api/webhooks/...'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  group_by: ['alertname', 'team']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 10s
      repeat_interval: 30m
    
    - match:
        severity: warning
      receiver: 'warning-alerts'
      group_wait: 1m
      repeat_interval: 2h

    - match:
        team: trading
      receiver: 'trading-team'

receivers:
  - name: 'default'
    discord_configs:
      - api_url: '{{ .ExternalURL }}/discord/general'
        title: 'Unit Talk Alert'
        message: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'critical-alerts'
    discord_configs:
      - api_url: '{{ .ExternalURL }}/discord/critical'
        title: '🚨 CRITICAL ALERT'
        message: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'warning-alerts'
    discord_configs:
      - api_url: '{{ .ExternalURL }}/discord/warnings'
        title: '⚠️ Warning Alert'
        message: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  - name: 'trading-team'
    discord_configs:
      - api_url: '{{ .ExternalURL }}/discord/trading'
        title: 'Trading System Alert'
        message: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

## 📈 Performance Analysis & Reporting

### Daily Performance Reports

#### Automated Report Generation
```typescript
export class PerformanceReporter {
  public async generateDailyReport(): Promise<PerformanceReport> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    const sloCompliance = await this.calculateSLOCompliance(startTime, endTime);
    const performanceTrends = await this.analyzePerformanceTrends(startTime, endTime);
    const incidentSummary = await this.generateIncidentSummary(startTime, endTime);
    const capacityAnalysis = await this.analyzeCapacityMetrics(startTime, endTime);

    return {
      report_date: endTime.toISOString().split('T')[0],
      slo_compliance: sloCompliance,
      performance_trends: performanceTrends,
      incident_summary: incidentSummary,
      capacity_analysis: capacityAnalysis,
      recommendations: this.generateRecommendations(sloCompliance, performanceTrends)
    };
  }

  private async calculateSLOCompliance(
    startTime: Date, 
    endTime: Date
  ): Promise<SLOComplianceReport> {
    const slos = [
      'api_response_time',
      'database_query_time', 
      'steam_detection_latency',
      'system_availability',
      'feature_computation_rate'
    ];

    const compliance = {};
    for (const slo of slos) {
      const errorBudget = await this.errorBudgetTracker.calculateErrorBudget(slo, 24);
      compliance[slo] = {
        target_met: errorBudget.status === 'healthy',
        compliance_percentage: (1 - errorBudget.consumption_rate) * 100,
        error_budget_remaining: errorBudget.error_budget_remaining,
        burn_rate: errorBudget.burn_rate
      };
    }

    return compliance;
  }
}
```

### Weekly Performance Reviews

#### Capacity Planning Analysis
```sql
-- Weekly capacity trends
SELECT 
  DATE_TRUNC('day', timestamp) as date,
  AVG(cpu_usage_percent) as avg_cpu,
  MAX(cpu_usage_percent) as peak_cpu,
  AVG(memory_usage_percent) as avg_memory,
  MAX(memory_usage_percent) as peak_memory,
  AVG(database_connections) as avg_connections,
  MAX(database_connections) as peak_connections
FROM system_metrics 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date;

-- Query performance trends
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  query_type,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
  COUNT(*) as query_count
FROM query_metrics 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp), query_type
ORDER BY hour, query_type;

-- Steam detection accuracy trends
SELECT 
  DATE_TRUNC('day', timestamp) as date,
  sport,
  COUNT(*) as total_detections,
  COUNT(*) FILTER (WHERE validated = true) as validated_detections,
  ROUND(COUNT(*) FILTER (WHERE validated = true)::numeric / COUNT(*) * 100, 2) as accuracy_percent
FROM steam_detection_log 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', timestamp), sport
ORDER BY date, sport;
```

### Performance Optimization Workflows

#### Automated Performance Tuning
```typescript
export class PerformanceOptimizer {
  public async optimizeSystemPerformance(): Promise<OptimizationResult> {
    const currentMetrics = await this.gatherCurrentMetrics();
    const optimizations = [];

    // Database optimization
    if (currentMetrics.db_latency_p95 > 0.05) {
      optimizations.push(await this.optimizeDatabase());
    }

    // API optimization
    if (currentMetrics.api_latency_p95 > 0.1) {
      optimizations.push(await this.optimizeAPI());
    }

    // Cache optimization
    if (currentMetrics.cache_hit_rate < 0.8) {
      optimizations.push(await this.optimizeCache());
    }

    // Resource scaling
    if (currentMetrics.cpu_utilization > 0.8) {
      optimizations.push(await this.scaleResources());
    }

    return {
      optimizations_applied: optimizations,
      expected_improvements: this.calculateExpectedImprovements(optimizations),
      monitoring_period: '24 hours',
      next_review: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  private async optimizeDatabase(): Promise<DatabaseOptimization> {
    // Analyze slow queries
    const slowQueries = await this.identifySlowQueries();
    
    // Suggest index optimizations
    const indexSuggestions = await this.suggestIndexes(slowQueries);
    
    // Optimize connection pool
    const poolOptimization = await this.optimizeConnectionPool();

    return {
      type: 'database_optimization',
      slow_queries_optimized: slowQueries.length,
      indexes_suggested: indexSuggestions.length,
      connection_pool_adjusted: poolOptimization.applied,
      expected_improvement: '20-30% query time reduction'
    };
  }
}
```

## 🎛️ Operational Procedures

### SLO Incident Response

#### SLO Violation Response Procedure
1. **Immediate Assessment** (0-5 minutes)
   - Acknowledge SLO violation alert
   - Check system dashboard for overall health
   - Identify affected services and user impact
   - Determine if emergency measures needed

2. **Root Cause Investigation** (5-15 minutes)
   - Analyze relevant metrics and logs
   - Check for recent deployments or changes
   - Identify potential causes (load, bugs, external dependencies)
   - Document findings in incident system

3. **Mitigation Actions** (15-30 minutes)
   - Implement immediate fixes if identified
   - Enable circuit breakers if external service issues
   - Scale resources if capacity-related
   - Activate safe mode if data quality issues

4. **Resolution Verification** (30-45 minutes)
   - Monitor metrics for improvement
   - Verify SLO compliance restoration
   - Check for side effects of mitigation
   - Update incident status

5. **Post-Incident Activities** (1-24 hours)
   - Document full incident timeline
   - Calculate error budget impact
   - Plan preventive measures
   - Update monitoring if needed

### Error Budget Management

#### Monthly Error Budget Review
```typescript
export class ErrorBudgetManager {
  public async conductMonthlyReview(): Promise<MonthlyBudgetReview> {
    const currentMonth = new Date().getMonth();
    const budgetStatus = await this.calculateMonthlyBudgetStatus();
    const burnAnalysis = await this.analyzeBurnPatterns();
    const riskAssessment = await this.assessRemainingMonthRisk();

    const recommendations = this.generateRecommendations(
      budgetStatus, 
      burnAnalysis, 
      riskAssessment
    );

    return {
      month: currentMonth,
      budget_status: budgetStatus,
      burn_analysis: burnAnalysis,
      risk_assessment: riskAssessment,
      recommendations: recommendations,
      action_items: this.createActionItems(recommendations)
    };
  }

  private generateRecommendations(
    budgetStatus: BudgetStatus,
    burnAnalysis: BurnAnalysis,
    riskAssessment: RiskAssessment
  ): Recommendation[] {
    const recommendations = [];

    // High burn rate recommendations
    if (burnAnalysis.average_burn_rate > 5) {
      recommendations.push({
        type: 'urgent',
        title: 'Reduce Error Budget Burn Rate',
        description: 'Implement performance optimizations to reduce SLO violations',
        estimated_impact: '50% burn rate reduction',
        timeline: '1 week'
      });
    }

    // Low budget remaining recommendations
    if (budgetStatus.remaining_percentage < 25) {
      recommendations.push({
        type: 'warning',
        title: 'Conservative Release Strategy',
        description: 'Defer non-critical releases until next month',
        estimated_impact: 'Budget preservation',
        timeline: 'Immediate'
      });
    }

    return recommendations;
  }
}
```

## 📊 Dashboards and Visualization

### Grafana Dashboard Configuration

#### Executive SLO Dashboard
```json
{
  "dashboard": {
    "title": "Unit Talk SLO Executive Dashboard",
    "panels": [
      {
        "title": "Overall SLO Health Score",
        "type": "stat",
        "targets": [
          {
            "expr": "avg(api:slo_compliance, db:slo_compliance, steam:slo_compliance, system:slo_compliance, features:slo_compliance)",
            "legendFormat": "Overall Health"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 95},
                {"color": "green", "value": 98}
              ]
            }
          }
        }
      },
      {
        "title": "SLO Compliance by Service",
        "type": "table",
        "targets": [
          {
            "expr": "api:slo_compliance",
            "legendFormat": "API Response Time"
          },
          {
            "expr": "db:slo_compliance", 
            "legendFormat": "Database Performance"
          },
          {
            "expr": "steam:slo_compliance",
            "legendFormat": "Steam Detection"
          },
          {
            "expr": "system:slo_compliance",
            "legendFormat": "System Availability"
          },
          {
            "expr": "features:slo_compliance",
            "legendFormat": "Feature Computation"
          }
        ]
      }
    ]
  }
}
```

#### Operational SLO Dashboard
```json
{
  "dashboard": {
    "title": "Unit Talk SLO Operational Dashboard",
    "panels": [
      {
        "title": "Error Budget Burn Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(api_slo_violations_total[1h])",
            "legendFormat": "API SLO Violations"
          },
          {
            "expr": "rate(db_slo_violations_total[1h])",
            "legendFormat": "DB SLO Violations"
          }
        ]
      },
      {
        "title": "Performance Trends",
        "type": "graph",
        "targets": [
          {
            "expr": "api:latency_p95",
            "legendFormat": "API P95 Latency"
          },
          {
            "expr": "db:latency_p95",
            "legendFormat": "DB P95 Latency"
          },
          {
            "expr": "steam:latency_p95",
            "legendFormat": "Steam Detection P95 Latency"
          }
        ]
      }
    ]
  }
}
```

---

**Document Version**: 2.0  
**Last Updated**: September 10, 2025  
**Next Review**: Monthly SLO review  
**Owner**: Platform Reliability Team