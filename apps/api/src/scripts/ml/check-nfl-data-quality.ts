import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkNFL() {
  console.log('🔍 Checking NFL data quality\n');

  const { data, error } = await supabase
    .from('settled_outcomes')
    .select('outcome')
    .eq('sport', 'NFL')
    .not('actual_value', 'is', null)
    .in('outcome', ['win', 'loss'])
    .gte('game_date', '2024-01-01')
    .limit(1000);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const winCount = data?.filter(r => r.outcome === 'win').length || 0;
  const lossCount = data?.filter(r => r.outcome === 'loss').length || 0;

  console.log(`Total: ${data?.length || 0}`);
  console.log(`Wins: ${winCount} (${((winCount / (data?.length || 1)) * 100).toFixed(1)}%)`);
  console.log(`Losses: ${lossCount} (${((lossCount / (data?.length || 1)) * 100).toFixed(1)}%)`);

  if (winCount === data?.length) {
    console.log('\n⚠️  WARNING: ALL outcomes are wins - data issue!');
  } else if (lossCount === data?.length) {
    console.log('\n⚠️  WARNING: ALL outcomes are losses - data issue!');
  } else {
    console.log('\n✅ Data looks balanced');
  }
}

checkNFL();
