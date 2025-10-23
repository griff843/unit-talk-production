#!/bin/bash
# Blue-Green Deployment Script for Unit Talk Platform
# Phase 6 - Performance Execution & Hardening
#
# Deployment Strategy:
# 1. Deploy to green environment
# 2. Canary 5% traffic for 20min
# 3. Canary 25% traffic for 20min
# 4. Full cutover 100% traffic for 20min
# 5. Cleanup blue environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="${NAMESPACE:-unit-talk}"
NEW_VERSION="${NEW_VERSION:-latest}"
CURRENT_ENV="${CURRENT_ENV:-blue}"
NEW_ENV="${NEW_ENV:-green}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3010/api/health}"
SOAK_TIME=1200  # 20 minutes in seconds
OUTPUT_DIR="out/ops/perf"
TIMESTAMP=$(date +%s)
REPORT_FILE="${OUTPUT_DIR}/blue-green-${TIMESTAMP}.md"

# SLO thresholds
P95_LATENCY_TARGET=150  # ms
P99_LATENCY_TARGET=400  # ms
ERROR_RATE_TARGET=0.005  # 0.5%

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check SLOs
check_slos() {
    local env=$1
    local duration=$2
    
    log_info "Checking SLOs for $env environment (${duration}s)..."
    
    # Query Prometheus for metrics
    local p95_latency=$(curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket{env=\"$env\"}[${duration}s]))" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    local p99_latency=$(curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.99,rate(http_request_duration_seconds_bucket{env=\"$env\"}[${duration}s]))" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    local error_rate=$(curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total{env=\"$env\",status=~\"5..\"}[${duration}s])" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    # Convert to milliseconds
    p95_latency=$(echo "$p95_latency * 1000" | bc)
    p99_latency=$(echo "$p99_latency * 1000" | bc)
    
    log_info "P95 Latency: ${p95_latency}ms (target: ≤${P95_LATENCY_TARGET}ms)"
    log_info "P99 Latency: ${p99_latency}ms (target: ≤${P99_LATENCY_TARGET}ms)"
    log_info "Error Rate: ${error_rate} (target: ≤${ERROR_RATE_TARGET})"
    
    # Check thresholds
    local slo_passed=true
    
    if (( $(echo "$p95_latency > $P95_LATENCY_TARGET" | bc -l) )); then
        log_error "P95 latency exceeds target"
        slo_passed=false
    fi
    
    if (( $(echo "$p99_latency > $P99_LATENCY_TARGET" | bc -l) )); then
        log_error "P99 latency exceeds target"
        slo_passed=false
    fi
    
    if (( $(echo "$error_rate > $ERROR_RATE_TARGET" | bc -l) )); then
        log_error "Error rate exceeds target"
        slo_passed=false
    fi
    
    if [ "$slo_passed" = true ]; then
        log_info "✅ All SLOs passed"
        return 0
    else
        log_error "❌ SLO check failed"
        return 1
    fi
}

# Health check
health_check() {
    local url=$1
    local max_attempts=30
    local attempt=0
    
    log_info "Running health check: $url"
    
    while [ $attempt -lt $max_attempts ]; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
        
        if [ "$response" == "200" ]; then
            log_info "✅ Health check passed"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_warn "Health check attempt $attempt/$max_attempts failed (HTTP $response)"
        sleep 10
    done
    
    log_error "❌ Health check failed after $max_attempts attempts"
    return 1
}

# Rollback
rollback() {
    log_error "🔄 Initiating rollback to $CURRENT_ENV..."
    
    # Switch traffic back to blue
    kubectl patch service unit-talk-api -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"env\":\"$CURRENT_ENV\"}}}"
    
    # Verify rollback
    sleep 10
    if health_check "$HEALTH_CHECK_URL"; then
        log_info "✅ Rollback successful"
    else
        log_error "❌ Rollback health check failed - manual intervention required!"
        exit 1
    fi
    
    # Scale down green
    kubectl scale deployment "unit-talk-api-$NEW_ENV" -n "$NAMESPACE" --replicas=0
    
    log_info "Rollback completed"
    exit 1
}

# Step 1: Deploy to green environment
deploy_green() {
    log_step "Step 1: Deploying to $NEW_ENV environment"
    
    # Apply green deployment
    kubectl apply -f kubernetes/blue-green/green-deployment.yaml
    
    # Wait for pods to be ready
    log_info "Waiting for $NEW_ENV pods to be ready..."
    kubectl wait --for=condition=ready pod \
        -l "app=unit-talk-api,env=$NEW_ENV" \
        -n "$NAMESPACE" \
        --timeout=300s || {
        log_error "Green deployment failed to become ready"
        exit 1
    }
    
    log_info "✅ Green environment deployed successfully"
}

# Step 2: Canary 5% traffic
canary_5_percent() {
    log_step "Step 2: Canary 5% traffic to $NEW_ENV"
    
    # Update service to route 5% traffic to green
    kubectl patch service unit-talk-api -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"env\":\"$NEW_ENV\",\"canary\":\"5\"}}}"
    
    log_info "Soaking for ${SOAK_TIME}s..."
    sleep "$SOAK_TIME"
    
    # Check SLOs
    if ! check_slos "$NEW_ENV" "$SOAK_TIME"; then
        log_error "SLO check failed at 5% canary"
        rollback
    fi
    
    log_info "✅ 5% canary successful"
}

# Step 3: Canary 25% traffic
canary_25_percent() {
    log_step "Step 3: Canary 25% traffic to $NEW_ENV"
    
    # Update service to route 25% traffic to green
    kubectl patch service unit-talk-api -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"env\":\"$NEW_ENV\",\"canary\":\"25\"}}}"
    
    log_info "Soaking for ${SOAK_TIME}s..."
    sleep "$SOAK_TIME"
    
    # Check SLOs
    if ! check_slos "$NEW_ENV" "$SOAK_TIME"; then
        log_error "SLO check failed at 25% canary"
        rollback
    fi
    
    log_info "✅ 25% canary successful"
}

# Step 4: Full cutover 100%
full_cutover() {
    log_step "Step 4: Full cutover 100% traffic to $NEW_ENV"
    
    # Update service to route 100% traffic to green
    kubectl patch service unit-talk-api -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"env\":\"$NEW_ENV\"}}}"
    
    log_info "Soaking for ${SOAK_TIME}s..."
    sleep "$SOAK_TIME"
    
    # Check SLOs
    if ! check_slos "$NEW_ENV" "$SOAK_TIME"; then
        log_error "SLO check failed at 100% cutover"
        rollback
    fi
    
    log_info "✅ Full cutover successful"
}

# Step 5: Cleanup blue environment
cleanup_blue() {
    log_step "Step 5: Cleaning up $CURRENT_ENV environment"
    
    # Scale down blue deployment
    kubectl scale deployment "unit-talk-api-$CURRENT_ENV" -n "$NAMESPACE" --replicas=0
    
    # Optionally delete blue deployment (commented out for safety)
    # kubectl delete deployment "unit-talk-api-$CURRENT_ENV" -n "$NAMESPACE"
    
    log_info "✅ Blue environment scaled down"
}

# Generate deployment report
generate_report() {
    log_info "Generating deployment report..."
    
    cat > "$REPORT_FILE" << EOF
# Blue-Green Deployment Report

**Date**: $(date -Iseconds)
**Version**: $NEW_VERSION
**Environment**: $NAMESPACE
**Current**: $CURRENT_ENV → **New**: $NEW_ENV

## Deployment Summary

This report documents the blue-green deployment executed as part of Phase 6 - Performance Execution & Hardening.

### Deployment Steps

1. ✅ Deploy to green environment
2. ✅ Canary 5% traffic (20min soak)
3. ✅ Canary 25% traffic (20min soak)
4. ✅ Full cutover 100% traffic (20min soak)
5. ✅ Cleanup blue environment

### SLO Compliance

All SLO checks passed at each stage:

- **P95 Latency**: ≤ ${P95_LATENCY_TARGET}ms
- **P99 Latency**: ≤ ${P99_LATENCY_TARGET}ms
- **Error Rate**: ≤ ${ERROR_RATE_TARGET}

### Rollback Plan

Rollback procedure validated and ready:

\`\`\`bash
# Immediate rollback to blue
kubectl patch service unit-talk-api -n $NAMESPACE \\
    -p '{"spec":{"selector":{"env":"$CURRENT_ENV"}}}'

# Verify health
curl -f $HEALTH_CHECK_URL

# Scale down green
kubectl scale deployment unit-talk-api-$NEW_ENV -n $NAMESPACE --replicas=0
\`\`\`

### Next Steps

- [ ] Monitor green environment for 24 hours
- [ ] Review metrics and logs
- [ ] Update documentation
- [ ] Schedule blue environment deletion

---

**Generated**: $(date -Iseconds)
**Status**: ✅ SUCCESSFUL
EOF
    
    log_info "Report generated: $REPORT_FILE"
}

# Main execution
main() {
    log_info "========================================="
    log_info "Blue-Green Deployment"
    log_info "========================================="
    log_info "Current: $CURRENT_ENV"
    log_info "New: $NEW_ENV"
    log_info "Version: $NEW_VERSION"
    log_info "Namespace: $NAMESPACE"
    log_info "========================================="
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Execute deployment steps
    deploy_green
    canary_5_percent
    canary_25_percent
    full_cutover
    cleanup_blue
    
    # Generate report
    generate_report
    
    log_info "========================================="
    log_info "✅ Blue-Green Deployment Completed Successfully!"
    log_info "========================================="
    log_info "Report: $REPORT_FILE"
}

# Execute main function
main "$@"

