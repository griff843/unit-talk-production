/**
 * Command Center Verification Script
 *
 * Runs verification checks and writes VERIFY_CC_<timestamp>.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RUNID = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(process.cwd(), 'apps/api/out/ops/verify');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log('🔍 Command Center Verification');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Run ID: ${RUNID}\n`);

  const results: any = {
    runId: RUNID,
    timestamp: new Date().toISOString(),
    checks: {},
    last_approved: [],
  };

  // Check 1: Board has rows
  console.log('1️⃣  Checking v_daily_board...');
  const { count: boardCount } = await supabase
    .from('v_daily_board')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  results.checks.board_has_rows = (boardCount || 0) > 0;
  results.checks.board_count = boardCount || 0;
  console.log(`   ${results.checks.board_has_rows ? '✅' : '❌'} Board count: ${boardCount}`);

  // Check 2: Feed has rows
  console.log('2️⃣  Checking v_prop_read_model...');
  const { count: feedCount } = await supabase
    .from('v_prop_read_model')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  results.checks.feed_has_rows = (feedCount || 0) > 0;
  results.checks.feed_count = feedCount || 0;
  console.log(`   ${results.checks.feed_has_rows ? '✅' : '❌'} Feed count: ${feedCount}`);

  // Check 3: Recent scoring
  console.log('3️⃣  Checking recent scoring (2h)...');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count: scoringCount } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', twoHoursAgo);

  results.checks.recent_scoring = (scoringCount || 0) > 0;
  results.checks.scoring_count = scoringCount || 0;
  console.log(`   ${results.checks.recent_scoring ? '✅' : '❌'} Scoring count: ${scoringCount}`);

  // Check 4: Last 5 approved
  console.log('4️⃣  Fetching last approved picks...');
  const { data: approvedData } = await supabase
    .from('promotion_queue')
    .select('id, prop_ref, status, publish_at, approved_by, created_at')
    .eq('status', 'approved')
    .order('publish_at', { ascending: false, nullsFirst: false })
    .limit(5);

  results.last_approved = approvedData || [];
  console.log(`   ✅ Found ${approvedData?.length || 0} approved picks`);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Verification Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Board has rows: ${results.checks.board_has_rows}`);
  console.log(`Feed has rows: ${results.checks.feed_has_rows}`);
  console.log(`Recent scoring: ${results.checks.recent_scoring}`);
  console.log(`Last approved: ${results.last_approved.length}`);
  console.log('');

  // Write results
  ensureDir(OUT_DIR);
  const outFile = path.join(OUT_DIR, `VERIFY_CC_${RUNID}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`📝 Results written to: ${outFile}\n`);

  // Exit code
  const allPassed =
    results.checks.board_has_rows &&
    results.checks.feed_has_rows &&
    results.checks.recent_scoring;

  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log('⚠️  SOME CHECKS FAILED');
    process.exit(1);
  }
}

main();
