#!/usr/bin/env node
/**
 * Check table schemas
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

  // Check smart_tickets schema
  console.log('=== smart_tickets columns ===');
  const stCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'smart_tickets'
    ORDER BY ordinal_position
  `);
  stCols.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

  // Check unified_picks schema - key columns
  console.log('\n=== unified_picks key columns ===');
  const upCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unified_picks'
      AND column_name IN ('id', 'bet_slip_id', 'user_id', 'leg_index', 'sport', 'ticket_type')
    ORDER BY ordinal_position
  `);
  upCols.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

  // Check bridge_outbox schema
  console.log('\n=== bridge_outbox columns ===');
  const boCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bridge_outbox'
    ORDER BY ordinal_position
  `);
  boCols.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
