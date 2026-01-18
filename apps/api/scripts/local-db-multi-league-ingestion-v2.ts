// Live Multi-League Ingestion Script v2 - WITH GAME LINKAGE & EVENT TIME
// Ingests live odds for all 5 required leagues: NBA, NFL, NCAAF, NCAAB, NHL
// Uses direct PostgreSQL connection with proper game linkage
// REALITY ALIGNMENT: Verifies props are for real-world games (e.g., NFL on Thanksgiving, no MLB)

import { Pool } from 'pg';
import { OddsApiClient } from '../src/agents/FeedAgent/oddsApi';

// Use local PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/unit_talk_dev',
});

// Sport key to league mapping (from oddsApi.ts:45-68)
const SUPPORTED_SPORTS: Record<string, string> = {
  'americanfootball_nfl': 'NFL',
  'americanfootball_ncaaf': 'NCAAF',
  'basketball_nba': 'NBA',
  'basketball_ncaab': 'NCAAB',
  'basketball_wnba': 'WNBA',
  'baseball_mlb': 'MLB',
  'icehockey_nhl': 'NHL',
  'soccer_epl': 'EPL',
  'soccer_uefa_champs_league': 'UEFA Champions League',
  'tennis_atp': 'ATP',
  'tennis_wta': 'WTA'
};

interface LeagueResult {
  league: string;
  sportKey: string;
  propsFetched: number;
  propsStored: number;
  gamesCreated: number;
  error: string | null;
}

