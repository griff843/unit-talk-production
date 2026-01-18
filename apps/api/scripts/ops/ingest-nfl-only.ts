/**
 * NFL-Only Live Ingestion
 *
 * Focused script to ingest all NFL games for today from Odds API
 * Used to verify ingestion properly captures all games, not just 1
 */

import { Pool } from 'pg';
import { OddsApiClient } from '../../src/agents/FeedAgent/oddsApi';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unit_talk_dev',
});

const SUPPORTED_SPORTS: Record<string, string> = {
  'americanfootball_nfl': 'NFL'
};

async function main() {
  console.log('=== NFL-ONLY LIVE INGESTION ===\n');
  console.log('Target: americanfootball_nfl (NFL)');
  console.log('Date: 2025-11-27 (Thanksgiving)\n');

  try {
    const client = await pool.connect();
    console.log('✅ Database connected\n');
    client.release();

    const oddsApiClient = new OddsApiClient();

    console.log('[NFL] Fetching from Odds API...\n');

    const props = await oddsApiClient.fetchOddsApiProps(
      'americanfootball_nfl',
      ['h2h', 'spreads', 'totals']
    );

    console.log(`[NFL] Fetched ${props.length} props\n`);

    if (props.length === 0) {
      console.log('❌ No NFL props returned from API');
      process.exit(1);
    }

    // Filter to today only
    const today = new Date().toISOString().split('T')[0];
    const todayProps = props.filter(prop => {
      const propDate = (prop.game_time || prop.start_time || '').split('T')[0];
      return propDate === today;
    });

    console.log(`[NFL] Filtered to today (${today}): ${todayProps.length} props\n`);

    // Group by game
    const propsByGame = new Map<string, typeof props>();

    for (const prop of todayProps) {
      const gameKey = prop.external_game_id || prop.event_id || `${prop.home_team}-${prop.away_team}-${prop.game_time}`;
      if (!propsByGame.has(gameKey)) {
        propsByGame.set(gameKey, []);
      }
      propsByGame.get(gameKey)!.push(prop);
    }

    console.log(`[NFL] ${propsByGame.size} unique games for today\n`);

    // Insert into database
    const dbClient = await pool.connect();
    let gamesCreated = 0;
    let propsStored = 0;

    try {
      await dbClient.query('BEGIN');

      for (const [gameKey, gameProps] of propsByGame.entries()) {
        const sampleProp = gameProps[0];

        console.log(`Processing game: ${sampleProp.away_team} @ ${sampleProp.home_team}`);

        // Upsert game
        const gameResult = await dbClient.query(`
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
          DO UPDATE SET updated_at = NOW()
          RETURNING id
        `, [
          SUPPORTED_SPORTS[sampleProp.sport_key] || 'NFL',
          sampleProp.home_team,
          sampleProp.away_team,
          sampleProp.game_time || sampleProp.start_time
        ]);

        const gameId = gameResult.rows[0]?.id;
        gamesCreated++;

        console.log(`  Game ID: ${gameId}`);
        console.log(`  Props for this game: ${gameProps.length}`);

        // Insert all props for this game
        for (const prop of gameProps) {
          const result = await dbClient.query(`
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
            gameId,
            prop.game_time || prop.start_time,
            prop.sport_key,
            SUPPORTED_SPORTS[prop.sport_key] || 'NFL',
            prop.external_game_id || prop.event_id || gameKey,
            prop.home_team,
            prop.away_team
          ]);

          if (result.rowCount > 0) {
            propsStored++;
          }
        }

        console.log(`  ✅ Stored ${gameProps.length} props\n`);
      }

      await dbClient.query('COMMIT');

      console.log('=== INGESTION COMPLETE ===\n');
      console.log(`Games created: ${gamesCreated}`);
      console.log(`Props stored: ${propsStored}\n`);

      // Verify
      const verifyGames = await dbClient.query(`
        SELECT COUNT(*) as count FROM games
        WHERE league = 'NFL' AND DATE(start_time) = CURRENT_DATE
      `);

      const verifyProps = await dbClient.query(`
        SELECT COUNT(*) as count FROM raw_props
        WHERE league = 'NFL' AND DATE(event_time) = CURRENT_DATE
      `);

      console.log('=== VERIFICATION ===\n');
      console.log(`NFL games in DB (today): ${verifyGames.rows[0].count}`);
      console.log(`NFL props in DB (today): ${verifyProps.rows[0].count}\n`);

      const output = {
        timestamp: new Date().toISOString(),
        target_date: today,
        games_created: gamesCreated,
        props_stored: propsStored,
        db_games_today: parseInt(verifyGames.rows[0].count),
        db_props_today: parseInt(verifyProps.rows[0].count)
      };

      console.log('JSON Output:');
      console.log(JSON.stringify(output, null, 2));

      if (gamesCreated === 0 || propsStored === 0) {
        console.log('\n❌ INGESTION FAILED - No data stored');
        process.exit(1);
      }

      console.log('\n✅ INGESTION SUCCESSFUL');
      process.exit(0);

    } catch (error: any) {
      await dbClient.query('ROLLBACK');
      console.error('❌ Database error:', error.message);
      throw error;
    } finally {
      dbClient.release();
    }

  } catch (error: any) {
    console.error('\n❌ INGESTION FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
