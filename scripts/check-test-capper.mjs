#!/usr/bin/env node
/**
 * Check if test capper exists, create if not
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;
const TEST_CAPPER_ID = '00000000-0000-0000-0000-000000000001';

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();

  // Check if capper exists
  const result = await client.query(`
    SELECT id, username, display_name
    FROM cappers
    WHERE id = $1
  `, [TEST_CAPPER_ID]);

  if (result.rows.length > 0) {
    console.log('✅ Test capper exists:', JSON.stringify(result.rows[0], null, 2));
  } else {
    console.log('Test capper does not exist, creating...');

    // Create test capper
    const insert = await client.query(`
      INSERT INTO cappers (id, username, display_name, is_active, created_at)
      VALUES ($1, 'test_capper', 'Test Capper', true, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING id, username, display_name
    `, [TEST_CAPPER_ID]);

    if (insert.rows.length > 0) {
      console.log('✅ Test capper created:', JSON.stringify(insert.rows[0], null, 2));
    } else {
      console.log('⚠️ Could not create test capper (may already exist)');
    }
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
