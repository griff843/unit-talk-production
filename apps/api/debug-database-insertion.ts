#!/usr/bin/env node

/**
 * DEBUG DATABASE INSERTION - Test actual insertion issues
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  host: 'unit-talk-postgres',
  port: 5432,
  database: 'unit_talk_dev',
  user: 'postgres',
  password: 'development_password_2024',
});

async function debugDatabaseInsertion() {
  console.log('🔍 DEBUGGING DATABASE INSERTION ISSUES');

  try {
    const client = await pool.connect();

    // Test 1: Simple game insertion
    console.log('\n📋 Test 1: Simple game insertion...');

    const testGame = {
      id: uuidv4(),
      game_id: 'TEST_GAME_123',
      sport: 'NBA',
      home_team: 'Test Home Team',
      away_team: 'Test Away Team',
      start_time: new Date().toISOString(),
      status: 'completed',
      provider: 'sgo'
    };

    try {
      const gameResult = await client.query(`
        INSERT INTO games (id, game_id, sport, home_team, away_team, start_time, status, provider, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id
      `, [
        testGame.id,
        testGame.game_id,
        testGame.sport,
        testGame.home_team,
        testGame.away_team,
        testGame.start_time,
        testGame.status,
        testGame.provider
      ]);

      console.log('✅ Game insertion successful:', gameResult.rows[0].id);

      // Test 2: Prop insertion with valid game reference
      console.log('\n📋 Test 2: Prop insertion with valid game reference...');

      const testProp = {
        id: uuidv4(),
        game_id: gameResult.rows[0].id,
        external_id: 'TEST_PROP_123_sgo',
        sport: 'NBA',
        stat_type: 'points',
        player_name: 'Test Player',
        line: 25.5,
        over_odds: -110,
        under_odds: -110,
        start_time: new Date().toISOString(),
        source: 'sgo'
      };

      const propResult = await client.query(`
        INSERT INTO raw_props (
          id, game_id, external_id, sport, stat_type, player_name,
          line, over_odds, under_odds, start_time, created_at, updated_at, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11)
        RETURNING id
      `, [
        testProp.id,
        testProp.game_id,
        testProp.external_id,
        testProp.sport,
        testProp.stat_type,
        testProp.player_name,
        testProp.line,
        testProp.over_odds,
        testProp.under_odds,
        testProp.start_time,
        testProp.source
      ]);

      console.log('✅ Prop insertion successful:', propResult.rows[0].id);

      // Clean up test data
      await client.query('DELETE FROM raw_props WHERE external_id = $1', [testProp.external_id]);
      await client.query('DELETE FROM games WHERE game_id = $1', [testGame.game_id]);
      console.log('✅ Test data cleaned up');

      // Test 3: Check if raw_props has foreign key constraint
      console.log('\n📋 Test 3: Checking raw_props foreign key constraints...');

      const fkResult = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'raw_props'
      `);

      if (fkResult.rows.length > 0) {
        console.log('⚠️  Foreign key constraints found:', fkResult.rows);
      } else {
        console.log('✅ No foreign key constraints on raw_props table');
      }

    } catch (insertError: any) {
      console.error('❌ Insertion test failed:', insertError.message);
      console.error('Error details:', insertError.detail);
    }

    client.release();

  } catch (error: any) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  debugDatabaseInsertion().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}