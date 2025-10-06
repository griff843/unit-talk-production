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

  console.log('Fetching sport distribution from 1000 random outcomes...\n');

  const { data, error } = await supabase
    .from('settled_outcomes')
    .select('sport, market_type, team')
    .not('actual_value', 'is', null)
    .limit(1000);

  if (error || !data) {
    console.error('Error fetching data:', error);
    return;
  }

  const sportCounts: Record<string, number> = {};
  const marketCounts: Record<string, number> = {};
  let teamPopulated = 0;

  data.forEach(row => {
    const sport = row.sport || 'UNKNOWN';
    const market = row.market_type || 'UNKNOWN';

    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    marketCounts[market] = (marketCounts[market] || 0) + 1;

    if (row.team) teamPopulated++;
  });

  console.log('SPORT DISTRIBUTION (1000 sample):');
  console.log('='.repeat(50));
  Object.entries(sportCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      const pct = ((count / 1000) * 100).toFixed(1);
      console.log(`  ${sport.padEnd(20)} ${count.toString().padStart(4)} (${pct}%)`);
    });

  console.log('\nMARKET TYPE DISTRIBUTION (1000 sample):');
  console.log('='.repeat(50));
  Object.entries(marketCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([market, count]) => {
      const pct = ((count / 1000) * 100).toFixed(1);
      console.log(`  ${market.padEnd(20)} ${count.toString().padStart(4)} (${pct}%)`);
    });

  console.log('\nFIELD POPULATION:');
  console.log('='.repeat(50));
  console.log(`  Team field populated: ${teamPopulated}/1000 (${((teamPopulated/1000)*100).toFixed(1)}%)`);
}

main();
