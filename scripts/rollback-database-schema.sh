#!/bin/bash

# Database Schema Rollback Script
# Removes advanced features database schema only

set -e

echo "🗄️ Rolling back advanced features database schema..."

# Create rollback migration
cat > apps/api/migrations/rollback_advanced_features_schema.sql << 'EOF'
BEGIN;

-- Drop advanced features tables in reverse dependency order
DROP TABLE IF EXISTS arbitrage_opportunities CASCADE;
DROP TABLE IF EXISTS injury_impacts CASCADE;
DROP TABLE IF EXISTS best_odds CASCADE;
DROP TABLE IF EXISTS steam_moves CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop API quota management tables
DROP TABLE IF EXISTS api_emergency_states CASCADE;
DROP TABLE IF EXISTS api_quota_usage CASCADE;
DROP TABLE IF EXISTS api_quota_configs CASCADE;

-- Drop views
DROP VIEW IF EXISTS daily_quota_usage CASCADE;
DROP VIEW IF EXISTS monthly_quota_usage CASCADE;
DROP VIEW IF EXISTS current_quota_status CASCADE;

COMMIT;
EOF

# Execute rollback
docker-compose exec api npx supabase db reset --db-url "$DATABASE_URL" --file rollback_advanced_features_schema.sql

echo "✅ Database schema rollback completed"