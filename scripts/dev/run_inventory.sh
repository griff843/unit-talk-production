#!/bin/sh
set -e
cd /app
# Ensure ts-node uses NodeNext
export TS_NODE_COMPILER_OPTIONS='{"module":"NodeNext","moduleResolution":"NodeNext"}'
# Run inventory generator (transpile-only)
printf "[run_inventory] starting at $(date -Iseconds)\n"
npx ts-node -T scripts/db/inventory-schema.ts --schema=public --md=full
printf "[run_inventory] done at $(date -Iseconds)\n"
# Show artifacts
ls -la out/db | head -n 50
printf "--- MD HEAD ---\n"
sed -n '1,60p' out/db/schema-inventory.md || true
printf "--- JSON HEAD ---\n"
sed -n '1,60p' out/db/schema-inventory.json || true
printf "--- JSON EXTRAS SEARCH ---\n"
grep -n 'extras' out/db/schema-inventory.json || true

