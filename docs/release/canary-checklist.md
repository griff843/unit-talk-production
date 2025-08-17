# v3.0.0 Canary Deployment Watch Checklist

**Release**: v3.0.0  
**Deployment Date**: 2025-01-17  
**Duration**: 30-60 minutes monitoring period  
**Operator**: Production Release Team  
**Frequency**: Every 5 minutes for first 30 minutes, then every 10 minutes  
**Escalation**: Immediate rollback if any SLO threshold breached

## 🎯 SLO Thresholds & Success Criteria

### Critical Service Availability (P0 - Immediate Rollback)

- **Platform Availability**: ≥95% (Current baseline: ~100%)
- **Service Uptime**: All services responding within 30s
- **Database Connectivity**: <100ms connection time
- **Agent Health**: ≥80% of agents operational (5 agents minimum 4 healthy)

### Performance Targets (P1 - Monitor Closely)

- **Command Center Response**: <2000ms (Current: 236-315ms)
- **API Response Times**: <200ms average (50th percentile)
- **Database Query Performance**: <50ms average
- **Agent Processing Time**: <2s average per operation

### Business Metrics (P2 - Track Trends)

- **Error Rate**: <1% across all services
- **User Session Success**: ≥98% successful logins/operations
- **Data Pipeline Health**: ≥90% successful picks processing
- **Discord Bot Responsiveness**: <5s command response

## 🔍 Critical Endpoints to Probe

### Primary Health Endpoints

```bash
# Command Center (Primary Operations Dashboard)
curl -f -m 10 http://localhost:3004/api/health
Expected: HTTP 200, JSON response with overall_status: "healthy"

# Main API (Core Platform Services)
curl -f -m 10 http://localhost:3000/api/health
Expected: HTTP 200, service health data

# Database Connectivity
curl -f -m 10 http://localhost:3004/api/system/metrics
Expected: HTTP 200, database response_time <100ms

# Agent Orchestration
curl -f -m 10 http://localhost:3004/api/agents/health
Expected: HTTP 200, ≥4/5 agents "active"
```

### Secondary Service Endpoints

```bash
# Temporal Workflow Health
curl -f -m 10 http://localhost:3004/api/temporal/health
Expected: HTTP 200, temporal status "healthy"

# Redis Cache Performance
curl -f -m 10 http://localhost:3004/api/redis
Expected: HTTP 200, connected: true, response_time <10ms

# Pipeline Event Stream
curl -f -m 10 http://localhost:3004/api/events
Expected: HTTP 200, recent events within last 5 minutes

# Monitoring Stack Health
curl -f -m 10 http://localhost:9090/api/v1/query?query=up
Expected: HTTP 200, Prometheus operational

curl -f -m 10 http://localhost:3000/api/health
Expected: HTTP 200, Grafana operational
```

### Business Logic Validation

```bash
# Pick Processing Pipeline
curl -f -m 10 http://localhost:3004/api/grading/picks
Expected: HTTP 200, recent grading activity

# Alert System Functionality
curl -f -m 10 http://localhost:3004/api/alerts
Expected: HTTP 200, alert system operational

# Analytics Data Flow
curl -f -m 10 http://localhost:3004/api/analytics
Expected: HTTP 200, analytics processing active
```

## 📊 Automated Watch Script

### 30-60 Minute Canary Watch Script

