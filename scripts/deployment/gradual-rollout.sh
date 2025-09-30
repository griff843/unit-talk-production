#!/bin/bash

# =============================================
# Unit Talk Syndicate-Grade Gradual Rollout Script
# Comprehensive deployment orchestration with safety gates
# =============================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Environment configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
FEATURE_FLAG="${FEATURE_FLAG:-}"
TARGET_PERCENTAGE="${TARGET_PERCENTAGE:-100}"
STEP_SIZE="${STEP_SIZE:-25}"
STABILIZATION_PERIOD="${STABILIZATION_PERIOD:-300}"
MAX_ROLLOUT_DURATION="${MAX_ROLLOUT_DURATION:-14400}"
VALIDATION_ENABLED="${VALIDATION_ENABLED:-true}"
AUTO_ROLLBACK="${AUTO_ROLLBACK:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log_info "Cleanup initiated with exit code: $exit_code"
    
    if [[ $exit_code -ne 0 && "$AUTO_ROLLBACK" == "true" ]]; then
        log_warning "Non-zero exit code detected, triggering emergency rollback"
        emergency_rollback "Script failure during deployment"
    fi
    
    # Clean up temporary files
    [[ -f "/tmp/rollout_state.json" ]] && rm -f "/tmp/rollout_state.json"
    [[ -f "/tmp/rollout_metrics.json" ]] && rm -f "/tmp/rollout_metrics.json"
    
    exit $exit_code
}

trap cleanup EXIT

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Syndicate-Grade Gradual Rollout Script for Unit Talk Platform

OPTIONS:
    -f, --feature-flag FLAG          Feature flag name to rollout (required)
    -p, --percentage TARGET          Target rollout percentage (default: 100)
    -s, --step-size SIZE            Rollout step size (default: 25)
    -w, --wait SECONDS              Stabilization period between steps (default: 300)
    -e, --environment ENV           Environment (default: production)
    -t, --timeout SECONDS           Max rollout duration (default: 14400)
    --no-validation                 Disable validation gates
    --no-auto-rollback             Disable automatic rollback
    --dry-run                      Preview rollout plan without execution
    -h, --help                     Show this help message

EXAMPLES:
    # Rollout enhanced grading to 50% with 5% steps
    $0 -f enhanced_45_factor_grading -p 50 -s 5
    
    # Full rollout with custom stabilization period
    $0 -f hot_warm_cold_pipeline -p 100 -w 600
    
    # Dry run to preview deployment plan
    $0 -f event_driven_alert_agent --dry-run

FEATURE FLAGS:
    - enhanced_45_factor_grading
    - event_driven_alert_agent 
    - hot_warm_cold_pipeline
    - feature_store_integration
    - slo_monitoring_system

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--feature-flag)
                FEATURE_FLAG="$2"
                shift 2
                ;;
            -p|--percentage)
                TARGET_PERCENTAGE="$2"
                shift 2
                ;;
            -s|--step-size)
                STEP_SIZE="$2"
                shift 2
                ;;
            -w|--wait)
                STABILIZATION_PERIOD="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--timeout)
                MAX_ROLLOUT_DURATION="$2"
                shift 2
                ;;
            --no-validation)
                VALIDATION_ENABLED="false"
                shift
                ;;
            --no-auto-rollback)
                AUTO_ROLLBACK="false"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate configuration
validate_config() {
    log_step "Validating deployment configuration"
    
    if [[ -z "$FEATURE_FLAG" ]]; then
        log_error "Feature flag name is required. Use -f or --feature-flag"
        exit 1
    fi
    
    if [[ ! "$TARGET_PERCENTAGE" =~ ^[0-9]+$ ]] || [[ "$TARGET_PERCENTAGE" -lt 0 ]] || [[ "$TARGET_PERCENTAGE" -gt 100 ]]; then
        log_error "Target percentage must be between 0 and 100"
        exit 1
    fi
    
    if [[ ! "$STEP_SIZE" =~ ^[0-9]+$ ]] || [[ "$STEP_SIZE" -lt 1 ]] || [[ "$STEP_SIZE" -gt 50 ]]; then
        log_error "Step size must be between 1 and 50"
        exit 1
    fi
    
    # Validate Docker environment
    if ! docker-compose --version >/dev/null 2>&1; then
        log_error "Docker Compose is required but not available"
        exit 1
    fi
    
    # Validate API connectivity
    if ! curl -sf "http://localhost:3000/health" >/dev/null 2>&1; then
        log_error "API service is not available at http://localhost:3000"
        log_info "Please run './dev.sh start' to start all services"
        exit 1
    fi
    
    log_success "Configuration validation passed"
}

