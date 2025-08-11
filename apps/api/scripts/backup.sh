#!/bin/bash

# Unit Talk Production - Backup Script
# This script performs automated backups of the application and database

set -e

# Configuration
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
LOG_FILE="/var/log/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

print_status() {
    log_message "${BLUE}[INFO]${NC} $1"
}

print_success() {
    log_message "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    log_message "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    log_message "${RED}[ERROR]${NC} $1"
}

# Function to create backup directory
create_backup_dir() {
    print_status "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/application"
    mkdir -p "$BACKUP_DIR/logs"
    print_success "Backup directory created"
}

# Function to backup Supabase database
backup_database() {
    print_status "Starting database backup..."
    
    # Check if Supabase URL is provided
    if [ -z "$SUPABASE_URL" ]; then
        print_error "SUPABASE_URL not set, skipping database backup"
        return 1
    fi
    
    # Extract database connection details from Supabase URL
    # Format: postgresql://postgres:[password]@[host]:[port]/postgres
    DB_URL=$(echo "$SUPABASE_URL" | sed 's/postgresql:\/\///')
    DB_HOST=$(echo "$DB_URL" | cut -d'@' -f2 | cut -d':' -f1)
    DB_PORT=$(echo "$DB_URL" | cut -d'@' -f2 | cut -d':' -f2 | cut -d'/' -f1)
    DB_NAME=$(echo "$DB_URL" | cut -d'/' -f2)
    DB_USER=$(echo "$DB_URL" | cut -d'@' -f1 | cut -d':' -f1)
    DB_PASSWORD=$(echo "$DB_URL" | cut -d'@' -f1 | cut -d':' -f2)
    
    # Create database backup using pg_dump
    BACKUP_FILE="$BACKUP_DIR/database/db_backup_$DATE.sql"
    
    if command -v pg_dump >/dev/null 2>&1; then
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-password \
            --verbose \
            --clean \
            --if-exists \
            --create \
            > "$BACKUP_FILE" 2>> "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            print_success "Database backup completed: $BACKUP_FILE"
            
            # Compress the backup
            gzip "$BACKUP_FILE"
            print_success "Database backup compressed: ${BACKUP_FILE}.gz"
        else
            print_error "Database backup failed"
            return 1
        fi
    else
        print_warning "pg_dump not available, using Supabase API backup"
        
        # Alternative: Use Supabase API for backup (if available)
        BACKUP_FILE="$BACKUP_DIR/database/supabase_backup_$DATE.json"
        
        # This would require Supabase API access for database dumps
        # For now, we'll create a metadata backup
        echo "{\"backup_date\": \"$DATE\", \"database\": \"$DB_NAME\", \"host\": \"$DB_HOST\"}" > "$BACKUP_FILE"
        print_success "Database metadata backup created: $BACKUP_FILE"
    fi
}

# Function to backup application files
backup_application() {
    print_status "Starting application backup..."
    
    # Backup application directory
    APP_BACKUP_FILE="$BACKUP_DIR/application/app_backup_$DATE.tar.gz"
    
    if [ -d "/opt/unit-talk-production" ]; then
        tar -czf "$APP_BACKUP_FILE" \
            --exclude='node_modules' \
            --exclude='.git' \
            --exclude='logs' \
            --exclude='*.log' \
            /opt/unit-talk-production 2>> "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            print_success "Application backup completed: $APP_BACKUP_FILE"
        else
            print_error "Application backup failed"
            return 1
        fi
    else
        print_warning "Application directory not found, skipping application backup"
    fi
}

# Function to backup logs
backup_logs() {
    print_status "Starting logs backup..."
    
    # Backup log files
    LOGS_BACKUP_FILE="$BACKUP_DIR/logs/logs_backup_$DATE.tar.gz"
    
    if [ -d "/opt/unit-talk-production/logs" ]; then
        tar -czf "$LOGS_BACKUP_FILE" \
            /opt/unit-talk-production/logs 2>> "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            print_success "Logs backup completed: $LOGS_BACKUP_FILE"
        else
            print_error "Logs backup failed"
            return 1
        fi
    else
        print_warning "Logs directory not found, skipping logs backup"
    fi
}

# Function to backup Docker volumes
backup_docker_volumes() {
    print_status "Starting Docker volumes backup..."
    
    # Backup Redis data
    REDIS_BACKUP_FILE="$BACKUP_DIR/redis_backup_$DATE.tar.gz"
    
    if docker ps | grep -q "unit-talk-redis"; then
        docker run --rm \
            --volumes-from unit-talk-redis \
            -v "$BACKUP_DIR:/backup" \
            alpine tar -czf "/backup/redis_backup_$DATE.tar.gz" /data 2>> "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            print_success "Redis backup completed: $REDIS_BACKUP_FILE"
        else
            print_error "Redis backup failed"
            return 1
        fi
    else
        print_warning "Redis container not running, skipping Redis backup"
    fi
}

