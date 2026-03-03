#!/usr/bin/env tsx
/**
 * psql-equivalent for Windows without PostgreSQL installed
 * Usage: npx tsx psql-exec.ts <connection-string> <sql-file-or-command>
 * Date: 2025-10-20
 */

import { Client } from 'pg';
import * as fs from 'fs';

async function executePSQL() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx tsx psql-exec.ts <connection-string> [-f <file> | -c <command>]');
    process.exit(1);
  }

  const connectionString = args[0];
  let sql = '';
  let isFile = false;

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-f' && args[i + 1]) {
      isFile = true;
      sql = fs.readFileSync(args[i + 1], 'utf-8');
      break;
    } else if (args[i] === '-c' && args[i + 1]) {
      sql = args[i + 1];
      break;
    } else if (args[i] === '-v' && args[i + 1] === 'ON_ERROR_STOP=1') {
      // Ignore this flag, we always stop on error
      continue;
    }
  }

  if (!sql) {
    console.error('No SQL provided');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Windows may not have proper certs
    connectionTimeoutMillis: 30000,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Execute SQL
    const result = await client.query(sql);

    if (result.rows && result.rows.length > 0) {
      console.log('\nResults:');
      console.table(result.rows);
    }

    if (result.rowCount !== null && result.rowCount !== undefined) {
      console.log(`\nRows affected: ${result.rowCount}`);
    }

    console.log('\nSuccess');
    process.exit(0);
  } catch (error: any) {
    console.error('\nError:', error.message);
    if (error.position) {
      console.error(`Position: ${error.position}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

executePSQL();
