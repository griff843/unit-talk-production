// ⚠️ DEV-ONLY: Local PostgreSQL Ingestion (OLD SCHEMA)
// ❌ DO NOT USE FOR PRODUCTION/CANARY TESTING
// This script uses OLD schema (league, prop_type) and writes to local unit_talk_dev
// For production/canary testing, use: npx tsx apps/api/scripts/live-fire-phase1-ingestion.ts

import dotenv from 'dotenv';
import { resolve } from 'path';
import pg from 'pg';
import { OddsApiClient } from '../src/agents/FeedAgent/oddsApi';

// Load environment variables from workspace root
const rootEnvPath = resolve(__dirname, '../../../.env');
const sharedEnvPath = resolve(__dirname, '../../../.env.shared');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: sharedEnvPath });

// Validate required environment variables
if (!process.env.ODDS_API_KEY) {
  console.error('❌ FATAL: Missing ODDS_API_KEY environment variable');
  console.error('Please ensure .env file is configured properly.');
  process.exit(1);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   LIVE ODDS INGESTION TEST - LOCAL DATABASE                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Connect to local PostgreSQL
  const db = new pg.Client('postgresql://postgres:postgres@localhost:5432/unit_talk_dev');

  try {
    await db.connect();
    console.log('✅ Connected to local PostgreSQL database\n');

    // Initialize Odds API client
    const oddsApiClient = new OddsApiClient();

    // Fetch props for multiple sports (NBA, NHL, NCAAB)
    const sports = [
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'basketball_ncaab', name: 'NCAAB' },
      { key: 'icehockey_nhl', name: 'NHL' }
    ];

    let totalPropsIngested = 0;
    const sportBreakdown: Record<string, number> = {};

    for (const sport of sports) {
      console.log(`\n📊 Fetching ${sport.name} props from Odds API...`);

      try {
        const props = await oddsApiClient.fetchOddsApiProps(
          sport.key as any,
          ['h2h', 'spreads', 'totals']
        );

        console.log(`  ✅ Fetched ${props.length} ${sport.name} props`);

        if (props.length === 0) {
          console.log(`  ℹ️  No ${sport.name} games available right now`);
          continue;
        }

        // Insert into local database using pg client (OLD SCHEMA: league, prop_type)
        console.log(`  💾 Inserting ${props.length} props into local raw_props table...`);

        let insertedCount = 0;
        for (const prop of props) {
          try {
            const query = `
              INSERT INTO raw_props (
                id, league, prop_type, line, over_odds, under_odds,
                event_time, home_team, away_team, created_at, updated_at,
                sport_key, external_game_id
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10, $11
              )
              ON CONFLICT (id) DO UPDATE SET
                updated_at = NOW()
            `;

            await db.query(query, [
              prop.id || require('crypto').randomUUID(),
              prop.sport || sport.name, // league column
              prop.stat_type || prop.market || prop.prop_type, // prop_type column
              prop.line,
              prop.over_odds || prop.over,
              prop.under_odds || prop.under,
              prop.event_time || prop.game_time,
              prop.home_team,
              prop.away_team,
              sport.key, // sport_key
              prop.external_game_id || prop.game_id
            ]);

            insertedCount++;
          } catch (err: any) {
            // Skip duplicates or constraint violations
            if (!err.message.includes('duplicate') && !err.message.includes('constraint')) {
              console.error(`    ⚠️  Failed to insert prop: ${err.message}`);
            }
          }
        }

        console.log(`  ✅ Successfully inserted ${insertedCount} ${sport.name} props`);
        totalPropsIngested += insertedCount;
        sportBreakdown[sport.name] = insertedCount;

      } catch (err: any) {
        console.error(`  ❌ Error fetching ${sport.name}: ${err.message}`);
      }
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                   INGESTION SUMMARY                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log(`Total props ingested: ${totalPropsIngested}\n`);
    console.log('Sport breakdown:');
    Object.entries(sportBreakdown).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} props`);
    });

    // Verify data
    console.log('\n🔍 Verifying recent ingestion...\n');
    const verifyQuery = await db.query(`
      SELECT league, COUNT(*) as count
      FROM raw_props
      WHERE created_at >= NOW() - INTERVAL '10 minutes'
      GROUP BY league
      ORDER BY count DESC
    `);

    console.log('Props in database (last 10 minutes):');
    verifyQuery.rows.forEach(row => {
      console.log(`  ${row.league}: ${row.count} props`);
    });

    console.log('\n✅ INGESTION COMPLETE!\n');

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
