#!/bin/bash

# =============================================
# Syndicate-Grade Unit Talk System Deployment
# Comprehensive deployment orchestration with feature flags
# =============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ID="syndicate-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="deployment-${DEPLOYMENT_ID}.log"
BACKUP_DIR="./backups/${DEPLOYMENT_ID}"
ROLLOUT_STEPS=(5 25 50 75 100)
STABILIZATION_PERIOD=300 # 5 minutes
MAX_DEPLOYMENT_TIME=14400 # 4 hours

# Deployment flags
SKIP_BACKUP=false
SKIP_TESTS=false
SKIP_VALIDATION=false
DRY_RUN=false
AUTO_ROLLBACK=true
FORCE_DEPLOYMENT=false

# Feature flags to deploy
FEATURE_FLAGS=(
    "enhanced_45_factor_grading"
    "event_driven_alert_agent"
    "hot_warm_cold_pipeline"
    "feature_store_integration"
    "slo_monitoring_system"
)

# Environment URLs
HEALTH_ENDPOINTS=(
    "http://localhost:3000/health"
    "http://localhost:3000/health/grading"
    "http://localhost:3000/health/alerts"
    "http://localhost:3000/health/pipeline"
    "http://localhost:9090/-/healthy"
)

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC} ${timestamp} - $message" | tee -a "$LOG_FILE" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message" | tee -a "$LOG_FILE" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} ${timestamp} - $message" | tee -a "$LOG_FILE" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message" | tee -a "$LOG_FILE" ;;
        SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} ${timestamp} - $message" | tee -a "$LOG_FILE" ;;
    esac
}

# Error handling
error_exit() {
    log ERROR "$1"
    log ERROR "Deployment failed. Check $LOG_FILE for details."
    
    if [ "$AUTO_ROLLBACK" = true ]; then
        log WARN "Initiating automatic rollback..."
        rollback_deployment
    fi
    
    exit 1
}

# Trap errors
trap 'error_exit "Unexpected error occurred on line $LINENO"' ERR

# Usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Syndicate-Grade Unit Talk System Deployment

OPTIONS:
    --skip-backup       Skip database backup (not recommended)
    --skip-tests        Skip validation tests
    --skip-validation   Skip deployment validation
    --dry-run          Show what would be deployed without executing
    --no-auto-rollback Disable automatic rollback on failure
    --force            Force deployment even if validation fails
    --help             Show this help message

EXAMPLES:
    $0                                    # Full deployment with all safety checks
    $0 --dry-run                         # Preview deployment plan
    $0 --skip-backup --force             # Fast deployment (risky)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-auto-rollback)
                AUTO_ROLLBACK=false
                shift
                ;;
            --force)
                FORCE_DEPLOYMENT=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log ERROR "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Prerequisites check
check_prerequisites() {
    log INFO "🔍 Checking deployment prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error_exit "Docker is not running. Please start Docker and try again."
    fi
    
    # Check if required tools are installed
    local required_tools=("docker-compose" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "Required tool '$tool' is not installed."
        fi
    done
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        error_exit ".env file not found. Please ensure environment configuration is present."
    fi
    
    # Check if we're in the correct directory
    if [ ! -f "docker-compose.yml" ]; then
        error_exit "docker-compose.yml not found. Please run from the project root directory."
    fi
    
    log SUCCESS "✅ Prerequisites check passed"
}

# Create backup
create_backup() {
    if [ "$SKIP_BACKUP" = true ]; then
        log WARN "⚠️ Skipping backup (--skip-backup flag)"
        return 0
    fi
    
    log INFO "💾 Creating pre-deployment backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    log INFO "Creating database backup..."
    docker-compose exec -T postgres pg_dump -U postgres unit_talk_dev > "$BACKUP_DIR/database_backup.sql"
    
    # Backup configuration
    log INFO "Backing up configuration files..."
    cp .env "$BACKUP_DIR/env_backup"
    cp docker-compose.yml "$BACKUP_DIR/docker-compose_backup.yml"
    
    # Backup current feature flag state
    log INFO "Backing up current feature flag state..."
    docker-compose exec -T api npm run feature-flags:export > "$BACKUP_DIR/feature_flags_backup.json"
    
    log SUCCESS "✅ Backup created in $BACKUP_DIR"
}

# Run pre-deployment tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        log WARN "⚠️ Skipping tests (--skip-tests flag)"
        return 0
    fi
    
    log INFO "🧪 Running pre-deployment tests..."
    
    # Type checking
    log INFO "Running TypeScript type checking..."
    docker-compose exec -T api npm run type-check
    
    # Unit tests
    log INFO "Running unit tests..."
    docker-compose exec -T api npm run test
    
    # Integration tests
    log INFO "Running integration tests..."
    docker-compose exec -T api npm run test:integration
    
    # E2E tests
    log INFO "Running E2E tests..."
    docker-compose exec -T api npm run test:e2e
    
    log SUCCESS "✅ All tests passed"
}

