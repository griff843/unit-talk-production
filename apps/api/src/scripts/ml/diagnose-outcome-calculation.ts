import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnoseOutcomes() {
  console.log('🔍 DIAGNOSING OUTCOME CALCULATION ISSUE\n');

  // Check NFL data to see actual_value vs line vs outcome
  const { data: nflSample, error } = await supabase
    .from('settled_outcomes')
    .select('id, player_name, market_type, line, actual_value, outcome, sport, game_date')
    .eq('sport', 'NFL')
    .not('actual_value', 'is', null)
    .gte('game_date', '2024-01-01')
    .limit(20);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('NFL Sample (First 20 records):');
  console.log('='.repeat(120));
  console.log('Player'.padEnd(25), 'Market'.padEnd(20), 'Line'.padEnd(8), 'Actual'.padEnd(8), 'Outcome'.padEnd(10), 'Correct?');
  console.log('='.repeat(120));

  let correctCount = 0;
  let wrongCount = 0;

  for (const record of nflSample || []) {
    const shouldBeWin = record.actual_value > record.line;
    const correctOutcome = shouldBeWin ? 'win' : 'loss';
    const isCorrect = record.outcome === correctOutcome;

    if (isCorrect) correctCount++;
    else wrongCount++;

    const status = isCorrect ? '✅' : '❌ WRONG';

    console.log(
      record.player_name?.substring(0, 24).padEnd(25) || 'Unknown'.padEnd(25),
      record.market_type?.substring(0, 19).padEnd(20) || 'Unknown'.padEnd(20),
      record.line.toString().padEnd(8),
      record.actual_value.toString().padEnd(8),
      record.outcome.padEnd(10),
      status
    );
  }

  console.log('='.repeat(120));
  console.log(`\nCorrect outcomes: ${correctCount}`);
  console.log(`Wrong outcomes: ${wrongCount}`);
  console.log(`Accuracy: ${((correctCount / (correctCount + wrongCount)) * 100).toFixed(1)}%`);

  if (wrongCount > 0) {
    console.log('\n⚠️  OUTCOME FIELD IS INCORRECTLY CALCULATED');
    console.log('   The outcome column does not match actual_value vs line comparison');
  }

  // Also check if there's a pattern
  const { data: allOutcomes } = await supabase
    .from('settled_outcomes')
    .select('outcome')
    .eq('sport', 'NFL')
    .not('actual_value', 'is', null)
    .gte('game_date', '2024-01-01')
    .limit(1000);

  const wins = allOutcomes?.filter(r => r.outcome === 'win').length || 0;
  const losses = allOutcomes?.filter(r => r.outcome === 'loss').length || 0;

  console.log(`\nNFL Outcome Distribution (1000 sample):`);
  console.log(`  Wins: ${wins} (${((wins / 1000) * 100).toFixed(1)}%)`);
  console.log(`  Losses: ${losses} (${((losses / 1000) * 100).toFixed(1)}%)`);
}

diagnoseOutcomes();
