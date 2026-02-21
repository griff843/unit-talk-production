#!/usr/bin/env node
/**
 * Allow NULL in ticket_legs for manual entry
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
  console.log('Connected to database');
  
  // Check current column constraints
  const checkQuery = await client.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'ticket_legs'
    AND column_name IN ('event_id', 'market_type_id', 'participant_id')
    ORDER BY column_name
  `);
  
  console.log('\nCurrent column constraints:');
  for (const col of checkQuery.rows) {
    console.log(`  ${col.column_name}: nullable=${col.is_nullable}, type=${col.data_type}`);
  }
  
  // Make columns nullable for manual entry
  console.log('\nMaking columns nullable...');
  
  await client.query(`
    ALTER TABLE ticket_legs
      ALTER COLUMN event_id DROP NOT NULL,
      ALTER COLUMN market_type_id DROP NOT NULL;
  `);
  
  console.log('✅ Columns updated');
  
  // Verify changes
  const verifyQuery = await client.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ticket_legs'
    AND column_name IN ('event_id', 'market_type_id', 'participant_id')
    ORDER BY column_name
  `);
  
  console.log('\nAfter update:');
  for (const col of verifyQuery.rows) {
    console.log(`  ${col.column_name}: nullable=${col.is_nullable}`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
