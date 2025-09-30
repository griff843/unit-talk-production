#!/bin/bash

# Production-grade SGO Backfill Starter Script
# This script demonstrates how to trigger the BackfillSportsGameOdds workflow

echo "🚀 Starting SGO Backfill Workflow for 2025..."

# Ensure environment variables are set
if [ -z "$SPORTSGAMEODDS_KEY" ]; then
    echo "❌ Error: SPORTSGAMEODDS_KEY environment variable not set"
    exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: SUPABASE_URL environment variable not set"
    exit 1
fi

# Start the workflow using tctl (Temporal CLI)
echo "📡 Triggering BackfillSportsGameOdds workflow..."

tctl workflow start \
  --task-queue backfill-worker \
  --workflow-type BackfillSportsGameOdds \
  --workflow-id backfill-sgo-2025-all-sports \
  --input '{
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "sports": ["mlb", "nba", "nfl", "ncaaf", "ncaab", "wnba", "nhl"]
  }'

echo "✅ Workflow started successfully!"
echo "📊 You can monitor progress at: http://localhost:8088 (Temporal Web UI)"
echo "🔍 Workflow ID: backfill-sgo-2025-all-sports"

# Alternative: Start with single sport for testing
echo ""
echo "💡 For testing, you can also run a single sport:"
echo "tctl workflow start \\"
echo "  --task-queue backfill-worker \\"
echo "  --workflow-type BackfillSportsGameOdds \\"
echo "  --workflow-id backfill-sgo-test-mlb \\"
echo "  --input '{\"startDate\":\"2025-01-01\",\"endDate\":\"2025-01-01\",\"sports\":[\"mlb\"]}'"