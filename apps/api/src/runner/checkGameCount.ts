/**
 * Check Game Count - Verify we have expected number of games
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkGameCount() {
  console.log('🎯 CHECKING GAME COUNT');
  console.log('='.repeat(30));

  const today = '2025-08-05';

  const { data: games } = await supabase
    .from('games')
    .select('sport, home_team, away_team')
    .eq('game_date', today)
    .order('sport');

  const mlbGames = games?.filter(g => g.sport === 'MLB') || [];
  const wnbaGames = games?.filter(g => g.sport === 'WNBA') || [];

  console.log(`MLB Games: ${mlbGames.length}`);
  mlbGames.forEach((g, i) => console.log(`${i + 1}. ${g.away_team} @ ${g.home_team}`));

  console.log(`\nWNBA Games: ${wnbaGames.length}`);
  wnbaGames.forEach((g, i) => console.log(`${i + 1}. ${g.away_team} @ ${g.home_team}`));

  console.log(`\nTotal: ${games?.length || 0} games`);
  console.log(`Expected: 21 games (16 MLB + 5 WNBA)`);
  console.log(
    `Actual: ${mlbGames.length} MLB + ${wnbaGames.length} WNBA = ${games?.length || 0} total`
  );

  if (games?.length === 21) {
    console.log('✅ Perfect game count!');
  } else {
    console.log('⚠️  Game count mismatch');
  }
}

checkGameCount()
  .then(() => process.exit(0))
  .catch(console.error);
