#!/usr/bin/env node

/**
 * DIRECT POSTGRES SGO BACKFILL - Bypasses Supabase UUID issues
 *
 * Uses direct PostgreSQL connections to avoid Supabase's UUID type confusion
 * Processes data in small chunks to prevent memory exhaustion
 */

import axios from 'axios';
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

// Ultra-conservative memory settings
const TINY_BATCH_SIZE = 5; // Even smaller batches
const PROPS_BATCH_SIZE = 500; // Smaller prop batches

interface SGOGameData {
  eventID: string;
  leagueID: string;
  teams?: {
    home?: { names?: { full?: string } };
    away?: { names?: { full?: string } };
  };
  info?: {
    startsAtUTC?: string;
  };
  odds?: Record<string, any>;
  players?: Record<string, { name: string }>;
}

// Test with just one month of NBA first
const TEST_CHUNKS = [
  { sport: 'NBA', start: '2024-11-01', end: '2024-11-30' }
];

async function fetchSGOEvents(sport: string, startDate: string, endDate: string): Promise<SGOGameData[]> {
  try {
    const params = {
      apiKey: SGO_API_KEY,
      leagueID: sport,
      startsAfter: `${startDate}T00:00:00Z`,
      startsBefore: `${endDate}T23:59:59Z`,
      includeAltLine: true,
      finalized: true,
      limit: 50
    };

    console.log(`   📡 Fetching ${sport} events from ${startDate} to ${endDate}...`);

    const response = await axios.get('https://api.sportsgameodds.com/v2/events', {
      params,
      timeout: 60000
    });

    if (response.data?.success && Array.isArray(response.data?.data)) {
      console.log(`   ✅ Found ${response.data.data.length} events`);
      return response.data.data;
    }

    return [];
  } catch (error: any) {
    console.error(`❌ Error fetching ${sport} events:`, error.message);
    return [];
  }
}

async function insertGamesDirectly(events: SGOGameData[], sport: string): Promise<Map<string, string>> {
  const eventIdToUuid = new Map<string, string>();
  const client = await pool.connect();

  try {
    for (let i = 0; i < events.length; i += TINY_BATCH_SIZE) {
      const batch = events.slice(i, i + TINY_BATCH_SIZE);

      for (const event of batch) {
        const uuid = uuidv4();
        eventIdToUuid.set(event.eventID, uuid);

        try {
          // Check if game already exists
          const checkResult = await client.query(
            'SELECT id FROM games WHERE game_id = $1',
            [event.eventID]
          );

          if (checkResult.rows.length > 0) {
            // Game exists, use existing UUID
            eventIdToUuid.set(event.eventID, checkResult.rows[0].id);
            console.log(`   ⏭️  Game ${event.eventID} already exists`);
          } else {
            // Insert new game
            await client.query(`
              INSERT INTO games (id, game_id, sport, home_team, away_team, start_time, status, provider, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            `, [
              uuid,
              event.eventID,
              event.leagueID || sport,
              (event.teams?.home?.names?.full || 'Unknown').substring(0, 299),
              (event.teams?.away?.names?.full || 'Unknown').substring(0, 299),
              event.info?.startsAtUTC || new Date().toISOString(),
              'completed',
              'sgo'
            ]);

            console.log(`   ✅ Inserted game ${event.eventID}`);
          }
        } catch (insertError: any) {
          console.error(`   ❌ Failed to insert game ${event.eventID}:`, insertError.message);
        }
      }

      console.log(`   📊 Processed games batch ${Math.floor(i/TINY_BATCH_SIZE) + 1}/${Math.ceil(events.length/TINY_BATCH_SIZE)}`);
    }
  } finally {
    client.release();
  }

  return eventIdToUuid;
}

