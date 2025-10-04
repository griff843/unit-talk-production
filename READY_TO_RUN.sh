#!/bin/bash
# READY TO RUN: Cloud E2E Execution Block
# Run this inside the repo root after filling in credentials

set -e

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 Cloud E2E Execution Starting"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Stop any existing containers
echo "📦 Stopping existing containers..."
docker-compose --profile cloud down 2>/dev/null || true
docker-compose --profile local down 2>/dev/null || true
docker-compose down 2>/dev/null || true

# Step 2: Start cloud profile services
echo "🐳 Starting cloud profile services..."
docker-compose --profile cloud up -d redis temporal temporal-ui prometheus grafana

# Step 3: Start API with cloud profile
echo "🔧 Starting API service (cloud mode)..."
docker-compose --profile cloud up -d --force-recreate --no-deps api-cloud

# Step 4: Wait for services to be healthy
echo "⏳ Waiting for services to be healthy (30s)..."
sleep 30

# Step 5: Verify no local DB leak
echo "🔍 Verifying no local DB environment..."
if docker-compose --profile cloud exec -T api-cloud printenv 2>/dev/null | grep -qi DATABASE_URL; then
  echo "❌ ERROR: Local DB environment detected!"
  echo "   DATABASE_URL should NOT be present in cloud mode"
  exit 1
else
  echo "✅ OK: No local DB environment detected"
fi

# Step 6: Supabase login (interactive)
echo ""
echo "🔐 Supabase Login Required"
echo "   This will open your browser for authentication"
read -p "Press Enter to continue..."
supabase logout 2>/dev/null || true
supabase login

# Step 7: Link to cloud project
echo ""
echo "🔗 Linking to Supabase Cloud project..."
supabase link --project-ref lxqmuzmqtnnlpfapvief --local-config .supabase/config.cloud.toml

# Step 8: Pull current schema
echo "📥 Pulling current schema..."
supabase db pull --local-config .supabase/config.cloud.toml

# Step 9: Push migrations
echo "📤 Pushing migrations to cloud..."
supabase db push --local-config .supabase/config.cloud.toml

# Step 10: Health check
echo ""
echo "🏥 Running database health check..."
docker-compose --profile cloud exec -T api-cloud npm run db:health

# Step 11: Run E2E
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎯 Running E2E Pipeline"
echo "═══════════════════════════════════════════════════════════"
echo ""
docker-compose --profile cloud exec -T api-cloud npm run e2e

# Step 12: Review results
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 E2E Complete - Reviewing Results"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📄 Acceptance Gates Summary:"
echo ""
cat apps/api/out/ops/ACCEPTANCE_GATES_SUMMARY.md | tail -20
echo ""
echo "✅ Done! Check apps/api/out/ops/ for all artifacts"
echo ""