# Get current rollout percentage
get_current_percentage() {
    local flag_name="$1"
    
    local current_percentage
    current_percentage=$(docker-compose exec -T api node -e "
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        async function getCurrentPercentage() {
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const service = new FeatureFlagService(supabase);
            const evaluation = await service.evaluateFlag('$flag_name');
            
            // Get flag config directly
            const { data } = await supabase
                .from('feature_flags')
                .select('rollout_percentage')
                .eq('flag_name', '$flag_name')
                .single();
                
            console.log(data?.rollout_percentage || 0);
        }
        
        getCurrentPercentage().catch(() => console.log(0));
    " 2>/dev/null)
    
    echo "${current_percentage:-0}"
}

# Calculate rollout steps
calculate_steps() {
    local current="$1"
    local target="$2"
    local step_size="$3"
    
    local steps=()
    
    if [[ $target -gt $current ]]; then
        # Increasing rollout
        for ((percentage = current + step_size; percentage <= target; percentage += step_size)); do
            if [[ $percentage -gt $target ]]; then
                percentage=$target
            fi
            steps+=($percentage)
            if [[ $percentage -eq $target ]]; then
                break
            fi
        done
        if [[ ${steps[-1]:-0} -ne $target ]]; then
            steps+=($target)
        fi
    elif [[ $target -lt $current ]]; then
        # Decreasing rollout (rollback)
        for ((percentage = current - step_size; percentage >= target; percentage -= step_size)); do
            if [[ $percentage -lt $target ]]; then
                percentage=$target
            fi
            steps+=($percentage)
            if [[ $percentage -eq $target ]]; then
                break
            fi
        done
        if [[ ${steps[-1]:-$current} -ne $target ]]; then
            steps+=($target)
        fi
    fi
    
    echo "${steps[@]}"
}

# Update feature flag percentage
update_flag_percentage() {
    local flag_name="$1"
    local percentage="$2"
    
    log_info "Updating $flag_name rollout to $percentage%"
    
    local result
    result=$(docker-compose exec -T api node -e "
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        async function updateFlag() {
            try {
                const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                const service = new FeatureFlagService(supabase);
                
                await service.updateFlag('$flag_name', {
                    rolloutPercentage: $percentage,
                    enabled: true
                });
                
                console.log('SUCCESS');
            } catch (error) {
                console.log('ERROR: ' + error.message);
            }
        }
        
        updateFlag();
    " 2>/dev/null)
    
    if [[ "$result" == "SUCCESS" ]]; then
        log_success "Successfully updated $flag_name to $percentage%"
        return 0
    else
        log_error "Failed to update flag: $result"
        return 1
    fi
}

# Run health checks
run_health_checks() {
    log_info "Running comprehensive health checks"
    
    local health_endpoints=(
        "http://localhost:3000/health:API"
        "http://localhost:3000/health/scoring:ScoringAgent"
        "http://localhost:3004/api/health:CommandCenter"
        "http://localhost:9090/api/v1/targets:Prometheus"
    )
    
    local failed_checks=0
    
    for endpoint_info in "${health_endpoints[@]}"; do
        local endpoint="${endpoint_info%:*}"
        local service="${endpoint_info#*:}"
        
        log_info "Checking $service health: $endpoint"
        
        if curl -sf "$endpoint" >/dev/null 2>&1; then
            log_success "$service health check passed"
        else
            log_error "$service health check failed"
            ((failed_checks++))
        fi
    done
    
    if [[ $failed_checks -gt 0 ]]; then
        log_error "$failed_checks health checks failed"
        return 1
    fi
    
    log_success "All health checks passed"
    return 0
}

# Collect rollout metrics
collect_metrics() {
    local flag_name="$1"
    
    log_info "Collecting rollout metrics for $flag_name"
    
    local metrics_file="/tmp/rollout_metrics.json"
    
    docker-compose exec -T api node -e "
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        async function collectMetrics() {
            try {
                const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                const service = new FeatureFlagService(supabase);
                
                const metrics = await service.getRolloutMetrics('$flag_name');
                const healthStatus = service.getHealthStatus();
                
                const combinedMetrics = {
                    flagMetrics: metrics,
                    serviceHealth: healthStatus,
                    timestamp: new Date().toISOString()
                };
                
                console.log(JSON.stringify(combinedMetrics, null, 2));
            } catch (error) {
                console.log(JSON.stringify({ error: error.message }, null, 2));
            }
        }
        
        collectMetrics();
    " 2>/dev/null > "$metrics_file"
    
    if [[ -f "$metrics_file" ]]; then
        log_success "Metrics collected successfully"
        
        # Display key metrics
        local error_rate
        error_rate=$(jq -r '.flagMetrics.errorRate // 0' "$metrics_file" 2>/dev/null || echo "0")
        local active_users
        active_users=$(jq -r '.flagMetrics.activeUsers // 0' "$metrics_file" 2>/dev/null || echo "0")
        
        log_info "Current metrics - Error Rate: ${error_rate}, Active Users: ${active_users}"
        
        return 0
    else
        log_error "Failed to collect metrics"
        return 1
    fi
}

# Run validation gates
run_validation_gates() {
    local flag_name="$1"
    
    if [[ "$VALIDATION_ENABLED" != "true" ]]; then
        log_info "Validation gates disabled, skipping"
        return 0
    fi
    
    log_info "Running validation gates for $flag_name"
    
    local validation_result
    validation_result=$(docker-compose exec -T api node -e "
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        async function runValidation() {
            try {
                const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                
                // Get validation gates
                const { data: gates } = await supabase
                    .from('rollout_validation_gates')
                    .select('*')
                    .eq('flag_name', '$flag_name')
                    .eq('is_active', true);
                
                if (!gates || gates.length === 0) {
                    console.log('NO_GATES');
                    return;
                }
                
                // Get current metrics
                const service = new FeatureFlagService(supabase);
                const metrics = await service.getRolloutMetrics('$flag_name');
                
                if (!metrics) {
                    console.log('NO_METRICS');
                    return;
                }
                
                let passedGates = 0;
                let totalGates = gates.length;
                
                for (const gate of gates) {
                    const metricValue = metrics[gate.metric_name] || 0;
                    let passed = false;
                    
                    switch (gate.comparison_operator) {
                        case 'gt': passed = metricValue > gate.threshold_value; break;
                        case 'lt': passed = metricValue < gate.threshold_value; break;
                        case 'gte': passed = metricValue >= gate.threshold_value; break;
                        case 'lte': passed = metricValue <= gate.threshold_value; break;
                        case 'eq': passed = metricValue === gate.threshold_value; break;
                    }
                    
                    if (passed) passedGates++;
                }
                
                const passRate = passedGates / totalGates;
                console.log(passRate >= 0.8 ? 'PASSED' : 'FAILED');
                
            } catch (error) {
                console.log('ERROR');
            }
        }
        
        runValidation();
    " 2>/dev/null)
    
    case "$validation_result" in
        "PASSED")
            log_success "Validation gates passed"
            return 0
            ;;
        "FAILED")
            log_error "Validation gates failed"
            return 1
            ;;
        "NO_GATES")
            log_warning "No validation gates configured for $flag_name"
            return 0
            ;;
        "NO_METRICS")
            log_warning "No metrics available for validation"
            return 0
            ;;
        *)
            log_error "Validation gate execution failed: $validation_result"
            return 1
            ;;
    esac
}

