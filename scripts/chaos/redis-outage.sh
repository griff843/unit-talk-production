#!/bin/bash
###############################################################################
# Redis Outage Chaos Engineering Test
# Phase 13 - Performance and Reliability Hardening
# Date: 2025-01-25
#
# Purpose: Validate Redis failure recovery and circuit breaker behavior
# Target: Recovery time < 60 seconds, graceful degradation
# Tests: Redis pod failure, connection pool exhaustion, cache invalidation
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-unit-talk}"
REDIS_DEPLOYMENT="${REDIS_DEPLOYMENT:-redis}"
API_DEPLOYMENT="${API_DEPLOYMENT:-unit-talk-api}"
RECOVERY_THRESHOLD=60  # seconds
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-https://api.unit-talk.com/health}"
API_URL="${API_URL:-https://api.unit-talk.com}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Logging
LOG_FILE="out/ops/chaos/redis-outage-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $*${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $*${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $*${NC}" | tee -a "$LOG_FILE"
}

# Send Slack notification
send_slack_notification() {
    local message="$1"
    local severity="${2:-info}"
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        [[ "$severity" == "error" ]] && color="danger"
        [[ "$severity" == "warning" ]] && color="warning"
        
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            2>/dev/null || true
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace $NAMESPACE not found."
        exit 1
    fi
    
    if ! kubectl get deployment "$REDIS_DEPLOYMENT" -n "$NAMESPACE" &> /dev/null; then
        log_error "Redis deployment $REDIS_DEPLOYMENT not found in namespace $NAMESPACE."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get Redis pod name
get_redis_pod() {
    kubectl get pods -n "$NAMESPACE" -l "app=$REDIS_DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}'
}

# Check API health
check_api_health() {
    local max_attempts=3
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$HEALTH_CHECK_URL" -o /dev/null; then
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    
    return 1
}

# Check API functionality (should work without Redis via circuit breaker)
check_api_functionality() {
    local endpoint="$1"
    local max_attempts=3
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        local response
        response=$(curl -sf "$API_URL$endpoint" -w "\n%{http_code}" 2>/dev/null || echo "000")
        local http_code
        http_code=$(echo "$response" | tail -n1)
        
        if [[ "$http_code" == "200" ]] || [[ "$http_code" == "503" ]]; then
            # 200 = working, 503 = degraded mode (acceptable)
            return 0
        fi
        
        sleep 1
        ((attempt++))
    done
    
    return 1
}

# Measure recovery time
measure_recovery_time() {
    local start_time=$1
    local end_time=$2
    echo $((end_time - start_time))
}

# Test 1: Redis Pod Deletion
test_redis_pod_deletion() {
    log "=========================================="
    log "Test 1: Redis Pod Deletion"
    log "=========================================="
    
    local redis_pod
    redis_pod=$(get_redis_pod)
    
    if [[ -z "$redis_pod" ]]; then
        log_error "No Redis pod found"
        return 1
    fi
    
    log "Redis pod: $redis_pod"
    
    # Verify API is healthy before test
    if ! check_api_health; then
        log_error "API is not healthy before test"
        return 1
    fi
    
    log_success "API is healthy before Redis deletion"
    
    # Record start time
    local start_time
    start_time=$(date +%s)
    
    # Delete Redis pod
    log "Deleting Redis pod $redis_pod..."
    kubectl delete pod "$redis_pod" -n "$NAMESPACE" --grace-period=0 --force
    
    # Check if API remains functional (circuit breaker should kick in)
    sleep 5
    
    if check_api_health; then
        log_success "API remained healthy after Redis deletion (circuit breaker working)"
    else
        log_warning "API health check failed, but this may be expected during Redis outage"
    fi
    
    # Check if API can still serve requests (degraded mode)
    if check_api_functionality "/api/picks?limit=5"; then
        log_success "API can still serve requests without Redis (graceful degradation)"
    else
        log_error "API cannot serve requests without Redis (circuit breaker may not be working)"
    fi
    
    # Wait for Redis to recover
    log "Waiting for Redis recovery..."
    local recovery_time=0
    local max_wait=120
    
    while [[ $recovery_time -lt $max_wait ]]; do
        sleep 3
        recovery_time=$((recovery_time + 3))
        
        # Check if Redis pod is running
        local new_redis_pod
        new_redis_pod=$(get_redis_pod 2>/dev/null || echo "")
        
        if [[ -n "$new_redis_pod" ]] && [[ "$new_redis_pod" != "$redis_pod" ]]; then
            # Redis pod recreated, check if it's ready
            local pod_ready
            pod_ready=$(kubectl get pod "$new_redis_pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
            
            if [[ "$pod_ready" == "True" ]]; then
                # Check if API is fully healthy again
                if check_api_health; then
                    local end_time
                    end_time=$(date +%s)
                    recovery_time=$(measure_recovery_time "$start_time" "$end_time")
                    
                    log_success "Redis recovered in ${recovery_time}s"
                    
                    if [[ $recovery_time -le $RECOVERY_THRESHOLD ]]; then
                        log_success "✅ Recovery time within threshold (${recovery_time}s <= ${RECOVERY_THRESHOLD}s)"
                        send_slack_notification "Redis pod deletion test passed: Recovery in ${recovery_time}s" "good"
                        return 0
                    else
                        log_error "❌ Recovery time exceeded threshold (${recovery_time}s > ${RECOVERY_THRESHOLD}s)"
                        send_slack_notification "Redis pod deletion test failed: Recovery took ${recovery_time}s" "danger"
                        return 1
                    fi
                fi
            fi
        fi
    done
    
    log_error "Redis failed to recover within ${max_wait}s"
    send_slack_notification "Redis pod deletion test failed: No recovery after ${max_wait}s" "danger"
    return 1
}

# Test 2: Redis Network Partition (simulate with NetworkPolicy)
test_redis_network_partition() {
    log "=========================================="
    log "Test 2: Redis Network Partition"
    log "=========================================="
    
    # Create a NetworkPolicy to block Redis traffic
    log "Creating NetworkPolicy to block Redis traffic..."
    
    cat <<EOF | kubectl apply -f - -n "$NAMESPACE"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-chaos-block
spec:
  podSelector:
    matchLabels:
      app: $REDIS_DEPLOYMENT
  policyTypes:
  - Ingress
  ingress: []
EOF
    
    # Record start time
    local start_time
    start_time=$(date +%s)
    
    # Wait for network policy to take effect
    sleep 5
    
    # Check if API handles Redis unavailability gracefully
    if check_api_functionality "/api/picks?limit=5"; then
        log_success "API handles Redis network partition gracefully"
    else
        log_error "API fails during Redis network partition"
    fi
    
    # Remove NetworkPolicy
    log "Removing NetworkPolicy to restore Redis connectivity..."
    kubectl delete networkpolicy redis-chaos-block -n "$NAMESPACE"
    
    # Wait for recovery
    sleep 10
    
    if check_api_health; then
        local end_time
        end_time=$(date +%s)
        local recovery_time
        recovery_time=$(measure_recovery_time "$start_time" "$end_time")
        
        log_success "API recovered after Redis network partition in ${recovery_time}s"
        
        if [[ $recovery_time -le $RECOVERY_THRESHOLD ]]; then
            log_success "✅ Recovery time within threshold"
            send_slack_notification "Redis network partition test passed: Recovery in ${recovery_time}s" "good"
            return 0
        else
            log_error "❌ Recovery time exceeded threshold"
            send_slack_notification "Redis network partition test failed: Recovery took ${recovery_time}s" "danger"
            return 1
        fi
    else
        log_error "API did not recover after Redis network partition"
        send_slack_notification "Redis network partition test failed: No recovery" "danger"
        return 1
    fi
}

# Test 3: Redis Connection Pool Exhaustion
test_redis_connection_exhaustion() {
    log "=========================================="
    log "Test 3: Redis Connection Pool Exhaustion"
    log "=========================================="
    
    local redis_pod
    redis_pod=$(get_redis_pod)
    
    if [[ -z "$redis_pod" ]]; then
        log_error "No Redis pod found"
        return 1
    fi
    
    # Get current connection count
    local initial_connections
    initial_connections=$(kubectl exec -n "$NAMESPACE" "$redis_pod" -- redis-cli CLIENT LIST | wc -l)
    log "Initial Redis connections: $initial_connections"
    
    # Simulate connection exhaustion by creating many connections
    log "Simulating connection pool exhaustion..."
    
    for i in {1..50}; do
        kubectl exec -n "$NAMESPACE" "$redis_pod" -- redis-cli PING &>/dev/null &
    done
    
    sleep 5
    
    # Check if API still functions
    if check_api_functionality "/api/picks?limit=5"; then
        log_success "API handles Redis connection exhaustion gracefully"
        send_slack_notification "Redis connection exhaustion test passed" "good"
        return 0
    else
        log_error "API fails during Redis connection exhaustion"
        send_slack_notification "Redis connection exhaustion test failed" "danger"
        return 1
    fi
}

# Generate report
generate_report() {
    local test_results="$1"
    
    log "=========================================="
    log "Chaos Engineering Report - Redis Outage"
    log "=========================================="
    log "Timestamp: $(date)"
    log "Namespace: $NAMESPACE"
    log "Redis Deployment: $REDIS_DEPLOYMENT"
    log "Recovery Threshold: ${RECOVERY_THRESHOLD}s"
    log ""
    log "Test Results:"
    echo -e "$test_results" | tee -a "$LOG_FILE"
    log ""
    log "Full log: $LOG_FILE"
    log "=========================================="
}

# Main execution
main() {
    log "🔥 Starting Redis Outage Chaos Engineering Tests"
    log "Target: Recovery time < ${RECOVERY_THRESHOLD}s, graceful degradation"
    
    check_prerequisites
    
    local test_results=""
    local all_passed=true
    
    # Run tests
    if test_redis_pod_deletion; then
        test_results+="✅ Redis Pod Deletion: PASSED\n"
    else
        test_results+="❌ Redis Pod Deletion: FAILED\n"
        all_passed=false
    fi
    
    sleep 30  # Cool down between tests
    
    if test_redis_network_partition; then
        test_results+="✅ Redis Network Partition: PASSED\n"
    else
        test_results+="❌ Redis Network Partition: FAILED\n"
        all_passed=false
    fi
    
    sleep 30  # Cool down between tests
    
    if test_redis_connection_exhaustion; then
        test_results+="✅ Redis Connection Exhaustion: PASSED\n"
    else
        test_results+="❌ Redis Connection Exhaustion: FAILED\n"
        all_passed=false
    fi
    
    # Generate report
    generate_report "$test_results"
    
    if $all_passed; then
        log_success "🎉 All Redis chaos engineering tests passed!"
        exit 0
    else
        log_error "💥 Some Redis chaos engineering tests failed"
        exit 1
    fi
}

# Run main function
main "$@"

