#!/bin/bash
###############################################################################
# Pod Failure Chaos Engineering Test
# Phase 13 - Performance and Reliability Hardening
# Date: 2025-01-25
#
# Purpose: Validate Kubernetes pod failure recovery and resilience
# Target: Recovery time < 60 seconds
# Tests: API pod failures, graceful degradation, auto-healing
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
DEPLOYMENT="${DEPLOYMENT:-unit-talk-api}"
RECOVERY_THRESHOLD=60  # seconds
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-https://api.unit-talk.com/health}"
METRICS_URL="${METRICS_URL:-http://prometheus:9090}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Logging
LOG_FILE="out/ops/chaos/pod-failure-$(date +%Y%m%d-%H%M%S).log"
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
    
    if ! kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" &> /dev/null; then
        log_error "Deployment $DEPLOYMENT not found in namespace $NAMESPACE."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get current pod count
get_pod_count() {
    kubectl get pods -n "$NAMESPACE" -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o json | jq '.items | length'
}

# Get pod names
get_pod_names() {
    kubectl get pods -n "$NAMESPACE" -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}'
}

# Check API health
check_api_health() {
    local max_attempts=5
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$HEALTH_CHECK_URL" -o /dev/null; then
            return 0
        fi
        sleep 2
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

# Test 1: Single Pod Failure
test_single_pod_failure() {
    log "=========================================="
    log "Test 1: Single Pod Failure"
    log "=========================================="
    
    local initial_pod_count
    initial_pod_count=$(get_pod_count)
    log "Initial pod count: $initial_pod_count"
    
    # Get a random pod to kill
    local pods
    pods=($(get_pod_names))
    local target_pod="${pods[0]}"
    
    log "Target pod for deletion: $target_pod"
    
    # Record start time
    local start_time
    start_time=$(date +%s)
    
    # Delete the pod
    log "Deleting pod $target_pod..."
    kubectl delete pod "$target_pod" -n "$NAMESPACE" --grace-period=0 --force
    
    # Wait for pod to be recreated
    log "Waiting for pod recreation..."
    local recovery_time=0
    local max_wait=120
    
    while [[ $recovery_time -lt $max_wait ]]; do
        sleep 2
        recovery_time=$((recovery_time + 2))
        
        local current_pod_count
        current_pod_count=$(get_pod_count)
        
        if [[ $current_pod_count -ge $initial_pod_count ]]; then
            # Check if API is healthy
            if check_api_health; then
                local end_time
                end_time=$(date +%s)
                recovery_time=$(measure_recovery_time "$start_time" "$end_time")
                
                log_success "Pod recovered in ${recovery_time}s"
                
                if [[ $recovery_time -le $RECOVERY_THRESHOLD ]]; then
                    log_success "✅ Recovery time within threshold (${recovery_time}s <= ${RECOVERY_THRESHOLD}s)"
                    send_slack_notification "Pod failure test passed: Recovery in ${recovery_time}s" "good"
                    return 0
                else
                    log_error "❌ Recovery time exceeded threshold (${recovery_time}s > ${RECOVERY_THRESHOLD}s)"
                    send_slack_notification "Pod failure test failed: Recovery took ${recovery_time}s (threshold: ${RECOVERY_THRESHOLD}s)" "danger"
                    return 1
                fi
            fi
        fi
    done
    
    log_error "Pod failed to recover within ${max_wait}s"
    send_slack_notification "Pod failure test failed: No recovery after ${max_wait}s" "danger"
    return 1
}

# Test 2: Multiple Pod Failures (50% of pods)
test_multiple_pod_failures() {
    log "=========================================="
    log "Test 2: Multiple Pod Failures (50%)"
    log "=========================================="
    
    local initial_pod_count
    initial_pod_count=$(get_pod_count)
    log "Initial pod count: $initial_pod_count"
    
    local pods_to_kill=$((initial_pod_count / 2))
    [[ $pods_to_kill -lt 1 ]] && pods_to_kill=1
    
    log "Pods to delete: $pods_to_kill"
    
    # Get pods to kill
    local pods
    pods=($(get_pod_names))
    
    # Record start time
    local start_time
    start_time=$(date +%s)
    
    # Delete multiple pods
    log "Deleting $pods_to_kill pods..."
    for ((i=0; i<pods_to_kill; i++)); do
        if [[ -n "${pods[$i]}" ]]; then
            log "Deleting pod ${pods[$i]}..."
            kubectl delete pod "${pods[$i]}" -n "$NAMESPACE" --grace-period=0 --force &
        fi
    done
    wait
    
    # Wait for recovery
    log "Waiting for recovery..."
    local recovery_time=0
    local max_wait=120
    
    while [[ $recovery_time -lt $max_wait ]]; do
        sleep 3
        recovery_time=$((recovery_time + 3))
        
        local current_pod_count
        current_pod_count=$(get_pod_count)
        
        if [[ $current_pod_count -ge $initial_pod_count ]]; then
            if check_api_health; then
                local end_time
                end_time=$(date +%s)
                recovery_time=$(measure_recovery_time "$start_time" "$end_time")
                
                log_success "Pods recovered in ${recovery_time}s"
                
                if [[ $recovery_time -le $RECOVERY_THRESHOLD ]]; then
                    log_success "✅ Recovery time within threshold (${recovery_time}s <= ${RECOVERY_THRESHOLD}s)"
                    send_slack_notification "Multiple pod failure test passed: Recovery in ${recovery_time}s" "good"
                    return 0
                else
                    log_error "❌ Recovery time exceeded threshold (${recovery_time}s > ${RECOVERY_THRESHOLD}s)"
                    send_slack_notification "Multiple pod failure test failed: Recovery took ${recovery_time}s" "danger"
                    return 1
                fi
            fi
        fi
    done
    
    log_error "Pods failed to recover within ${max_wait}s"
    send_slack_notification "Multiple pod failure test failed: No recovery after ${max_wait}s" "danger"
    return 1
}

# Test 3: Rolling Pod Failures
test_rolling_pod_failures() {
    log "=========================================="
    log "Test 3: Rolling Pod Failures"
    log "=========================================="
    
    local pods
    pods=($(get_pod_names))
    local total_pods=${#pods[@]}
    
    log "Total pods: $total_pods"
    
    local failures=0
    local successes=0
    
    for pod in "${pods[@]}"; do
        log "Deleting pod $pod..."
        kubectl delete pod "$pod" -n "$NAMESPACE" --grace-period=0 --force
        
        # Wait for API to remain healthy
        sleep 5
        
        if check_api_health; then
            log_success "API remained healthy after deleting $pod"
            ((successes++))
        else
            log_error "API became unhealthy after deleting $pod"
            ((failures++))
        fi
        
        # Wait for pod to be recreated before killing next one
        sleep 10
    done
    
    log "Rolling failures completed: $successes successes, $failures failures"
    
    if [[ $failures -eq 0 ]]; then
        log_success "✅ All rolling pod failures handled gracefully"
        send_slack_notification "Rolling pod failure test passed: ${successes}/${total_pods} successful" "good"
        return 0
    else
        log_error "❌ Some rolling pod failures caused API downtime"
        send_slack_notification "Rolling pod failure test failed: ${failures}/${total_pods} caused downtime" "danger"
        return 1
    fi
}

# Generate report
generate_report() {
    local test_results="$1"
    
    log "=========================================="
    log "Chaos Engineering Report - Pod Failures"
    log "=========================================="
    log "Timestamp: $(date)"
    log "Namespace: $NAMESPACE"
    log "Deployment: $DEPLOYMENT"
    log "Recovery Threshold: ${RECOVERY_THRESHOLD}s"
    log ""
    log "Test Results:"
    echo "$test_results" | tee -a "$LOG_FILE"
    log ""
    log "Full log: $LOG_FILE"
    log "=========================================="
}

# Main execution
main() {
    log "🔥 Starting Pod Failure Chaos Engineering Tests"
    log "Target: Recovery time < ${RECOVERY_THRESHOLD}s"
    
    check_prerequisites
    
    local test_results=""
    local all_passed=true
    
    # Run tests
    if test_single_pod_failure; then
        test_results+="✅ Single Pod Failure: PASSED\n"
    else
        test_results+="❌ Single Pod Failure: FAILED\n"
        all_passed=false
    fi
    
    sleep 30  # Cool down between tests
    
    if test_multiple_pod_failures; then
        test_results+="✅ Multiple Pod Failures: PASSED\n"
    else
        test_results+="❌ Multiple Pod Failures: FAILED\n"
        all_passed=false
    fi
    
    sleep 30  # Cool down between tests
    
    if test_rolling_pod_failures; then
        test_results+="✅ Rolling Pod Failures: PASSED\n"
    else
        test_results+="❌ Rolling Pod Failures: FAILED\n"
        all_passed=false
    fi
    
    # Generate report
    generate_report "$test_results"
    
    if $all_passed; then
        log_success "🎉 All chaos engineering tests passed!"
        exit 0
    else
        log_error "💥 Some chaos engineering tests failed"
        exit 1
    fi
}

# Run main function
main "$@"

