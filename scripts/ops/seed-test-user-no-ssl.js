#!/usr/bin/env node
/**
 * Seed Test User - SSL Bypass for Testing
 * Temporary script for validation purposes only
 */

require('dotenv').config();
const { Pool } = require('pg');

const userId = '00000000-0000-0000-0000-000000000001';
const tenantId = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

async function seedUser() {
  const startTime = Date.now();
  const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.log(JSON.stringify({
      success: false,
      error: 'no_connection_string',
      message: 'DATABASE_DIRECT_URL not found',
    }, null, 2));
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }, // Bypass SSL for testing
  });

  try {
    // Idempotent insert
    const result = await pool.query(
      `
      INSERT INTO users (id, tenant_id, username, role, tier, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, username, role, tier, status, created_at, updated_at
      `,
      [userId, tenantId, 'test-user-rpc', 'test', 'free', 'active']
    );

    const user = result.rows[0];
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tier: user.tier,
        status: user.status,
      },
      method: 'direct_sql_no_ssl',
      durationMs: duration,
    }, null, 2));

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      success: false,
      error: error.code || 'database_error',
      message: error.message,
      durationMs: duration,
    }, null, 2));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedUser().catch(error => {
  console.log(JSON.stringify({
    success: false,
    error: 'fatal_error',
    message: error.message,
  }, null, 2));
  process.exit(1);
});
