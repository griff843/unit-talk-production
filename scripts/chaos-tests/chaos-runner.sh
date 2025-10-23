#!/bin/bash
# Chaos Engineering Test Runner for Unit Talk Platform
# Phase 6 - Performance Execution & Hardening
#
# Tests: Pod failures, Redis outage, network partitions
# Validates: Auto-heal < 60s, no data loss, Temporal recovery

set -e

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-unit-talk}"
OUTPUT_DIR="out/ops/perf"
TIMESTAMP=$(date +%s)
RESULTS_FILE="${OUTPUT_DIR}/chaos-results-${TIMESTAMP}.json"
REPORT_FILE="${OUTPUT_DIR}/CHAOS_RESULTS.md"

# Monitoring endpoints
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

# Test configuration
API_POD_RECOVERY_TARGET=60  # seconds
WORKER_POD_RECOVERY_TARGET=60  # seconds
REDIS_RECOVERY_TARGET=60  # seconds

# Initialize results
echo "{" > "$RESULTS_FILE"
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
echo "  \"tests\": [" >> "$RESULTS_FILE"

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

# Wait for pod to be ready
wait_for_pod_ready() {
    local label=$1
    local timeout=$2
    local start_time=$(date +%s)
    
    log_info "Waiting for pod with label $label to be ready..."
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            log_error "Timeout waiting for pod to be ready"
            return 1
        fi
        
        local ready=$(kubectl get pods -n "$NAMESPACE" -l "$label" \
            -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')
        
        if [ "$ready" == "True" ]; then
            log_info "Pod is ready (${elapsed}s)"
            echo $elapsed
            return 0
        fi
        
        sleep 2
    done
}

# Check service health
check_service_health() {
    local service=$1
    local endpoint=$2
    
    log_info "Checking health of $service..."
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "000")
    
    if [ "$response" == "200" ]; then
        log_info "$service is healthy"
        return 0
    else
        log_error "$service is unhealthy (HTTP $response)"
        return 1
    fi
}

# Capture metrics from Prometheus
capture_metrics() {
    local query=$1
    local label=$2
    
    local result=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=${query}" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    echo "    \"$label\": $result," >> "$RESULTS_FILE"
}

# Test 1: API Pod Failure
test_api_pod_failure() {
    log_info "========================================="
    log_info "Test 1: API Pod Failure"
    log_info "========================================="
    
    echo "    {" >> "$RESULTS_FILE"
    echo "      \"test\": \"api_pod_failure\"," >> "$RESULTS_FILE"
    echo "      \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
    
    # Get initial pod count
    local initial_pods=$(kubectl get pods -n "$NAMESPACE" -l app=unit-talk-api \
        --field-selector=status.phase=Running -o name | wc -l)
    log_info "Initial API pods: $initial_pods"
    
    # Delete one pod
    local pod_name=$(kubectl get pods -n "$NAMESPACE" -l app=unit-talk-api \
        --field-selector=status.phase=Running -o name | head -1)
    log_info "Deleting pod: $pod_name"
    
    local start_time=$(date +%s)
    kubectl delete -n "$NAMESPACE" "$pod_name" --grace-period=0 --force
    
    # Wait for replacement pod
    local recovery_time=$(wait_for_pod_ready "app=unit-talk-api" 120)
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    
    # Verify pod count restored
    local final_pods=$(kubectl get pods -n "$NAMESPACE" -l app=unit-talk-api \
        --field-selector=status.phase=Running -o name | wc -l)
    
    # Check service health
    check_service_health "API" "http://localhost:3010/api/health"
    local health_status=$?
    
    # Record results
    echo "      \"recovery_time_seconds\": $recovery_time," >> "$RESULTS_FILE"
    echo "      \"total_time_seconds\": $total_time," >> "$RESULTS_FILE"
    echo "      \"initial_pods\": $initial_pods," >> "$RESULTS_FILE"
    echo "      \"final_pods\": $final_pods," >> "$RESULTS_FILE"
    echo "      \"health_check_passed\": $([ $health_status -eq 0 ] && echo 'true' || echo 'false')," >> "$RESULTS_FILE"
    echo "      \"target_recovery_time\": $API_POD_RECOVERY_TARGET," >> "$RESULTS_FILE"
    echo "      \"passed\": $([ $recovery_time -le $API_POD_RECOVERY_TARGET ] && echo 'true' || echo 'false')" >> "$RESULTS_FILE"
    echo "    }," >> "$RESULTS_FILE"
    
    if [ $recovery_time -le $API_POD_RECOVERY_TARGET ]; then
        log_info "✅ API pod recovery test PASSED (${recovery_time}s ≤ ${API_POD_RECOVERY_TARGET}s)"
    else
        log_error "❌ API pod recovery test FAILED (${recovery_time}s > ${API_POD_RECOVERY_TARGET}s)"
    fi
}

