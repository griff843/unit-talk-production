#!/usr/bin/env tsx
/**
 * Fix outcome calculations via Supabase REST API
 * Executes batch updates through the API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixOutcomes() {
  console.log('🔧 Fixing outcome calculations for all sports\n');
  console.log('📝 Fetching records that need fixing...\n');

  // Get all records with outcome in ('win', 'loss') and actual_value not null
  const { data: records, error: fetchError } = await supabase
    .from('settled_outcomes')
    .select('id, actual_value, line, outcome, sport')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .order('id');

  if (fetchError) {
    console.error('❌ Error fetching records:', fetchError.message);
    process.exit(1);
  }

  if (!records || records.length === 0) {
    console.log('No records found to fix');
    return;
  }

  console.log(`Found ${records.length} records to check\n`);

  // Calculate which ones need fixing
  const toFix: Array<{ id: string; correctOutcome: string; sport: string }> = [];
  let alreadyCorrect = 0;

  for (const record of records) {
    const correctOutcome = record.actual_value > record.line ? 'win' : 'loss';

    if (record.outcome !== correctOutcome) {
      toFix.push({ id: record.id, correctOutcome, sport: record.sport });
    } else {
      alreadyCorrect++;
    }
  }

  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`Need fixing: ${toFix.length}\n`);

  if (toFix.length === 0) {
    console.log('✅ All outcomes are already correct!');
    return;
  }

  // Update in batches of 100
  const batchSize = 100;
  let fixed = 0;

  for (let i = 0; i < toFix.length; i += batchSize) {
    const batch = toFix.slice(i, i + batchSize);

    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toFix.length / batchSize)}...`);

    // Update each record in the batch
    for (const record of batch) {
      const { error } = await supabase
        .from('settled_outcomes')
        .update({ outcome: record.correctOutcome })
        .eq('id', record.id);

      if (error) {
        console.error(`  ❌ Error updating ${record.id}:`, error.message);
      } else {
        fixed++;
      }
    }

    console.log(`  ✅ Fixed ${fixed}/${toFix.length} records`);
  }

  console.log(`\n✅ Migration complete - Fixed ${fixed} outcome records\n`);

  // Verify the fix
  console.log('🔍 Verifying outcome distribution by sport...\n');

  const { data: verification } = await supabase
    .from('settled_outcomes')
    .select('sport, outcome')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .gte('game_date', '2024-01-01')
    .order('sport');

  if (verification) {
    const bySport: Record<string, { wins: number; losses: number }> = {};

    verification.forEach(r => {
      if (!bySport[r.sport]) bySport[r.sport] = { wins: 0, losses: 0 };
      if (r.outcome === 'win') bySport[r.sport].wins++;
      else bySport[r.sport].losses++;
    });

    console.log('Sport Distribution (all 2024+ data):');
    console.log('='.repeat(70));
    console.log('Sport'.padEnd(10), 'Wins'.padEnd(10), 'Losses'.padEnd(10), 'Total'.padEnd(10), 'Win%');
    console.log('='.repeat(70));

    Object.entries(bySport)
      .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
      .forEach(([sport, counts]) => {
        const total = counts.wins + counts.losses;
        const winPct = ((counts.wins / total) * 100).toFixed(1);
        console.log(
          sport.padEnd(10),
          counts.wins.toString().padEnd(10),
          counts.losses.toString().padEnd(10),
          total.toString().padEnd(10),
          `${winPct}%`
        );
      });

    console.log('='.repeat(70));
  }

  console.log('\n✅ All done - outcomes corrected for all sports');
}

fixOutcomes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
