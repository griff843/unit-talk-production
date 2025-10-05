/**
 * Verify Pipeline Persistence - Final Gates Check
 *
 * Checks all 5 gates and produces PASS/FAIL report
 *
 * Usage: npx tsx apps/api/src/scripts/verify-pipeline-persist.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT_FILE = path.join(process.cwd(), 'apps/api/out/ops/VERIFY_PIPELINE_PERSIST.json');

async function verifyPipeline() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  PIPELINE PERSISTENCE VERIFICATION');
  console.log('════════════════════════════════════════════════════════════════\n');

  const results: any = {
    timestamp: new Date().toISOString(),
    gates: {},
    samples: {},
    overall_status: 'PENDING'
  };

  // Gate 1: raw_props_today
  console.log('🔍 Gate 1: raw_props_today (raw_props for today)');
  const { data: rawPropsData, error: rpError } = await supabase
    .from('raw_props')
    .select('id', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const raw_props_today = rawPropsData?.length || 0;
  results.gates.raw_props_today = {
    expected: '> 0',
    actual: raw_props_today,
    status: raw_props_today > 0 ? 'PASS' : 'FAIL'
  };
  console.log(`   ${raw_props_today > 0 ? '✅' : '🔴'} ${results.gates.raw_props_today.status}: ${raw_props_today} rows\n`);

  // Gate 2: unified_today
  console.log('🔍 Gate 2: unified_today (unified_picks for today)');
  const { data: unifiedData, error: upError } = await supabase
    .from('unified_picks')
    .select('id', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const unified_today = unifiedData?.length || 0;
  results.gates.unified_today = {
    expected: '> 0',
    actual: unified_today,
    status: unified_today > 0 ? 'PASS' : 'FAIL'
  };
  console.log(`   ${unified_today > 0 ? '✅' : '🔴'} ${results.gates.unified_today.status}: ${unified_today} rows\n`);

  // Gate 3: scored_15m
  console.log('🔍 Gate 3: scored_15m (scored_props updated in last 15 min)');
  const { data: scoredData, error: spError } = await supabase
    .from('scored_props')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

  const scored_15m = scoredData?.length || 0;
  results.gates.scored_15m = {
    expected: '>= 1',
    actual: scored_15m,
    status: scored_15m >= 1 ? 'PASS' : 'FAIL'
  };
  console.log(`   ${scored_15m >= 1 ? '✅' : '🔴'} ${results.gates.scored_15m.status}: ${scored_15m} rows\n`);

  // Gate 4: feed_rows (v_prop_read_model)
  console.log('🔍 Gate 4: feed_rows (v_prop_read_model for today)');
  const { data: feedData, error: feedError } = await supabase
    .from('v_prop_read_model')
    .select('id', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const feed_rows = feedData?.length || 0;
  results.gates.feed_rows = {
    expected: '> 0',
    actual: feed_rows,
    status: feed_rows > 0 ? 'PASS' : 'FAIL'
  };
  console.log(`   ${feed_rows > 0 ? '✅' : '🔴'} ${results.gates.feed_rows.status}: ${feed_rows} rows\n`);

  // Gate 5: board_rows (v_daily_board)
  console.log('🔍 Gate 5: board_rows (v_daily_board for today)');
  const { data: boardData, error: boardError } = await supabase
    .from('v_daily_board')
    .select('prop_id', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  const board_rows = boardData?.length || 0;
  results.gates.board_rows = {
    expected: '> 0',
    actual: board_rows,
    status: board_rows > 0 ? 'PASS' : 'FAIL'
  };
  console.log(`   ${board_rows > 0 ? '✅' : '🔴'} ${results.gates.board_rows.status}: ${board_rows} rows\n`);

  // Sample data
  console.log('📊 Fetching sample data...\n');

  // Sample from v_prop_read_model
  const { data: viewSample } = await supabase
    .from('v_prop_read_model')
    .select('id, sport, market, selection, odds, game_date')
    .gte('game_date', new Date().toISOString().split('T')[0])
    .order('game_date')
    .order('odds', { ascending: false, nullsFirst: false })
    .limit(3);

  results.samples.v_prop_read_model = viewSample || [];

  // Sample from scored_props with unified_picks
  const { data: scoredSample } = await supabase
    .from('scored_props')
    .select('prop_ref, tier, edge, prob_win, updated_at')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('updated_at', { ascending: false })
    .limit(3);

  results.samples.scored_props = scoredSample || [];

  // Overall status
  const gates = Object.values(results.gates);
  const passCount = gates.filter((g: any) => g.status === 'PASS').length;
  const failCount = gates.filter((g: any) => g.status === 'FAIL').length;

  results.overall_status = passCount === 5 ? 'PASS' : 'PARTIAL';
  results.summary = {
    pass: passCount,
    fail: failCount,
    total: 5
  };

  // Write JSON report
  const outDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));

  // Console summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`\n✅ PASS: ${passCount}/5`);
  console.log(`🔴 FAIL: ${failCount}/5`);
  console.log(`\nOverall: ${results.overall_status === 'PASS' ? '🎉 ALL GATES PASS' : '⚠️ PARTIAL PASS'}`);
  console.log(`\n📄 Report saved to: ${OUT_FILE}\n`);

  return results;
}

verifyPipeline()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
