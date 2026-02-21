#!/usr/bin/env node
/**
 * Add active column to users table and set test user to active
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

  // Check if active column exists
  const columns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log('Current users columns:');
  columns.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

  const hasActive = columns.rows.some(r => r.column_name === 'active');

  if (!hasActive) {
    console.log('\nAdding active column...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true
    `);
    console.log('✅ Active column added');
  } else {
    console.log('\n✅ Active column already exists');
  }

  // Set test user to active
  console.log('\nSetting test user to active...');
  await client.query(`
    UPDATE users SET active = true WHERE id = $1
  `, [TEST_USER_ID]);
  console.log('✅ Test user activated');

  // Verify
  const user = await client.query(`
    SELECT id, username, active FROM users WHERE id = $1
  `, [TEST_USER_ID]);
  console.log('\nTest user:', user.rows[0]);

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
