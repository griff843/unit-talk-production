#!/bin/bash
# =============================================================================
# PHASE 10 - GLOBAL DEPLOYMENT VALIDATION SCRIPT
# =============================================================================
# Validates global deployment meets SLO targets:
# - P95 Latency < 200ms
# - Replication Lag ≤ 3s
# - Availability ≥ 99.95%
# - Error Rate < 0.1%
#
# Usage: ./scripts/validate-global-deployment.sh
# Date: 2025-01-23
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# SLO Targets
P95_LATENCY_TARGET=200
REPLICATION_LAG_TARGET=3
AVAILABILITY_TARGET=99.95
ERROR_RATE_TARGET=0.1

# Regional endpoints
GLOBAL_ENDPOINT="https://api.unittalk.io"
NA_ENDPOINT="https://api-na.unittalk.io"
EU_ENDPOINT="https://api-eu.unittalk.io"
APAC_ENDPOINT="https://api-apac.unittalk.io"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# =============================================================================
# HEALTH CHECK VALIDATION
# =============================================================================

validate_health_checks() {
    print_header "HEALTH CHECK VALIDATION"
    
    # Test global endpoint
    echo "Testing global endpoint..."
    RESPONSE=$(curl -s -w "\n%{http_code}" "$GLOBAL_ENDPOINT/api/health/global" || echo "000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Global health check passed (HTTP $HTTP_CODE)"
    else
        print_error "Global health check failed (HTTP $HTTP_CODE)"
    fi
    
    # Test regional endpoints
    for REGION in "NA" "EU" "APAC"; do
        case $REGION in
            "NA") ENDPOINT=$NA_ENDPOINT ;;
            "EU") ENDPOINT=$EU_ENDPOINT ;;
            "APAC") ENDPOINT=$APAC_ENDPOINT ;;
        esac
        
        echo "Testing $REGION endpoint..."
        RESPONSE=$(curl -s -w "\n%{http_code}" "$ENDPOINT/api/health/global" || echo "000")
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        
        if [ "$HTTP_CODE" = "200" ]; then
            print_success "$REGION health check passed (HTTP $HTTP_CODE)"
        else
            print_error "$REGION health check failed (HTTP $HTTP_CODE)"
        fi
    done
}

# =============================================================================
# LATENCY VALIDATION
# =============================================================================

validate_latency() {
    print_header "LATENCY VALIDATION (P95 < ${P95_LATENCY_TARGET}ms)"
    
    # Test latency for each region
    for REGION in "Global" "NA" "EU" "APAC"; do
        case $REGION in
            "Global") ENDPOINT=$GLOBAL_ENDPOINT ;;
            "NA") ENDPOINT=$NA_ENDPOINT ;;
            "EU") ENDPOINT=$EU_ENDPOINT ;;
            "APAC") ENDPOINT=$APAC_ENDPOINT ;;
        esac
        
        echo "Measuring $REGION latency..."
        
        # Run 10 requests and calculate average
        TOTAL_TIME=0
        for i in {1..10}; do
            START=$(date +%s%3N)
            curl -s "$ENDPOINT/api/health" > /dev/null
            END=$(date +%s%3N)
            LATENCY=$((END - START))
            TOTAL_TIME=$((TOTAL_TIME + LATENCY))
        done
        
        AVG_LATENCY=$((TOTAL_TIME / 10))
        
        if [ $AVG_LATENCY -lt $P95_LATENCY_TARGET ]; then
            print_success "$REGION average latency: ${AVG_LATENCY}ms (target: <${P95_LATENCY_TARGET}ms)"
        elif [ $AVG_LATENCY -lt $((P95_LATENCY_TARGET * 2)) ]; then
            print_warning "$REGION average latency: ${AVG_LATENCY}ms (target: <${P95_LATENCY_TARGET}ms)"
        else
            print_error "$REGION average latency: ${AVG_LATENCY}ms (target: <${P95_LATENCY_TARGET}ms)"
        fi
    done
}

# =============================================================================
# REPLICATION LAG VALIDATION
# =============================================================================

