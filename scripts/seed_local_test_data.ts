/**
 * Seed Local Test Data
 *
 * Seeds local database with test NFL and NBA games and props
 * for full local stack validation.
 *
 * Usage:
 *   npx tsx scripts/seed_local_test_data.ts
 *   npx tsx scripts/seed_local_test_data.ts --mode=static  (default)
 *   npx tsx scripts/seed_local_test_data.ts --mode=live    (use Odds API)
 *
 * Features:
 * - Inserts 1-2 NFL games and 1-2 NBA games
 * - Inserts realistic props into raw_props
 * - Runs through CanonicalMappingService for canonical IDs
 * - Clear ✅/❌ log output for validation
 */

import { supabaseClient } from '../apps/api/src/services/supabaseClient';
import { CanonicalMappingService } from '../apps/api/src/services/canonical/CanonicalMappingService';
import { v4 as uuidv4 } from 'uuid';

// Seed mode: 'static' for predetermined data, 'live' for Odds API
const SEED_MODE = process.argv.includes('--mode=live') ? 'live' : 'static';

interface SeedStats {
  gamesCreated: number;
  playersCreated: number;
  propsCreated: number;
  canonicalMappingsApplied: number;
  errors: string[];
}

const stats: SeedStats = {
  gamesCreated: 0,
  playersCreated: 0,
  propsCreated: 0,
  canonicalMappingsApplied: 0,
  errors: [],
};

/**
 * Get current timestamp for upcoming games (next 24 hours)
 */
