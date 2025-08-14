#!/bin/bash
set -e

echo "🚀 Starting local Command Center smoke test..."

# Check if dev server is running
if curl -f http://localhost:3000/api/health 2>/dev/null; then
  echo "✅ Dev server is running at http://localhost:3000"
elif curl -f http://localhost:3001/api/health 2>/dev/null; then
  echo "✅ Dev server is running at http://localhost:3001" 
  export BASE_URL=http://localhost:3001
elif curl -f http://localhost:3018/api/health 2>/dev/null; then
  echo "✅ Dev server is running at http://localhost:3018"
  export BASE_URL=http://localhost:3018
else
  echo "❌ Command Center dev server not found"
  echo ""
  echo "Please start the dev server first:"
  echo "  npm run dev"
  echo ""
  echo "Then run this script again:"
  echo "  ./scripts/local-smoke.sh"
  exit 1
fi

echo "🧪 Running smoke tests against ${BASE_URL:-http://localhost:3000}..."
echo ""

# Run the smoke tests
npx tsx scripts/smoke/wiring-smoke.ts

echo ""
echo "✅ Local smoke test completed!"