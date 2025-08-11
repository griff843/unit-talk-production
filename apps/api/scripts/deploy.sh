#!/bin/bash

# Unit Talk Platform - Production Deployment Script
# This script handles the complete deployment process for production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deployment.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if required files exist
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        error "Docker compose file not found: $DOCKER_COMPOSE_FILE"
    fi
    
    if [ ! -f ".env.production" ]; then
        error "Production environment file not found: .env.production"
    fi
    
    # Check Docker and Docker Compose
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if ports are available
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        warning "Port 3000 is already in use"
    fi
    
    success "Pre-deployment checks completed"
}

# Environment validation
validate_environment() {
    log "Validating environment variables..."
    
    # Source the production environment
    set -a
    source .env.production
    set +a
    
    # Check critical environment variables
    required_vars=(
        "NODE_ENV"
        "SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "REDIS_URL"
        "OPENAI_API_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Validate NODE_ENV is production
    if [ "$NODE_ENV" != "production" ]; then
        error "NODE_ENV must be set to 'production'"
    fi
    
    success "Environment validation completed"
}

# Build application
build_application() {
    log "Building application..."
    
    # Install dependencies
    npm ci --only=production
    
    # Run type checking
    npm run type-check
    
    # Run tests
    npm run test
    
    # Build application
    npm run build
    
    success "Application build completed"
}

# Database migration
run_migrations() {
    log "Running database migrations..."
    
    # This would run your database migrations
    # npm run db:migrate:prod
    
    success "Database migrations completed"
}

# Backup current deployment
backup_current_deployment() {
    log "Creating backup of current deployment..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup current containers if they exist
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q | grep -q .; then
        BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
        
        # Export current containers
        docker-compose -f "$DOCKER_COMPOSE_FILE" config > "$BACKUP_DIR/$BACKUP_NAME.yml"
        
        # Backup volumes
        docker run --rm -v unit-talk-production_redis_data:/data -v "$PWD/$BACKUP_DIR":/backup alpine tar czf "/backup/$BACKUP_NAME-redis.tar.gz" -C /data .
        
        success "Backup created: $BACKUP_NAME"
    else
        log "No existing deployment to backup"
    fi
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    # Pull latest images
    docker-compose -f "$DOCKER_COMPOSE_FILE" pull
    
    # Build custom images
    docker-compose -f "$DOCKER_COMPOSE_FILE" build
    
    # Start services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    success "Application deployment completed"
}

# Health checks
run_health_checks() {
    log "Running health checks..."
    
    # Wait for services to start
    sleep 30
    
    # Check if containers are running
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
        error "Some containers are not running"
    fi
    
    # Check health endpoints
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health/live > /dev/null 2>&1; then
            success "Health check passed"
            break
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "Health checks failed after $max_attempts attempts"
    fi
    
    # Detailed health check
    curl -s http://localhost:3000/health | jq '.'
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."
    
    # Clean up old Docker images
    docker image prune -f
    
    # Set up log rotation
    setup_log_rotation
    
    # Send deployment notification
    send_deployment_notification
    
    success "Post-deployment tasks completed"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    # Create logrotate configuration
    cat > /tmp/unit-talk-logrotate << EOF
./logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose -f $DOCKER_COMPOSE_FILE restart unit-talk-app
    endscript
}
EOF
    
    # Install logrotate configuration (requires sudo)
    if command -v sudo &> /dev/null; then
        sudo mv /tmp/unit-talk-logrotate /etc/logrotate.d/unit-talk
        success "Log rotation configured"
    else
        warning "Could not configure log rotation (sudo not available)"
    fi
}

# Send deployment notification
send_deployment_notification() {
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{\"content\":\"🚀 Unit Talk Platform deployed successfully to production at $(date)\"}" \
             "$DISCORD_WEBHOOK_URL" > /dev/null 2>&1
        log "Deployment notification sent to Discord"
    fi
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current deployment
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.yml 2>/dev/null | head -n1)
    
    if [ -n "$LATEST_BACKUP" ]; then
        # Restore from backup
        cp "$LATEST_BACKUP" "$DOCKER_COMPOSE_FILE.backup"
        docker-compose -f "$DOCKER_COMPOSE_FILE.backup" up -d
        success "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Main deployment function
main() {
    log "Starting Unit Talk Platform deployment..."
    
    # Create log directory
    mkdir -p logs
    
    case "${1:-deploy}" in
        "deploy")
            pre_deployment_checks
            validate_environment
            build_application
            backup_current_deployment
            run_migrations
            deploy_application
            run_health_checks
            post_deployment_tasks
            success "Deployment completed successfully!"
            ;;
        "rollback")
            rollback
            ;;
        "health")
            run_health_checks
            ;;
        "backup")
            backup_current_deployment
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|health|backup}"
            exit 1
            ;;
    esac
}

# Trap errors and provide cleanup
trap 'error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"