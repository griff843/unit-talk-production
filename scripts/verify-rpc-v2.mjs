#!/usr/bin/env node
/**
 * Verify the atomic_submit_ticket_v2 RPC exists with manual entry support
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

  // Query pg_proc for the atomic_submit_ticket_v2 function
  const result = await client.query(`
    SELECT
      p.proname as function_name,
      n.nspname as schema_name,
      pg_get_function_result(p.oid) as return_type,
      pg_get_function_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'atomic_submit_ticket_v2'
    AND n.nspname = 'public'
  `);

  console.log('=== atomic_submit_ticket_v2 ===');
  console.log(JSON.stringify(result.rows, null, 2));

  if (result.rows.length > 0) {
    console.log('\n✅ RPC atomic_submit_ticket_v2 EXISTS');
    console.log('Arguments:', result.rows[0].arguments);
  } else {
    console.log('\n❌ RPC atomic_submit_ticket_v2 NOT FOUND');
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
