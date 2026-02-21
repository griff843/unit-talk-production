#!/usr/bin/env node
/**
 * Verify the atomic_submit_ticket RPC exists
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const poolerUrl = process.env.SUPABASE_DB_URL_POOLER;

const client = new pg.Client({
  connectionString: poolerUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();

  // Query pg_proc for the atomic_submit_ticket function
  const result = await client.query(`
    SELECT
      p.proname as function_name,
      n.nspname as schema_name,
      pg_get_function_result(p.oid) as return_type,
      pg_get_function_arguments(p.oid) as arguments,
      p.provolatile as volatility,
      p.prosecdef as security_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'atomic_submit_ticket'
  `);

  console.log('=== pg_proc query for atomic_submit_ticket ===');
  console.log(JSON.stringify(result.rows, null, 2));

  if (result.rows.length > 0) {
    console.log('\n✅ RPC atomic_submit_ticket EXISTS in database');
    console.log('\nFunction details:');
    console.log('- Schema:', result.rows[0].schema_name);
    console.log('- Return type:', result.rows[0].return_type);
    console.log('- Security definer:', result.rows[0].security_definer);
  } else {
    console.log('\n❌ RPC atomic_submit_ticket NOT FOUND');
    process.exit(1);
  }
} catch (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
