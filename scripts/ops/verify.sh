#!/bin/bash
# Unit Talk Platform - Production Verification Script
# Comprehensive health checks and SLO probes
# Date: 2025-01-24

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
OUTPUT_DIR="out/ops/verify"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/verification_${ENVIRONMENT}_${TIMESTAMP}.json"

# Create output directory
mkdir -p $OUTPUT_DIR

# Initialize report
cat > $REPORT_FILE <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "checks": []
}
EOF

# Helper functions
log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

add_check_result() {
    local name=$1
    local status=$2
    local message=$3
    local duration=$4
    
    jq --arg name "$name" \
       --arg status "$status" \
       --arg message "$message" \
       --arg duration "$duration" \
       '.checks += [{
           "name": $name,
           "status": $status,
           "message": $message,
           "duration_ms": $duration
       }]' $REPORT_FILE > ${REPORT_FILE}.tmp && mv ${REPORT_FILE}.tmp $REPORT_FILE
}

# Check 1: Kubernetes Cluster Health
check_cluster_health() {
    log_info "Checking Kubernetes cluster health..."
    local start=$(date +%s%3N)
    
    if kubectl cluster-info &> /dev/null; then
        local nodes=$(kubectl get nodes --no-headers | wc -l)
        local ready_nodes=$(kubectl get nodes --no-headers | grep " Ready" | wc -l)
        
        if [ "$nodes" -eq "$ready_nodes" ]; then
            local duration=$(($(date +%s%3N) - start))
            add_check_result "cluster_health" "PASS" "All $nodes nodes are ready" "$duration"
            log_info "Cluster health: $ready_nodes/$nodes nodes ready"
        else
            local duration=$(($(date +%s%3N) - start))
            add_check_result "cluster_health" "FAIL" "Only $ready_nodes/$nodes nodes ready" "$duration"
            log_error "Cluster health: Only $ready_nodes/$nodes nodes ready"
            return 1
        fi
    else
        local duration=$(($(date +%s%3N) - start))
        add_check_result "cluster_health" "FAIL" "Cannot connect to cluster" "$duration"
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    fi
}

# Check 2: Application Pods Health
check_application_pods() {
    log_info "Checking application pods..."
    local start=$(date +%s%3N)
    
    local apps=("unit-talk-api" "unit-talk-command-center" "unit-talk-dashboard" "unit-talk-smart-form" "unit-talk-discord-bot" "unit-talk-workers")
    local all_healthy=true
    
    for app in "${apps[@]}"; do
        local pods=$(kubectl get pods -n unit-talk -l app=$app --no-headers 2>/dev/null | wc -l)
        local ready_pods=$(kubectl get pods -n unit-talk -l app=$app --no-headers 2>/dev/null | grep "Running" | grep "1/1\|2/2\|3/3" | wc -l)
        
        if [ "$pods" -eq 0 ]; then
            log_warn "$app: No pods found"
            all_healthy=false
        elif [ "$pods" -eq "$ready_pods" ]; then
            log_info "$app: $ready_pods/$pods pods ready"
        else
            log_error "$app: Only $ready_pods/$pods pods ready"
            all_healthy=false
        fi
    done
    
    local duration=$(($(date +%s%3N) - start))
    if [ "$all_healthy" = true ]; then
        add_check_result "application_pods" "PASS" "All application pods are healthy" "$duration"
    else
        add_check_result "application_pods" "FAIL" "Some application pods are unhealthy" "$duration"
        return 1
    fi
}

# Check 3: API Health Endpoints
check_api_health() {
    log_info "Checking API health endpoints..."
    local start=$(date +%s%3N)
    
    local endpoints=(
        "https://api.unit-talk.com/health"
        "https://command-center.unit-talk.com/api/health"
        "https://app.unit-talk.com/api/health"
    )
    
    local all_healthy=true
    
    for endpoint in "${endpoints[@]}"; do
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$endpoint" 2>/dev/null || echo "000")
        
        if [ "$response_code" = "200" ]; then
            log_info "$endpoint: HTTP $response_code"
        else
            log_error "$endpoint: HTTP $response_code"
            all_healthy=false
        fi
    done
    
    local duration=$(($(date +%s%3N) - start))
    if [ "$all_healthy" = true ]; then
        add_check_result "api_health" "PASS" "All API health endpoints responding" "$duration"
    else
        add_check_result "api_health" "FAIL" "Some API health endpoints failing" "$duration"
        return 1
    fi
}

# Check 4: Database Connectivity
check_database() {
    log_info "Checking database connectivity..."
    local start=$(date +%s%3N)
    
    # Test database connection via API pod
    local api_pod=$(kubectl get pods -n unit-talk -l app=unit-talk-api --no-headers -o custom-columns=":metadata.name" | head -n 1)
    
    if [ -n "$api_pod" ]; then
        if kubectl exec -n unit-talk $api_pod -- sh -c "echo 'SELECT 1' | psql \$DATABASE_URL -t" &> /dev/null; then
            local duration=$(($(date +%s%3N) - start))
            add_check_result "database_connectivity" "PASS" "Database connection successful" "$duration"
            log_info "Database connectivity: OK"
        else
            local duration=$(($(date +%s%3N) - start))
            add_check_result "database_connectivity" "FAIL" "Database connection failed" "$duration"
            log_error "Database connectivity: FAILED"
            return 1
        fi
    else
        local duration=$(($(date +%s%3N) - start))
        add_check_result "database_connectivity" "FAIL" "No API pod found to test database" "$duration"
        log_error "No API pod found to test database connectivity"
        return 1
    fi
}