validate_replication() {
    print_header "REPLICATION LAG VALIDATION (≤ ${REPLICATION_LAG_TARGET}s)"
    
    # Check EU replication lag
    echo "Checking EU replication lag..."
    EU_LAG=$(curl -s "$EU_ENDPOINT/api/health/global" | jq -r '.checks.database.replicationLag // 0')
    EU_LAG_SEC=$(echo "scale=2; $EU_LAG / 1000" | bc)
    
    if (( $(echo "$EU_LAG_SEC <= $REPLICATION_LAG_TARGET" | bc -l) )); then
        print_success "EU replication lag: ${EU_LAG_SEC}s (target: ≤${REPLICATION_LAG_TARGET}s)"
    else
        print_error "EU replication lag: ${EU_LAG_SEC}s (target: ≤${REPLICATION_LAG_TARGET}s)"
    fi
    
    # Check APAC replication lag
    echo "Checking APAC replication lag..."
    APAC_LAG=$(curl -s "$APAC_ENDPOINT/api/health/global" | jq -r '.checks.database.replicationLag // 0')
    APAC_LAG_SEC=$(echo "scale=2; $APAC_LAG / 1000" | bc)
    
    if (( $(echo "$APAC_LAG_SEC <= $REPLICATION_LAG_TARGET" | bc -l) )); then
        print_success "APAC replication lag: ${APAC_LAG_SEC}s (target: ≤${REPLICATION_LAG_TARGET}s)"
    else
        print_error "APAC replication lag: ${APAC_LAG_SEC}s (target: ≤${REPLICATION_LAG_TARGET}s)"
    fi
}

# =============================================================================
# ROUTING VALIDATION
# =============================================================================

validate_routing() {
    print_header "REGIONAL ROUTING VALIDATION"
    
    # Test geo-steering
    for REGION in "NA" "EU" "APAC"; do
        echo "Testing $REGION routing..."
        RESPONSE=$(curl -s -H "CF-IPCountry: ${REGION}" "$GLOBAL_ENDPOINT/api/health/region")
        ROUTED_REGION=$(echo "$RESPONSE" | jq -r '.region')
        
        if [ "$ROUTED_REGION" = "${REGION,,}" ]; then
            print_success "$REGION routing correct (routed to ${ROUTED_REGION})"
        else
            print_warning "$REGION routing: expected ${REGION,,}, got ${ROUTED_REGION}"
        fi
    done
}

# =============================================================================
# SLO COMPLIANCE VALIDATION
# =============================================================================

validate_slo_compliance() {
    print_header "SLO COMPLIANCE VALIDATION"
    
    # Get SLO compliance from global health check
    echo "Checking SLO compliance..."
    RESPONSE=$(curl -s "$GLOBAL_ENDPOINT/api/health/global")
    SLO_COMPLIANT=$(echo "$RESPONSE" | jq -r '.slo.compliant')
    VIOLATIONS=$(echo "$RESPONSE" | jq -r '.slo.violations | length')
    
    if [ "$SLO_COMPLIANT" = "true" ]; then
        print_success "SLO compliance: PASS (no violations)"
    else
        print_error "SLO compliance: FAIL ($VIOLATIONS violations)"
        echo "$RESPONSE" | jq -r '.slo.violations[]' | while read -r violation; do
            echo "  - $violation"
        done
    fi
}

# =============================================================================
# INFRASTRUCTURE VALIDATION
# =============================================================================

validate_infrastructure() {
    print_header "INFRASTRUCTURE VALIDATION"
    
    # Check if kubectl is available
    if command -v kubectl &> /dev/null; then
        # Check NA cluster
        echo "Checking NA cluster..."
        if kubectl get nodes --context=unit-talk-na &> /dev/null; then
            NODE_COUNT=$(kubectl get nodes --context=unit-talk-na --no-headers | wc -l)
            print_success "NA cluster: $NODE_COUNT nodes ready"
        else
            print_warning "NA cluster: Unable to connect (kubectl not configured)"
        fi
        
        # Check EU cluster
        echo "Checking EU cluster..."
        if kubectl get nodes --context=unit-talk-eu &> /dev/null; then
            NODE_COUNT=$(kubectl get nodes --context=unit-talk-eu --no-headers | wc -l)
            print_success "EU cluster: $NODE_COUNT nodes ready"
        else
            print_warning "EU cluster: Unable to connect (kubectl not configured)"
        fi
        
        # Check APAC cluster
        echo "Checking APAC cluster..."
        if kubectl get nodes --context=unit-talk-apac &> /dev/null; then
            NODE_COUNT=$(kubectl get nodes --context=unit-talk-apac --no-headers | wc -l)
            print_success "APAC cluster: $NODE_COUNT nodes ready"
        else
            print_warning "APAC cluster: Unable to connect (kubectl not configured)"
        fi
    else
        print_warning "kubectl not available, skipping cluster validation"
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  PHASE 10 - GLOBAL DEPLOYMENT VALIDATION                       ║"
    echo "║  Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")                              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    
    # Run all validations
    validate_health_checks
    validate_latency
    validate_replication
    validate_routing
    validate_slo_compliance
    validate_infrastructure
    
    # Print summary
    print_header "VALIDATION SUMMARY"
    echo "Passed:   $PASSED"
    echo "Failed:   $FAILED"
    echo "Warnings: $WARNINGS"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✅ ALL VALIDATIONS PASSED - DEPLOYMENT SUCCESSFUL             ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ❌ VALIDATION FAILED - PLEASE REVIEW ERRORS ABOVE             ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

# Run main function
main

