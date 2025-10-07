#!/usr/bin/env tsx
/**
 * Fix ALL outcome calculations via streaming batch processing
 * Processes 2.3M+ records in chunks without loading into memory
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixAllOutcomes() {
  console.log('🔧 Fixing ALL outcome calculations across 2.3M+ records\n');

  const fetchBatchSize = 10000;
  const updateBatchSize = 100;
  let lastId = '';
  let totalProcessed = 0;
  let totalFixed = 0;
  let totalCorrect = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`\nFetching batch starting after ID: ${lastId || 'beginning'}...`);

    // Fetch next batch using cursor-based pagination
    let query = supabase
      .from('settled_outcomes')
      .select('id, actual_value, line, outcome, sport')
      .not('actual_value', 'is', null)
      .in('outcome', ['win', 'loss'])
      .order('id')
      .limit(fetchBatchSize);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data: batch, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Error fetching batch:', fetchError.message);
      break;
    }

    if (!batch || batch.length === 0) {
      console.log('No more records to process');
      hasMore = false;
      break;
    }

    console.log(`Processing ${batch.length} records...`);

    // Calculate which ones need fixing
    const toFix: Array<{ id: string; correctOutcome: string }> = [];

    for (const record of batch) {
      totalProcessed++;
      const correctOutcome = record.actual_value > record.line ? 'win' : 'loss';

      if (record.outcome !== correctOutcome) {
        toFix.push({ id: record.id, correctOutcome });
      } else {
        totalCorrect++;
      }
    }

    // Update records that need fixing
    if (toFix.length > 0) {
      console.log(`  Found ${toFix.length} records to fix in this batch`);

      for (let i = 0; i < toFix.length; i += updateBatchSize) {
        const updateBatch = toFix.slice(i, i + updateBatchSize);

        for (const record of updateBatch) {
          const { error } = await supabase
            .from('settled_outcomes')
            .update({ outcome: record.correctOutcome })
            .eq('id', record.id);

          if (error) {
            console.error(`    ❌ Error updating ${record.id}:`, error.message);
          } else {
            totalFixed++;
          }
        }

        if (i + updateBatchSize < toFix.length) {
          console.log(`    Updated ${i + updateBatchSize}/${toFix.length} in this batch`);
        }
      }

      console.log(`  ✅ Fixed ${toFix.length} records in this batch`);
    } else {
      console.log(`  ✅ All records in this batch were already correct`);
    }

    // Update cursor for next iteration
    lastId = batch[batch.length - 1].id;

    console.log(`Progress: ${totalProcessed} processed, ${totalFixed} fixed, ${totalCorrect} already correct`);

    // Check if we got fewer records than batch size (end of data)
    if (batch.length < fetchBatchSize) {
      hasMore = false;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Migration complete!');
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Already correct: ${totalCorrect}`);
  console.log(`   Fixed: ${totalFixed}`);
  console.log(`${'='.repeat(70)}\n`);

  // Verify the fix
  console.log('🔍 Verifying outcome distribution by sport...\n');

  const { data: verification } = await supabase
    .from('settled_outcomes')
    .select('sport, outcome')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .gte('game_date', '2024-01-01')
    .limit(50000);  // Sample 50K for verification

  if (verification) {
    const bySport: Record<string, { wins: number; losses: number }> = {};

    verification.forEach(r => {
      if (!bySport[r.sport]) bySport[r.sport] = { wins: 0, losses: 0 };
      if (r.outcome === 'win') bySport[r.sport].wins++;
      else bySport[r.sport].losses++;
    });

    console.log('Sport Distribution (50K sample from 2024+):');
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

fixAllOutcomes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
