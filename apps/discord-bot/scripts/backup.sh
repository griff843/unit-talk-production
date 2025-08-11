#!/bin/bash

# Unit Talk Discord Bot - Database Backup Script
# This script creates automated backups of the Supabase database

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/backup.log"

# Load environment variables
if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a
fi

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
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_exit() {
    log ERROR "$1"
    exit 1
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log INFO "Backup directory created: $BACKUP_DIR"
}

# Database backup function
backup_database() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/database_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    log INFO "Starting database backup..."
    
    # Check if required environment variables are set
    if [[ -z "${SUPABASE_DB_HOST:-}" ]] || [[ -z "${SUPABASE_DB_NAME:-}" ]] || [[ -z "${SUPABASE_DB_USER:-}" ]]; then
        log WARN "Supabase database connection details not found. Creating application data backup instead."
        backup_application_data "$timestamp"
        return
    fi
    
    # Create database dump
    log INFO "Creating database dump..."
    
    PGPASSWORD="${SUPABASE_DB_PASSWORD:-}" pg_dump \
        -h "${SUPABASE_DB_HOST}" \
        -p "${SUPABASE_DB_PORT:-5432}" \
        -U "${SUPABASE_DB_USER}" \
        -d "${SUPABASE_DB_NAME}" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        > "$backup_file" 2>/dev/null || {
        log ERROR "Database backup failed"
        rm -f "$backup_file"
        return 1
    }
    
    # Compress the backup
    log INFO "Compressing backup..."
    gzip "$backup_file" || {
        log ERROR "Failed to compress backup"
        return 1
    }
    
    local file_size=$(du -h "$compressed_file" | cut -f1)
    log INFO "Database backup completed: $compressed_file ($file_size)"
    
    # Verify backup integrity
    verify_backup "$compressed_file"
    
    return 0
}

# Application data backup (fallback)
backup_application_data() {
    local timestamp=$1
    local backup_file="$BACKUP_DIR/app_data_backup_$timestamp.tar.gz"
    
    log INFO "Creating application data backup..."
    
    # Create backup of application data, configs, and logs
    tar -czf "$backup_file" \
        -C "$PROJECT_ROOT" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='*.log' \
        --exclude='backups' \
        config/ \
        src/ \
        package*.json \
        tsconfig.json \
        docker-compose*.yml \
        Dockerfile* \
        scripts/ \
        .env.example \
        2>/dev/null || {
        log ERROR "Application data backup failed"
        return 1
    }
    
    local file_size=$(du -h "$backup_file" | cut -f1)
    log INFO "Application data backup completed: $backup_file ($file_size)"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    
    log INFO "Verifying backup integrity..."
    
    # Check if file exists and is not empty
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        log ERROR "Backup file is missing or empty"
        return 1
    fi
    
    # Test gzip integrity
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file" 2>/dev/null; then
            log ERROR "Backup file is corrupted"
            return 1
        fi
    fi
    
    log INFO "Backup integrity verified"
    return 0
}

# Clean old backups
cleanup_old_backups() {
    local retention_days=${BACKUP_RETENTION_DAYS:-7}
    
    log INFO "Cleaning up backups older than $retention_days days..."
    
    # Find and remove old backup files
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm "$file"
        ((deleted_count++))
        log INFO "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.tar.gz" -type f -mtime +$retention_days -print0 2>/dev/null)
    
    if [[ $deleted_count -eq 0 ]]; then
        log INFO "No old backups to clean up"
    else
        log INFO "Cleaned up $deleted_count old backup(s)"
    fi
}

# Upload backup to cloud storage (optional)
upload_to_cloud() {
    local backup_file=$1
    
    # Check if cloud storage is configured
    if [[ -z "${BACKUP_CLOUD_PROVIDER:-}" ]]; then
        log INFO "Cloud storage not configured, skipping upload"
        return 0
    fi
    
    log INFO "Uploading backup to cloud storage..."
    
    case "${BACKUP_CLOUD_PROVIDER}" in
        "aws")
            upload_to_aws "$backup_file"
            ;;
        "gcp")
            upload_to_gcp "$backup_file"
            ;;
        "azure")
            upload_to_azure "$backup_file"
            ;;
        *)
            log WARN "Unknown cloud provider: ${BACKUP_CLOUD_PROVIDER}"
            ;;
    esac
}