function getUpcomingGameTime(hoursFromNow: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

/**
 * Seed NFL games
 */
async function seedNFLGames() {
  console.log('\n📊 Seeding NFL games...');

  const nflGames = [
    {
      id: uuidv4(),
      sport: 'NFL',
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
      start_time: getUpcomingGameTime(4),
      status: 'scheduled' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      sport: 'NFL',
      home_team: 'San Francisco 49ers',
      away_team: 'Dallas Cowboys',
      start_time: getUpcomingGameTime(8),
      status: 'scheduled' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  for (const game of nflGames) {
    try {
      const { error } = await supabaseClient.from('games').insert(game);

      if (error && !error.message.includes('duplicate key')) {
        console.error(`  ❌ Failed to insert NFL game: ${game.home_team} vs ${game.away_team}`, error);
        stats.errors.push(`NFL game ${game.id}: ${error.message}`);
      } else {
        console.log(`  ✅ Created NFL game: ${game.away_team} @ ${game.home_team}`);
        stats.gamesCreated++;
      }
    } catch (err: any) {
      console.error(`  ❌ Error inserting NFL game:`, err.message);
      stats.errors.push(`NFL game error: ${err.message}`);
    }
  }

  return nflGames;
}

/**
 * Seed NBA games
 */
async function seedNBAGames() {
  console.log('\n🏀 Seeding NBA games...');

  const nbaGames = [
    {
      id: uuidv4(),
      sport: 'NBA',
      home_team: 'Los Angeles Lakers',
      away_team: 'Golden State Warriors',
      start_time: getUpcomingGameTime(3),
      status: 'scheduled' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      sport: 'NBA',
      home_team: 'Boston Celtics',
      away_team: 'Miami Heat',
      start_time: getUpcomingGameTime(6),
      status: 'scheduled' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  for (const game of nbaGames) {
    try {
      const { error } = await supabaseClient.from('games').insert(game);

      if (error && !error.message.includes('duplicate key')) {
        console.error(`  ❌ Failed to insert NBA game: ${game.home_team} vs ${game.away_team}`, error);
        stats.errors.push(`NBA game ${game.id}: ${error.message}`);
      } else {
        console.log(`  ✅ Created NBA game: ${game.away_team} @ ${game.home_team}`);
        stats.gamesCreated++;
      }
    } catch (err: any) {
      console.error(`  ❌ Error inserting NBA game:`, err.message);
      stats.errors.push(`NBA game error: ${err.message}`);
    }
  }

  return nbaGames;
}

/**
 * Seed NFL players
 */
async function seedNFLPlayers(nflGames: any[]) {
  console.log('\n👤 Seeding NFL players...');

  const players = [
    { name: 'Patrick Mahomes', position: 'QB', team_name: 'Kansas City Chiefs' },
    { name: 'Travis Kelce', position: 'TE', team_name: 'Kansas City Chiefs' },
    { name: 'Josh Allen', position: 'QB', team_name: 'Buffalo Bills' },
    { name: 'Stefon Diggs', position: 'WR', team_name: 'Buffalo Bills' },
    { name: 'Brock Purdy', position: 'QB', team_name: 'San Francisco 49ers' },
    { name: 'Christian McCaffrey', position: 'RB', team_name: 'San Francisco 49ers' },
    { name: 'Dak Prescott', position: 'QB', team_name: 'Dallas Cowboys' },
    { name: 'CeeDee Lamb', position: 'WR', team_name: 'Dallas Cowboys' },
  ];

  const createdPlayers = [];

  for (const player of players) {
    try {
      const playerId = uuidv4();
      const { error } = await supabaseClient.from('players').insert({
        id: playerId,
        name: player.name,
        team_id: 'mock-team-id', // Simplified for local testing
        position: player.position,
        sport: 'NFL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes('duplicate key')) {
        console.error(`  ❌ Failed to insert player: ${player.name}`, error);
        stats.errors.push(`Player ${player.name}: ${error.message}`);
      } else {
        console.log(`  ✅ Created player: ${player.name} (${player.position})`);
        stats.playersCreated++;
        createdPlayers.push({ ...player, id: playerId });
      }
    } catch (err: any) {
      console.error(`  ❌ Error inserting player:`, err.message);
      stats.errors.push(`Player error: ${err.message}`);
    }
  }

  return createdPlayers;
}

/**
 * Seed NBA players
 */
async function seedNBAPlayers(nbaGames: any[]) {
  console.log('\n👤 Seeding NBA players...');

  const players = [
    { name: 'LeBron James', position: 'F', team_name: 'Los Angeles Lakers' },
    { name: 'Anthony Davis', position: 'F-C', team_name: 'Los Angeles Lakers' },
    { name: 'Stephen Curry', position: 'G', team_name: 'Golden State Warriors' },
    { name: 'Klay Thompson', position: 'G', team_name: 'Golden State Warriors' },
    { name: 'Jayson Tatum', position: 'F', team_name: 'Boston Celtics' },
    { name: 'Jaylen Brown', position: 'G-F', team_name: 'Boston Celtics' },
    { name: 'Jimmy Butler', position: 'F', team_name: 'Miami Heat' },
    { name: 'Bam Adebayo', position: 'C', team_name: 'Miami Heat' },
  ];

  const createdPlayers = [];

  for (const player of players) {
    try {
      const playerId = uuidv4();
      const { error } = await supabaseClient.from('players').insert({
        id: playerId,
        name: player.name,
        team_id: 'mock-team-id',
        position: player.position,
        sport: 'NBA',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes('duplicate key')) {
        console.error(`  ❌ Failed to insert player: ${player.name}`, error);
        stats.errors.push(`Player ${player.name}: ${error.message}`);
      } else {
        console.log(`  ✅ Created player: ${player.name} (${player.position})`);
        stats.playersCreated++;
        createdPlayers.push({ ...player, id: playerId });
      }
    } catch (err: any) {
      console.error(`  ❌ Error inserting player:`, err.message);
      stats.errors.push(`Player error: ${err.message}`);
    }
  }

  return createdPlayers;
}

/**
 * Seed NFL props
 */
async function seedNFLProps(games: any[], players: any[]) {
  console.log('\n📈 Seeding NFL props...');

  const props = [
    // Patrick Mahomes passing props
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'Patrick Mahomes')?.id || uuidv4(),
      player_name: 'Patrick Mahomes',
      stat_type: 'Passing Yards',
      line: 285.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NFL',
    },
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'Patrick Mahomes')?.id || uuidv4(),
      player_name: 'Patrick Mahomes',
      stat_type: 'Passing TDs',
      line: 2.5,
      over_odds: -125,
      under_odds: +105,
      sport: 'NFL',
    },
    // Travis Kelce receiving props
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'Travis Kelce')?.id || uuidv4(),
      player_name: 'Travis Kelce',
      stat_type: 'Receiving Yards',
      line: 75.5,
      over_odds: -115,
      under_odds: -105,
      sport: 'NFL',
    },
    // Josh Allen passing props
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'Josh Allen')?.id || uuidv4(),
      player_name: 'Josh Allen',
      stat_type: 'Passing Yards',
      line: 268.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NFL',
    },
    // Christian McCaffrey rushing props
    {
      game_id: games[1].id,
      player_id: players.find(p => p.name === 'Christian McCaffrey')?.id || uuidv4(),
      player_name: 'Christian McCaffrey',
      stat_type: 'Rushing Yards',
      line: 95.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NFL',
    },
  ];

  for (const prop of props) {
    try {
      const propId = uuidv4();
      const { error } = await supabaseClient.from('raw_props').insert({
        id: propId,
        ...prop,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes('duplicate key')) {
        console.error(`  ❌ Failed to insert NFL prop: ${prop.player_name} ${prop.stat_type}`, error);
        stats.errors.push(`NFL prop ${propId}: ${error.message}`);
      } else {
        console.log(`  ✅ Created NFL prop: ${prop.player_name} ${prop.stat_type} O/U ${prop.line}`);
        stats.propsCreated++;
      }
    } catch (err: any) {
      console.error(`  ❌ Error inserting NFL prop:`, err.message);
      stats.errors.push(`NFL prop error: ${err.message}`);
    }
  }
}

