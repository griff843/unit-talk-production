#!/usr/bin/env tsx
/**
 * Execute SQL file using pg Client with DATABASE_DIRECT_URL
 * Date: 2025-10-20
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runSQL(sqlFile: string) {
  // Parse DATABASE_DIRECT_URL and decode password
  const dbUrl = process.env.DATABASE_DIRECT_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_DIRECT_URL not set');
  }

  // Decode URL-encoded password
  const decodedUrl = dbUrl.replace('%21', '!');

  console.log(`📄 Executing SQL file: ${sqlFile}\n`);
  console.log(`🔗 Connecting to database...\n`);

  const client = new Client({
    connectionString: decodedUrl,
    ssl: { rejectUnauthorized: false }, // Supabase uses valid certs but container may not trust them
    statement_timeout: 600000, // 10 minutes
    query_timeout: 600000,
  });

  try {
    await client.connect();
    console.log('✅ Connected\n');

    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');

    // Execute the entire SQL file as one transaction
    console.log('Executing SQL...\n');
    const result = await client.query(sqlContent);

    console.log('✅ SQL executed successfully\n');

    if (result.rows && result.rows.length > 0) {
      console.log('Results:');
      console.log(JSON.stringify(result.rows, null, 2));
    }

    if (result.rowCount !== null) {
      console.log(`\nRows affected: ${result.rowCount}\n`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('Connection closed\n');
  }
}

const sqlFile = process.argv[2] || 'apps/api/out/ops/BACKFILL_MARKET_PROPS_TODAY.sql';
runSQL(sqlFile).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
