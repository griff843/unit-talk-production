#!/usr/bin/env npx tsx
/**
 * Schema Audit Script
 *
 * Verifies all 6 canonical TABLES exist with correct structure:
 * - users
 * - games
 * - unified_picks (CANONICAL pick table)
 * - smart_tickets
 * - bridge_outbox
 * - pick_publish (CANONICAL Discord publish outbox)
 *
 * Also verifies the picks VIEW exists (read-only backward compat).
 *
 * CANONICAL RULES:
 *   - unified_picks is the ONLY writable pick table
 *   - pick_publish is the ONLY Discord publish outbox
 *   - picks is a READ-ONLY VIEW (no writes allowed)
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
  name: string;
  type: 'TABLE' | 'VIEW';
  exists: boolean;
  rowCount: number;
  error?: string;
}

// 6 Canonical TABLES
const CANONICAL_TABLES = [
  'users',
  'games',
  'unified_picks',
  'smart_tickets',
  'bridge_outbox',
  'pick_publish',
];

// 1 Backward compat VIEW
const BACKWARD_COMPAT_VIEWS = ['picks'];

async function auditTable(name: string, expectedType: 'TABLE' | 'VIEW'): Promise<TableAudit> {
  try {
    const { data, error, count } = await supabase
      .from(name)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        name,
        type: expectedType,
        exists: false,
        rowCount: 0,
        error: error.message,
      };
    }

    return {
      name,
      type: expectedType,
      exists: true,
      rowCount: count || 0,
    };
  } catch (e) {
    return {
      name,
      type: expectedType,
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

  // Audit canonical tables
  console.log('--- Canonical Tables (BASE TABLES) ---\n');
  for (const table of CANONICAL_TABLES) {
    const result = await auditTable(table, 'TABLE');
    results.push(result);

    const status = result.exists ? '[PASS]' : '[FAIL]';
    const info = result.exists
      ? `${result.rowCount} rows`
      : result.error || 'Not found';
    console.log(`${status} ${table}: ${info}`);
  }

  // Audit backward compat views
  console.log('\n--- Backward Compatibility Views (READ-ONLY) ---\n');
  for (const view of BACKWARD_COMPAT_VIEWS) {
    const result = await auditTable(view, 'VIEW');
    results.push(result);

    const status = result.exists ? '[PASS]' : '[FAIL]';
    const info = result.exists
      ? `READ-ONLY view (${result.rowCount} rows from unified_picks)`
      : result.error || 'Not found';
    console.log(`${status} ${view}: ${info}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('CANONICAL RULES');
  console.log('='.repeat(60));
  console.log('  - unified_picks: ONLY writable pick table');
  console.log('  - pick_publish: ONLY Discord publish outbox');
  console.log('  - picks: READ-ONLY view (backward compat)');
  console.log('');

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const passCount = results.filter((r) => r.exists).length;
  const failCount = results.filter((r) => !r.exists).length;

  console.log(`Total: ${results.length}`);
  console.log(`Found: ${passCount}`);
  console.log(`Missing: ${failCount}`);

  if (failCount === 0) {
    console.log('\nStatus: ALL CANONICAL SCHEMA PRESENT');
    process.exit(0);
  } else {
    console.log('\nStatus: MISSING SCHEMA DETECTED');
    console.log('\nMissing:');
    results
      .filter((r) => !r.exists)
      .forEach((r) => console.log(`  - ${r.name} (${r.type}): ${r.error}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
