#!/usr/bin/env node

/**
 * MASSIVE SGO BACKFILL - COMPLETE HISTORICAL DATA
 *
 * Scale up to process the full 1.4M props efficiently.
 * Uses the proven direct PostgreSQL approach.
 */

import { fetchAndFlattenSGOProps } from '../src/logic/providers/sgoFetcher';
import { Pool } from 'pg';

const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;

// Direct PostgreSQL connection (proven working)
const pool = new Pool({
  host: 'unit-talk-postgres',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'development_password_2024',
});

interface DatabaseProp {
  sport: string;
  stat_type: string;
  player_name: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  start_time: string | null;
  game_id: string | null;
  external_id: string | null;
  source: string;
}

function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

async function insertPropsDirectly(props: DatabaseProp[]): Promise<boolean> {
  console.log(`📦 Inserting ${props.length} props directly to PostgreSQL...`);

  const valuesClauses = props.map(prop => {
    const escapedStatType = escapeString(prop.stat_type || 'unknown');
    const escapedPlayerName = escapeString(prop.player_name || 'Unknown Player');
    const startTime = prop.start_time ? `'${prop.start_time}'` : 'NULL';
    const gameId = prop.game_id ? `'${escapeString(prop.game_id)}'` : 'NULL';
    const externalId = prop.external_id ? `'${escapeString(prop.external_id)}'` : 'NULL';

    return `('${prop.sport}', '${escapedStatType}', '${escapedPlayerName}', ${prop.line}, ${prop.over_odds || 'NULL'}, ${prop.under_odds || 'NULL'}, ${startTime}, ${gameId}, ${externalId}, '${prop.source}', NOW(), NOW())`;
  }).join(',\n    ');

  const insertSQL = `
    INSERT INTO raw_props (
      sport, stat_type, player_name, line, over_odds, under_odds,
      start_time, game_id, external_id, source, created_at, updated_at
    ) VALUES
    ${valuesClauses}
  `;

  try {
    const client = await pool.connect();
    const result = await client.query(insertSQL);
    client.release();

    console.log(`✅ Successfully inserted ${result.rowCount} props`);
    return true;
  } catch (error: any) {
    console.error('❌ Direct insertion failed:', error.message);
    return false;
  }
}

