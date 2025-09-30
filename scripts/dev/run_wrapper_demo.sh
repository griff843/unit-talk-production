#!/bin/sh
set -e
cd /app/apps/api
export TS_NODE_COMPILER_OPTIONS='{"module":"NodeNext","moduleResolution":"NodeNext"}'
# Ensure ODDS_API_KEY exists (use placeholder if missing)
if [ -z "$ODDS_API_KEY" ]; then
  export ODDS_API_KEY="test-placeholder-key"
fi
printf "[run_wrapper_demo] starting at $(date -Iseconds)\n"
# Run the runner in transpile-only mode
npx ts-node -T src/runner/runFeedAgentNow.ts || true
printf "[run_wrapper_demo] done at $(date -Iseconds)\n"
# Show last lines of runner log if present
if [ -f /app/out/runner.log ]; then
  tail -n 60 /app/out/runner.log || true
fi