/**
 * Seed NBA props
 */
async function seedNBAProps(games: any[], players: any[]) {
  console.log('\n📈 Seeding NBA props...');

  const props = [
    // LeBron James scoring props
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'LeBron James')?.id || uuidv4(),
      player_name: 'LeBron James',
      stat_type: 'Points',
      line: 25.5,
      over_odds: -115,
      under_odds: -105,
      sport: 'NBA',
    },
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'LeBron James')?.id || uuidv4(),
      player_name: 'LeBron James',
      stat_type: 'Rebounds',
      line: 7.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NBA',
    },
    // Stephen Curry scoring props
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'Stephen Curry')?.id || uuidv4(),
      player_name: 'Stephen Curry',
      stat_type: 'Points',
      line: 28.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NBA',
    },
    {
      game_id: games[0].id,
      player_id: players.find(p => p.name === 'Stephen Curry')?.id || uuidv4(),
      player_name: 'Stephen Curry',
      stat_type: '3-Pointers Made',
      line: 4.5,
      over_odds: -120,
      under_odds: +100,
      sport: 'NBA',
    },
    // Jayson Tatum scoring props
    {
      game_id: games[1].id,
      player_id: players.find(p => p.name === 'Jayson Tatum')?.id || uuidv4(),
      player_name: 'Jayson Tatum',
      stat_type: 'Points',
      line: 27.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NBA',
    },
  ];

  for (const prop of props) {
    try {
      const propId = uuidv4();
      const { error } = await supabaseClient.from('raw_props').insert({
        id: propId,
        ...prop,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error && !error.message.includes('duplicate key')) {
        console.error(`  ❌ Failed to insert NBA prop: ${prop.player_name} ${prop.stat_type}`, error);
        stats.errors.push(`NBA prop ${propId}: ${error.message}`);
      } else {
        console.log(`  ✅ Created NBA prop: ${prop.player_name} ${prop.stat_type} O/U ${prop.line}`);
        stats.propsCreated++;
      }
    } catch (err: any) {
      console.error(`  ❌ Error inserting NBA prop:`, err.message);
      stats.errors.push(`NBA prop error: ${err.message}`);
    }
  }
}

/**
 * Apply canonical mapping to all seeded props
 */
