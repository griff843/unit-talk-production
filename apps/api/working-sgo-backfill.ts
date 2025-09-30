#!/usr/bin/env node

/**
 * Working SGO Backfill - Using Known Working Parameters
 *
 * Based on successful health check results showing 3,196 NBA props fetched.
 * This uses the exact working parameters and handles the schema issue.
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

interface DatabaseProp {
  id?: number;
  prop_id: string;
  sport: string;
  stat_type: string;
  player_name: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  game_start?: string;
  created_at?: string;
  source: string;
}

async function insertPropsViaDirect(props: DatabaseProp[]) {
  console.log(`📦 Inserting ${props.length} props via direct SQL...`);

  const { spawn } = require('child_process');

  // Create SQL INSERT statements
  const sqlStatements = props.map(prop => {
    const escapedPlayerName = prop.player_name.replace(/'/g, "''");
    const escapedStatType = prop.stat_type.replace(/'/g, "''");

    return `INSERT INTO raw_props (prop_id, sport, stat_type, player_name, line, over_odds, under_odds, game_start, source, created_at)
            VALUES ('${prop.prop_id}', '${prop.sport}', '${escapedStatType}', '${escapedPlayerName}', ${prop.line}, ${prop.over_odds || 'NULL'}, ${prop.under_odds || 'NULL'}, ${prop.game_start ? "'" + prop.game_start + "'" : 'NULL'}, '${prop.source}', NOW());`;
  }).join('\n');

  // Write SQL to temp file
  require('fs').writeFileSync('/tmp/insert_props.sql', sqlStatements);

  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [
      process.env.DATABASE_URL!,
      '-f', '/tmp/insert_props.sql'
    ]);

    let output = '';
    let errorOutput = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    psql.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Successfully inserted ${props.length} props via direct SQL`);
        resolve(true);
      } else {
        console.error(`❌ SQL insertion failed with code ${code}`);
        console.error('Error output:', errorOutput);
        reject(new Error(`SQL insertion failed: ${errorOutput}`));
      }
    });
  });
}

async function runWorkingSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Starting Working SGO Backfill...');
  console.log('📊 Using KNOWN WORKING parameters from health check...');

  try {
    // Use the EXACT parameters that worked in health check (showing 3,196 props)
    console.log('📊 Fetching NBA data with working parameters...');
    const sgoProps = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY,
      leagueID: 'NBA',
      startsAfter: '2024-03-28T07:00:00Z',
      startsBefore: '2024-09-30T06:59:59Z',
      includeAltLine: true,
      finalized: true
    });

    console.log(`✅ Fetched ${sgoProps.length} props from SGO`);

    if (sgoProps.length === 0) {
      console.log('📋 No props found to process');
      return;
    }

    // Map SGO props to database schema - INCLUDING source column
    const dbProps: DatabaseProp[] = sgoProps.map((prop, index) => ({
      prop_id: `sgo_${prop.eventID}_${prop.playerId || 'team'}_${prop.statType}_${index}`,
      sport: prop.leagueID || 'NBA',
      stat_type: prop.statType,
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : undefined,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : undefined,
      game_start: prop.startsAtUTC || undefined,
      source: 'sgo' // CRITICAL: Include source column
    }));

    console.log('🔄 Inserting via direct SQL to bypass Supabase schema cache...');

    const batchSize = 50;
    let successCount = 0;

    for (let i = 0; i < dbProps.length; i += batchSize) {
      const batch = dbProps.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(dbProps.length / batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} props)`);

      try {
        await insertPropsViaDirect(batch);
        successCount += batch.length;
      } catch (error: any) {
        console.error(`❌ Batch ${batchNum} failed:`, error.message);
      }

      // Progress update every 10 batches
      if (batchNum % 10 === 0) {
        console.log(`   📊 Progress: ${i + batch.length}/${dbProps.length} props processed (${Math.round(((i + batch.length) / dbProps.length) * 100)}%)`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n🎯 Working SGO Backfill Complete!');
    console.log(`   📊 Processed: ${sgoProps.length} props`);
    console.log(`   💾 Successfully inserted: ${successCount} props`);
    console.log(`   📅 Date Range: 2024-03-28 to 2024-09-30`);
    console.log(`   🏀 League: NBA`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successCount / sgoProps.length) * 100)}%`);

  } catch (error: any) {
    console.error('❌ SGO backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runWorkingSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}