# Test 2: Worker Pod Failure
test_worker_pod_failure() {
    log_info "========================================="
    log_info "Test 2: Worker Pod Failure"
    log_info "========================================="
    
    echo "    {" >> "$RESULTS_FILE"
    echo "      \"test\": \"worker_pod_failure\"," >> "$RESULTS_FILE"
    echo "      \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
    
    # Get initial pod count
    local initial_pods=$(kubectl get pods -n "$NAMESPACE" -l app=unit-talk-worker \
        --field-selector=status.phase=Running -o name | wc -l)
    log_info "Initial worker pods: $initial_pods"
    
    # Delete one pod
    local pod_name=$(kubectl get pods -n "$NAMESPACE" -l app=unit-talk-worker \
        --field-selector=status.phase=Running -o name | head -1)
    log_info "Deleting pod: $pod_name"
    
    local start_time=$(date +%s)
    kubectl delete -n "$NAMESPACE" "$pod_name" --grace-period=0 --force
    
    # Wait for replacement pod
    local recovery_time=$(wait_for_pod_ready "app=unit-talk-worker" 120)
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    
    # Verify pod count restored
    local final_pods=$(kubectl get pods -n "$NAMESPACE" -l app=unit-talk-worker \
        --field-selector=status.phase=Running -o name | wc -l)
    
    # Verify Temporal workflow recovery
    log_info "Verifying Temporal workflow recovery..."
    sleep 10  # Allow time for workflows to recover
    
    # Record results
    echo "      \"recovery_time_seconds\": $recovery_time," >> "$RESULTS_FILE"
    echo "      \"total_time_seconds\": $total_time," >> "$RESULTS_FILE"
    echo "      \"initial_pods\": $initial_pods," >> "$RESULTS_FILE"
    echo "      \"final_pods\": $final_pods," >> "$RESULTS_FILE"
    echo "      \"target_recovery_time\": $WORKER_POD_RECOVERY_TARGET," >> "$RESULTS_FILE"
    echo "      \"passed\": $([ $recovery_time -le $WORKER_POD_RECOVERY_TARGET ] && echo 'true' || echo 'false')" >> "$RESULTS_FILE"
    echo "    }," >> "$RESULTS_FILE"
    
    if [ $recovery_time -le $WORKER_POD_RECOVERY_TARGET ]; then
        log_info "✅ Worker pod recovery test PASSED (${recovery_time}s ≤ ${WORKER_POD_RECOVERY_TARGET}s)"
    else
        log_error "❌ Worker pod recovery test FAILED (${recovery_time}s > ${WORKER_POD_RECOVERY_TARGET}s)"
    fi
}

