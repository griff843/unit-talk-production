/**
 * SINGLE-WRITER-SEAL-011: Duplicate Audit Script
 *
 * Detects duplicate bet_slip_id values in unified_picks table.
 * Part of Phase 1: DB Duplicate Audit
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DuplicateResult {
  bet_slip_id: string;
  count: number;
}

async function auditDuplicates(): Promise<void> {
  console.log('================================================================================');
  console.log('PHASE 1: DUPLICATE AUDIT ON bet_slip_id');
  console.log('Date:', new Date().toISOString());
  console.log('================================================================================\n');

  // Query 1: Count total rows and unique bet_slip_ids
  const { data: totalData, error: totalError } = await supabase
    .from('unified_picks')
    .select('id', { count: 'exact', head: true });

  if (totalError) {
    console.error('ERROR querying total rows:', totalError.message);
    process.exit(1);
  }

  const totalRows = totalData ? (totalData as any).length : 0;
  console.log('Total unified_picks rows (approximate):', totalRows);

  // Query 2: Find non-null, non-empty bet_slip_id counts
  const { data: withBetSlipId, error: bsError } = await supabase
    .from('unified_picks')
    .select('bet_slip_id')
    .not('bet_slip_id', 'is', null)
    .neq('bet_slip_id', '');

  if (bsError) {
    console.error('ERROR querying bet_slip_ids:', bsError.message);
    process.exit(1);
  }

  const betSlipIds = withBetSlipId?.map(r => r.bet_slip_id) || [];
  console.log('Rows with non-null/non-empty bet_slip_id:', betSlipIds.length);

  // Find duplicates using JavaScript (since Supabase REST doesn't support GROUP BY HAVING)
  const countMap = new Map<string, number>();
  for (const bsId of betSlipIds) {
    if (bsId) {
      countMap.set(bsId, (countMap.get(bsId) || 0) + 1);
    }
  }

  const duplicates: DuplicateResult[] = [];
  for (const [betSlipId, count] of countMap.entries()) {
    if (count > 1) {
      duplicates.push({ bet_slip_id: betSlipId, count });
    }
  }

  console.log('\n================================================================================');
  console.log('DUPLICATE DETECTION RESULTS');
  console.log('================================================================================\n');

  if (duplicates.length === 0) {
    console.log('✅ NO DUPLICATES FOUND');
    console.log('');
    console.log('Safe to proceed with UNIQUE constraint migration.');
    console.log('');
    console.log('PROOF: 0 bet_slip_id values appear more than once.');
  } else {
    console.log('❌ DUPLICATES FOUND:', duplicates.length, 'bet_slip_ids with duplicates');
    console.log('');
    console.log('Duplicate Details:');
    for (const dup of duplicates.slice(0, 20)) {
      console.log(`  bet_slip_id: ${dup.bet_slip_id}, count: ${dup.count}`);
    }
    if (duplicates.length > 20) {
      console.log(`  ... and ${duplicates.length - 20} more`);
    }
    console.log('');
    console.log('REMEDIATION REQUIRED before applying UNIQUE constraint.');
  }

  // Query 3: Check for null bet_slip_id rows
  const { data: nullBsRows, error: nullError } = await supabase
    .from('unified_picks')
    .select('id')
    .is('bet_slip_id', null);

  if (!nullError && nullBsRows) {
    console.log('\nRows with NULL bet_slip_id:', nullBsRows.length);
  }

  // Query 4: Check for empty string bet_slip_id rows
  const { data: emptyBsRows, error: emptyError } = await supabase
    .from('unified_picks')
    .select('id')
    .eq('bet_slip_id', '');

  if (!emptyError && emptyBsRows) {
    console.log('Rows with empty string bet_slip_id:', emptyBsRows.length);
  }

  console.log('\n================================================================================');
  console.log('AUDIT COMPLETE');
  console.log('================================================================================');

  // Exit with appropriate code
  process.exit(duplicates.length > 0 ? 1 : 0);
}

auditDuplicates().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