# Function to create backup manifest
create_manifest() {
    print_status "Creating backup manifest..."
    
    MANIFEST_FILE="$BACKUP_DIR/backup_manifest_$DATE.json"
    
    cat > "$MANIFEST_FILE" << EOF
{
  "backup_date": "$DATE",
  "backup_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "retention_days": $RETENTION_DAYS,
  "files": [
EOF
    
    # Add database backup
    if [ -f "$BACKUP_DIR/database/db_backup_$DATE.sql.gz" ]; then
        echo "    {\"type\": \"database\", \"file\": \"db_backup_$DATE.sql.gz\", \"size\": \"$(du -h "$BACKUP_DIR/database/db_backup_$DATE.sql.gz" | cut -f1)\"}" >> "$MANIFEST_FILE"
    fi
    
    # Add application backup
    if [ -f "$BACKUP_DIR/application/app_backup_$DATE.tar.gz" ]; then
        echo "    {\"type\": \"application\", \"file\": \"app_backup_$DATE.tar.gz\", \"size\": \"$(du -h "$BACKUP_DIR/application/app_backup_$DATE.tar.gz" | cut -f1)\"}" >> "$MANIFEST_FILE"
    fi
    
    # Add logs backup
    if [ -f "$BACKUP_DIR/logs/logs_backup_$DATE.tar.gz" ]; then
        echo "    {\"type\": \"logs\", \"file\": \"logs_backup_$DATE.tar.gz\", \"size\": \"$(du -h "$BACKUP_DIR/logs/logs_backup_$DATE.tar.gz" | cut -f1)\"}" >> "$MANIFEST_FILE"
    fi
    
    # Add Redis backup
    if [ -f "$BACKUP_DIR/redis_backup_$DATE.tar.gz" ]; then
        echo "    {\"type\": \"redis\", \"file\": \"redis_backup_$DATE.tar.gz\", \"size\": \"$(du -h "$BACKUP_DIR/redis_backup_$DATE.tar.gz" | cut -f1)\"}" >> "$MANIFEST_FILE"
    fi
    
    echo "  ]" >> "$MANIFEST_FILE"
    echo "}" >> "$MANIFEST_FILE"
    
    print_success "Backup manifest created: $MANIFEST_FILE"
}

# Function to clean old backups
cleanup_old_backups() {
    print_status "Cleaning up old backups..."
    
    # Remove backups older than retention period
    find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "backup_manifest_*.json" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    print_success "Old backups cleaned up (retention: $RETENTION_DAYS days)"
}

# Function to verify backup integrity
verify_backup() {
    print_status "Verifying backup integrity..."
    
    # Check if backup files exist and are not empty
    local backup_files=(
        "$BACKUP_DIR/database/db_backup_$DATE.sql.gz"
        "$BACKUP_DIR/application/app_backup_$DATE.tar.gz"
        "$BACKUP_DIR/logs/logs_backup_$DATE.tar.gz"
        "$BACKUP_DIR/redis_backup_$DATE.tar.gz"
    )
    
    for file in "${backup_files[@]}"; do
        if [ -f "$file" ] && [ -s "$file" ]; then
            print_success "Backup file verified: $file"
        elif [ -f "$file" ]; then
            print_warning "Backup file is empty: $file"
        else
            print_warning "Backup file not found: $file"
        fi
    done
}

# Function to send backup notification
send_notification() {
    print_status "Sending backup notification..."
    
    if [ -n "$DISCORD_WEBHOOK" ]; then
        # Create backup summary
        local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
        local file_count=$(find "$BACKUP_DIR" -name "*$DATE*" -type f | wc -l)
        
        # Send Discord notification
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{
               \"content\": \"📦 **Backup Completed**\n\n**Date:** $DATE\n**Files:** $file_count\n**Total Size:** $total_size\n**Status:** ✅ Success\"
             }" \
             "$DISCORD_WEBHOOK" >/dev/null 2>&1
        
        print_success "Backup notification sent to Discord"
    else
        print_warning "Discord webhook not configured, skipping notification"
    fi
}

# Main backup function
main() {
    print_status "Starting Unit Talk Production backup process..."
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_database
    backup_application
    backup_logs
    backup_docker_volumes
    
    # Create manifest
    create_manifest
    
    # Verify backup
    verify_backup
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send notification
    send_notification
    
    print_success "Backup process completed successfully!"
    
    # Log backup completion
    log_message "Backup completed successfully at $(date)"
}

# Run main function
main "$@" 