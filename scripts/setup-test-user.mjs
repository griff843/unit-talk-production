#!/usr/bin/env node
/**
 * Setup test user for integration tests
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();

  // Check if user exists
  const result = await client.query(`
    SELECT id, username, discord_id, tier
    FROM users
    WHERE id = $1
  `, [TEST_USER_ID]);

  if (result.rows.length > 0) {
    console.log('✅ Test user exists:', JSON.stringify(result.rows[0], null, 2));
  } else {
    console.log('Test user does not exist, creating...');

    // Create test user
    const insert = await client.query(`
      INSERT INTO users (id, username, discord_id, tier)
      VALUES ($1, 'test_capper', 'test_discord_id_001', 'premium')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, username, discord_id, tier
    `, [TEST_USER_ID]);

    if (insert.rows.length > 0) {
      console.log('✅ Test user created:', JSON.stringify(insert.rows[0], null, 2));
    } else {
      // Try to get existing user after conflict
      const existing = await client.query(`
        SELECT id, username, discord_id, tier FROM users WHERE id = $1
      `, [TEST_USER_ID]);
      if (existing.rows.length > 0) {
        console.log('✅ Test user already exists:', JSON.stringify(existing.rows[0], null, 2));
      } else {
        console.log('❌ Could not create or find test user');
      }
    }
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
