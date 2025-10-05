# ============================================================================
# Apply Cloud Delta Migration & Verify
# ============================================================================

Write-Host "`n=== SUPABASE CLOUD DELTA MIGRATION ===" -ForegroundColor Cyan
Write-Host "Migration: 20251008_cloud_delta.sql`n" -ForegroundColor Gray

# Supabase Cloud pooler connection (prompts for password)
$env:SUPABASE_POOLER_URL = "postgresql://postgres.lxqmuzmqtnnlpfapvief@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"

Write-Host "Step 1: Applying cloud delta migration..." -ForegroundColor Yellow

# Apply the delta migration
docker run --rm -i postgres:16-alpine sh -lc 'cat > /tmp/cloud_delta.sql && psql "$SUPABASE_URL" --set ON_ERROR_STOP=1 -f /tmp/cloud_delta.sql' `
  -e SUPABASE_URL=$env:SUPABASE_POOLER_URL < supabase/overrides/20251008_cloud_delta.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Migration applied successfully!`n" -ForegroundColor Green

Write-Host "Step 2: Verifying schema..." -ForegroundColor Yellow

# Verification queries
$verifyJson = docker run --rm -e SUPABASE_URL=$env:SUPABASE_POOLER_URL postgres:16-alpine psql "$SUPABASE_URL" -t -c "
  SELECT json_build_object(
    'raw_props_today', (SELECT count(*) FROM public.raw_props WHERE game_date >= (now()::date)),
    'unified_today', (SELECT count(*) FROM public.unified_picks WHERE game_date >= (now()::date)),
    'scored_15m', (SELECT count(*) FROM public.scored_props WHERE updated_at >= now() - interval '15 minutes'),
    'feed_rows', (SELECT count(*) FROM public.v_prop_read_model WHERE game_date >= (now()::date)),
    'board_rows', (SELECT count(*) FROM public.v_daily_board WHERE game_date >= (now()::date)),
    'views_exist', (
      SELECT json_build_object(
        'v_prop_read_model', EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'v_prop_read_model'),
        'v_daily_board', EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'v_daily_board'),
        'v_open_promotions', EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'v_open_promotions')
      )
    ),
    'rpcs_exist', (
      SELECT json_agg(proname ORDER BY proname)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname IN ('submit_pick', 'approve_pick', 'deny_pick')
    )
  );"

Write-Host "`n📊 Verification Results:" -ForegroundColor Cyan
Write-Host $verifyJson

# Save to file
$outDir = "apps/api/out/ops"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$verifyJson | Out-File -FilePath "$outDir/VERIFY_DB.json" -Encoding UTF8
Write-Host "`n✅ Saved to: $outDir/VERIFY_DB.json" -ForegroundColor Green

Write-Host "`n=== MIGRATION COMPLETE ===" -ForegroundColor Cyan
Write-Host "Next: Run npx tsx apps/api/src/scripts/test-pipeline-flow.ts`n" -ForegroundColor Gray
