#!/usr/bin/env node

/**
 * LOCAL DATABASE MASSIVE BACKFILL - 1.4M Props + Games Settlement
 *
 * Directly inserts into LOCAL PostgreSQL database (not Supabase)
 * Processes ALL sports for 2024-2025 seasons with settlement data
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { Pool } from 'pg';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

// Direct PostgreSQL connection to local database
const pgPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'postgres'
});

interface SportConfig {
  league: string;
  icon: string;
  start: string;
  end: string;
}

// Comprehensive 2024-2025 seasons for ALL sports
const SPORTS_CONFIG: SportConfig[] = [
  { league: 'NFL', icon: '🏈', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z' },
  { league: 'NBA', icon: '🏀', start: '2023-10-01T00:00:00Z', end: '2025-08-31T23:59:59Z' },
  { league: 'MLB', icon: '⚾', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z' },
  { league: 'NHL', icon: '🏒', start: '2023-10-01T00:00:00Z', end: '2025-08-31T23:59:59Z' },
  { league: 'NCAAF', icon: '🏈', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z' },
  { league: 'WNBA', icon: '🏀', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z' }
];

async function insertPropsToLocalDB(props: any[], league: string) {
  if (props.length === 0) return { inserted: 0, games: 0 };

  console.log(`📦 Inserting ${props.length} ${league} props to LOCAL database...`);

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    let insertedCount = 0;
    let gamesCount = 0;
    const gameIds = new Set<string>();

    for (const prop of props) {
      try {
        // 1. Insert/update game data first
        if (prop.eventID && !gameIds.has(prop.eventID)) {
          const gameResult = await client.query(`
            INSERT INTO games (game_id, sport, league, home_team, away_team, start_time, status, provider, external_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (game_id)
            DO UPDATE SET
              status = EXCLUDED.status,
              home_score = CASE WHEN $10 IS NOT NULL THEN $10 ELSE games.home_score END,
              away_score = CASE WHEN $11 IS NOT NULL THEN $11 ELSE games.away_score END,
              updated_at = NOW()
            RETURNING id
          `, [
            prop.eventID,
            league,
            league,
            prop.homeTeam || 'Home Team',
            prop.awayTeam || 'Away Team',
            prop.startsAtUTC,
            prop.isFinalized ? 'completed' : 'scheduled',
            'sgo',
            JSON.stringify(prop),
            prop.homeScore || null,
            prop.awayScore || null
          ]);

          if (gameResult.rows.length > 0) {
            gamesCount++;
            gameIds.add(prop.eventID);
          }
        }

        // 2. Insert prop data with settlement info
        const external_id = `sgo_${prop.eventID}_${prop.playerId || 'team'}_${prop.statType}_${prop.line}`;

        const propResult = await client.query(`
          INSERT INTO raw_props (
            sport, stat_type, player_name, line, over_odds, under_odds,
            start_time, source, external_id, game_id, status, result,
            actual_value, settled_at, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (external_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            result = EXCLUDED.result,
            actual_value = EXCLUDED.actual_value,
            settled_at = EXCLUDED.settled_at,
            updated_at = NOW()
          RETURNING id
        `, [
          league,
          prop.statType,
          prop.playerName || 'Unknown Player',
          parseFloat(prop.line?.toString() || '0'),
          prop.odds ? parseInt(prop.odds.toString()) : null,
          prop.odds ? parseInt(prop.odds.toString()) : null,
          prop.startsAtUTC,
          'sgo',
          external_id,
          prop.eventID,
          prop.isFinalized ? 'settled' : 'pending',
          prop.result || null,
          prop.actualValue ? parseFloat(prop.actualValue.toString()) : null,
          prop.isFinalized ? new Date().toISOString() : null,
          new Date().toISOString()
        ]);

        if (propResult.rows.length > 0) {
          insertedCount++;
        }

      } catch (error: any) {
        console.error(`   ⚠️ Skipped prop ${prop.playerName || 'unknown'}: ${error.message}`);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ ${league}: ${insertedCount} props inserted, ${gamesCount} games processed`);
    return { inserted: insertedCount, games: gamesCount };

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`❌ ${league} batch failed:`, error.message);
    return { inserted: 0, games: 0 };
  } finally {
    client.release();
  }
}

async function runLocalMassiveBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 LOCAL DATABASE MASSIVE BACKFILL - 1.4M PROPS + GAMES');
  console.log('🎯 Target: Local PostgreSQL Database (unit_talk_dev)');
  console.log('📅 Coverage: Complete 2024-2025 seasons + playoffs + settlements');
  console.log('🏈 NFL | 🏀 NBA | ⚾ MLB | 🏒 NHL | 🏈 NCAAF | 🏀 WNBA');
  console.log('=' .repeat(80));

  let totalPropsProcessed = 0;
  let totalPropsInserted = 0;
  let totalGamesProcessed = 0;
  const results: Record<string, { fetched: number; inserted: number; games: number }> = {};

  for (let i = 0; i < SPORTS_CONFIG.length; i++) {
    const sport = SPORTS_CONFIG[i];
    const batchNum = i + 1;

    console.log(`\n📦 SPORT ${batchNum}/${SPORTS_CONFIG.length}: ${sport.icon} ${sport.league}`);
    console.log(`📅 Period: ${sport.start} to ${sport.end}`);

    try {
      // Fetch ALL data (including finalized for settlements)
      console.log(`📊 Fetching comprehensive ${sport.league} data...`);
      const allProps = await fetchAndFlattenSGOProps({
        apiKey: SGO_API_KEY,
        leagueID: sport.league,
        startsAfter: sport.start,
        startsBefore: sport.end,
        includeAltLine: true,
        finalized: false  // Get both pending AND finalized
      });

      console.log(`✅ Fetched ${allProps.length} ${sport.league} props (pending + finalized)`);
      totalPropsProcessed += allProps.length;
      results[sport.league] = { fetched: allProps.length, inserted: 0, games: 0 };

      if (allProps.length === 0) {
        console.log(`📋 No ${sport.league} props found for comprehensive period`);
        continue;
      }

      // Show sample data
      console.log(`📋 Sample ${sport.league} props:`);
      allProps.slice(0, 3).forEach((prop: any, i: number) => {
        const status = prop.isFinalized ? '✅ SETTLED' : '⏳ PENDING';
        const startTime = prop.startsAtUTC ? new Date(prop.startsAtUTC).toLocaleDateString() : 'No date';
        console.log(`   ${i + 1}. ${prop.playerName || 'Team'} - ${prop.statType} ${prop.line} (${startTime}) ${status}`);
      });

      // Process in chunks for stability
      console.log(`🔄 Processing ${sport.league} in batches of 100 for LOCAL database...`);
      const batchSize = 100;
      let sportInsertedTotal = 0;
      let sportGamesTotal = 0;

      for (let j = 0; j < allProps.length; j += batchSize) {
        const batch = allProps.slice(j, j + batchSize);
        const subBatchNum = Math.floor(j / batchSize) + 1;
        const totalSubBatches = Math.ceil(allProps.length / batchSize);

        console.log(`   📦 ${sport.league} batch ${subBatchNum}/${totalSubBatches} (${batch.length} props)`);

        const batchResult = await insertPropsToLocalDB(batch, sport.league);
        sportInsertedTotal += batchResult.inserted;
        sportGamesTotal += batchResult.games;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      results[sport.league].inserted = sportInsertedTotal;
      results[sport.league].games = sportGamesTotal;
      totalPropsInserted += sportInsertedTotal;
      totalGamesProcessed += sportGamesTotal;

      console.log(`✅ ${sport.league} COMPLETE: ${allProps.length} fetched → ${sportInsertedTotal} inserted → ${sportGamesTotal} games`);

    } catch (error: any) {
      console.error(`❌ ${sport.league} processing failed:`, error.message);
      results[sport.league] = { fetched: 0, inserted: 0, games: 0 };
    }
  }

  // Final verification and summary
  const client = await pgPool.connect();
  try {
    const propsResult = await client.query('SELECT COUNT(*), COUNT(*) FILTER (WHERE status = $1) as settled FROM raw_props', ['settled']);
    const gamesResult = await client.query('SELECT COUNT(*), COUNT(*) FILTER (WHERE status = $1) as completed FROM games', ['completed']);

    console.log('\n' + '=' .repeat(80));
    console.log('🎯 LOCAL DATABASE MASSIVE BACKFILL COMPLETE!');
    console.log('=' .repeat(80));

    SPORTS_CONFIG.forEach(sport => {
      const result = results[sport.league] || { fetched: 0, inserted: 0, games: 0 };
      const successRate = result.fetched > 0 ? Math.round((result.inserted / result.fetched) * 100) : 0;
      console.log(`${sport.icon} ${sport.league.padEnd(6)} | Fetched: ${result.fetched.toString().padStart(6)} | Inserted: ${result.inserted.toString().padStart(6)} | Games: ${result.games.toString().padStart(4)} | Success: ${successRate}%`);
    });

    console.log('─' .repeat(80));
    console.log(`📊 TOTALS     | Fetched: ${totalPropsProcessed.toString().padStart(6)} | Inserted: ${totalPropsInserted.toString().padStart(6)} | Games: ${totalGamesProcessed.toString().padStart(4)} | Overall: ${Math.round((totalPropsInserted / Math.max(totalPropsProcessed, 1)) * 100)}%`);
    console.log(`🎯 DATABASE   | Props: ${propsResult.rows[0].count} total, ${propsResult.rows[0].settled} settled`);
    console.log(`🏟️ GAMES      | Games: ${gamesResult.rows[0].count} total, ${gamesResult.rows[0].completed} completed`);
    console.log(`🔥 SUCCESS    | LOCAL database now contains comprehensive 2024-2025 sports data!`);
    console.log(`💾 TARGET     | PostgreSQL unit_talk_dev (LOCAL)`);

  } finally {
    client.release();
  }

  await pgPool.end();
}

if (require.main === module) {
  runLocalMassiveBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}