# Wait for stabilization
wait_for_stabilization() {
    local duration="$1"
    
    log_info "Stabilization period: ${duration}s"
    
    local remaining=$duration
    while [[ $remaining -gt 0 ]]; do
        printf "\r${BLUE}[INFO]${NC} Stabilizing... %d seconds remaining" $remaining
        sleep 1
        ((remaining--))
    done
    printf "\n"
    
    log_success "Stabilization period completed"
}

# Emergency rollback
emergency_rollback() {
    local reason="$1"
    
    log_error "EMERGENCY ROLLBACK TRIGGERED: $reason"
    
    docker-compose exec -T api node -e "
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        async function emergencyRollback() {
            try {
                const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                const service = new FeatureFlagService(supabase);
                
                await service.emergencyRollback('$FEATURE_FLAG', '$reason');
                console.log('ROLLBACK_SUCCESS');
            } catch (error) {
                console.log('ROLLBACK_FAILED: ' + error.message);
            }
        }
        
        emergencyRollback();
    " 2>/dev/null
    
    log_warning "Emergency rollback completed for $FEATURE_FLAG"
}

# Create rollout plan
create_rollout_plan() {
    local current="$1"
    local target="$2"
    local steps_array=($3)
    
    log_step "Creating rollout plan"
    
    cat << EOF

====================================================
SYNDICATE-GRADE ROLLOUT PLAN
====================================================
Feature Flag:      $FEATURE_FLAG
Environment:       $ENVIRONMENT
Current Rollout:   $current%
Target Rollout:    $target%
Step Size:         $STEP_SIZE%
Stabilization:     ${STABILIZATION_PERIOD}s between steps
Max Duration:      ${MAX_ROLLOUT_DURATION}s
Validation Gates:  $([ "$VALIDATION_ENABLED" = "true" ] && echo "Enabled" || echo "Disabled")
Auto Rollback:     $([ "$AUTO_ROLLBACK" = "true" ] && echo "Enabled" || echo "Disabled")

ROLLOUT STEPS:
EOF

    local step_num=1
    for step in "${steps_array[@]}"; do
        echo "  Step $step_num: $step%"
        ((step_num++))
    done
    
    echo ""
    echo "Total Steps: $((step_num - 1))"
    echo "Estimated Duration: $(( (step_num - 1) * STABILIZATION_PERIOD + 300 ))s"
    echo "===================================================="
    echo ""
}