# Validate system health
validate_system_health() {
    log INFO "🏥 Validating system health..."
    
    local failed_checks=0
    
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        log INFO "Checking health endpoint: $endpoint"
        
        if curl -f -s --max-time 10 "$endpoint" > /dev/null; then
            log SUCCESS "✅ $endpoint is healthy"
        else
            log ERROR "❌ $endpoint failed health check"
            ((failed_checks++))
        fi
    done
    
    if [ $failed_checks -gt 0 ]; then
        if [ "$FORCE_DEPLOYMENT" = true ]; then
            log WARN "⚠️ Health checks failed but proceeding due to --force flag"
        else
            error_exit "Health checks failed. Use --force to proceed anyway."
        fi
    fi
    
    log SUCCESS "✅ System health validation completed"
}

# Deploy database migrations
deploy_migrations() {
    log INFO "🗄️ Deploying database migrations..."
    
    # Check migration status
    log INFO "Checking current migration status..."
    docker-compose exec -T api npm run db:status
    
    # Apply migrations
    log INFO "Applying database migrations..."
    docker-compose exec -T api npm run db:migrate
    
    # Validate migration success
    log INFO "Validating migration completion..."
    docker-compose exec -T api npm run db:validate
    
    log SUCCESS "✅ Database migrations completed"
}

# Initialize feature flags
initialize_feature_flags() {
    log INFO "🚩 Initializing feature flags..."
    
    # Initialize feature flag service
    log INFO "Starting feature flag service..."
    docker-compose exec -T api node -e "
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const flagService = new FeatureFlagService(supabase);
        
        console.log('✅ Feature flag service initialized');
    "
    
    # Set all flags to 0% rollout initially
    for flag in "${FEATURE_FLAGS[@]}"; do
        log INFO "Initializing flag: $flag"
        docker-compose exec -T api node -e "
            const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
            const { createClient } = require('@supabase/supabase-js');
            
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const flagService = new FeatureFlagService(supabase);
            
            flagService.updateFlag('$flag', { enabled: true, rolloutPercentage: 0 })
                .then(() => console.log('✅ Flag $flag initialized'))
                .catch(err => { console.error('❌ Failed to initialize $flag:', err); process.exit(1); });
        "
    done
    
    log SUCCESS "✅ Feature flags initialized"
}

# Deploy single feature flag
deploy_feature_flag() {
    local flag_name=$1
    
    log INFO "🚀 Deploying feature flag: $flag_name"
    
    for step in "${ROLLOUT_STEPS[@]}"; do
        log INFO "📈 Rolling out $flag_name to $step%..."
        
        # Update rollout percentage
        docker-compose exec -T api node -e "
            const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
            const { createClient } = require('@supabase/supabase-js');
            
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const flagService = new FeatureFlagService(supabase);
            
            flagService.updateFlag('$flag_name', { rolloutPercentage: $step })
                .then(() => console.log('✅ $flag_name rolled out to $step%'))
                .catch(err => { console.error('❌ Rollout failed:', err); process.exit(1); });
        "
        
        # Wait for stabilization (except for 100%)
        if [ "$step" -ne 100 ]; then
            log INFO "⏳ Stabilization period: ${STABILIZATION_PERIOD}s"
            sleep "$STABILIZATION_PERIOD"
            
            # Validate step
            validate_rollout_step "$flag_name" "$step"
        fi
    done
    
    log SUCCESS "✅ Feature flag $flag_name deployed successfully"
}

