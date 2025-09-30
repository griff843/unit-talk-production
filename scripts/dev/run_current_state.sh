#!/bin/sh
set -e
cd /app
export TS_NODE_COMPILER_OPTIONS='{"module":"NodeNext","moduleResolution":"NodeNext"}'
printf "[run_current_state] starting at $(date -Iseconds)\n"
npx ts-node -T scripts/db/current-state.ts
printf "[run_current_state] done at $(date -Iseconds)\n"
ls -la out/ops || true
printf "--- CURRENT STATE HEAD ---\n"
sed -n '1,80p' out/ops/current-state.json || true

