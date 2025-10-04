/**
 * E2E Views Verification Script
 *
 * Tests:
 * 1. Views return data
 * 2. Scoring writes work
 * 3. Smoke test workflow (submit → approve)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RUNID = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

interface VerificationResult {
  runId: string;
  timestamp: string;
  board_rows: number;
  feed_rows: number;
  scored_recent_rows: number;
  approved_smoke: {
    prop_id: string | null;
    queue_id: string | null;
    queue_status: string | null;
    publish_at: string | null;
  };
  gates: {
    name: string;
    pass: boolean;
    value?: any;
    threshold?: any;
  }[];
}

async function main() {
  console.log('🔍 Starting Views E2E Verification');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Run ID: ${RUNID}`);
  console.log('');

  const result: VerificationResult = {
    runId: RUNID,
    timestamp: new Date().toISOString(),
    board_rows: 0,
    feed_rows: 0,
    scored_recent_rows: 0,
    approved_smoke: {
      prop_id: null,
      queue_id: null,
      queue_status: null,
      publish_at: null,
    },
    gates: [],
  };

  try {
    // CHECK 1: v_prop_read_model returns data
    console.log('1️⃣  Checking v_prop_read_model...');
    const { data: feedData, error: feedError } = await supabase
      .from('v_prop_read_model')
      .select('prop_ref', { count: 'exact', head: false })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    result.feed_rows = feedData?.length || 0;
    const feedPass = result.feed_rows > 0;
    result.gates.push({
      name: 'v_prop_read_model_has_data',
      pass: feedPass,
      value: result.feed_rows,
      threshold: '>0',
    });
    console.log(`   ${feedPass ? '✅' : '❌'} v_prop_read_model: ${result.feed_rows} rows`);
    if (feedError) console.error('   Error:', feedError);

    // CHECK 2: v_daily_board returns data
    console.log('2️⃣  Checking v_daily_board...');
    const { data: boardData, error: boardError } = await supabase
      .from('v_daily_board')
      .select('prop_id', { count: 'exact', head: false })
      .gte('game_date', new Date().toISOString().split('T')[0]);

    result.board_rows = boardData?.length || 0;
    const boardPass = result.board_rows > 0;
    result.gates.push({
      name: 'v_daily_board_has_data',
      pass: boardPass,
      value: result.board_rows,
      threshold: '>0',
    });
    console.log(`   ${boardPass ? '✅' : '❌'} v_daily_board: ${result.board_rows} rows`);
    if (boardError) console.error('   Error:', boardError);

    // CHECK 3: scored_props has recent writes
    console.log('3️⃣  Checking scored_props recent writes...');
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: scoredData, error: scoredError } = await supabase
      .from('scored_props')
      .select('prop_ref', { count: 'exact', head: false })
      .gte('created_at', oneHourAgo);

    result.scored_recent_rows = scoredData?.length || 0;
    const scoredPass = result.scored_recent_rows >= 1;
    result.gates.push({
      name: 'scored_props_recent_writes',
      pass: scoredPass,
      value: result.scored_recent_rows,
      threshold: '>=1',
    });
    console.log(`   ${scoredPass ? '✅' : '❌'} scored_props recent (1h): ${result.scored_recent_rows} rows`);
    if (scoredError) console.error('   Error:', scoredError);

    // CHECK 4: Smoke test - Pick one prop, submit → approve
    console.log('4️⃣  Running smoke test workflow...');

    // Find one pick from today's board
    const { data: candidateData } = await supabase
      .from('v_daily_board')
      .select('prop_id')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('edge', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (candidateData?.prop_id) {
      result.approved_smoke.prop_id = candidateData.prop_id;
      console.log(`   Selected prop: ${candidateData.prop_id}`);

      // Submit pick
      const { data: submitData, error: submitError } = await supabase.rpc('submit_pick', {
        p_unified_pick_id: candidateData.prop_id,
        p_reason: 'E2E verification smoke test',
        p_org_id: null,
      });

      if (submitError) {
        console.error('   ❌ Submit failed:', submitError);
      } else {
        result.approved_smoke.queue_id = submitData as string;
        console.log(`   Submitted to queue: ${result.approved_smoke.queue_id}`);

        // Approve pick
        const { error: approveError } = await supabase.rpc('approve_pick', {
          p_queue_id: result.approved_smoke.queue_id,
          p_approved_by: process.env.SYSTEM_USER_ID || '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
          p_reason: 'E2E verification approved',
        });

        if (approveError) {
          console.error('   ❌ Approve failed:', approveError);
        } else {
          console.log(`   Approved queue entry`);

          // Verify approval reflected in v_daily_board
          const { data: verifyData } = await supabase
            .from('v_daily_board')
            .select('queue_status, publish_at')
            .eq('prop_id', candidateData.prop_id)
            .single();

          result.approved_smoke.queue_status = verifyData?.queue_status || null;
          result.approved_smoke.publish_at = verifyData?.publish_at || null;

          const smokePass = verifyData?.queue_status === 'approved' && verifyData?.publish_at;
          result.gates.push({
            name: 'smoke_test_approval',
            pass: smokePass,
            value: verifyData?.queue_status,
            threshold: 'approved',
          });

          console.log(`   ${smokePass ? '✅' : '❌'} Smoke test: status=${verifyData?.queue_status}, publish_at=${verifyData?.publish_at}`);
        }
      }
    } else {
      console.log('   ⚠️  No picks available for smoke test');
      result.gates.push({
        name: 'smoke_test_approval',
        pass: false,
        value: 'No picks available',
      });
    }

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Verification Summary');
    console.log('═══════════════════════════════════════════════════════════');
    const passCount = result.gates.filter(g => g.pass).length;
    const totalCount = result.gates.length;
    console.log(`Gates Passed: ${passCount}/${totalCount}`);
    console.log('');
    result.gates.forEach(g => {
      console.log(`  ${g.pass ? '✅' : '❌'} ${g.name}: ${g.value} ${g.threshold ? `(threshold: ${g.threshold})` : ''}`);
    });
    console.log('');

    // Write results
    ensureDir(OUT_DIR);
    const outFile = path.join(OUT_DIR, `VERIFY_DB_${RUNID}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`📝 Results written to: ${outFile}`);
    console.log('');

    // Exit code
    const allPassed = passCount === totalCount;
    if (allPassed) {
      console.log('🎉 ALL ACCEPTANCE GATES PASSED');
      process.exit(0);
    } else {
      console.log('⚠️  SOME ACCEPTANCE GATES FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Verification failed with error:', error);
    result.gates.push({
      name: 'execution',
      pass: false,
      value: error instanceof Error ? error.message : String(error),
    });

    ensureDir(OUT_DIR);
    const outFile = path.join(OUT_DIR, `VERIFY_DB_${RUNID}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

    process.exit(1);
  }
}

main();