# Validate rollout step
validate_rollout_step() {
    local flag_name=$1
    local percentage=$2
    
    log INFO "🔍 Validating rollout step: $flag_name at $percentage%"
    
    # Check system health
    validate_system_health
    
    # Check feature flag metrics
    docker-compose exec -T api node -e "
        const { ABTestingEngine } = require('./dist/services/feature-flags/ABTestingEngine');
        const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const flagService = new FeatureFlagService(supabase);
        const abTesting = new ABTestingEngine(supabase, flagService);
        
        abTesting.checkRollbackConditions('$flag_name')
            .then(result => {
                if (result.shouldRollback) {
                    console.error('❌ Rollback conditions detected:', result.reasons);
                    process.exit(1);
                } else {
                    console.log('✅ Rollout validation passed');
                }
            })
            .catch(err => { console.error('❌ Validation failed:', err); process.exit(1); });
    "
    
    log SUCCESS "✅ Rollout step validation passed"
}

# Deploy all feature flags
deploy_all_feature_flags() {
    log INFO "🚀 Starting syndicate-grade feature deployment..."
    
    # Deploy in dependency order
    local deployment_order=(
        "hot_warm_cold_pipeline"
        "feature_store_integration"
        "enhanced_45_factor_grading"
        "event_driven_alert_agent"
        "slo_monitoring_system"
    )
    
    for flag in "${deployment_order[@]}"; do
        log INFO "🎯 Deploying: $flag"
        deploy_feature_flag "$flag"
        
        # Brief pause between flags
        sleep 30
    done
    
    log SUCCESS "✅ All feature flags deployed successfully"
}

# Rollback deployment
rollback_deployment() {
    log WARN "🔄 Initiating deployment rollback..."
    
    # Emergency rollback all feature flags
    for flag in "${FEATURE_FLAGS[@]}"; do
        log INFO "Rolling back feature flag: $flag"
        docker-compose exec -T api node -e "
            const { FeatureFlagService } = require('./dist/services/feature-flags/FeatureFlagService');
            const { createClient } = require('@supabase/supabase-js');
            
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const flagService = new FeatureFlagService(supabase);
            
            flagService.emergencyRollback('$flag', 'Deployment script rollback')
                .then(() => console.log('✅ $flag rolled back'))
                .catch(err => console.error('❌ Rollback failed for $flag:', err));
        "
    done
    
    # Restore from backup if available
    if [ -d "$BACKUP_DIR" ]; then
        log INFO "Restoring from backup..."
        
        # Restore database
        if [ -f "$BACKUP_DIR/database_backup.sql" ]; then
            log INFO "Restoring database..."
            docker-compose exec -T postgres psql -U postgres unit_talk_dev < "$BACKUP_DIR/database_backup.sql"
        fi
        
        # Restore configuration
        if [ -f "$BACKUP_DIR/env_backup" ]; then
            log INFO "Restoring environment configuration..."
            cp "$BACKUP_DIR/env_backup" .env
        fi
    fi
    
    # Restart services
    log INFO "Restarting services..."
    docker-compose restart
    
    log SUCCESS "✅ Rollback completed"
}