# Execute rollout step
execute_rollout_step() {
    local step_num="$1"
    local percentage="$2"
    local total_steps="$3"
    
    log_step "Step $step_num/$total_steps: Rolling out to $percentage%"
    
    # Update flag percentage
    if ! update_flag_percentage "$FEATURE_FLAG" "$percentage"; then
        log_error "Failed to update flag percentage"
        return 1
    fi
    
    # Short wait for changes to propagate
    sleep 10
    
    # Run health checks
    if ! run_health_checks; then
        log_error "Health checks failed at $percentage%"
        return 1
    fi
    
    # Collect metrics
    if ! collect_metrics "$FEATURE_FLAG"; then
        log_warning "Metrics collection failed, continuing"
    fi
    
    # Run validation gates
    if ! run_validation_gates "$FEATURE_FLAG"; then
        log_error "Validation gates failed at $percentage%"
        return 1
    fi
    
    log_success "Step $step_num completed successfully at $percentage%"
    return 0
}

# Main rollout execution
execute_rollout() {
    local current_percentage
    current_percentage=$(get_current_percentage "$FEATURE_FLAG")
    
    log_info "Current rollout percentage: $current_percentage%"
    
    if [[ $current_percentage -eq $TARGET_PERCENTAGE ]]; then
        log_success "Feature flag is already at target percentage ($TARGET_PERCENTAGE%)"
        return 0
    fi
    
    local steps_array
    IFS=' ' read -ra steps_array <<< "$(calculate_steps "$current_percentage" "$TARGET_PERCENTAGE" "$STEP_SIZE")"
    
    if [[ ${#steps_array[@]} -eq 0 ]]; then
        log_success "No rollout steps needed"
        return 0
    fi
    
    # Create and display rollout plan
    create_rollout_plan "$current_percentage" "$TARGET_PERCENTAGE" "${steps_array[*]}"
    
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "Dry run mode - no changes will be made"
        return 0
    fi
    
    # Confirm execution
    if [[ -t 0 ]]; then  # Check if running interactively
        read -p "Proceed with rollout? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollout cancelled by user"
            return 0
        fi
    fi
    
    local start_time
    start_time=$(date +%s)
    
    log_info "Starting rollout execution"
    
    # Execute rollout steps
    local step_num=1
    for percentage in "${steps_array[@]}"; do
        local elapsed=$(($(date +%s) - start_time))
        
        if [[ $elapsed -gt $MAX_ROLLOUT_DURATION ]]; then
            log_error "Maximum rollout duration exceeded (${MAX_ROLLOUT_DURATION}s)"
            return 1
        fi
        
        if ! execute_rollout_step "$step_num" "$percentage" "${#steps_array[@]}"; then
            log_error "Rollout step $step_num failed"
            return 1
        fi
        
        # Stabilization period (except for last step)
        if [[ $step_num -lt ${#steps_array[@]} ]]; then
            wait_for_stabilization "$STABILIZATION_PERIOD"
        fi
        
        ((step_num++))
    done
    
    local total_duration=$(($(date +%s) - start_time))
    log_success "Rollout completed successfully in ${total_duration}s"
    
    # Final metrics collection
    log_info "Collecting final metrics"
    collect_metrics "$FEATURE_FLAG"
    
    return 0
}

# Main function
main() {
    log_info "Unit Talk Syndicate-Grade Gradual Rollout Script"
    log_info "Starting deployment orchestration"
    
    parse_args "$@"
    validate_config
    
    if ! execute_rollout; then
        log_error "Rollout failed"
        exit 1
    fi
    
    log_success "Deployment orchestration completed successfully"
}

# Execute main function with all arguments
main "$@"