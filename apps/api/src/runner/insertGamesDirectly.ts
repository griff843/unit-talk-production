/**
 * Insert Games Directly - Working Version
 * Use the working Optimal integration to populate games table
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { fetchEvents } from '../agents/FeedAgent/optimal';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function insertGamesDirectly() {
  console.log('🎯 INSERTING GAMES DIRECTLY');
  console.log('='.repeat(40));

  const today = '2025-08-05';

  try {
    // Fetch events using our working Optimal integration
    console.log('📡 Fetching events...');
    const events = await fetchEvents();
    console.log(`Found ${events.length} events`);

    if (events.length === 0) {
      console.log('❌ No events to insert');
      return;
    }

    // Start with just core fields that we know work
    const gamesToInsert = events.slice(0, 10).map(event => ({
      id: randomUUID(),
      external_game_id: event.id,
      sport: event.league.toUpperCase(),
      home_team: event.home_display || event.home,
      away_team: event.away_display || event.away,
      game_date: today,
    }));

    console.log(`💾 Inserting ${gamesToInsert.length} games...`);
    console.log('Sample game:', {
      sport: gamesToInsert[0].sport,
      matchup: `${gamesToInsert[0].away_team} @ ${gamesToInsert[0].home_team}`,
      external_id: gamesToInsert[0].external_game_id,
    });

    const { data: insertedGames, error } = await supabase
      .from('games')
      .insert(gamesToInsert)
      .select('id, sport, home_team, away_team, external_game_id');

    if (error) {
      console.error('❌ Insert failed:', error.message);
      console.error('Error details:', error);
      return;
    }

    console.log(`✅ Successfully inserted ${insertedGames?.length || 0} games`);

    if (insertedGames && insertedGames.length > 0) {
      console.log('\n📋 Inserted games:');
      insertedGames.forEach((game, i) => {
        console.log(`${i + 1}. ${game.sport}: ${game.away_team} @ ${game.home_team}`);
      });
    }

    // Verify final count
    const { count: finalCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);

    console.log(`\n🎯 FINAL RESULT: ${finalCount || 0} games for ${today}`);

    // Test if props can now link to games
    const { data: sampleProps } = await supabase
      .from('raw_props')
      .select('external_game_id')
      .eq('game_date', today)
      .limit(3);

    if (sampleProps && sampleProps.length > 0) {
      console.log(
        '\nSample prop external_game_ids:',
        sampleProps.map(p => p.external_game_id)
      );

      const matchingGames = insertedGames?.filter(g =>
        sampleProps.some(p => p.external_game_id === g.external_game_id)
      );

      console.log(
        `Props that can link to games: ${matchingGames?.length || 0}/${sampleProps.length}`
      );
    }
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

insertGamesDirectly()
  .then(() => {
    console.log('\n✅ GAMES INSERT COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Games insert failed:', error);
    process.exit(1);
  });
