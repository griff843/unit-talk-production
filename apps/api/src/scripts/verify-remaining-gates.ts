import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyRemainingGates() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  PIPELINE GATES VERIFICATION - REMAINING 4 GATES');
  console.log('════════════════════════════════════════════════════════════════\n');

  const results: any = {
    timestamp: new Date().toISOString(),
    gates: {}
  };

  // Gate 3: unified_picks today
  console.log('🔍 Gate 3: unified_today (unified_picks in last 5 min)');
  const { data: unifiedData, error: unifiedError } = await supabase
    .from('unified_picks')
    .select('id, created_at, sport, market, player_name')
    .gte('created_at', new Date(Date.now() - 300000).toISOString());

  if (unifiedError) {
    console.log(`   ❌ ERROR: ${unifiedError.message}`);
    results.gates.unified_today = { status: 'ERROR', error: unifiedError.message };
  } else {
    const count = unifiedData?.length || 0;
    const status = count > 0 ? 'PASS' : 'FAIL';
    console.log(`   ${status === 'PASS' ? '✅' : '🔴'} ${status}: ${count} rows`);
    if (count > 0) {
      console.log(`   Sample: ${unifiedData[0]?.player_name || unifiedData[0]?.market} (${unifiedData[0]?.sport})`);
    }
    results.gates.unified_today = { status, count, sample: unifiedData?.[0] };
  }

  // Gate 4: scored_props in last 15 min
  console.log('\n🔍 Gate 4: scored_15m (scored_props in last 15 min)');
  const { data: scoredData, error: scoredError } = await supabase
    .from('scored_props')
    .select('id, updated_at, tier, edge, prob_win, prop_ref')
    .gte('updated_at', new Date(Date.now() - 900000).toISOString());

  if (scoredError) {
    console.log(`   ❌ ERROR: ${scoredError.message}`);
    results.gates.scored_15m = { status: 'ERROR', error: scoredError.message };
  } else {
    const count = scoredData?.length || 0;
    const status = count > 0 ? 'PASS' : 'FAIL';
    console.log(`   ${status === 'PASS' ? '✅' : '🔴'} ${status}: ${count} rows`);
    if (count > 0) {
      console.log(`   Sample: Tier ${scoredData[0]?.tier}, Edge ${scoredData[0]?.edge}%, Win ${scoredData[0]?.prob_win}%`);
    }
    results.gates.scored_15m = { status, count, sample: scoredData?.[0] };
  }

  // Gate 5: v_prop_read_model today
  console.log('\n🔍 Gate 5: v_prop_read_model_today (view rows for today)');
  const { data: viewData, error: viewError } = await supabase
    .from('v_prop_read_model')
    .select('id, player_name, market, sport, tier, edge')
    .gte('game_date', new Date().toISOString().split('T')[0]);

  if (viewError) {
    console.log(`   ❌ ERROR: ${viewError.message}`);
    results.gates.v_prop_read_model_today = { status: 'ERROR', error: viewError.message };
  } else {
    const count = viewData?.length || 0;
    const status = count > 0 ? 'PASS' : 'FAIL';
    console.log(`   ${status === 'PASS' ? '✅' : '🔴'} ${status}: ${count} rows`);
    if (count > 0) {
      const tiered = viewData.filter(d => d.tier).length;
      console.log(`   Tiered props: ${tiered}/${count} (${Math.round(tiered/count*100)}%)`);
      console.log(`   Sample: ${viewData[0]?.player_name || viewData[0]?.market} - Tier ${viewData[0]?.tier || 'N/A'}`);
    }
    results.gates.v_prop_read_model_today = { status, count, sample: viewData?.[0] };
  }

  // Gate 6: v_daily_board today
  console.log('\n🔍 Gate 6: v_daily_board_today (approved picks for today)');
  const { data: boardData, error: boardError } = await supabase
    .from('v_daily_board')
    .select('prop_id, player_name, market, sport, tier, edge, pick_status')
    .gte('game_date', new Date().toISOString().split('T')[0]);

  if (boardError) {
    console.log(`   ❌ ERROR: ${boardError.message}`);
    results.gates.v_daily_board_today = { status: 'ERROR', error: boardError.message };
  } else {
    const count = boardData?.length || 0;
    const status = count > 0 ? 'PASS' : 'FAIL';
    console.log(`   ${status === 'PASS' ? '✅' : '🔴'} ${status}: ${count} rows`);
    if (count > 0) {
      const approved = boardData.filter(d => d.pick_status === 'approved').length;
      console.log(`   Approved: ${approved}/${count}`);
      console.log(`   Sample: ${boardData[0]?.player_name || boardData[0]?.market} - Status: ${boardData[0]?.pick_status}`);
    }
    results.gates.v_daily_board_today = { status, count, sample: boardData?.[0] };
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  
  const gates = Object.values(results.gates);
  const passed = gates.filter((g: any) => g.status === 'PASS').length;
  const failed = gates.filter((g: any) => g.status === 'FAIL').length;
  const errors = gates.filter((g: any) => g.status === 'ERROR').length;

  console.log(`\n✅ PASS: ${passed}/4`);
  console.log(`🔴 FAIL: ${failed}/4`);
  console.log(`❌ ERROR: ${errors}/4`);

  const overall = passed === 4 ? '🎉 ALL GATES PASS' : failed > 0 ? '⚠️ PARTIAL PASS' : '❌ GATES FAILED';
  console.log(`\nOverall: ${overall}\n`);

  return results;
}

verifyRemainingGates()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
