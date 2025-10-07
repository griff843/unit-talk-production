#!/usr/bin/env tsx
/**
 * Apply outcome fix migration via direct SQL execution
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function applyFix() {
  console.log('🔧 Applying outcome calculation fix migration\n');

  // Execute the UPDATE directly using Supabase query builder
  console.log('📝 Recalculating outcomes for ALL sports...\n');

  // First, get a count of affected records
  const { count: totalCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss']);

  console.log(`Found ${totalCount} records to verify/fix\n`);

  // We'll need to do this in batches since we can't use CASE in Supabase client
  // Instead, we'll fetch the data and update in batches

  const batchSize = 1000;
  let offset = 0;
  let totalFixed = 0;
  let totalCorrect = 0;

  while (offset < (totalCount || 0)) {
    const { data: batch } = await supabase
      .from('settled_outcomes')
      .select('id, actual_value, line, outcome')
      .not('actual_value', 'is', null)
      .in('outcome', ['win', 'loss'])
      .order('id')
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;

    // Calculate correct outcomes and prepare updates
    const toUpdate: { id: string; correctOutcome: string }[] = [];

    for (const record of batch) {
      const correctOutcome = record.actual_value > record.line ? 'win' : 'loss';

      if (record.outcome !== correctOutcome) {
        toUpdate.push({ id: record.id, correctOutcome });
      } else {
        totalCorrect++;
      }
    }

    // Update incorrect records
    if (toUpdate.length > 0) {
      for (const update of toUpdate) {
        await supabase
          .from('settled_outcomes')
          .update({ outcome: update.correctOutcome })
          .eq('id', update.id);
      }

      totalFixed += toUpdate.length;
      console.log(`Batch ${Math.floor(offset / batchSize) + 1}: Fixed ${toUpdate.length} records`);
    }

    offset += batchSize;
  }

  console.log('\n✅ Outcome fix complete');
  console.log(`   Total checked: ${totalCount}`);
  console.log(`   Already correct: ${totalCorrect}`);
  console.log(`   Fixed: ${totalFixed}\n`);

  // Verify the fix
  console.log('🔍 Verifying outcome distribution by sport...\n');

  const { data: verification } = await supabase
    .from('settled_outcomes')
    .select('sport, outcome')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .gte('game_date', '2024-01-01')
    .limit(10000);

  if (verification) {
    const bySport: Record<string, { wins: number; losses: number }> = {};

    verification.forEach(r => {
      if (!bySport[r.sport]) bySport[r.sport] = { wins: 0, losses: 0 };
      if (r.outcome === 'win') bySport[r.sport].wins++;
      else bySport[r.sport].losses++;
    });

    console.log('Sport Distribution (10K sample):');
    console.log('='.repeat(60));
    console.log('Sport'.padEnd(10), 'Wins'.padEnd(10), 'Losses'.padEnd(10), 'Win%');
    console.log('='.repeat(60));

    Object.entries(bySport)
      .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
      .forEach(([sport, counts]) => {
        const total = counts.wins + counts.losses;
        const winPct = ((counts.wins / total) * 100).toFixed(1);
        console.log(
          sport.padEnd(10),
          counts.wins.toString().padEnd(10),
          counts.losses.toString().padEnd(10),
          `${winPct}%`
        );
      });

    console.log('='.repeat(60));
  }

  console.log('\n✅ Migration complete - outcomes fixed for all sports');
}

applyFix();
