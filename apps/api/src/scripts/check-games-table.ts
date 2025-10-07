import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o'
);

async function checkGames() {
  console.log('Checking games table...\n');

  // Check total games
  const { data: allGames, error: allError } = await supabase
    .from('games')
    .select('game_date, sport')
    .limit(10);

  if (allError) {
    console.error('Error querying games:', allError);
    return;
  }

  console.log(`Total games (sample): ${allGames?.length || 0}`);
  allGames?.forEach(g => console.log(`  ${g.game_date} - ${g.sport}`));

  // Check NFL games around October 5
  const { data: nflGames, error: nflError } = await supabase
    .from('games')
    .select('*')
    .eq('league', 'NFL')  // Changed from 'sport' to 'league'
    .gte('game_date', '2025-10-01')
    .lte('game_date', '2025-10-10')
    .order('game_date');

  console.log(`\nNFL games Oct 1-10, 2025: ${nflGames?.length || 0}`);
  if (nflError) console.error('NFL query error:', nflError);
  nflGames?.forEach(g => {
    console.log(`  ${g.game_date}: ${g.home_team} vs ${g.away_team}`);
  });
}

checkGames();