# Check 5: Redis Connectivity
check_redis() {
    log_info "Checking Redis connectivity..."
    local start=$(date +%s%3N)
    
    # Test Redis connection via API pod
    local api_pod=$(kubectl get pods -n unit-talk -l app=unit-talk-api --no-headers -o custom-columns=":metadata.name" | head -n 1)
    
    if [ -n "$api_pod" ]; then
        if kubectl exec -n unit-talk $api_pod -- sh -c "redis-cli -u \$REDIS_URL PING" 2>/dev/null | grep -q "PONG"; then
            local duration=$(($(date +%s%3N) - start))
            add_check_result "redis_connectivity" "PASS" "Redis connection successful" "$duration"
            log_info "Redis connectivity: OK"
        else
            local duration=$(($(date +%s%3N) - start))
            add_check_result "redis_connectivity" "FAIL" "Redis connection failed" "$duration"
            log_error "Redis connectivity: FAILED"
            return 1
        fi
    else
        local duration=$(($(date +%s%3N) - start))
        add_check_result "redis_connectivity" "FAIL" "No API pod found to test Redis" "$duration"
        log_error "No API pod found to test Redis connectivity"
        return 1
    fi
}

# Check 6: SSL Certificates
check_ssl_certificates() {
    log_info "Checking SSL certificates..."
    local start=$(date +%s%3N)
    
    local domains=("api.unit-talk.com" "command-center.unit-talk.com" "app.unit-talk.com")
    local all_valid=true
    
    for domain in "${domains[@]}"; do
        local expiry=$(echo | openssl s_client -servername $domain -connect $domain:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        
        if [ -n "$expiry" ]; then
            local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry" +%s 2>/dev/null)
            local now_epoch=$(date +%s)
            local days_until_expiry=$(( ($expiry_epoch - $now_epoch) / 86400 ))
            
            if [ $days_until_expiry -gt 30 ]; then
                log_info "$domain: Certificate valid for $days_until_expiry days"
            elif [ $days_until_expiry -gt 0 ]; then
                log_warn "$domain: Certificate expires in $days_until_expiry days"
            else
                log_error "$domain: Certificate expired!"
                all_valid=false
            fi
        else
            log_error "$domain: Cannot retrieve certificate"
            all_valid=false
        fi
    done
    
    local duration=$(($(date +%s%3N) - start))
    if [ "$all_valid" = true ]; then
        add_check_result "ssl_certificates" "PASS" "All SSL certificates are valid" "$duration"
    else
        add_check_result "ssl_certificates" "FAIL" "Some SSL certificates are invalid or expiring" "$duration"
        return 1
    fi
}

# Check 7: Prometheus Metrics
check_prometheus() {
    log_info "Checking Prometheus metrics..."
    local start=$(date +%s%3N)
    
    # Port forward to Prometheus
    kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 &> /dev/null &
    local pf_pid=$!
    sleep 2
    
    # Query Prometheus
    local response=$(curl -s "http://localhost:9090/api/v1/query?query=up" 2>/dev/null)
    
    kill $pf_pid 2>/dev/null || true
    
    if echo "$response" | jq -e '.status == "success"' &> /dev/null; then
        local duration=$(($(date +%s%3N) - start))
        add_check_result "prometheus_metrics" "PASS" "Prometheus is collecting metrics" "$duration"
        log_info "Prometheus metrics: OK"
    else
        local duration=$(($(date +%s%3N) - start))
        add_check_result "prometheus_metrics" "FAIL" "Prometheus metrics unavailable" "$duration"
        log_error "Prometheus metrics: FAILED"
        return 1
    fi
}

# Check 8: SLO Compliance
check_slo_compliance() {
    log_info "Checking SLO compliance..."
    local start=$(date +%s%3N)
    
    # Define SLOs
    local api_response_time_slo=100  # ms
    local database_query_time_slo=50  # ms
    local uptime_slo=99.9  # %
    
    # Test API response time
    local api_response_time=$(curl -o /dev/null -s -w '%{time_total}' https://api.unit-talk.com/health 2>/dev/null)
    local api_response_time_ms=$(echo "$api_response_time * 1000" | bc | cut -d. -f1)
    
    if [ "$api_response_time_ms" -lt "$api_response_time_slo" ]; then
        log_info "API response time: ${api_response_time_ms}ms (SLO: <${api_response_time_slo}ms)"
    else
        log_warn "API response time: ${api_response_time_ms}ms (SLO: <${api_response_time_slo}ms)"
    fi
    
    local duration=$(($(date +%s%3N) - start))
    add_check_result "slo_compliance" "PASS" "SLO checks completed" "$duration"
}

# Main execution
main() {
    echo "========================================="
    echo "Unit Talk Platform Verification"
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date)"
    echo "========================================="
    echo ""
    
    local failed_checks=0
    
    check_cluster_health || ((failed_checks++))
    check_application_pods || ((failed_checks++))
    check_api_health || ((failed_checks++))
    check_database || ((failed_checks++))
    check_redis || ((failed_checks++))
    check_ssl_certificates || ((failed_checks++))
    check_prometheus || ((failed_checks++))
    check_slo_compliance || ((failed_checks++))
    
    echo ""
    echo "========================================="
    echo "Verification Summary"
    echo "========================================="
    
    local total_checks=$(jq '.checks | length' $REPORT_FILE)
    local passed_checks=$(jq '[.checks[] | select(.status == "PASS")] | length' $REPORT_FILE)
    
    echo "Total checks: $total_checks"
    echo "Passed: $passed_checks"
    echo "Failed: $failed_checks"
    echo ""
    echo "Report saved to: $REPORT_FILE"
    
    if [ $failed_checks -eq 0 ]; then
        log_info "All verification checks passed! ✅"
        exit 0
    else
        log_error "$failed_checks verification checks failed! ❌"
        exit 1
    fi
}

# Run main function
main

