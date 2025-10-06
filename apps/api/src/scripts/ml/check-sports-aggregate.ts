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

  console.log('Analyzing sports distribution across ALL 2.3M outcomes...\n');

  // Strategy: Sample from different date ranges to get diverse sports
  const dateRanges = [
    { label: 'Last Week', days: 7 },
    { label: 'Last Month', days: 30 },
    { label: 'Last 3 Months', days: 90 },
    { label: 'Last 6 Months', days: 180 },
  ];

  const allSports = new Set<string>();
  const sportCounts: Record<string, number> = {};

  for (const range of dateRanges) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - range.days);

    const { data, error } = await supabase
      .from('settled_outcomes')
      .select('sport')
      .gte('created_at', cutoffDate.toISOString())
      .not('actual_value', 'is', null)
      .limit(5000);

    if (data) {
      console.log(`${range.label} (${data.length} outcomes):`);
      const rangeSports = new Set<string>();

      data.forEach(row => {
        const sport = row.sport || 'NULL';
        allSports.add(sport);
        rangeSports.add(sport);
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
      });

      console.log(`  Sports: ${Array.from(rangeSports).join(', ')}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('AGGREGATE SPORT DISTRIBUTION:');
  console.log('='.repeat(60));

  const sorted = Object.entries(sportCounts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [_, count]) => sum + count, 0);

  sorted.forEach(([sport, count]) => {
    const pct = ((count / total) * 100).toFixed(2);
    console.log(`  ${sport.padEnd(25)} ${count.toString().padStart(8)} (${pct.padStart(6)}%)`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total unique sports found: ${allSports.size}`);
  console.log(`Sports: ${Array.from(allSports).join(', ')}`);

  // Check if we have the key sports for Tier 1
  const tier1Sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const foundTier1 = tier1Sports.filter(sport => allSports.has(sport));

  console.log('\nTIER 1 SPORTS CHECK:');
  tier1Sports.forEach(sport => {
    const status = allSports.has(sport) ? '✅' : '❌';
    console.log(`  ${status} ${sport}`);
  });

  if (foundTier1.length === tier1Sports.length) {
    console.log('\n✅ All Tier 1 sports (NFL, NBA, MLB, NHL) found in database');
  } else {
    console.log(`\n⚠️  Only ${foundTier1.length}/${tier1Sports.length} Tier 1 sports found`);
    console.log('   Currently available:', foundTier1.join(', '));
  }
}

main();
