#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '../../../../../.env');
dotenv.config({ path: envPath });

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Checking unique sports in database...\n');

  // Get distinct sports with counts
  const { data: sports, error } = await supabase
    .from('settled_outcomes')
    .select('sport')
    .not('actual_value', 'is', null);

  if (error || !sports) {
    console.error('Error fetching data:', error);
    return;
  }

  const sportCounts: Record<string, number> = {};
  sports.forEach(row => {
    const sport = row.sport || 'NULL';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });

  console.log('ALL SPORTS IN DATABASE:');
  console.log('='.repeat(60));
  console.log(`Total outcomes: ${sports.length.toLocaleString()}\n`);

  const sorted = Object.entries(sportCounts).sort((a, b) => b[1] - a[1]);

  sorted.forEach(([sport, count]) => {
    const pct = ((count / sports.length) * 100).toFixed(2);
    console.log(`  ${sport.padEnd(25)} ${count.toString().padStart(10)} (${pct.padStart(6)}%)`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total unique sports: ${sorted.length}`);

  // Check if we need multi-sport data for training
  if (sorted.length === 1) {
    console.log('\n⚠️  WARNING: Only 1 sport found in database!');
    console.log('   Multi-sport ML training may not be possible.');
  } else {
    console.log(`\n✅ Multi-sport data available (${sorted.length} sports)`);
  }
}

main();
