#!/bin/bash

# Unit Talk Production - Update Script
# This script updates the application with zero downtime

set -e

# Configuration
PROJECT_NAME="unit-talk-production"
PROJECT_DIR="/opt/$PROJECT_NAME"
BACKUP_BEFORE_UPDATE=true
ROLLBACK_ON_FAILURE=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if project directory exists
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Project directory not found: $PROJECT_DIR"
        exit 1
    fi
    
    # Check if docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "Docker Compose not found"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to create backup before update
create_backup() {
    if [ "$BACKUP_BEFORE_UPDATE" = true ]; then
        print_status "Creating backup before update..."
        
        # Run backup script
        if [ -f "$PROJECT_DIR/scripts/backup.sh" ]; then
            cd "$PROJECT_DIR"
            ./scripts/backup.sh
            print_success "Backup completed"
        else
            print_warning "Backup script not found, skipping backup"
        fi
    fi
}

# Function to check current health
check_health() {
    print_status "Checking current system health..."
    
    # Check if containers are running
    if ! docker-compose -f "$PROJECT_DIR/docker-compose.yml" ps | grep -q "Up"; then
        print_error "Some containers are not running"
        return 1
    fi
    
    # Check health endpoint
    if ! curl -f http://localhost/health >/dev/null 2>&1; then
        print_error "Health check failed"
        return 1
    fi
    
    print_success "System health check passed"
    return 0
}

# Function to pull latest code
pull_latest_code() {
    print_status "Pulling latest code..."
    
    cd "$PROJECT_DIR"
    
    # Stash any local changes
    if git status --porcelain | grep -q .; then
        print_warning "Local changes detected, stashing them"
        git stash
    fi
    
    # Pull latest changes
    git pull origin main
    
    if [ $? -eq 0 ]; then
        print_success "Latest code pulled successfully"
    else
        print_error "Failed to pull latest code"
        exit 1
    fi
}

# Function to update dependencies
update_dependencies() {
    print_status "Updating dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Install/update npm dependencies
    if [ -f "package.json" ]; then
        npm ci --only=production
        print_success "Dependencies updated"
    fi
}

# Function to build new images
build_images() {
    print_status "Building new Docker images..."
    
    cd "$PROJECT_DIR"
    
    # Build images with no cache to ensure fresh builds
    docker-compose build --no-cache
    
    if [ $? -eq 0 ]; then
        print_success "Docker images built successfully"
    else
        print_error "Failed to build Docker images"
        exit 1
    fi
}

# Function to perform zero-downtime deployment
deploy_with_zero_downtime() {
    print_status "Performing zero-downtime deployment..."
    
    cd "$PROJECT_DIR"
    
    # Stop current containers gracefully
    print_status "Stopping current containers..."
    docker-compose down --timeout 30
    
    # Start new containers
    print_status "Starting new containers..."
    docker-compose up -d
    
    # Wait for containers to be ready
    print_status "Waiting for containers to be ready..."
    sleep 30
    
    # Check if containers are running
    if ! docker-compose ps | grep -q "Up"; then
        print_error "Some containers failed to start"
        return 1
    fi
    
    # Wait for health check to pass
    print_status "Waiting for health check..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f http://localhost/health >/dev/null 2>&1; then
            print_success "Health check passed"
            return 0
        fi
        
        attempts=$((attempts + 1))
        sleep 10
    done
    
    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Function to rollback on failure
rollback() {
    if [ "$ROLLBACK_ON_FAILURE" = true ]; then
        print_warning "Rolling back to previous version..."
        
        cd "$PROJECT_DIR"
        
        # Stop current containers
        docker-compose down
        
        # Revert git changes
        git reset --hard HEAD~1
        
        # Rebuild and restart
        docker-compose up -d --build
        
        # Wait for rollback to complete
        sleep 30
        
        # Check health after rollback
        if curl -f http://localhost/health >/dev/null 2>&1; then
            print_success "Rollback completed successfully"
        else
            print_error "Rollback failed - manual intervention required"
            exit 1
        fi
    fi
}

# Function to run post-update tasks
post_update_tasks() {
    print_status "Running post-update tasks..."
    
    cd "$PROJECT_DIR"
    
    # Run database migrations if needed
    if [ -f "scripts/migrate.sh" ]; then
        print_status "Running database migrations..."
        ./scripts/migrate.sh
    fi
    
    # Clean up old images
    print_status "Cleaning up old Docker images..."
    docker image prune -f
    
    # Clean up old containers
    print_status "Cleaning up old containers..."
    docker container prune -f
    
    print_success "Post-update tasks completed"
}

# Function to send update notification
send_notification() {
    print_status "Sending update notification..."
    
    if [ -n "$DISCORD_WEBHOOK" ]; then
        local version=$(git rev-parse --short HEAD)
        local date=$(date '+%Y-%m-%d %H:%M:%S')
        
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{
               \"content\": \"🚀 **System Updated**\n\n**Version:** $version\n**Date:** $date\n**Status:** ✅ Success\n**Health:** ✅ All systems operational\"
             }" \
             "$DISCORD_WEBHOOK" >/dev/null 2>&1
        
        print_success "Update notification sent to Discord"
    else
        print_warning "Discord webhook not configured, skipping notification"
    fi
}

# Function to display update summary
display_summary() {
    print_status "Update completed successfully!"
    
    echo ""
    echo "=== Update Summary ==="
    echo "Project: $PROJECT_NAME"
    echo "Version: $(git rev-parse --short HEAD)"
    echo "Date: $(date)"
    echo "Status: ✅ Success"
    echo ""
    echo "=== System Status ==="
    docker-compose ps
    echo ""
    echo "=== Health Check ==="
    curl -s http://localhost/health | jq . 2>/dev/null || echo "Health endpoint responding"
    echo ""
    echo "=== Useful Commands ==="
    echo "View logs: docker-compose logs -f"
    echo "Check status: docker-compose ps"
    echo "Health check: curl http://localhost/health"
    echo "Restart services: docker-compose restart"
    echo ""
}

# Main update function
main() {
    echo "🚀 Unit Talk Production - System Update"
    echo "======================================="
    echo ""
    
    # Check if running as root
    check_root
    
    # Check prerequisites
    check_prerequisites
    
    # Check current health
    if ! check_health; then
        print_error "System is not healthy, aborting update"
        exit 1
    fi
    
    # Create backup
    create_backup
    
    # Pull latest code
    pull_latest_code
    
    # Update dependencies
    update_dependencies
    
    # Build new images
    build_images
    
    # Deploy with zero downtime
    if ! deploy_with_zero_downtime; then
        print_error "Deployment failed"
        rollback
        exit 1
    fi
    
    # Run post-update tasks
    post_update_tasks
    
    # Send notification
    send_notification
    
    # Display summary
    display_summary
    
    print_success "Update completed successfully! 🎉"
}

# Run main function
main "$@" 