# Generate deployment report
generate_report() {
    local status=$1
    
    log INFO "📊 Generating deployment report..."
    
    local report_file="deployment-report-${DEPLOYMENT_ID}.json"
    
    cat > "$report_file" << EOF
{
    "deploymentId": "$DEPLOYMENT_ID",
    "timestamp": "$(date -Iseconds)",
    "status": "$status",
    "environment": "production",
    "featureFlags": $(printf '%s\n' "${FEATURE_FLAGS[@]}" | jq -R . | jq -s .),
    "rolloutSteps": $(printf '%s\n' "${ROLLOUT_STEPS[@]}" | jq -R . | jq -s . | jq 'map(tonumber)'),
    "configuration": {
        "skipBackup": $SKIP_BACKUP,
        "skipTests": $SKIP_TESTS,
        "skipValidation": $SKIP_VALIDATION,
        "dryRun": $DRY_RUN,
        "autoRollback": $AUTO_ROLLBACK,
        "forceDeployment": $FORCE_DEPLOYMENT
    },
    "timing": {
        "stabilizationPeriod": $STABILIZATION_PERIOD,
        "maxDeploymentTime": $MAX_DEPLOYMENT_TIME
    },
    "logs": "$LOG_FILE",
    "backup": "$BACKUP_DIR"
}
EOF
    
    log SUCCESS "✅ Deployment report generated: $report_file"
}

# Main deployment function
main() {
    echo -e "${PURPLE}"
    cat << "EOF"
    ███████╗██╗   ██╗███╗   ██╗██████╗ ██╗ ██████╗ █████╗ ████████╗███████╗
    ██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██║██╔════╝██╔══██╗╚══██╔══╝██╔════╝
    ███████╗ ╚████╔╝ ██╔██╗ ██║██║  ██║██║██║     ███████║   ██║   █████╗  
    ╚════██║  ╚██╔╝  ██║╚██╗██║██║  ██║██║██║     ██╔══██║   ██║   ██╔══╝  
    ███████║   ██║   ██║ ╚████║██████╔╝██║╚██████╗██║  ██║   ██║   ███████╗
    ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═════╝ ╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
    
    Unit Talk Syndicate-Grade System Deployment
    Comprehensive Feature Flag Rollout with Zero-Downtime Deployment
EOF
    echo -e "${NC}"
    
    log INFO "🚀 Starting syndicate-grade deployment: $DEPLOYMENT_ID"
    log INFO "📋 Configuration: backup=$(!$SKIP_BACKUP && echo enabled || echo disabled), tests=$(!$SKIP_TESTS && echo enabled || echo disabled), validation=$(!$SKIP_VALIDATION && echo enabled || echo disabled)"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "🔍 DRY RUN MODE - No changes will be made"
        log INFO "Would deploy feature flags: ${FEATURE_FLAGS[*]}"
        log INFO "Would use rollout steps: ${ROLLOUT_STEPS[*]}"
        log INFO "Would stabilize for: ${STABILIZATION_PERIOD}s between steps"
        generate_report "dry_run"
        exit 0
    fi
    
    # Deployment steps
    check_prerequisites
    create_backup
    run_tests
    validate_system_health
    deploy_migrations
    initialize_feature_flags
    deploy_all_feature_flags
    
    # Final validation
    if [ "$SKIP_VALIDATION" = false ]; then
        log INFO "🔍 Running final system validation..."
        validate_system_health
        
        # Run comprehensive tests
        docker-compose exec -T api npm run test:e2e:production
    fi
    
    log SUCCESS "🎉 Syndicate-grade deployment completed successfully!"
    log INFO "📊 Deployment ID: $DEPLOYMENT_ID"
    log INFO "📝 Logs: $LOG_FILE"
    log INFO "💾 Backup: $BACKUP_DIR"
    
    generate_report "success"
    
    echo -e "${GREEN}"
    cat << "EOF"
    ╔══════════════════════════════════════════════════════════════╗
    ║                    DEPLOYMENT SUCCESSFUL                     ║
    ║                                                              ║
    ║  🎯 All feature flags deployed with gradual rollout         ║
    ║  📈 Enhanced 45-factor grading system active               ║
    ║  ⚡ Event-driven alert agent operational                   ║
    ║  🔥 HOT/WARM/COLD data pipeline enabled                    ║
    ║  🏪 Feature store integration active                       ║
    ║  📊 SLO monitoring system deployed                         ║
    ║                                                              ║
    ║  System is ready for 8K+ simultaneous prop processing      ║
    ║  with <1 second alert latency targets                      ║
    ╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Parse arguments and run main
parse_args "$@"
main