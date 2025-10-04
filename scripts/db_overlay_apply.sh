#!/usr/bin/env bash
# scripts/db_overlay_apply.sh
# Apply idempotent overlay views and RPCs to Supabase cloud DB

set -euo pipefail

if [[ -z "${SUPABASE_PSQL_URL:-}" ]]; then
  echo "[ERROR] SUPABASE_PSQL_URL not set"
  exit 1
fi

echo "[overlay] Applying views (20_views.sql)..."
psql "$SUPABASE_PSQL_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/overlay/20_views.sql

echo "[overlay] Applying RPCs (30_rpcs.sql)..."
psql "$SUPABASE_PSQL_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/overlay/30_rpcs.sql

echo "[overlay] ✓ All overlays applied successfully"