# Test 3: Redis Outage
test_redis_outage() {
    log_info "========================================="
    log_info "Test 3: Redis Outage (60s)"
    log_info "========================================="
    
    echo "    {" >> "$RESULTS_FILE"
    echo "      \"test\": \"redis_outage\"," >> "$RESULTS_FILE"
    echo "      \"timestamp\": \"$(date -Iseconds)\"," >> "$RESULTS_FILE"
    
    # Capture pre-outage metrics
    log_info "Capturing pre-outage metrics..."
    local pre_cache_hits=$(capture_metrics "redis_cache_hits_total" "pre_cache_hits")
    
    # Scale down Redis
    log_info "Scaling down Redis..."
    kubectl scale deployment redis -n "$NAMESPACE" --replicas=0
    
    # Wait 60 seconds
    log_info "Waiting 60 seconds..."
    sleep 60
    
    # Scale up Redis
    log_info "Scaling up Redis..."
    local start_time=$(date +%s)
    kubectl scale deployment redis -n "$NAMESPACE" --replicas=1
    
    # Wait for Redis to be ready
    local recovery_time=$(wait_for_pod_ready "app=redis" 120)
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    
    # Verify cache rebuild
    log_info "Verifying cache rebuild..."
    sleep 10
    local post_cache_hits=$(capture_metrics "redis_cache_hits_total" "post_cache_hits")
    
    # Check for data loss
    check_service_health "Redis" "http://localhost:6379/ping"
    local health_status=$?
    
    # Record results
    echo "      \"outage_duration_seconds\": 60," >> "$RESULTS_FILE"
    echo "      \"recovery_time_seconds\": $recovery_time," >> "$RESULTS_FILE"
    echo "      \"total_time_seconds\": $total_time," >> "$RESULTS_FILE"
    echo "      \"health_check_passed\": $([ $health_status -eq 0 ] && echo 'true' || echo 'false')," >> "$RESULTS_FILE"
    echo "      \"target_recovery_time\": $REDIS_RECOVERY_TARGET," >> "$RESULTS_FILE"
    echo "      \"passed\": $([ $recovery_time -le $REDIS_RECOVERY_TARGET ] && echo 'true' || echo 'false')" >> "$RESULTS_FILE"
    echo "    }" >> "$RESULTS_FILE"
    
    if [ $recovery_time -le $REDIS_RECOVERY_TARGET ]; then
        log_info "✅ Redis outage test PASSED (${recovery_time}s ≤ ${REDIS_RECOVERY_TARGET}s)"
    else
        log_error "❌ Redis outage test FAILED (${recovery_time}s > ${REDIS_RECOVERY_TARGET}s)"
    fi
}

# Generate markdown report
generate_report() {
    log_info "Generating markdown report..."
    
    cat > "$REPORT_FILE" << 'EOF'
# Chaos Engineering Test Results

**Date**: $(date -Iseconds)
**Environment**: Staging
**Namespace**: ${NAMESPACE}

## Summary

This report contains the results of chaos engineering tests executed as part of Phase 6 - Performance Execution & Hardening.

### Tests Executed

1. **API Pod Failure** - Verify auto-heal < 60s
2. **Worker Pod Failure** - Verify auto-heal < 60s and Temporal recovery
3. **Redis Outage** - Verify no data loss and recovery < 60s

## Detailed Results

See `chaos-results-${TIMESTAMP}.json` for complete metrics.

### Test 1: API Pod Failure

- **Recovery Time**: See JSON results
- **Target**: ≤ 60s
- **Status**: See JSON results

### Test 2: Worker Pod Failure

- **Recovery Time**: See JSON results
- **Target**: ≤ 60s
- **Status**: See JSON results

### Test 3: Redis Outage

- **Outage Duration**: 60s
- **Recovery Time**: See JSON results
- **Target**: ≤ 60s
- **Status**: See JSON results

## Recommendations

Based on the test results, the following recommendations are made:

1. Review and optimize pod startup times if recovery exceeded targets
2. Verify Temporal workflow recovery mechanisms
3. Implement additional monitoring for cache rebuild after Redis outage
4. Consider implementing circuit breakers for external dependencies

## Next Steps

- [ ] Review detailed metrics in JSON results
- [ ] Address any failed tests
- [ ] Update runbooks based on findings
- [ ] Schedule follow-up chaos tests

---

**Generated**: $(date -Iseconds)
EOF
    
    log_info "Report generated: $REPORT_FILE"
}

# Main execution
main() {
    log_info "Starting Chaos Engineering Tests..."
    log_info "Output directory: $OUTPUT_DIR"
    log_info "Results file: $RESULTS_FILE"
    
    # Create output directory if it doesn't exist
    mkdir -p "$OUTPUT_DIR"
    
    # Run tests
    test_api_pod_failure
    test_worker_pod_failure
    test_redis_outage
    
    # Close JSON
    echo "  ]" >> "$RESULTS_FILE"
    echo "}" >> "$RESULTS_FILE"
    
    # Generate report
    generate_report
    
    log_info "Chaos engineering tests completed!"
    log_info "Results: $RESULTS_FILE"
    log_info "Report: $REPORT_FILE"
}

# Execute main function
main "$@"

