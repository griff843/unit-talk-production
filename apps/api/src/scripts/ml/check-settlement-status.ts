/**
 * Check settlement status across all data
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkSettlementStatus() {
  console.log('📊 Checking Settlement Status\n');
  console.log('='.repeat(80));

  // Raw props total
  const { count: rawCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  // Settled outcomes total
  const { count: settledCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal raw_props: ${rawCount?.toLocaleString()}`);
  console.log(`Total settled_outcomes: ${settledCount?.toLocaleString()}`);
  console.log(`Settlement rate: ${((settledCount! / rawCount!) * 100).toFixed(2)}%\n`);

  // By sport
  const { data: rawProps } = await supabase.from('raw_props').select('sport, stat_type');

  const bySport: Record<string, number> = {};
  const byMarket: Record<string, number> = {};

  rawProps?.forEach((p) => {
    bySport[p.sport] = (bySport[p.sport] || 0) + 1;
    const key = `${p.sport}:${p.stat_type}`;
    byMarket[key] = (byMarket[key] || 0) + 1;
  });

  console.log('By Sport:');
  Object.entries(bySport)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count.toLocaleString()}`);
    });

  console.log('\nTop 20 Markets:');
  Object.entries(byMarket)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([market, count]) => {
      console.log(`  ${market}: ${count.toLocaleString()}`);
    });

  // Settled by sport
  const { data: settled } = await supabase.from('settled_outcomes').select('sport');

  const settledBySport: Record<string, number> = {};
  settled?.forEach((s) => {
    settledBySport[s.sport] = (settledBySport[s.sport] || 0) + 1;
  });

  console.log('\nSettled by Sport:');
  Object.entries(settledBySport)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count.toLocaleString()}`);
    });

  // Date range
  const { data: dateRange } = await supabase
    .from('raw_props')
    .select('game_date')
    .order('game_date', { ascending: true })
    .limit(1);

  const { data: dateRangeEnd } = await supabase
    .from('raw_props')
    .select('game_date')
    .order('game_date', { ascending: false })
    .limit(1);

  console.log('\nDate Range:');
  console.log(`  Earliest: ${dateRange?.[0]?.game_date}`);
  console.log(`  Latest: ${dateRangeEnd?.[0]?.game_date}`);

  console.log('\n' + '='.repeat(80));

  process.exit(0);
}

checkSettlementStatus();
