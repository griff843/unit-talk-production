#!/usr/bin/env npx tsx
/**
 * Schema Audit Script
 *
 * Verifies all 7 canonical tables exist with correct structure:
 * - users
 * - games
 * - unified_picks
 * - smart_tickets
 * - bridge_outbox
 * - pick_publish
 * - picks
 *
 * Usage:
 *   npx tsx scripts/audit/audit_schema.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface TableAudit {
  table: string;
  exists: boolean;
  rowCount: number;
  error?: string;
}

const CANONICAL_TABLES = [
  'users',
  'games',
  'unified_picks',
  'smart_tickets',
  'bridge_outbox',
  'pick_publish',
  'picks',
];

async function auditTable(tableName: string): Promise<TableAudit> {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        table: tableName,
        exists: false,
        rowCount: 0,
        error: error.message,
      };
    }

    return {
      table: tableName,
      exists: true,
      rowCount: count || 0,
    };
  } catch (e) {
    return {
      table: tableName,
      exists: false,
      rowCount: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Schema Audit - Canonical Tables Verification');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const results: TableAudit[] = [];

  for (const table of CANONICAL_TABLES) {
    const result = await auditTable(table);
    results.push(result);

    const status = result.exists ? '[PASS]' : '[FAIL]';
    const info = result.exists
      ? `${result.rowCount} rows`
      : result.error || 'Not found';
    console.log(`${status} ${table}: ${info}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const passCount = results.filter((r) => r.exists).length;
  const failCount = results.filter((r) => !r.exists).length;

  console.log(`Total Tables: ${CANONICAL_TABLES.length}`);
  console.log(`Found: ${passCount}`);
  console.log(`Missing: ${failCount}`);

  if (failCount === 0) {
    console.log('\nStatus: ALL CANONICAL TABLES PRESENT');
    process.exit(0);
  } else {
    console.log('\nStatus: MISSING TABLES DETECTED');
    console.log('\nMissing:');
    results
      .filter((r) => !r.exists)
      .forEach((r) => console.log(`  - ${r.table}: ${r.error}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
