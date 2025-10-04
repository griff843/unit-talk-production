#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGames() {
  console.log('\n═══ GAMES TABLE CHECK ═══');

  const { data: games } = await supabase
    .from('games')
    .select('sport, game_date, home_team, away_team')
    .order('game_date')
    .limit(30);

  console.log('\nGames in database (first 30):');
  games?.forEach(g => {
    const date = g.game_date.split('T')[0];
    console.log(`  ${date} | ${g.sport} | ${g.away_team} @ ${g.home_team}`);
  });

  // Check Oct 2 specifically
  const { data: oct2Games } = await supabase
    .from('games')
    .select('sport, game_date, home_team, away_team')
    .gte('game_date', '2025-10-02T00:00:00Z')
    .lt('game_date', '2025-10-03T00:00:00Z');

  console.log(`\n═══ GAMES ON OCT 2, 2025 (${oct2Games?.length || 0} games) ═══`);
  oct2Games?.forEach(g => {
    console.log(`  ${g.game_date} | ${g.sport} | ${g.away_team} @ ${g.home_team}`);
  });

  // Check by sport
  const sportCounts: Record<string, number> = {};
  games?.forEach(g => {
    sportCounts[g.sport] = (sportCounts[g.sport] || 0) + 1;
  });

  console.log('\n═══ GAMES BY SPORT ═══');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} games`);
  });

  console.log('\n');
}

checkGames().catch(console.error);
