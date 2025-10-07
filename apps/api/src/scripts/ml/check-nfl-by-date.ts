import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkDates() {
  const { data } = await supabase
    .from('settled_outcomes')
    .select('game_date, outcome, actual_value, line')
    .eq('sport', 'NFL')
    .not('actual_value', 'is', null)
    .gte('game_date', '2024-01-01')
    .order('game_date', { ascending: false })
    .limit(2000);

  const byDate: Record<string, { wins: number; losses: number; correct: number; wrong: number }> = {};

  data?.forEach(r => {
    const date = r.game_date.split('T')[0];
    if (!byDate[date]) byDate[date] = { wins: 0, losses: 0, correct: 0, wrong: 0 };

    const shouldBeWin = r.actual_value > r.line;
    const correctOutcome = shouldBeWin ? 'win' : 'loss';
    const isCorrect = r.outcome === correctOutcome;

    if (r.outcome === 'win') byDate[date].wins++;
    else byDate[date].losses++;

    if (isCorrect) byDate[date].correct++;
    else byDate[date].wrong++;
  });

  console.log('NFL Data by Date (most recent first):');
  console.log('Date'.padEnd(15), 'Wins'.padEnd(8), 'Losses'.padEnd(10), 'Correct'.padEnd(10), 'Accuracy');
  console.log('='.repeat(70));

  Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 20)
    .forEach(([date, counts]) => {
      const total = counts.wins + counts.losses;
      const accuracy = ((counts.correct / total) * 100).toFixed(1);
      console.log(
        date.padEnd(15),
        counts.wins.toString().padEnd(8),
        counts.losses.toString().padEnd(10),
        counts.correct.toString().padEnd(10),
        `${accuracy}%`
      );
    });
}

checkDates();