async function fetchAndProcessSportSeason(sport: string, startDate: string, endDate: string) {
  console.log(`\n🏀 Processing ${sport} from ${startDate} to ${endDate}...`);

  try {
    const sgoProps = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY,
      leagueID: sport,
      startsAfter: startDate,
      startsBefore: endDate,
      includeAltLine: true,
      finalized: true,
      limit: 100 // Max per request to avoid timeouts
    });

    console.log(`✅ Fetched ${sgoProps.length} props for ${sport}`);

    if (sgoProps.length === 0) {
      console.log(`📋 No props found for ${sport} in this period`);
      return 0;
    }

    // Map to database schema
    const mappedProps: DatabaseProp[] = sgoProps.map((prop: any) => ({
      sport: prop.leagueID || sport,
      stat_type: prop.statType || 'unknown',
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      start_time: prop.startsAtUTC || null,
      game_id: prop.eventID || null,
      external_id: `${prop.eventID}-${prop.marketKey}` || null,
      source: 'sgo'
    }));

    // Process in batches
    const batchSize = 1000; // Larger batches for efficiency
    let successCount = 0;

    for (let i = 0; i < mappedProps.length; i += batchSize) {
      const batch = mappedProps.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(mappedProps.length / batchSize);

      console.log(`   📦 ${sport} batch ${batchNum}/${totalBatches} (${batch.length} props)`);

      const success = await insertPropsDirectly(batch);
      if (success) {
        successCount += batch.length;
      }

      // Progress update every 5 batches
      if (batchNum % 5 === 0) {
        const processed = i + batch.length;
        const percent = Math.round((processed / mappedProps.length) * 100);
        console.log(`   📊 ${sport} progress: ${processed}/${mappedProps.length} props (${percent}%)`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log(`✅ ${sport} complete: ${successCount}/${mappedProps.length} props inserted`);
    return successCount;

  } catch (error: any) {
    console.error(`❌ ${sport} failed:`, error.message);
    return 0;
  }
}

async function runMassiveSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SGO_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 MASSIVE SGO BACKFILL - COMPLETE HISTORICAL DATA');
  console.log('📊 Target: Process 1.4M+ props across all major sports...');

  try {
    // Check current database state
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    const { rows } = await client.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    console.log(`📊 Current SGO props in database: ${rows[0].count}`);
    client.release();

    let totalInserted = 0;

    // Major sports leagues with comprehensive date ranges
    const sportsSchedule = [
      // NBA 2023-24 season (October 2023 - June 2024)
      { sport: 'NBA', start: '2023-10-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },

      // NBA 2024-25 season (October 2024 - June 2025)
      { sport: 'NBA', start: '2024-10-01T00:00:00Z', end: '2025-06-30T23:59:59Z' },

      // NFL 2023 season (September 2023 - February 2024)
      { sport: 'NFL', start: '2023-09-01T00:00:00Z', end: '2024-02-28T23:59:59Z' },

      // NFL 2024 season (September 2024 - February 2025)
      { sport: 'NFL', start: '2024-09-01T00:00:00Z', end: '2025-02-28T23:59:59Z' },

      // MLB 2024 season (March 2024 - November 2024)
      { sport: 'MLB', start: '2024-03-01T00:00:00Z', end: '2024-11-30T23:59:59Z' },

      // NHL 2023-24 season (October 2023 - June 2024)
      { sport: 'NHL', start: '2023-10-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },

      // NHL 2024-25 season (October 2024 - June 2025)
      { sport: 'NHL', start: '2024-10-01T00:00:00Z', end: '2025-06-30T23:59:59Z' },

      // NCAAF 2024 season (August 2024 - January 2025)
      { sport: 'NCAAF', start: '2024-08-01T00:00:00Z', end: '2025-01-31T23:59:59Z' },

      // NCAAB 2023-24 season (November 2023 - April 2024)
      { sport: 'NCAAB', start: '2023-11-01T00:00:00Z', end: '2024-04-30T23:59:59Z' },

      // NCAAB 2024-25 season (November 2024 - April 2025)
      { sport: 'NCAAB', start: '2024-11-01T00:00:00Z', end: '2025-04-30T23:59:59Z' }
    ];

    console.log(`🎯 Processing ${sportsSchedule.length} sport seasons...`);

    for (let i = 0; i < sportsSchedule.length; i++) {
      const { sport, start, end } = sportsSchedule[i];
      console.log(`\n📅 [${i + 1}/${sportsSchedule.length}] Starting ${sport} (${start.split('T')[0]} to ${end.split('T')[0]})`);

      const inserted = await fetchAndProcessSportSeason(sport, start, end);
      totalInserted += inserted;

      console.log(`✅ ${sport} season complete: +${inserted} props`);
      console.log(`📊 Running total: ${totalInserted} props inserted`);

      // Longer delay between sports to avoid rate limiting
      if (i < sportsSchedule.length - 1) {
        console.log('⏱️ Rate limiting delay (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    // Final verification
    const verifyClient = await pool.connect();
    const { rows: finalCount } = await verifyClient.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    verifyClient.release();

    console.log('\n🎯 MASSIVE SGO BACKFILL COMPLETE!');
    console.log(`   📊 Total props processed: ${totalInserted}`);
    console.log(`   📅 Seasons covered: 2023-24 and 2024-25 across 5 major sports`);
    console.log(`   🏆 Sports: NBA, NFL, MLB, NHL, NCAAF, NCAAB`);
    console.log(`   🔧 Source: SGO API (direct PostgreSQL insertion)`);
    console.log(`   ✅ Final SGO props in database: ${finalCount[0].count}`);
    console.log(`   📈 Database growth: +${parseInt(finalCount[0].count) - parseInt(rows[0].count)} props`);

  } catch (error: any) {
    console.error('❌ Massive SGO backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMassiveSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}