/**
 * Verify Settlement Results
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verifySettlements() {
  console.log('🔍 Verifying Settlement Results...\n');

  // Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting settlements:', countError);
    process.exit(1);
  }

  console.log(`Total settled outcomes: ${totalCount}\n`);

  // Get breakdown by sport
  const { data: bySport, error: sportError } = await supabase
    .from('settled_outcomes')
    .select('sport, outcome');

  if (sportError) {
    console.error('Error querying by sport:', sportError);
    process.exit(1);
  }

  const sportBreakdown: Record<string, any> = {};
  bySport?.forEach((row: any) => {
    if (!sportBreakdown[row.sport]) {
      sportBreakdown[row.sport] = { total: 0, win: 0, loss: 0, push: 0, void: 0 };
    }
    sportBreakdown[row.sport].total++;
    sportBreakdown[row.sport][row.outcome] = (sportBreakdown[row.sport][row.outcome] || 0) + 1;
  });

  console.log('📊 Breakdown by Sport:');
  console.table(sportBreakdown);

  // Get sample settlements
  const { data: samples, error: sampleError } = await supabase
    .from('settled_outcomes')
    .select('sport, player_name, market_type, line, actual_value, outcome, settled_at')
    .order('settled_at', { ascending: false })
    .limit(10);

  if (sampleError) {
    console.error('Error querying samples:', sampleError);
    process.exit(1);
  }

  console.log('\n🔍 Sample Settled Outcomes (latest 10):');
  console.table(samples);

  // Calculate win rate
  const totalWithOutcome = bySport?.length || 0;
  const wins = bySport?.filter((r: any) => r.outcome === 'win').length || 0;
  const losses = bySport?.filter((r: any) => r.outcome === 'loss').length || 0;
  const pushes = bySport?.filter((r: any) => r.outcome === 'push').length || 0;

  const winRate = totalWithOutcome > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : 0;

  console.log('\n📈 Win Rate Analysis:');
  console.log(`Total Outcomes: ${totalWithOutcome}`);
  console.log(`Wins: ${wins}`);
  console.log(`Losses: ${losses}`);
  console.log(`Pushes: ${pushes}`);
  console.log(`Win Rate: ${winRate}%\n`);

  process.exit(0);
}

verifySettlements();