async function applyCanonicalMappings() {
  console.log('\n🔗 Applying canonical mappings...');

  try {
    // Fetch all raw props that need canonical mapping
    const { data: props, error: fetchError } = await supabaseClient
      .from('raw_props')
      .select('*')
      .is('canonical_game_id', null);

    if (fetchError) {
      console.error('  ❌ Failed to fetch raw props for mapping:', fetchError);
      stats.errors.push(`Canonical mapping fetch: ${fetchError.message}`);
      return;
    }

    if (!props || props.length === 0) {
      console.log('  ℹ️  No props requiring canonical mapping');
      return;
    }

    console.log(`  📊 Found ${props.length} props requiring canonical mapping`);

    // Initialize canonical mapping service
    const canonicalService = CanonicalMappingService.getInstance();

    // Process each prop through canonical mapping
    for (const prop of props) {
      try {
        // Map game
        const gameResult = await canonicalService.mapGame({
          source: 'local-seed' as any,
          external_game_id: prop.game_id,
          sport: prop.sport as any,
          home_team: 'Home', // Simplified for seed script
          away_team: 'Away',
          game_time: new Date().toISOString(),
        });

        // Map player
        const playerResult = await canonicalService.mapPlayer({
          source: 'local-seed' as any,
          external_player_id: prop.player_id,
          player_name: prop.player_name,
          sport: prop.sport as any,
          team_name: 'Team',
          position: 'POS',
        });

        // Update prop with canonical IDs if mapping succeeded
        if (gameResult.success && playerResult.success) {
          const { error: updateError } = await supabaseClient
            .from('raw_props')
            .update({
              canonical_game_id: gameResult.canonical_game_id,
              canonical_player_id: playerResult.canonical_player_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', prop.id);

          if (updateError) {
            console.error(`  ❌ Failed to update prop ${prop.id} with canonical IDs:`, updateError);
            stats.errors.push(`Canonical update ${prop.id}: ${updateError.message}`);
          } else {
            console.log(`  ✅ Applied canonical mappings to ${prop.player_name} ${prop.stat_type}`);
            stats.canonicalMappingsApplied++;
          }
        } else {
          console.warn(`  ⚠️  Canonical mapping failed for ${prop.player_name} ${prop.stat_type}`);
          stats.errors.push(`Canonical mapping failed for prop ${prop.id}`);
        }
      } catch (err: any) {
        console.error(`  ❌ Error mapping prop ${prop.id}:`, err.message);
        stats.errors.push(`Prop mapping error ${prop.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error('  ❌ Error in canonical mapping process:', err.message);
    stats.errors.push(`Canonical mapping error: ${err.message}`);
  }
}

/**
 * Print final statistics
 */
function printStats() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 SEED LOCAL TEST DATA - SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Mode: ${SEED_MODE.toUpperCase()}`);
  console.log(`Games Created: ${stats.gamesCreated}`);
  console.log(`Players Created: ${stats.playersCreated}`);
  console.log(`Props Created: ${stats.propsCreated}`);
  console.log(`Canonical Mappings Applied: ${stats.canonicalMappingsApplied}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    stats.errors.forEach((error, idx) => {
      console.log(`  ${idx + 1}. ${error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════');

  const overallSuccess =
    stats.gamesCreated > 0 &&
    stats.playersCreated > 0 &&
    stats.propsCreated > 0 &&
    stats.errors.length === 0;

  if (overallSuccess) {
    console.log('✅ LOCAL TEST DATA SEEDED SUCCESSFULLY!');
    console.log('\nNext steps:');
    console.log('  1. Run: npx tsx scripts/local_e2e_ticket_simulation.ts');
    console.log('  2. Or run: ./dev.sh simulate-local');
    console.log('═══════════════════════════════════════════════════\n');
  } else {
    console.log('❌ SEEDING COMPLETED WITH ERRORS');
    console.log('\nReview errors above and check:');
    console.log('  1. Database connection (SUPABASE_URL in .env)');
    console.log('  2. Table schema matches types');
    console.log('  3. Run: ./dev.sh logs to check service logs');
    console.log('═══════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🌱 SEED LOCAL TEST DATA');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Mode: ${SEED_MODE.toUpperCase()}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Seed games
    const nflGames = await seedNFLGames();
    const nbaGames = await seedNBAGames();

    // Seed players
    const nflPlayers = await seedNFLPlayers(nflGames);
    const nbaPlayers = await seedNBAPlayers(nbaGames);

    // Seed props
    await seedNFLProps(nflGames, nflPlayers);
    await seedNBAProps(nbaGames, nbaPlayers);

    // Apply canonical mappings
    await applyCanonicalMappings();

    // Print final statistics
    printStats();
  } catch (err: any) {
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Execute
main();
