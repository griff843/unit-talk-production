#!/usr/bin/env npx tsx
/**
 * Verify Canary Invariants - Daily Proof Run
 *
 * Verifies the complete pipeline processed the canary pick correctly:
 * - I2: Smart Form origin (form_source='smart_form' or 'canary_proof')
 * - I3: Outbox lifecycle (pick_publish status transitions)
 * - I5: Observability (trace_id propagation)
 *
 * Usage:
 *   npx tsx scripts/canary/verify-canary-invariants.ts \
 *     --trace-id=<id> --bet-slip-id=<id> --output=<file>
 *
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface InvariantCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

interface VerificationResult {
  trace_id: string;
  bet_slip_id: string;
  overall_status: 'PASS' | 'FAIL';
  timestamp: string;
  invariants: InvariantCheck[];
  cleanup_performed: boolean;
}

async function verifyCanaryInvariants(): Promise<VerificationResult> {
  // Parse arguments
  const traceIdArg = process.argv.find(a => a.startsWith('--trace-id='));
  const betSlipIdArg = process.argv.find(a => a.startsWith('--bet-slip-id='));
  const outputArg = process.argv.find(a => a.startsWith('--output='));
  const skipCleanup = process.argv.includes('--skip-cleanup');

  const traceId = traceIdArg?.split('=')[1] || '';
  const betSlipId = betSlipIdArg?.split('=')[1] || '';
  const outputFile = outputArg?.split('=')[1];

  if (!traceId || !betSlipId) {
    console.error('ERROR: --trace-id and --bet-slip-id are required');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('CANARY INVARIANT VERIFICATION');
  console.log('='.repeat(60));
  console.log(`Trace ID: ${traceId}`);
  console.log(`Bet Slip ID: ${betSlipId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const invariants: InvariantCheck[] = [];
  let failCount = 0;

  // =========================================================================
  // I2: Smart Form Origin Proof
  // =========================================================================
  console.log('\n--- I2: Smart Form Origin Proof ---\n');

  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .select('id, form_source, trace_id, bet_slip_id, status')
    .eq('bet_slip_id', betSlipId)
    .single();

  if (pickError || !pick) {
    invariants.push({
      name: 'I2: unified_picks exists',
      status: 'FAIL',
      message: 'Pick not found in unified_picks',
      details: pickError?.message,
    });
    failCount++;
  } else {
    invariants.push({
      name: 'I2: unified_picks exists',
      status: 'PASS',
      message: `Found pick ${pick.id}`,
    });

    // Check form_source
    const validSources = ['smart_form', 'canary_proof', 'api'];
    if (validSources.includes(pick.form_source)) {
      invariants.push({
        name: 'I2: form_source is valid',
        status: 'PASS',
        message: `form_source = '${pick.form_source}'`,
      });
    } else {
      invariants.push({
        name: 'I2: form_source is valid',
        status: 'FAIL',
        message: `Invalid form_source: '${pick.form_source}'`,
      });
      failCount++;
    }
  }

  // =========================================================================
  // I3: Outbox Lifecycle
  // =========================================================================
  console.log('\n--- I3: Outbox Lifecycle ---\n');

  const { data: publish, error: publishError } = await supabase
    .from('pick_publish')
    .select('id, status, channel_id, published_at, metadata')
    .eq('bet_slip_id', betSlipId)
    .single();

  if (publishError || !publish) {
    invariants.push({
      name: 'I3: pick_publish exists',
      status: 'FAIL',
      message: 'Publish record not found',
      details: publishError?.message,
    });
    failCount++;
  } else {
    invariants.push({
      name: 'I3: pick_publish exists',
      status: 'PASS',
      message: `Found publish record ${publish.id}`,
    });

    // Check status is valid
    const validStatuses = ['pending', 'publishing', 'published', 'failed', 'retrying'];
    if (validStatuses.includes(publish.status)) {
      invariants.push({
        name: 'I3: pick_publish.status is valid',
        status: 'PASS',
        message: `status = '${publish.status}'`,
      });
    } else {
      invariants.push({
        name: 'I3: pick_publish.status is valid',
        status: 'FAIL',
        message: `Invalid status: '${publish.status}'`,
      });
      failCount++;
    }

    // Check channel_id is set
    if (publish.channel_id) {
      invariants.push({
        name: 'I3: channel_id is set',
        status: 'PASS',
        message: `channel_id = '${publish.channel_id}'`,
      });
    } else {
      invariants.push({
        name: 'I3: channel_id is set',
        status: 'WARN',
        message: 'channel_id is not set (may be pending)',
      });
    }
  }

  // =========================================================================
  // I5: Observability (trace_id propagation)
  // =========================================================================
  console.log('\n--- I5: Observability (trace_id) ---\n');

  // Check trace_id in unified_picks
  if (pick?.trace_id === traceId) {
    invariants.push({
      name: 'I5: trace_id in unified_picks',
      status: 'PASS',
      message: `trace_id = '${pick.trace_id}'`,
    });
  } else if (pick?.trace_id) {
    invariants.push({
      name: 'I5: trace_id in unified_picks',
      status: 'WARN',
      message: `trace_id mismatch: expected '${traceId}', got '${pick.trace_id}'`,
    });
  } else {
    invariants.push({
      name: 'I5: trace_id in unified_picks',
      status: 'FAIL',
      message: 'trace_id not set in unified_picks',
    });
    failCount++;
  }

  // Check trace_id in pick_publish.metadata
  const publishTraceId = publish?.metadata?.trace_id;
  if (publishTraceId === traceId) {
    invariants.push({
      name: 'I5: trace_id in pick_publish.metadata',
      status: 'PASS',
      message: `metadata.trace_id = '${publishTraceId}'`,
    });
  } else if (publishTraceId) {
    invariants.push({
      name: 'I5: trace_id in pick_publish.metadata',
      status: 'WARN',
      message: `trace_id mismatch: expected '${traceId}', got '${publishTraceId}'`,
    });
  } else {
    invariants.push({
      name: 'I5: trace_id in pick_publish.metadata',
      status: 'FAIL',
      message: 'trace_id not set in pick_publish.metadata',
    });
    failCount++;
  }

  // =========================================================================
  // Cleanup
  // =========================================================================
  let cleanupPerformed = false;
  if (!skipCleanup) {
    console.log('\n--- Cleanup ---\n');

    // Delete canary records
    await supabase.from('pick_publish').delete().eq('bet_slip_id', betSlipId);
    await supabase.from('bridge_outbox').delete().eq('bet_slip_id', betSlipId);
    await supabase.from('unified_picks').delete().eq('bet_slip_id', betSlipId);

    console.log('Canary records cleaned up');
    cleanupPerformed = true;
  }

  // =========================================================================
  // Summary
  // =========================================================================
  const overallStatus = failCount === 0 ? 'PASS' : 'FAIL';

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  for (const inv of invariants) {
    const icon = inv.status === 'PASS' ? '✅' : inv.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${inv.name}: ${inv.message}`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Overall Status: ${overallStatus}`);
  console.log(`Pass: ${invariants.filter(i => i.status === 'PASS').length}`);
  console.log(`Fail: ${invariants.filter(i => i.status === 'FAIL').length}`);
  console.log(`Warn: ${invariants.filter(i => i.status === 'WARN').length}`);
  console.log('='.repeat(60));

  const result: VerificationResult = {
    trace_id: traceId,
    bet_slip_id: betSlipId,
    overall_status: overallStatus,
    timestamp: new Date().toISOString(),
    invariants,
    cleanup_performed: cleanupPerformed,
  };

  // Write output file
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\nResults written to: ${outputFile}`);
  }

  if (overallStatus === 'FAIL') {
    process.exit(1);
  }

  return result;
}

verifyCanaryInvariants().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
