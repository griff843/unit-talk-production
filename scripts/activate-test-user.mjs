#!/usr/bin/env node
/**
 * Activate test user for integration tests
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

  // Check user_profiles table structure
  console.log('Checking user_profiles...');
  const profiles = await client.query(`
    SELECT discord_id, tier, is_active
    FROM user_profiles
    WHERE discord_id = (SELECT discord_id FROM users WHERE id = $1)
  `, [TEST_USER_ID]);

  console.log('User profiles:', profiles.rows);

  // Get the discord_id for the test user
  const userResult = await client.query(`
    SELECT id, username, discord_id, tier FROM users WHERE id = $1
  `, [TEST_USER_ID]);
  console.log('User:', userResult.rows);

  if (userResult.rows.length > 0) {
    const discordId = userResult.rows[0].discord_id;

    // Check if user_profile exists
    const profileCheck = await client.query(`
      SELECT * FROM user_profiles WHERE discord_id = $1
    `, [discordId]);

    if (profileCheck.rows.length === 0) {
      console.log('Creating user_profile...');
      await client.query(`
        INSERT INTO user_profiles (discord_id, tier, is_active, created_at)
        VALUES ($1, 'vip', true, NOW())
        ON CONFLICT (discord_id) DO UPDATE SET is_active = true
      `, [discordId]);
      console.log('✅ User profile created/updated');
    } else {
      console.log('Updating existing profile...');
      await client.query(`
        UPDATE user_profiles SET is_active = true WHERE discord_id = $1
      `, [discordId]);
      console.log('✅ User profile activated');
    }

    // Verify
    const final = await client.query(`
      SELECT * FROM user_profiles WHERE discord_id = $1
    `, [discordId]);
    console.log('Final profile:', final.rows);
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