```bash
#!/bin/bash
# canary-watch.sh - v1.0.0 Production Canary Monitoring

set -e

WATCH_DURATION=${1:-1800}  # Default 30 minutes (1800 seconds)
CHECK_INTERVAL=300         # 5 minutes initially
METRICS_FILE="docs/release/canary-metrics-$(date +%Y%m%d-%H%M%S).log"
ALERT_THRESHOLD=3          # Number of failures before alerting
FAILURE_COUNT=0

echo "🚀 Starting v1.0.0 Canary Watch - Duration: ${WATCH_DURATION}s"
echo "📊 Metrics will be logged to: ${METRICS_FILE}"
echo "$(date): Canary watch started" >> "$METRICS_FILE"

# Initialize baseline metrics
echo "📈 Establishing baseline metrics..."
./scripts/collect-baseline-metrics.sh >> "$METRICS_FILE"

start_time=$(date +%s)
end_time=$((start_time + WATCH_DURATION))

while [ $(date +%s) -lt $end_time ]; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    remaining=$((end_time - current_time))

    echo "⏱️  Canary Check - Elapsed: ${elapsed}s, Remaining: ${remaining}s"

    # Critical Health Checks
    echo "🔍 Checking critical service health..."

    # Command Center Health (P0)
    if ! curl -f -m 10 http://localhost:3004/api/health > /dev/null 2>&1; then
        echo "❌ CRITICAL: Command Center health check failed" | tee -a "$METRICS_FILE"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    else
        echo "✅ Command Center healthy" | tee -a "$METRICS_FILE"
    fi

    # Agent Health Check (P0)
    agent_health=$(curl -s -m 10 http://localhost:3004/api/agents/health | jq -r '.healthy_count // 0' 2>/dev/null || echo "0")
    if [ "$agent_health" -lt 4 ]; then
        echo "❌ CRITICAL: Only $agent_health/5 agents healthy (minimum 4 required)" | tee -a "$METRICS_FILE"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    else
        echo "✅ Agents healthy: $agent_health/5" | tee -a "$METRICS_FILE"
    fi

    # Performance Metrics Collection
    echo "📊 Collecting performance metrics..."

    # Command Center Response Time
    cc_response_time=$(curl -w "%{time_total}" -s -o /dev/null -m 10 http://localhost:3004/api/health 2>/dev/null || echo "timeout")
    if [[ "$cc_response_time" =~ ^[0-9]+\.?[0-9]*$ ]] && (( $(echo "$cc_response_time > 2.0" | bc -l) )); then
        echo "⚠️  WARNING: Command Center response time ${cc_response_time}s exceeds 2s target" | tee -a "$METRICS_FILE"
    else
        echo "✅ Command Center response time: ${cc_response_time}s" | tee -a "$METRICS_FILE"
    fi

    # Database Performance Check
    db_metrics=$(curl -s -m 10 http://localhost:3004/api/system/metrics 2>/dev/null || echo '{"database":{"response_time":999}}')
    db_response_time=$(echo "$db_metrics" | jq -r '.database.response_time // 999' 2>/dev/null || echo "999")
    if (( $(echo "$db_response_time > 100" | bc -l) )); then
        echo "⚠️  WARNING: Database response time ${db_response_time}ms exceeds 100ms target" | tee -a "$METRICS_FILE"
    else
        echo "✅ Database response time: ${db_response_time}ms" | tee -a "$METRICS_FILE"
    fi

    # Platform Availability Check
    prometheus_up=$(curl -s -m 10 http://localhost:9090/api/v1/query?query=avg\(up\) 2>/dev/null | jq -r '.data.result[0].value[1] // "0"' || echo "0")
    platform_availability=$(echo "$prometheus_up * 100" | bc -l 2>/dev/null || echo "0")
    if (( $(echo "$platform_availability < 95" | bc -l) )); then
        echo "❌ CRITICAL: Platform availability ${platform_availability}% below 95% SLO" | tee -a "$METRICS_FILE"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    else
        echo "✅ Platform availability: ${platform_availability}%" | tee -a "$METRICS_FILE"
    fi

    # Error Rate Check
    echo "🔍 Checking error rates..."
    error_rate=$(curl -s -m 10 http://localhost:3004/api/monitoring/pipeline 2>/dev/null | jq -r '.error_rate // 0' || echo "0")
    if (( $(echo "$error_rate > 1" | bc -l) )); then
        echo "⚠️  WARNING: Error rate ${error_rate}% exceeds 1% threshold" | tee -a "$METRICS_FILE"
    else
        echo "✅ Error rate: ${error_rate}%" | tee -a "$METRICS_FILE"
    fi

    # Failure threshold check
    if [ $FAILURE_COUNT -ge $ALERT_THRESHOLD ]; then
        echo "🚨 CRITICAL: $FAILURE_COUNT failures detected - IMMEDIATE ROLLBACK RECOMMENDED" | tee -a "$METRICS_FILE"
        echo "$(date): CANARY FAILURE - $FAILURE_COUNT critical issues detected" >> "$METRICS_FILE"
        exit 1
    fi

    # Reset failure count if no recent failures
    if [ $FAILURE_COUNT -gt 0 ]; then
        FAILURE_COUNT=$((FAILURE_COUNT - 1))
    fi

    # Log detailed metrics
    echo "$(date): elapsed=${elapsed}s, cc_response=${cc_response_time}s, db_response=${db_response_time}ms, platform_availability=${platform_availability}%, agents=${agent_health}/5, errors=${error_rate}%" >> "$METRICS_FILE"

    # Adjust check interval (more frequent in first 30 minutes)
    if [ $elapsed -gt 1800 ]; then
        CHECK_INTERVAL=600  # 10 minutes after first 30 minutes
    fi

    echo "⏸️  Waiting ${CHECK_INTERVAL}s until next check..."
    sleep $CHECK_INTERVAL
done

echo "🎉 Canary watch completed successfully - No critical issues detected"
echo "$(date): Canary watch completed successfully" >> "$METRICS_FILE"
echo "📊 Final metrics report available in: $METRICS_FILE"

# Generate summary
echo "📋 Canary Watch Summary:"
echo "- Duration: ${WATCH_DURATION}s ($(($WATCH_DURATION / 60)) minutes)"
echo "- Total Checks: $(grep -c "elapsed=" "$METRICS_FILE" || echo "Unknown")"
echo "- Critical Failures: 0 (passed)"
echo "- Metrics File: $METRICS_FILE"
```