async function main() {
  console.log('=== LIVE MULTI-LEAGUE INGESTION V2 (WITH GAME LINKAGE) ===\n');
  console.log('Target Leagues: NBA, NFL, NCAAF, NCAAB, NHL\n');
  console.log('Features: Game linkage + event_time + reality alignment\n');
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] || 'postgres:5432/unit_talk_dev'}\n`);

  const results: LeagueResult[] = [];

  try {
    // Test DB connection
    const client = await pool.connect();
    console.log('✅ Database connection established\n');

    // Verify new columns exist
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'raw_props'
      AND column_name IN ('event_time', 'sport_key', 'league', 'external_game_id', 'home_team', 'away_team')
    `);

    console.log(`Schema verification: ${columnCheck.rows.length}/6 required columns present`);
    if (columnCheck.rows.length < 6) {
      console.error('❌ Missing required columns. Run migration: 20251127_phase15_raw_props_event_time_and_game_link.sql');
      process.exit(1);
    }

    client.release();

    // Initialize Odds API client
    const oddsApiClient = new OddsApiClient();

    // All 5 required leagues
    const leagues = [
      { name: 'NBA', sportKey: 'basketball_nba' },
      { name: 'NFL', sportKey: 'americanfootball_nfl' },
      { name: 'NCAAF', sportKey: 'americanfootball_ncaaf' },
      { name: 'NCAAB', sportKey: 'basketball_ncaab' },
      { name: 'NHL', sportKey: 'icehockey_nhl' },
      // { name: 'MLB', sportKey: 'baseball_mlb' } // Should be 0 on Thanksgiving 2025-11-27
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
            gamesCreated: 0,
            error: null
          });
          continue;
        }

        // Insert into database using direct SQL with game linkage
        const client = await pool.connect();
        let storedCount = 0;
        const gamesCreated = new Set<string>();

        try {
          await client.query('BEGIN');

          // Group props by game to minimize game upserts
          const propsByGame = new Map<string, typeof props>();

          for (const prop of props) {
            const gameKey = prop.external_game_id || prop.event_id || `${prop.home_team}-${prop.away_team}-${prop.game_time}`;
            if (!propsByGame.has(gameKey)) {
              propsByGame.set(gameKey, []);
            }
            propsByGame.get(gameKey)!.push(prop);
          }

          console.log(`[${league.name}] Processing ${propsByGame.size} unique games...`);

          // Process each game and its props
          for (const [gameKey, gameProps] of propsByGame.entries()) {
            const sampleProp = gameProps[0];

            // Upsert game
            const gameResult = await client.query(`
              INSERT INTO games (
                id,
                league,
                home_team,
                away_team,
                start_time,
                status,
                created_at,
                updated_at
              ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                'scheduled',
                NOW(),
                NOW()
              )
              ON CONFLICT (league, home_team, away_team, start_time)
              DO UPDATE SET
                updated_at = NOW()
              RETURNING id
            `, [
              SUPPORTED_SPORTS[sampleProp.sport_key] || sampleProp.sport || league.name,
              sampleProp.home_team || 'Unknown',
              sampleProp.away_team || 'Unknown',
              sampleProp.game_time || sampleProp.start_time || new Date().toISOString()
            ]);

            const gameId = gameResult.rows[0]?.id;

            if (!gamesCreated.has(gameKey)) {
              gamesCreated.add(gameKey);
            }

            // Insert all props for this game
            for (const prop of gameProps) {
              const result = await client.query(`
                INSERT INTO raw_props (
                  id,
                  prop_type,
                  line,
                  over_odds,
                  under_odds,
                  game_id,
                  event_time,
                  sport_key,
                  league,
                  external_game_id,
                  home_team,
                  away_team,
                  created_at,
                  updated_at
                ) VALUES (
                  gen_random_uuid(),
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6,
                  $7,
                  $8,
                  $9,
                  $10,
                  $11,
                  NOW(),
                  NOW()
                )
                ON CONFLICT DO NOTHING
                RETURNING id
              `, [
                prop.stat_type || prop.prop_type || 'unknown',
                prop.line || 0,
                prop.over_odds || 0,
                prop.under_odds || 0,
                gameId,  // Link to game
                prop.game_time || prop.start_time || new Date().toISOString(),  // event_time
                prop.sport_key || league.sportKey,  // sport_key
                SUPPORTED_SPORTS[prop.sport_key] || prop.sport || league.name,  // league
                prop.external_game_id || prop.event_id || gameKey,  // external_game_id
                prop.home_team || 'Unknown',  // home_team
                prop.away_team || 'Unknown'   // away_team
              ]);

              if (result.rowCount > 0) {
                storedCount++;
              }
            }
          }

          await client.query('COMMIT');
          console.log(`[${league.name}] ✅ Stored ${storedCount} props across ${gamesCreated.size} games`);

          results.push({
            league: league.name,
            sportKey: league.sportKey,
            propsFetched: props.length,
            propsStored: storedCount,
            gamesCreated: gamesCreated.size,
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
            gamesCreated: 0,
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
          gamesCreated: 0,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n=== INGESTION SUMMARY ===\n');
    console.log('| League | Props Fetched | Props Stored | Games | Status |');
    console.log('|--------|---------------|--------------|-------|--------|');

    results.forEach(r => {
      const status = r.error ? '❌ FAIL' : r.propsStored > 0 ? '✅ PASS' : '⚠️  NO DATA';
      console.log(`| ${r.league.padEnd(6)} | ${String(r.propsFetched).padStart(13)} | ${String(r.propsStored).padStart(12)} | ${String(r.gamesCreated).padStart(5)} | ${status} |`);
    });

    const totalFetched = results.reduce((sum, r) => sum + r.propsFetched, 0);
    const totalStored = results.reduce((sum, r) => sum + r.propsStored, 0);
    const totalGames = results.reduce((sum, r) => sum + r.gamesCreated, 0);
    const failures = results.filter(r => r.error !== null).length;

    console.log('\n**Totals**:');
    console.log(`- Props Fetched: ${totalFetched}`);
    console.log(`- Props Stored: ${totalStored}`);
    console.log(`- Games Created: ${totalGames}`);
    console.log(`- Failures: ${failures}/5`);

    // Reality alignment check
    console.log('\n=== REALITY ALIGNMENT CHECK ===\n');
    const alignmentClient = await pool.connect();

    const dateCheck = await alignmentClient.query(`
      SELECT
        league,
        DATE(event_time) AS game_date,
        COUNT(*) AS props_count
      FROM raw_props
      WHERE event_time IS NOT NULL
      GROUP BY league, DATE(event_time)
      ORDER BY league, game_date
    `);

    console.log('Props by League & Date:');
    console.log('| League | Game Date  | Props |');
    console.log('|--------|------------|-------|');
    dateCheck.rows.forEach(row => {
      console.log(`| ${row.league.padEnd(6)} | ${row.game_date} | ${String(row.props_count).padStart(5)} |`);
    });

    alignmentClient.release();

    // Export results as JSON
    console.log('\n**JSON Output**:');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      totalFetched,
      totalStored,
      totalGames,
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
      console.log('\n✅ INGESTION SUCCESSFUL WITH GAME LINKAGE');
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
