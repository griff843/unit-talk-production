#!/usr/bin/env tsx
/**
 * Test game metadata sync for a single NFL game
 */

import { syncGameMetadata } from '../../services/GameMetadataSync';

const testGame = {
  id: 'test_nfl_game_001',
  sport_key: 'americanfootball_nfl',
  sport_title: 'NFL',
  commence_time: '2025-10-02T20:15:00Z', // Thursday Night Football
  home_team: 'Tampa Bay Buccaneers',
  away_team: 'Atlanta Falcons',
  bookmakers: [{ key: 'draftkings' }, { key: 'fanduel' }]
};

async function testSync() {
  console.log('\n═══ TESTING GAME METADATA SYNC ═══\n');
  console.log('Test game:', testGame);

  const result = await syncGameMetadata([testGame as any]);

  console.log('\n═══ SYNC RESULT ═══');
  console.log('Success:', result.success);
  console.log('Synced:', result.synced);
  console.log('Errors:', result.errors);

  // Now query to verify
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', testGame.id)
    .single();

  console.log('\n═══ VERIFIED IN DATABASE ═══');
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Game found:', data);
    console.log('game_date:', data.game_date);
    console.log('external_game_id:', data.external_game_id);
    console.log('sport:', data.sport);
  }

  console.log('\n');
}

testSync().catch(console.error);