# AWS S3 upload
upload_to_aws() {
    local backup_file=$1
    local s3_bucket="${AWS_BACKUP_BUCKET:-}"
    
    if [[ -z "$s3_bucket" ]]; then
        log ERROR "AWS_BACKUP_BUCKET not configured"
        return 1
    fi
    
    if command -v aws &> /dev/null; then
        aws s3 cp "$backup_file" "s3://$s3_bucket/$(basename "$backup_file")" || {
            log ERROR "Failed to upload to AWS S3"
            return 1
        }
        log INFO "Backup uploaded to AWS S3: s3://$s3_bucket/$(basename "$backup_file")"
    else
        log ERROR "AWS CLI not installed"
        return 1
    fi
}

# Google Cloud Storage upload
upload_to_gcp() {
    local backup_file=$1
    local gcs_bucket="${GCP_BACKUP_BUCKET:-}"
    
    if [[ -z "$gcs_bucket" ]]; then
        log ERROR "GCP_BACKUP_BUCKET not configured"
        return 1
    fi
    
    if command -v gsutil &> /dev/null; then
        gsutil cp "$backup_file" "gs://$gcs_bucket/$(basename "$backup_file")" || {
            log ERROR "Failed to upload to Google Cloud Storage"
            return 1
        }
        log INFO "Backup uploaded to GCS: gs://$gcs_bucket/$(basename "$backup_file")"
    else
        log ERROR "Google Cloud SDK not installed"
        return 1
    fi
}

# Azure Blob Storage upload
upload_to_azure() {
    local backup_file=$1
    local azure_container="${AZURE_BACKUP_CONTAINER:-}"
    
    if [[ -z "$azure_container" ]]; then
        log ERROR "AZURE_BACKUP_CONTAINER not configured"
        return 1
    fi
    
    if command -v az &> /dev/null; then
        az storage blob upload \
            --file "$backup_file" \
            --name "$(basename "$backup_file")" \
            --container-name "$azure_container" || {
            log ERROR "Failed to upload to Azure Blob Storage"
            return 1
        }
        log INFO "Backup uploaded to Azure: $azure_container/$(basename "$backup_file")"
    else
        log ERROR "Azure CLI not installed"
        return 1
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Check if notifications are configured
    if [[ -z "${NOTIFICATION_WEBHOOK:-}" ]]; then
        return 0
    fi
    
    local color
    case $status in
        "success") color="good" ;;
        "warning") color="warning" ;;
        "error") color="danger" ;;
        *) color="good" ;;
    esac
    
    # Send to Discord webhook (if configured)
    if [[ "${NOTIFICATION_WEBHOOK}" == *"discord"* ]]; then
        curl -X POST "${NOTIFICATION_WEBHOOK}" \
            -H "Content-Type: application/json" \
            -d "{
                \"embeds\": [{
                    \"title\": \"Unit Talk Backup Status\",
                    \"description\": \"$message\",
                    \"color\": $(case $color in "good") echo "3066993";; "warning") echo "15105570";; "danger") echo "15158332";; esac),
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
                }]
            }" &>/dev/null || log WARN "Failed to send Discord notification"
    fi
}

# Main backup function
main() {
    log INFO "Starting backup process..."
    
    local start_time=$(date +%s)
    local success=true
    
    # Create backup directory
    create_backup_dir
    
    # Perform backup
    if backup_database; then
        log INFO "Database backup successful"
        
        # Find the latest backup file
        local latest_backup=$(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.tar.gz" | sort | tail -1)
        
        if [[ -n "$latest_backup" ]]; then
            # Upload to cloud storage
            upload_to_cloud "$latest_backup"
        fi
        
        # Clean up old backups
        cleanup_old_backups
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        send_notification "success" "Backup completed successfully in ${duration}s"
        log INFO "Backup process completed successfully in ${duration}s"
    else
        success=false
        send_notification "error" "Backup process failed"
        log ERROR "Backup process failed"
    fi
    
    # Exit with appropriate code
    if [[ "$success" == "true" ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script arguments
case "${1:-backup}" in
    backup)
        main
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    verify)
        if [[ -n "${2:-}" ]]; then
            verify_backup "$2"
        else
            log ERROR "Please specify a backup file to verify"
            exit 1
        fi
        ;;
    list)
        log INFO "Available backups:"
        ls -la "$BACKUP_DIR"/*.{sql.gz,tar.gz} 2>/dev/null || log INFO "No backups found"
        ;;
    *)
        echo "Usage: $0 {backup|cleanup|verify|list}"
        echo ""
        echo "Commands:"
        echo "  backup  - Create a new backup (default)"
        echo "  cleanup - Clean up old backups"
        echo "  verify  - Verify backup integrity"
        echo "  list    - List available backups"
        exit 1
        ;;
esac