### Quick Health Check Script

```bash
#!/bin/bash
# quick-health-check.sh - Rapid health validation

echo "🚀 Quick Health Check for v1.0.0"

services=(
    "Command Center:http://localhost:3004/api/health"
    "Prometheus:http://localhost:9090/api/v1/query?query=up"
    "Grafana:http://localhost:3000/api/health"
    "Agents:http://localhost:3004/api/agents/health"
    "System Metrics:http://localhost:3004/api/system/metrics"
    "Pipeline:http://localhost:3004/api/monitoring/pipeline"
)

healthy=0
total=${#services[@]}

for service in "${services[@]}"; do
    name=$(echo "$service" | cut -d: -f1)
    url=$(echo "$service" | cut -d: -f2-)

    if curl -f -m 5 "$url" > /dev/null 2>&1; then
        echo "✅ $name: Healthy"
        healthy=$((healthy + 1))
    else
        echo "❌ $name: Failed"
    fi
done

echo ""
echo "📊 Health Summary: $healthy/$total services healthy"

if [ $healthy -eq $total ]; then
    echo "🎉 All services healthy - deployment looking good!"
    exit 0
else
    echo "⚠️  Some services unhealthy - investigate before proceeding"
    exit 1
fi
```

## 🚨 Rollback Triggers

### Immediate Rollback Conditions

- **Platform Availability**: <95% for >5 minutes
- **Agent Failure**: <4/5 agents healthy for >10 minutes
- **Command Center**: Response time >5s or unavailable >2 minutes
- **Database**: Connection failures or >500ms response time
- **Critical Errors**: >5% error rate across services

### Warning Conditions (Monitor Closely)

- **Performance Degradation**: >50% increase in response times
- **Memory Issues**: >80% memory usage sustained >15 minutes
- **Disk Usage**: >90% disk usage on any service
- **Network Issues**: >100ms increase in network latency

## 📈 Success Criteria

### 30-Minute Mark (Promotion Ready)

- ✅ All critical services healthy
- ✅ Performance within SLO targets
- ✅ Error rate <1%
- ✅ No rollback triggers activated
- ✅ Agent orchestration stable

### 60-Minute Mark (Full Confidence)

- ✅ 30-minute criteria sustained
- ✅ Business metrics trending positive
- ✅ No performance degradation detected
- ✅ Monitoring alerts properly functioning
- ✅ User-facing functionality verified

## 📝 Escalation Procedures

### Level 1: Warning (Performance Degradation)

1. **Action**: Increase monitoring frequency to every 2 minutes
2. **Investigation**: Check specific service logs and metrics
3. **Timeline**: Resolve within 15 minutes or escalate

### Level 2: Critical (SLO Breach)

1. **Action**: Prepare rollback procedures immediately
2. **Investigation**: Root cause analysis in parallel
3. **Decision Point**: 5 minutes to fix or rollback
4. **Timeline**: Execute rollback within 10 minutes if no resolution

### Level 3: Emergency (Multiple Failures)

1. **Action**: Execute immediate rollback
2. **Communication**: Notify all stakeholders immediately
3. **Investigation**: Full post-mortem within 24 hours
4. **Timeline**: Service restoration within 15 minutes

---

**🎯 This checklist ensures systematic validation of v1.0.0 deployment health
with clear rollback criteria and automated monitoring capabilities.**
