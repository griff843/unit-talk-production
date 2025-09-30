#!/usr/bin/env node

/**
 * URGENT SGO BACKFILL FIX
 *
 * Direct PostgreSQL insertion to bypass Supabase schema cache entirely.
 * Uses EXACT schema match with raw_props table.
 */

import { fetchAndFlattenSGOProps } from '../src/logic/providers/sgoFetcher';
import { Pool } from 'pg';

const SGO_API_KEY = process.env.SGO_API_KEY || process.env.SPORTSGAMEODDS_KEY;

// Direct PostgreSQL connection (use correct Docker credentials)
const pool = new Pool({
  host: 'unit-talk-postgres', // Docker service name
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
  start_time: string | null;  // CORRECT: start_time, not game_start
  game_id: string | null;
  external_id: string | null;
  source: string;
}

function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

async function insertPropsDirectly(props: DatabaseProp[]): Promise<boolean> {
  console.log(`📦 Inserting ${props.length} props directly to PostgreSQL...`);

  // Build VALUES clauses for bulk insert
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

    console.log(`✅ Successfully inserted/updated ${result.rowCount} props`);
    return true;
  } catch (error: any) {
    console.error('❌ Direct insertion failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

async function runUrgentSGOFix() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚨 URGENT SGO BACKFILL FIX');
  console.log('📊 Using direct PostgreSQL insertion to bypass Supabase...');

  try {
    // Test database connection first
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    const { rows } = await client.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    console.log(`📊 Current SGO props in database: ${rows[0].count}`);
    client.release();

    // Fetch props from SGO API - Start with recent past data
    console.log('📊 Fetching props from SGO API...');
    const sgoProps = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY,
      leagueID: 'NBA',
      startsAfter: '2024-09-01T00:00:00Z',     // September 2024 start
      startsBefore: '2024-12-31T23:59:59Z',    // End of 2024
      includeAltLine: true,
      finalized: true // Get settled data first
    });

    console.log(`✅ Fetched ${sgoProps.length} props from SGO`);

    if (sgoProps.length === 0) {
      console.log('📋 No props found to process');
      return;
    }

    // Show sample data
    console.log('📋 Sample fetched props:');
    sgoProps.slice(0, 3).forEach((prop: any, i: number) => {
      console.log(`   ${i + 1}. ${prop.playerName} - ${prop.statType} ${prop.line} (${prop.startsAtUTC})`);
    });

    // Map to database schema - EXACT column match
    const mappedProps: DatabaseProp[] = sgoProps.map((prop: any) => ({
      sport: prop.leagueID || 'NBA',
      stat_type: prop.statType || 'unknown',
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      start_time: prop.startsAtUTC || null,  // CORRECT: start_time column
      game_id: prop.eventID || null,
      external_id: `${prop.eventID}-${prop.marketKey}` || null,
      source: 'sgo'
    }));

    console.log('🔄 Processing in batches of 500...');

    const batchSize = 500;
    let successCount = 0;

    for (let i = 0; i < mappedProps.length; i += batchSize) {
      const batch = mappedProps.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(mappedProps.length / batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} props)`);

      const success = await insertPropsDirectly(batch);
      if (success) {
        successCount += batch.length;
      }

      // Progress update
      const processed = i + batch.length;
      const percent = Math.round((processed / mappedProps.length) * 100);
      console.log(`   📊 Progress: ${processed}/${mappedProps.length} props processed (${percent}%)`);

      // Small delay to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final verification
    const verifyClient = await pool.connect();
    const { rows: finalCount } = await verifyClient.query('SELECT COUNT(*) FROM raw_props WHERE source = $1', ['sgo']);
    verifyClient.release();

    console.log('\n🎯 URGENT SGO Fix Complete!');
    console.log(`   📊 Processed: ${mappedProps.length} props`);
    console.log(`   💾 Successfully inserted: ${successCount} props`);
    console.log(`   📅 Date Range: October 2024 - June 2025 (Current Season)`);
    console.log(`   🏀 League: NBA`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successCount / mappedProps.length) * 100)}%`);
    console.log(`   ✅ Total SGO props in database: ${finalCount[0].count}`);

  } catch (error: any) {
    console.error('❌ Urgent SGO fix failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runUrgentSGOFix().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}