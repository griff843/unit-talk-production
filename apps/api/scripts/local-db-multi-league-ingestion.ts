// Live Multi-League Ingestion Script - LOCAL DB VERSION
// Ingests live odds for all 5 required leagues: NBA, NFL, NCAAF, NCAAB, NHL
// Uses direct PostgreSQL connection instead of Supabase HTTP client

import { Pool } from 'pg';
import { OddsApiClient } from '../src/agents/FeedAgent/oddsApi';

// Use local PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/unit_talk_dev',
});

interface LeagueResult {
  league: string;
  sportKey: string;
  propsFetched: number;
  propsStored: number;
  error: string | null;
}

async function main() {
  console.log('=== LIVE MULTI-LEAGUE INGESTION (LOCAL DB) ===\n');
  console.log('Target Leagues: NBA, NFL, NCAAF, NCAAB, NHL\n');
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] || 'postgres:5432/unit_talk_dev'}\n`);

  const results: LeagueResult[] = [];

  try {
    // Test DB connection
    const client = await pool.connect();
    console.log('✅ Database connection established\n');
    client.release();

    // Initialize Odds API client
    const oddsApiClient = new OddsApiClient();

    // All 5 required leagues
    const leagues = [
      { name: 'NBA', sportKey: 'basketball_nba' },
      { name: 'NFL', sportKey: 'americanfootball_nfl' },
      { name: 'NCAAF', sportKey: 'americanfootball_ncaaf' },
      { name: 'NCAAB', sportKey: 'basketball_ncaab' },
      { name: 'NHL', sportKey: 'icehockey_nhl' }
    ];

    for (const league of leagues) {
      console.log(`\n[${league.name}] Fetching from Odds API...`);

      try {
        const props = await oddsApiClient.fetchOddsApiProps(
          league.sportKey as any,
          ['h2h', 'spreads', 'totals']
        );

        console.log(`[${league.name}] Fetched ${props.length} props`);

        if (props.length === 0) {
          console.log(`[${league.name}] ⚠️  No games available (off-season or between games)`);
          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: 0,
            propsStored: 0,
            error: null
          });
          continue;
        }

        // Insert into database using direct SQL
        const client = await pool.connect();
        let storedCount = 0;

        try {
          await client.query('BEGIN');

          for (const prop of props) {
            // Convert RawProp to raw_props table columns
            const result = await client.query(`
              INSERT INTO raw_props (
                id,
                prop_type,
                line,
                over_odds,
                under_odds,
                created_at,
                updated_at
              ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                NOW(),
                NOW()
              )
              ON CONFLICT DO NOTHING
              RETURNING id
            `, [
              prop.stat_type || prop.prop_type || 'unknown',
              prop.line || 0,
              prop.over_odds || 0,
              prop.under_odds || 0
            ]);

            if (result.rowCount > 0) {
              storedCount++;
            }
          }

          await client.query('COMMIT');
          console.log(`[${league.name}] ✅ Stored ${storedCount} props`);

          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: props.length,
            propsStored: storedCount,
            error: null
          });

        } catch (error: any) {
          await client.query('ROLLBACK');
          console.error(`[${league.name}] ❌ Insert failed:`, error.message);
          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: props.length,
            propsStored: 0,
            error: error.message
          });
        } finally {
          client.release();
        }

      } catch (error: any) {
        console.error(`[${league.name}] ❌ Error:`, error.message);
        results.push({
          league: league.name,
          sportKey: league.sportKey,
          propsFetched: 0,
          propsStored: 0,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n=== INGESTION SUMMARY ===\n');
    console.log('| League | Props Fetched | Props Stored | Status |');
    console.log('|--------|---------------|--------------|--------|');

    results.forEach(r => {
      const status = r.error ? '❌ FAIL' : r.propsStored > 0 ? '✅ PASS' : '⚠️  NO DATA';
      console.log(`| ${r.league.padEnd(6)} | ${String(r.propsFetched).padStart(13)} | ${String(r.propsStored).padStart(12)} | ${status} |`);
    });

    const totalFetched = results.reduce((sum, r) => sum + r.propsFetched, 0);
    const totalStored = results.reduce((sum, r) => sum + r.propsStored, 0);
    const failures = results.filter(r => r.error !== null).length;

    console.log('\n**Totals**:');
    console.log(`- Props Fetched: ${totalFetched}`);
    console.log(`- Props Stored: ${totalStored}`);
    console.log(`- Failures: ${failures}/5`);

    // Export results as JSON
    console.log('\n**JSON Output**:');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      totalFetched,
      totalStored,
      failures,
      results
    }, null, 2));

    // Exit code based on success
    if (failures > 0) {
      console.log('\n❌ INGESTION COMPLETED WITH ERRORS');
      process.exit(1);
    } else if (totalStored === 0) {
      console.log('\n⚠️  INGESTION COMPLETED - NO DATA AVAILABLE');
      process.exit(0);
    } else {
      console.log('\n✅ INGESTION SUCCESSFUL');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ INGESTION FAILED:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
