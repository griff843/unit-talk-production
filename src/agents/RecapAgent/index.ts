import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '../../services/supabaseClient'; // Adjust path as needed

const em = {
  win: '✅', lose: '❌', push: '➖',
  up: '🟢 ▲', down: '🔴 ▼', mvp: '🏆', fire: '🔥'
};
const DOLLAR_SIZES = [20, 50, 100, 250];

function to2(n: number) {
  return Number(n).toFixed(2);
}

function capperStats(picks: any[]) {
  const units = picks.reduce((acc, p) => acc + (p.units ?? 0), 0);
  const win = picks.filter(p => p.outcome === 'win').length;
  const loss = picks.filter(p => p.outcome === 'loss').length;
  const roi = picks.length ? ((units / Math.abs(picks.reduce((acc, p) => acc + Math.abs(p.units ?? 0), 0) || 1)) * 100) : 0;
  const l3 = picks.slice(-3);
  const l5 = picks.slice(-5);
  const l10 = picks.slice(-10);
  return {
    units: +to2(units),
    win,
    loss,
    roi: +to2(roi),
    l3: `${l3.filter(p => p.outcome === 'win').length}-${l3.filter(p => p.outcome === 'loss').length}`,
    l5: `${l5.filter(p => p.outcome === 'win').length}-${l5.filter(p => p.outcome === 'loss').length}`,
    l10: `${l10.filter(p => p.outcome === 'win').length}-${l10.filter(p => p.outcome === 'loss').length}`,
    streak: getStreak(picks)
  };
}

function getStreak(picks: any[]) {
  let streak = 0;
  let last: string | null = null;
  for (let i = picks.length - 1; i >= 0; i--) {
    if (!last) last = picks[i].outcome;
    if (picks[i].outcome === last) streak++;
    else break;
  }
  return last ? `${last === 'win' ? 'W' : last === 'loss' ? 'L' : ''}${streak}` : '';
}

function formatPickLine(pick: any) {
  const outcome = pick.outcome === 'win' ? em.win : pick.outcome === 'loss' ? em.lose : em.push;
  const units = Number(pick.units ?? 0);
  return `${outcome} ${pick.prop_name || pick.player_name || pick.market || 'N/A'} (${units >= 0 ? '+' : ''}${to2(units)}u)`;
}

function bestCapper(statsArr: any[]) {
  return statsArr.sort((a, b) => b.units - a.units)[0];
}

function dollars(units: number, unit: number) {
  return (units * unit).toFixed(2);
}

// --- MAIN AGENT ---
export async function RecapAgent({ date }: { date?: string }) {
  const recapDate = date ? new Date(date) : subDays(new Date(), 1);
  const from = startOfDay(recapDate);
  const to = endOfDay(recapDate);

  // 1. Get picks for the recap day
  const { data: picks, error } = await supabase
    .from('final_picks')
    .select('*')
    .gte('graded_at', from.toISOString())
    .lte('graded_at', to.toISOString());

  if (error) throw error;
  if (!picks || picks.length === 0) throw new Error('No picks found for recap period.');

  // 2. Per-capper grouping
  const cappers = [...new Set(picks.map(p => p.capper))];
  const grouped: Record<string, any[]> = {};
  cappers.forEach(capper => {
    grouped[capper] = picks.filter(p => p.capper === capper);
  });

  // 3. Per-capper stats & pick lines
  const capperStatsArr = cappers.map(capper => {
    const picksArr = grouped[capper];
    const stats = capperStats(picksArr);
    const pickLines = picksArr.map(formatPickLine);
    return {
      capper,
      ...stats,
      pickLines
    };
  });

  // 4. Team stats
  const teamStats = capperStats(picks);

  // 5. MVP logic
  const mvp = bestCapper(capperStatsArr);

  // 6. Dollar conversions
  const dollarLine = DOLLAR_SIZES.map(d => `🟢 $${d} bettors: $${dollars(teamStats.units, d)}`).join('\n');

  // 7. Full Results/Dashboard link
  const fullResultsLink = `[See all picks](https://yourdashboard.com/results/${format(from, 'yyyy-MM-dd')})`;

  // 8. Build output
  return {
    date: format(from, 'yyyy-MM-dd'),
    teamStats,
    capperStatsArr,
    mvp,
    dollarLine,
    fullResultsLink,
    picks
  };
}
