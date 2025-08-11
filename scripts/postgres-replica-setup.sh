#!/bin/bash

# PostgreSQL Read Replica Setup Script
# This script configures a PostgreSQL read replica for high availability

set -e

echo "🔧 Setting up PostgreSQL read replica..."

# Wait for master to be ready
echo "⏳ Waiting for master PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U postgres -d unit_talk_dev; do
  echo "⏳ Master not ready yet, waiting..."
  sleep 2
done

echo "✅ Master PostgreSQL is ready"

# Create replication user on master (if not exists)
echo "👤 Setting up replication user on master..."
PGPASSWORD=postgres psql -h postgres -p 5432 -U postgres -d unit_talk_dev -c "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
        CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_pass';
        GRANT CONNECT ON DATABASE unit_talk_dev TO replicator;
        GRANT USAGE ON SCHEMA public TO replicator;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO replicator;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO replicator;
    END IF;
END
\$\$;
" || echo "⚠️ Replication user setup failed, may already exist"

# Configure master for replication
echo "⚙️ Configuring master for replication..."
PGPASSWORD=postgres psql -h postgres -p 5432 -U postgres -d unit_talk_dev -c "
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET max_replication_slots = 3;
ALTER SYSTEM SET synchronous_commit = off;
SELECT pg_reload_conf();
" || echo "⚠️ Master configuration may already be set"

# Stop PostgreSQL on replica to prepare for base backup
echo "🛑 Stopping PostgreSQL on replica for setup..."
pg_ctl -D /var/lib/postgresql/data -m fast -w stop || echo "PostgreSQL was not running"

# Remove existing data directory
echo "🗑️ Clearing replica data directory..."
rm -rf /var/lib/postgresql/data/*

# Create base backup from master
echo "📋 Creating base backup from master..."
PGPASSWORD=replicator_pass pg_basebackup -h postgres -p 5432 -D /var/lib/postgresql/data -U replicator -v -P -W -R

# Configure replica-specific settings
echo "⚙️ Configuring replica settings..."
cat >> /var/lib/postgresql/data/postgresql.conf << EOF

# ==============================================
# REPLICA CONFIGURATION
# ==============================================

# Server Settings
cluster_name = 'unit_talk_replica'
port = 5432

# Read-only replica settings
hot_standby = on
max_standby_archive_delay = 30s
max_standby_streaming_delay = 30s

# Recovery settings
restore_command = 'false'  # No archive recovery needed for streaming

# Logging for monitoring
log_destination = 'stderr'
log_statement = 'none'
log_min_duration_statement = 5000
log_line_prefix = '%t [%p]: [%l-1] db=%d,user=%u,app=%a,client=%h '

# Connection settings  
max_connections = 50  # Lower than master since read-only
shared_preload_libraries = ''

EOF

# Set proper permissions
echo "🔐 Setting permissions..."
chown -R postgres:postgres /var/lib/postgresql/data
chmod 700 /var/lib/postgresql/data

# Start PostgreSQL replica
echo "🚀 Starting PostgreSQL replica..."
pg_ctl -D /var/lib/postgresql/data -l /var/lib/postgresql/data/replica.log start -w

# Wait for replica to be ready
echo "⏳ Waiting for replica to be ready..."
until pg_isready -h localhost -p 5432 -U postgres -d unit_talk_dev; do
  echo "⏳ Replica not ready yet, waiting..."
  sleep 2
done

# Verify replication status
echo "✅ Verifying replication status..."
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d unit_talk_dev -c "
SELECT 
    pid,
    state,
    client_addr,
    client_hostname,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state,
    sync_priority
FROM pg_stat_replication;
"

echo "🎉 PostgreSQL read replica setup completed successfully!"
echo "📊 Master: postgres:5432"
echo "📊 Replica: postgres-replica:5432 (localhost:5433)"
echo ""
echo "🔍 To check replication lag:"
echo "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS replica_lag_seconds;"
echo ""
echo "🔧 High Availability Setup Complete!"