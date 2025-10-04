#!/usr/bin/env bash
# scripts/db_deploy.sh
# Full cloud DB deployment: overlays + verification

set -euo pipefail

RUNID=$(date -u +%Y%m%dT%H%M%SZ 2>/dev/null || date -u +"%Y%m%dT%H%M%SZ")
OUT="apps/api/out/ops/dbcore/run-$RUNID"
mkdir -p "$OUT"

if [[ -z "${SUPABASE_PSQL_URL:-}" ]]; then
  echo "[deploy] SUPABASE_PSQL_URL not set. Scaffolding complete; awaiting env."
  exit 0
fi

echo "[deploy] Starting deployment run $RUNID" | tee "$OUT/01_start.log"

echo "[deploy] apply overlays…" | tee -a "$OUT/02_overlay.log"
bash ./scripts/db_overlay_apply.sh >>"$OUT/02_overlay.log" 2>&1

echo "[deploy] verify…" | tee -a "$OUT/03_verify.log"
bash ./scripts/db_verify.sh >"$OUT/03_verify.log" 2>&1

PASS=$(grep -c 'PASS ' "$OUT/03_verify.log" 2>/dev/null || echo "0")
echo "[SUMMARY $RUNID] views_pass=$PASS" | tee "$OUT/summary.txt"

echo "[deploy] ✓ Deployment complete. Artifacts in $OUT"