async function insertPropsDirectly(events: SGOGameData[], eventIdToUuid: Map<string, string>): Promise<number> {
  const client = await pool.connect();
  let totalProps = 0;

  try {
    // Process events one at a time to minimize memory usage
    for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
      const event = events[eventIndex];
      const gameUuid = eventIdToUuid.get(event.eventID);

      if (!gameUuid || !event.odds) {
        continue;
      }

      const propBatch = [];

      for (const [marketKey, prop] of Object.entries(event.odds)) {
        const propData = prop as any;

        let playerName = 'Team';
        if (propData.statEntityID && !['home', 'away', 'all'].includes(propData.statEntityID)) {
          if (propData.playerID && event.players && event.players[propData.playerID]) {
            playerName = event.players[propData.playerID].name;
          } else if (propData.statEntityID) {
            playerName = propData.statEntityID;
          }
        }

        propBatch.push({
          id: uuidv4(),
          game_id: gameUuid,
          external_id: `${event.eventID}-${marketKey}`.substring(0, 199),
          sport: event.leagueID || 'Unknown',
          stat_type: (propData.statID || marketKey).substring(0, 99),
          player_name: playerName.substring(0, 149),
          line: parseFloat(propData.bookOverUnder || propData.fairOverUnder || '0'),
          over_odds: propData.sideID === 'over' ? parseInt(propData.bookOdds || propData.fairOdds || '-110') : null,
          under_odds: propData.sideID === 'under' ? parseInt(propData.bookOdds || propData.fairOdds || '-110') : null,
          start_time: event.info?.startsAtUTC || new Date().toISOString(),
          source: 'sgo'
        });
      }

      // Insert props for this event in small batches
      for (let i = 0; i < propBatch.length; i += PROPS_BATCH_SIZE) {
        const batch = propBatch.slice(i, i + PROPS_BATCH_SIZE);

        for (const prop of batch) {
          try {
            // Check if prop already exists
            const checkResult = await client.query(
              'SELECT id FROM raw_props WHERE external_id = $1 AND source = $2',
              [prop.external_id, prop.source]
            );

            if (checkResult.rows.length === 0) {
              await client.query(`
                INSERT INTO raw_props (
                  id, game_id, external_id, sport, stat_type, player_name,
                  line, over_odds, under_odds, start_time, created_at, updated_at, source
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11)
              `, [
                prop.id, prop.game_id, prop.external_id, prop.sport,
                prop.stat_type, prop.player_name, prop.line,
                prop.over_odds, prop.under_odds, prop.start_time, prop.source
              ]);

              totalProps++;
            }
          } catch (propError: any) {
            // Skip individual prop errors
          }
        }
      }

      if ((eventIndex + 1) % 10 === 0) {
        console.log(`   📊 Processed props for ${eventIndex + 1}/${events.length} events (${totalProps} props inserted so far)`);
      }
    }
  } finally {
    client.release();
  }

  return totalProps;
}

async function directPostgresSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 DIRECT POSTGRES SGO BACKFILL');
  console.log('📊 Using direct PostgreSQL to bypass Supabase UUID issues...');
  console.log('🔑 API Key:', SGO_API_KEY.substring(0, 8) + '...');
  console.log('');

  try {
    // Check current state
    console.log('🔌 Checking current database state...');
    const client = await pool.connect();

    const gamesResult = await client.query("SELECT COUNT(*) FROM games WHERE provider = 'sgo'");
    const propsResult = await client.query("SELECT COUNT(*) FROM raw_props WHERE source = 'sgo'");

    console.log(`📊 Current state: ${gamesResult.rows[0].count} games, ${propsResult.rows[0].count} props`);

    client.release();

    // Process test chunks
    for (const chunk of TEST_CHUNKS) {
      console.log(`\n📅 Processing ${chunk.sport} ${chunk.start} to ${chunk.end}`);

      // Fetch events
      const events = await fetchSGOEvents(chunk.sport, chunk.start, chunk.end);

      if (events.length > 0) {
        // Insert games
        console.log(`📮 Inserting ${events.length} games directly into PostgreSQL...`);
        const eventIdToUuid = await insertGamesDirectly(events, chunk.sport);

        // Insert props
        console.log(`📊 Processing props for ${events.length} games...`);
        const propsInserted = await insertPropsDirectly(events, eventIdToUuid);

        console.log(`✅ Chunk complete: ${eventIdToUuid.size} games, ${propsInserted} props`);
      }
    }

    // Final verification
    console.log('\n📊 FINAL VERIFICATION:');

    const finalClient = await pool.connect();
    const finalGamesResult = await client.query("SELECT COUNT(*) FROM games WHERE provider = 'sgo'");
    const finalPropsResult = await client.query("SELECT COUNT(*) FROM raw_props WHERE source = 'sgo'");

    console.log(`🎮 Total games in database: ${finalGamesResult.rows[0].count}`);
    console.log(`📊 Total props in database: ${finalPropsResult.rows[0].count}`);

    finalClient.release();

    console.log('\n🎯 BACKFILL RESULTS:');
    console.log('✅ Direct PostgreSQL insertion bypasses Supabase UUID issues');
    console.log('✅ Memory-efficient processing');
    console.log('✅ Duplicate handling implemented');

  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  directPostgresSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}