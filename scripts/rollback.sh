#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-production}"
SERVICE="${2:-all}"
VERSION="${3:-previous}"

echo "===========================================" 
echo "Unit Talk Platform - Rollback Script"
echo "Environment: $ENVIRONMENT"
echo "Service: $SERVICE"
echo "Target Version: $VERSION"
echo "==========================================="

# Function to rollback Docker Compose services
rollback_docker_compose() {
    echo "🔄 Rolling back Docker Compose services..."
    
    case "$SERVICE" in
        "all")
            echo "Rolling back all services..."
            docker-compose down
            # Switch to previous version if available
            if [ -f "docker-compose.${VERSION}.yml" ]; then
                echo "Using docker-compose.${VERSION}.yml"
                cp "docker-compose.${VERSION}.yml" "docker-compose.yml"
            fi
            docker-compose up -d
            ;;
        *)
            echo "Rolling back service: $SERVICE"
            docker-compose stop $SERVICE
            # Pull previous image if specified
            if [ "$VERSION" != "previous" ]; then
                docker-compose pull $SERVICE:$VERSION
            fi
            docker-compose up -d $SERVICE
            ;;
    esac
}

# Function to check rollback success
verify_rollback() {
    echo "🔍 Verifying rollback success..."
    
    # Wait for services to be healthy
    timeout=120
    elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if curl -fsS "http://localhost:3000/health" > /dev/null 2>&1; then
            echo "✅ Rollback verification successful - API is healthy"
            return 0
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        echo "... waiting for API health check (${elapsed}s)"
    done
    
    echo "❌ Rollback verification failed - API not healthy after ${timeout}s"
    return 1
}

# Function to create rollback backup
create_rollback_backup() {
    echo "💾 Creating rollback backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir="./backups/rollback_${timestamp}"
    
    mkdir -p "$backup_dir"
    
    # Backup current configuration
    cp docker-compose.yml "$backup_dir/"
    cp .env "$backup_dir/"
    
    # Backup database if needed
    if docker ps | grep -q "unit-talk-postgres"; then
        echo "Backing up database..."
        docker exec unit-talk-postgres pg_dump -U postgres unit_talk_dev > "$backup_dir/database_backup.sql"
    fi
    
    echo "Backup created at: $backup_dir"
}

# Function to send rollback notification
send_notification() {
    local status=$1
    local message="Rollback $status for $ENVIRONMENT environment"
    
    echo "📢 Notification: $message"
    
    # Send to Discord webhook if configured
    if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
        curl -X POST "$DISCORD_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"content\": \"🔄 $message\"}" > /dev/null 2>&1 || true
    fi
}

# Main rollback execution
main() {
    echo "🚨 Initiating rollback procedure..."
    
    # Create backup before rollback
    create_rollback_backup
    
    # Perform rollback based on environment
    case "$ENVIRONMENT" in
        "development"|"dev")
            echo "Development rollback - using Docker Compose"
            rollback_docker_compose
            ;;
        "staging"|"stage")
            echo "Staging rollback - using Docker Compose with staging config"
            if [ -f "docker-compose.staging.yml" ]; then
                docker-compose -f docker-compose.yml -f docker-compose.staging.yml down
                docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
            else
                rollback_docker_compose
            fi
            ;;
        "production"|"prod")
            echo "Production rollback - implement with your deployment platform"
            echo "⚠️  This should integrate with your K8s/Helm/Argo deployment system"
            rollback_docker_compose
            ;;
        *)
            echo "❌ Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    # Verify rollback success
    if verify_rollback; then
        send_notification "COMPLETED"
        echo "✅ Rollback completed successfully!"
        exit 0
    else
        send_notification "FAILED"
        echo "❌ Rollback failed - manual intervention required"
        exit 1
    fi
}

# Handle script interruption
trap 'echo "❌ Rollback interrupted"; send_notification "INTERRUPTED"; exit 1' INT TERM

# Execute main function
main "$@"

