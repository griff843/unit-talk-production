#!/bin/bash

# Settlement System Startup Script
# This script runs the full production settlement with correct environment variables

export SUPABASE_URL="https://lxqmuzmqtnnlpfapvief.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E"

echo "🚀 Starting Unit Talk Settlement System"
echo "📊 Configuration: 100 batch size, 8 RPS rate limit"
echo "⏱️ Estimated completion: 48-60 hours for 1.38M picks"
echo ""

npx tsx bin/settlement-runner.ts backfill --batch 100 --rate 8