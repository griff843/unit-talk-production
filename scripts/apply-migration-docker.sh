#!/bin/bash
# Apply Supabase migration using postgres Docker image
# Date: 2025-10-20

set -e

echo "🔧 Applying migration: 20251020_api_quota_configs_extension.sql"
echo ""

# Database connection string (direct connection to db.PROJECT.supabase.co:5432)
DB_URL="postgresql://postgres:Adalise843!@db.cqfnsozknjzvyiziwicl.supabase.co:5432/postgres?sslmode=require"

# Run psql in postgres container with custom DNS
docker run --rm \
  --dns 8.8.8.8 \
  --dns 8.8.4.4 \
  -v "$(pwd)/supabase/migrations:/migrations" \
  postgres:15-alpine \
  psql "$DB_URL" \
  -f /migrations/20251020_api_quota_configs_extension.sql

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "Next steps:"
echo "  1. Restart API: ./dev.sh restart api"
echo "  2. Check logs: docker-compose logs api --tail=100 | grep -i quota"
echo ""

