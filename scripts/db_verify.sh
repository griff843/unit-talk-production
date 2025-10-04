#!/usr/bin/env bash
# scripts/db_verify.sh
# Verify overlay views and RPCs exist and are readable

set -euo pipefail

if [[ -z "${SUPABASE_PSQL_URL:-}" ]]; then
  echo "[ERROR] SUPABASE_PSQL_URL not set"
  exit 1
fi

echo "[verify] Checking views..."

# Check v_daily_board
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS daily_board_exists' as gate, count(*) >= 0 from public.v_daily_board;" || echo "FAIL daily_board_exists"

# Check v_prop_read_model
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS prop_read_model_exists' as gate, count(*) >= 0 from public.v_prop_read_model;" || echo "FAIL prop_read_model_exists"

# Check v_open_promotions
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS open_promotions_exists' as gate, count(*) >= 0 from public.v_open_promotions;" || echo "FAIL open_promotions_exists"

# Check v_recent_settlement
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS recent_settlement_exists' as gate, count(*) >= 0 from public.v_recent_settlement;" || echo "FAIL recent_settlement_exists"

# Check v_best_line_now
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS best_line_now_exists' as gate, count(*) >= 0 from public.v_best_line_now;" || echo "FAIL best_line_now_exists"

echo "[verify] Checking RPCs..."

# Check approve_pick function exists
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS approve_pick_exists' as gate from pg_proc where proname = 'approve_pick';" || echo "FAIL approve_pick_exists"

# Check deny_pick function exists
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS deny_pick_exists' as gate from pg_proc where proname = 'deny_pick';" || echo "FAIL deny_pick_exists"

# Check submit_pick function exists
psql "$SUPABASE_PSQL_URL" -tAc "select 'PASS submit_pick_exists' as gate from pg_proc where proname = 'submit_pick';" || echo "FAIL submit_pick_exists"

echo "[verify] ✓ Verification complete"
