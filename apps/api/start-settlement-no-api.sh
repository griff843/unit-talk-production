#!/bin/bash

# Settlement System Startup Script - NO EXTERNAL API MODE
# This script runs settlement with manual outcomes only (no external API calls)

export SUPABASE_URL="https://lxqmuzmqtnnlpfapvief.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E"

# Disable external API calls - settlement will only process picks with existing outcomes
export SKIP_EXTERNAL_API=true
export SETTLEMENT_MODE=manual_only

echo "🚀 Starting Unit Talk Settlement System (No External API Mode)"
echo "📊 Configuration: Manual settlement only - skipping external API calls"
echo "⚡ Processing picks with existing outcomes in database"
echo "⏱️ Estimated completion: 10-15 minutes for 1.38M picks"
echo ""

npx tsx bin/settlement-runner.ts backfill --batch 500 --rate 50 --dry-run=false