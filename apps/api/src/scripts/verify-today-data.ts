/**
 * Verify Today's Data - Quick verification script
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
  console.log('🔍 Verifying Today\'s Data');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Run ID: ${RUNID}\n`);

  const results: any = {
    runId: RUNID,
    timestamp: new Date().toISOString(),
    queries: {}
  };

  // A1: Feed rows today+
  console.log('A1: Checking feed rows (v_prop_read_model)...');
  const { data: feedData, error: feedError } = await supabase.rpc('exec_raw_sql', {
    sql: `SELECT count(*) AS feed_rows FROM public.v_prop_read_model WHERE game_date >= current_date`
  }).single();

  if (feedError) {
    // Fallback to direct query
    const { count: feedCount } = await supabase
      .from('v_prop_read_model')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', new Date().toISOString().split('T')[0]);
    results.queries.A1_feed_rows = feedCount || 0;
  } else {
    results.queries.A1_feed_rows = feedData?.feed_rows || 0;
  }
  console.log(`   ✅ Feed rows: ${results.queries.A1_feed_rows}`);

  // A2: Board rows today+
  console.log('A2: Checking board rows (v_daily_board)...');
  const { count: boardCount } = await supabase
    .from('v_daily_board')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);
  results.queries.A2_board_rows = boardCount || 0;
  console.log(`   ✅ Board rows: ${results.queries.A2_board_rows}`);

  // A3: Scored in last 60 min
  console.log('A3: Checking recent scoring (scored_props)...');
  const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: scoredCount } = await supabase
    .from('scored_props')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', sixtyMinAgo);
  results.queries.A3_scored_recent_rows = scoredCount || 0;
  console.log(`   ✅ Scored recent (60min): ${results.queries.A3_scored_recent_rows}`);

  // A4: Peek 5 latest approved
  console.log('A4: Checking approved picks (v_daily_board)...');
  const { data: approvedData } = await supabase
    .from('v_daily_board')
    .select('prop_id, queue_status, publish_at')
    .eq('queue_status', 'approved')
    .order('publish_at', { ascending: false, nullsFirst: false })
    .limit(5);
  results.queries.A4_approved_peek = approvedData || [];
  console.log(`   ✅ Approved picks: ${approvedData?.length || 0}`);

  // Write results
  ensureDir(OUT_DIR);
  const jsonFile = path.join(OUT_DIR, `VERIFY_${RUNID}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));
  console.log(`\n📝 Results written to: ${jsonFile}`);

  // Write MD
  const mdFile = path.join(OUT_DIR, `VERIFY_${RUNID}.md`);
  const mdContent = `# Verification Report - ${RUNID}

**Timestamp**: ${results.timestamp}

## Query Results

### A1: Feed Rows (v_prop_read_model)
**Count**: ${results.queries.A1_feed_rows}

### A2: Board Rows (v_daily_board)
**Count**: ${results.queries.A2_board_rows}

### A3: Scored Recent (60min)
**Count**: ${results.queries.A3_scored_recent_rows}

### A4: Approved Picks (Latest 5)
**Count**: ${results.queries.A4_approved_peek.length}

${results.queries.A4_approved_peek.length > 0 ? '**Picks**:\n' + results.queries.A4_approved_peek.map((p: any) => `- ${p.prop_id} (${p.queue_status}) @ ${p.publish_at}`).join('\n') : 'No approved picks found'}

---
**Status**: ${results.queries.A3_scored_recent_rows > 0 ? '✅ System Operational' : '⚠️ Scoring Required'}
`;
  fs.writeFileSync(mdFile, mdContent);
  console.log(`📝 Results written to: ${mdFile}\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Verification Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Feed rows: ${results.queries.A1_feed_rows}`);
  console.log(`Board rows: ${results.queries.A2_board_rows}`);
  console.log(`Scored recent: ${results.queries.A3_scored_recent_rows}`);
  console.log(`Approved peek: ${results.queries.A4_approved_peek.length}`);
  console.log('');

  // Check if scoring needed
  if (results.queries.A3_scored_recent_rows === 0) {
    console.log('⚠️  No recent scoring detected - scorer run required');
    process.exit(2);
  } else {
    console.log('✅ System operational');
    process.exit(0);
  }
}

main();
