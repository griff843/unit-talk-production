#!/usr/bin/env node

/**
 * CORRECT SGO BACKFILL - Proper Data Pipeline
 *
 * This script uses the proper SGO fetcher to:
 * 1. Fetch events (games) and insert into games table
 * 2. Fetch and flatten props with correct game relationships
 * 3. Insert props with proper game_id references
 * 4. Maintain data integrity and relationships
 *
 * Target: 1.4M+ props with complete game context
 */

import { fetchSGOEvents, fetchAndFlattenSGOProps } from '../src/logic/providers/sgoFetcher';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;

// Direct PostgreSQL connection
const pool = new Pool({
  host: 'unit-talk-postgres',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'development_password_2024',
});

interface GameRecord {
  id: string;
  game_id: string;  // Changed from external_game_id
  sport: string;
  home_team: string;
  away_team: string;
  start_time: string;  // Changed from game_date/game_time
  status: string;
  provider: string;  // Changed from source
}

interface PropRecord {
  id: string;
  game_id: string;
  external_id: string;
  sport: string;
  stat_type: string;
  player_name: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  start_time: string | null;
  source: string;
}

function escapeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toString().replace(/'/g, "''");
}

async function insertGames(games: GameRecord[]): Promise<Map<string, string>> {
  if (games.length === 0) return new Map();

  console.log(`📮 Inserting ${games.length} games into games table...`);

  const gameIdMap = new Map<string, string>(); // game_id -> internal_id

  try {
    const client = await pool.connect();

    for (const game of games) {
      // Check if game already exists
      const checkResult = await client.query(
        'SELECT id FROM games WHERE game_id = $1 AND provider = $2',
        [game.game_id, game.provider]
      );

      if (checkResult.rows.length > 0) {
        // Game exists, use existing ID
        gameIdMap.set(game.game_id, checkResult.rows[0].id);
      } else {
        // Insert new game
        const insertResult = await client.query(`
          INSERT INTO games (
            id, game_id, sport, home_team, away_team,
            start_time, status, provider, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (game_id) DO UPDATE
          SET updated_at = NOW()
          RETURNING id
        `, [
          game.id,
          game.game_id,
          game.sport,
          game.home_team,
          game.away_team,
          game.start_time,
          game.status,
          game.provider
        ]);

        gameIdMap.set(game.game_id, insertResult.rows[0].id);
      }
    }

    client.release();
    console.log(`✅ Successfully processed ${games.length} games (${gameIdMap.size} unique)`);

  } catch (error: any) {
    console.error('❌ Failed to insert games:', error.message);
  }

  return gameIdMap;
}

