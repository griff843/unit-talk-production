#!/bin/bash

# Unit Talk Discord Bot - Production Deployment Script
# This script handles the complete deployment process for the Discord bot

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.production.yml"
ENV_FILE="$PROJECT_ROOT/.env.production"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
    
    # Also log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log ERROR "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info &> /dev/null; then
        error_exit "Docker is not running. Please start Docker first."
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error_exit "Docker Compose is not available. Please install Docker Compose."
    fi
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        error_exit "Environment file not found: $ENV_FILE"
    fi
    
    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error_exit "Docker Compose file not found: $COMPOSE_FILE"
    fi
    
    log INFO "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log INFO "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/config/nginx"
    mkdir -p "$PROJECT_ROOT/config/prometheus"
    mkdir -p "$PROJECT_ROOT/config/grafana"
    mkdir -p "$PROJECT_ROOT/config/loki"
    mkdir -p "$PROJECT_ROOT/config/promtail"
    
    log INFO "Directories created successfully"
}

# Validate environment variables
validate_environment() {
    log INFO "Validating environment variables..."
    
    # Source the environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Required variables
    required_vars=(
        "DISCORD_TOKEN"
        "DISCORD_CLIENT_ID"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "REDIS_PASSWORD"
        "GRAFANA_ADMIN_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
    
    log INFO "Environment validation passed"
}

# Build Docker images
build_images() {
    log INFO "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build the main application image
    docker build -f Dockerfile.production -t unit-talk-bot:latest . || error_exit "Failed to build application image"
    
    log INFO "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log INFO "Running database migrations..."
    
    # This would typically run your database migration scripts
    # For now, we'll just log that migrations would run here
    log INFO "Database migrations completed (placeholder)"
}

# Start services
start_services() {
    log INFO "Starting services..."
    
    cd "$PROJECT_ROOT"
    
    # Use docker-compose or docker compose based on availability
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Start services
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d || error_exit "Failed to start services"
    
    log INFO "Services started successfully"
}

# Wait for services to be healthy
wait_for_health() {
    log INFO "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log INFO "Health check attempt $attempt/$max_attempts"
        
        # Check main application health
        if curl -f http://localhost:3000/health &> /dev/null; then
            log INFO "Application is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error_exit "Services failed to become healthy within timeout"
        fi
        
        sleep 10
        ((attempt++))
    done
    
    log INFO "All services are healthy"
}

# Run post-deployment tests
run_tests() {
    log INFO "Running post-deployment tests..."
    
    # Test application endpoints
    local endpoints=(
        "http://localhost:3000/health"
        "http://localhost:3001/metrics"
        "http://localhost:9090/-/healthy"  # Prometheus
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f "$endpoint" &> /dev/null; then
            log INFO "✓ $endpoint is responding"
        else
            log WARN "✗ $endpoint is not responding"
        fi
    done
    
    log INFO "Post-deployment tests completed"
}

# Create backup
create_backup() {
    log INFO "Creating backup..."
    
    local backup_timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/backup_$backup_timestamp.tar.gz"
    
    # Create backup of important data
    tar -czf "$backup_file" \
        -C "$PROJECT_ROOT" \
        config/ \
        logs/ \
        .env.production \
        docker-compose.production.yml \
        2>/dev/null || log WARN "Some files may not have been backed up"
    
    log INFO "Backup created: $backup_file"
}

# Show deployment status
show_status() {
    log INFO "Deployment Status:"
    echo "===================="
    
    cd "$PROJECT_ROOT"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f "$COMPOSE_FILE" ps
    else
        docker compose -f "$COMPOSE_FILE" ps
    fi
    
    echo ""
    log INFO "Service URLs:"
    echo "- Application: http://localhost:3000"
    echo "- Metrics: http://localhost:3001/metrics"
    echo "- Prometheus: http://localhost:9090"
    echo "- Grafana: http://localhost:3002 (admin/\$GRAFANA_ADMIN_PASSWORD)"
    echo "- Health Check: http://localhost:3000/health"
}

# Cleanup function
cleanup() {
    log INFO "Cleaning up temporary files..."
    # Add any cleanup logic here
}

# Main deployment function
main() {
    log INFO "Starting Unit Talk Discord Bot deployment..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    create_directories
    validate_environment
    build_images
    run_migrations
    start_services
    wait_for_health
    run_tests
    create_backup
    show_status
    
    log INFO "Deployment completed successfully!"
    log INFO "The Unit Talk Discord Bot is now running in production mode."
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    stop)
        log INFO "Stopping services..."
        cd "$PROJECT_ROOT"
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" down
        else
            docker compose -f "$COMPOSE_FILE" down
        fi
        log INFO "Services stopped"
        ;;
    restart)
        log INFO "Restarting services..."
        cd "$PROJECT_ROOT"
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" restart
        else
            docker compose -f "$COMPOSE_FILE" restart
        fi
        log INFO "Services restarted"
        ;;
    status)
        show_status
        ;;
    logs)
        cd "$PROJECT_ROOT"
        if command -v docker-compose &> /dev/null; then
            docker-compose -f "$COMPOSE_FILE" logs -f
        else
            docker compose -f "$COMPOSE_FILE" logs -f
        fi
        ;;
    backup)
        create_backup
        ;;
    *)
        echo "Usage: $0 {deploy|stop|restart|status|logs|backup}"
        echo ""
        echo "Commands:"
        echo "  deploy  - Deploy the application (default)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status"
        echo "  logs    - Show service logs"
        echo "  backup  - Create a backup"
        exit 1
        ;;
esac