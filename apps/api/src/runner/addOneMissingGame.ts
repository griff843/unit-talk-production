/**
 * Add One Missing Game - Get us to 21 total games
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { fetchEvents } from '../agents/FeedAgent/optimal';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function addOneMissingGame() {
  console.log('⚾ ADDING ONE MISSING MLB GAME');
  console.log('='.repeat(35));

  const today = '2025-08-05';

  // Get current games
  const { data: existingGames } = await supabase
    .from('games')
    .select('external_game_id')
    .eq('game_date', today);

  const existingIds = new Set(existingGames?.map(g => g.external_game_id) || []);
  console.log(`Current games: ${existingGames?.length || 0}`);

  // Fetch fresh events from Optimal
  console.log('📡 Fetching events from Optimal...');
  const events = await fetchEvents();

  // Find MLB games we don't have yet
  const mlbEvents = events.filter(
    event => event.league.toUpperCase() === 'MLB' && !existingIds.has(event.id)
  );

  console.log(`Available new MLB games: ${mlbEvents.length}`);

  if (mlbEvents.length === 0) {
    console.log('❌ No new MLB games available to add');
    return;
  }

  // Add the first one
  const gameToAdd = mlbEvents[0];
  const newGame = {
    id: randomUUID(),
    external_game_id: gameToAdd.id,
    sport: gameToAdd.league.toUpperCase(),
    home_team: gameToAdd.home_display || gameToAdd.home || 'HOME',
    away_team: gameToAdd.away_display || gameToAdd.away || 'AWAY',
    game_date: today,
    game_time: gameToAdd.commence_time || new Date().toISOString(),
    status: gameToAdd.status || 'scheduled',
  };

  console.log(`💾 Adding: ${newGame.away_team} @ ${newGame.home_team}`);

  const { data: insertedGame, error } = await supabase
    .from('games')
    .insert([newGame])
    .select('sport, home_team, away_team');

  if (error) {
    console.error('❌ Insert failed:', error.message);
    return;
  }

  console.log(
    `✅ Successfully added: ${insertedGame?.[0]?.away_team} @ ${insertedGame?.[0]?.home_team}`
  );

  // Final count
  const { count: finalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today);

  console.log(`\n🎯 FINAL RESULT: ${finalCount || 0} games total`);

  if (finalCount === 21) {
    console.log('🎉 SUCCESS: Perfect 21 games! (16 MLB + 5 WNBA expected)');
  } else {
    console.log('⚠️  Still not exactly 21 games');
  }
}

addOneMissingGame()
  .then(() => process.exit(0))
  .catch(console.error);
