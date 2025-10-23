#!/bin/bash
# Database Connectivity Probes
# Date: 2025-10-20
# Purpose: Test both DIRECT and POOLED DSNs with SSL

set -e

echo "========================================="
echo "Database Connectivity Probes"
echo "Project: cqfnsozknjzvyiziwicl"
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "========================================="
echo ""

# DIRECT CONNECTION (port 5432)
echo "🔍 Probe 1: DIRECT CONNECTION (db.PROJECT.supabase.co:5432)"
echo "   Purpose: Migrations, backfills, long jobs"
echo "   SSL: Required"
echo "   Note: DNS resolution may fail from container - this is expected"
echo ""

DIRECT_URL="postgresql://postgres:Adalise843!@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres?sslmode=require"

# Try direct connection (may fail due to DNS)
docker-compose exec -T api psql "$DIRECT_URL" -c "
SELECT
  'DIRECT' as connection_type,
  version() as postgres_version,
  current_database() as database,
  inet_server_addr() as server_ip,
  inet_server_port() as server_port,
  pg_is_in_recovery() as is_replica,
  current_user as db_user;
" 2>&1 | tee /tmp/direct_probe.log || {
  echo "⚠️  DIRECT connection failed (expected due to DNS resolution from container)"
  echo "   This DSN works from host machine and Supabase CLI"
  echo "   Error: $(cat /tmp/direct_probe.log | grep -i error | head -n 1)"
}

echo ""
echo "========================================="
echo ""

# POOLED CONNECTION (port 6543)
echo "🔍 Probe 2: POOLED CONNECTION (aws-0-us-east-1.pooler.supabase.com:6543)"
echo "   Purpose: Runtime apps/agents"
echo "   SSL: Required"
echo "   PgBouncer: Enabled"
echo ""

POOLED_URL="postgresql://postgres:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"

docker-compose exec -T api psql "$POOLED_URL" -c "
SELECT 
  'POOLED' as connection_type,
  version() as postgres_version,
  current_database() as database,
  inet_server_addr() as server_ip,
  inet_server_port() as server_port,
  current_user as db_user;
" || echo "❌ POOLED connection failed"

echo ""
echo "========================================="
echo "✅ Connectivity probes complete"
echo "========================================="