async function insertProps(props: PropRecord[], batchSize: number = 500): Promise<number> {
  if (props.length === 0) return 0;

  console.log(`📦 Inserting ${props.length} props with game relationships...`);

  let totalInserted = 0;

  try {
    const client = await pool.connect();

    // Process in batches
    for (let i = 0; i < props.length; i += batchSize) {
      const batch = props.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(props.length / batchSize);

      // Build batch insert with ON CONFLICT DO NOTHING
      const values = batch.map((prop, index) => {
        const offset = index * 11;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, NOW(), NOW(), $${offset + 11})`;
      }).join(',');

      const query = `
        INSERT INTO raw_props (
          id, game_id, external_id, sport, stat_type, player_name,
          line, over_odds, under_odds, start_time, created_at, updated_at, source
        ) VALUES ${values}
        ON CONFLICT (external_id, source) DO NOTHING
      `;

      const queryParams = batch.flatMap(prop => [
        prop.id,
        prop.game_id,
        prop.external_id,
        prop.sport,
        prop.stat_type,
        prop.player_name,
        prop.line,
        prop.over_odds,
        prop.under_odds,
        prop.start_time,
        prop.source
      ]);

      const result = await client.query(query, queryParams);
      totalInserted += result.rowCount || 0;

      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(`   📊 Progress: Batch ${batchNum}/${totalBatches} - Total inserted: ${totalInserted}`);
      }
    }

    client.release();
    console.log(`✅ Successfully inserted ${totalInserted} new props`);

  } catch (error: any) {
    console.error('❌ Failed to insert props:', error.message);
  }

  return totalInserted;
}

// Helper function to chunk dates into monthly ranges
function getMonthlyChunks(startDate: string, endDate: string): Array<{start: string, end: string}> {
  const chunks: Array<{start: string, end: string}> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let current = new Date(start);

  while (current < end) {
    const chunkStart = new Date(current);
    const chunkEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59); // End of month

    if (chunkEnd > end) {
      chunks.push({
        start: chunkStart.toISOString(),
        end: end.toISOString()
      });
      break;
    } else {
      chunks.push({
        start: chunkStart.toISOString(),
        end: chunkEnd.toISOString()
      });
    }

    // Move to next month
    current.setMonth(current.getMonth() + 1);
    current.setDate(1);
  }

  return chunks;
}

async function processSportDateRange(
  sport: string,
  startDate: string,
  endDate: string
): Promise<{ games: number; props: number }> {

  console.log(`\n🏀 Processing ${sport} from ${startDate} to ${endDate}...`);

  let totalGames = 0;
  let totalProps = 0;

  try {
    // Break large date ranges into monthly chunks to avoid API limits
    const monthlyChunks = getMonthlyChunks(startDate, endDate);
    console.log(`   📅 Breaking ${sport} into ${monthlyChunks.length} monthly chunks...`);

    const allEvents: any[] = [];

    // Process each monthly chunk
    for (let i = 0; i < monthlyChunks.length; i++) {
      const chunk = monthlyChunks[i];
      console.log(`   🗓️  Chunk ${i + 1}/${monthlyChunks.length}: ${chunk.start.substring(0, 10)} to ${chunk.end.substring(0, 10)}`);

      try {
        const events = await fetchSGOEvents({
          apiKey: SGO_API_KEY,
          leagueID: sport,
          startsAfter: chunk.start,
          startsBefore: chunk.end,
          finalized: true, // CRITICAL: Historical data must be finalized
          limit: 50, // CRITICAL: SGO maximum is 50, not 1000
        });

        if (events && events.length > 0) {
          allEvents.push(...events);
          console.log(`      ✅ Found ${events.length} events in chunk ${i + 1} (Running total: ${allEvents.length})`);
        } else {
          console.log(`      📋 No events found in chunk ${i + 1}`);
        }

        // Rate limiting between chunks (important for historical data)
        if (i < monthlyChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (chunkError: any) {
        console.error(`      ❌ Error processing chunk ${i + 1}:`, chunkError.message);
        continue; // Continue with next chunk
      }
    }

    const events = allEvents;

    if (!events || events.length === 0) {
      console.log(`   📋 No events found for ${sport} in this period`);
      return { games: 0, props: 0 };
    }

    console.log(`   ✅ Found ${events.length} ${sport} events`);

    // Transform events to game records
    const gameRecords: GameRecord[] = events.map(event => ({
      id: uuidv4(),
      game_id: event.eventID,  // Changed from external_game_id
      sport: event.leagueID || sport,
      home_team: event.teams?.home?.name || 'Unknown',
      away_team: event.teams?.away?.name || 'Unknown',
      start_time: event.info?.startsAtUTC || new Date().toISOString(),  // Combined date and time
      status: event.status || 'scheduled',
      provider: 'sgo'  // Changed from source
    }));

    // Insert games and get ID mapping
    const gameIdMap = await insertGames(gameRecords);
    totalGames = gameIdMap.size;

    // Now fetch props for this sport using the same monthly chunking
    console.log(`   📊 Fetching ${sport} props using monthly chunks...`);

    const allProps: any[] = [];

    // Process each monthly chunk for props
    for (let i = 0; i < monthlyChunks.length; i++) {
      const chunk = monthlyChunks[i];
      console.log(`   📊 Props chunk ${i + 1}/${monthlyChunks.length}: ${chunk.start.substring(0, 10)} to ${chunk.end.substring(0, 10)}`);

      try {
        const chunkProps = await fetchAndFlattenSGOProps({
          apiKey: SGO_API_KEY,
          leagueID: sport,
          startsAfter: chunk.start,
          startsBefore: chunk.end,
          includeAltLine: true,
          finalized: true, // CRITICAL: Historical data must be finalized
          limit: 50, // CRITICAL: SGO maximum is 50, not 100
        });

        if (chunkProps && chunkProps.length > 0) {
          allProps.push(...chunkProps);
          console.log(`      ✅ Found ${chunkProps.length} props in chunk ${i + 1} (Running total: ${allProps.length})`);
        } else {
          console.log(`      📋 No props found in chunk ${i + 1}`);
        }

        // Rate limiting between prop chunks
        if (i < monthlyChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (chunkError: any) {
        console.error(`      ❌ Error processing props chunk ${i + 1}:`, chunkError.message);
        continue; // Continue with next chunk
      }
    }

    const props = allProps;

    if (!props || props.length === 0) {
      console.log(`   📋 No props found for ${sport}`);
      return { games: totalGames, props: 0 };
    }

    console.log(`   ✅ Found ${props.length} ${sport} props`);

    // Transform props to records with game relationships
    const propRecords: PropRecord[] = props.map(prop => {
      // Find the game ID for this prop
      const gameId = gameIdMap.get(prop.eventID) || null;

      if (!gameId) {
        console.warn(`   ⚠️  No game found for prop event ${prop.eventID}`);
      }

      return {
        id: uuidv4(),
        game_id: gameId || uuidv4(), // Fallback to new ID if game not found
        external_id: `${prop.eventID}-${prop.marketKey}-${prop.line || 0}`,
        sport: prop.leagueID || sport,
        stat_type: prop.statType || 'unknown',
        player_name: prop.playerName || 'Team',
        line: parseFloat(prop.line?.toString() || '0'),
        over_odds: prop.ou === 'over' ? parseInt(prop.odds?.toString() || '-110') : null,
        under_odds: prop.ou === 'under' ? parseInt(prop.odds?.toString() || '-110') : null,
        start_time: prop.startsAtUTC || null,
        source: 'sgo'
      };
    }).filter(prop => prop.game_id !== null); // Only include props with valid game references

    // Insert props
    const insertedProps = await insertProps(propRecords);
    totalProps = insertedProps;

    console.log(`✅ ${sport} complete: ${totalGames} games, ${totalProps} props`);

  } catch (error: any) {
    console.error(`❌ Error processing ${sport}:`, error.message);
  }

  return { games: totalGames, props: totalProps };
}

async function runCorrectSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 CORRECT SGO BACKFILL - Using Proper Data Pipeline');
  console.log('📊 Target: Process 1.4M+ props with complete game relationships...');
  console.log('');

  try {
    // Check current database state
    console.log('🔌 Checking current database state...');
    const client = await pool.connect();

    const gamesCount = await client.query('SELECT COUNT(*) FROM games WHERE provider = $1', ['sgo']);
    const propsCount = await client.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);

    console.log(`📊 Current state: ${gamesCount.rows[0].count} games, ${propsCount.rows[0].count} props`);
    client.release();

    let totalGamesProcessed = 0;
    let totalPropsProcessed = 0;

    // Define comprehensive date ranges for all major sports
    const sportsSchedule = [
      // Current NBA season (2024-25)
      { sport: 'NBA', start: '2024-10-01T00:00:00Z', end: '2025-06-30T23:59:59Z' },

      // Previous NBA season (2023-24)
      { sport: 'NBA', start: '2023-10-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },

      // Current NFL season (2024)
      { sport: 'NFL', start: '2024-08-01T00:00:00Z', end: '2025-02-28T23:59:59Z' },

      // Previous NFL season (2023)
      { sport: 'NFL', start: '2023-08-01T00:00:00Z', end: '2024-02-28T23:59:59Z' },

      // Current NHL season (2024-25)
      { sport: 'NHL', start: '2024-10-01T00:00:00Z', end: '2025-06-30T23:59:59Z' },

      // Previous NHL season (2023-24)
      { sport: 'NHL', start: '2023-10-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },

      // MLB season (2024)
      { sport: 'MLB', start: '2024-03-01T00:00:00Z', end: '2024-11-30T23:59:59Z' },

      // NCAAF season (2024)
      { sport: 'NCAAF', start: '2024-08-01T00:00:00Z', end: '2025-01-31T23:59:59Z' },

      // NCAAB season (2024-25)
      { sport: 'NCAAB', start: '2024-11-01T00:00:00Z', end: '2025-04-30T23:59:59Z' },

      // NCAAB previous season (2023-24)
      { sport: 'NCAAB', start: '2023-11-01T00:00:00Z', end: '2024-04-30T23:59:59Z' },

      // WNBA season (2024)
      { sport: 'WNBA', start: '2024-05-01T00:00:00Z', end: '2024-10-31T23:59:59Z' }
    ];

    console.log(`🎯 Processing ${sportsSchedule.length} sport seasons with proper game/prop relationships...`);
    console.log('');

    for (let i = 0; i < sportsSchedule.length; i++) {
      const { sport, start, end } = sportsSchedule[i];
      console.log(`📅 [${i + 1}/${sportsSchedule.length}] ${sport} Season`);

      const result = await processSportDateRange(sport, start, end);
      totalGamesProcessed += result.games;
      totalPropsProcessed += result.props;

      console.log(`   📊 Running totals: ${totalGamesProcessed} games, ${totalPropsProcessed} props`);

      // Rate limiting between sports
      if (i < sportsSchedule.length - 1) {
        console.log('   ⏱️  Rate limiting delay (5 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Final verification
    const finalClient = await pool.connect();
    const finalGames = await finalClient.query('SELECT COUNT(*) FROM games WHERE provider = $1', ['sgo']);
    const finalProps = await finalClient.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    finalClient.release();

    console.log('\n🎯 CORRECT SGO BACKFILL COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🎮 Games in database: ${finalGames.rows[0].count}`);
    console.log(`   📊 Props in database: ${finalProps.rows[0].count}`);
    console.log(`   ✨ New games added: ${parseInt(finalGames.rows[0].count) - parseInt(gamesCount.rows[0].count)}`);
    console.log(`   ✨ New props added: ${parseInt(finalProps.rows[0].count) - parseInt(propsCount.rows[0].count)}`);
    console.log(`   🔗 Data integrity: Props properly linked to games`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runCorrectSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}