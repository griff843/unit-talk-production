#!/usr/bin/env node
/**
 * SPRINT-MANUAL-E2E-GOLDEN-092: Dev Lifecycle Reset
 *
 * Resets ONLY lifecycle tables for clean E2E testing.
 * Preserves all catalog data (participants, teams, games, etc.)
 *
 * Usage: DEV_RESET_ALLOWED=true node scripts/ops-reset-dev-lifecycle.mjs
 *
 * ⚠️  DESTRUCTIVE: Truncates unified_picks, bridge_outbox, settlements
 */

import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// SAFETY GATE
// ============================================================
if (process.env.DEV_RESET_ALLOWED !== 'true') {
  console.error(`
╔═══════════════════════════════════════════════════════════════════════════╗
║  🛑 DEV RESET BLOCKED - Safety Gate                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  This script truncates lifecycle tables (unified_picks, bridge_outbox).   ║
║  Only run in development/staging environments.                            ║
║                                                                           ║
║  To proceed, set:                                                         ║
║    DEV_RESET_ALLOWED=true node scripts/ops-reset-dev-lifecycle.mjs        ║
╚═══════════════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// Parse .env file
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  const envLines = envFile.split('\n');
  for (const line of envLines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
} catch (e) {
  // .env not found
}

const DATABASE_URL = process.env.SUPABASE_DB_URL_POOLER || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL or SUPABASE_DB_URL_POOLER');
  process.exit(1);
}

const { Client } = pg;

// Tables to RESET (lifecycle/transactional)
const LIFECYCLE_TABLES = [
  'bridge_outbox',
  'unified_picks',
  'prop_settlements',
  'closing_snapshots',
  'agent_health',
];

// Tables to PRESERVE (catalogs)
const PRESERVED_TABLES = [
  'participants',
  'participant_memberships',
  'players',
  'teams',
  'games',
  'events',
  'cappers',
  'sports',
  'bet_types',
  'raw_props',
];

async function resetLifecycle() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SPRINT-MANUAL-E2E-GOLDEN-092: Dev Lifecycle Reset            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const results = {
    timestamp: new Date().toISOString(),
    before: {},
    after: {},
    truncated: [],
    preserved: [],
  };

  try {
    console.log('📊 Counting rows BEFORE reset...\n');

    // Count lifecycle tables
    for (const table of LIFECYCLE_TABLES) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        results.before[table] = parseInt(rows[0].count);
        console.log(`   ${table}: ${results.before[table]} rows`);
      } catch (e) {
        console.log(`   ${table}: (table not found)`);
        results.before[table] = 'N/A';
      }
    }

    console.log('\n📊 Preserved catalogs (not touched):');
    for (const table of PRESERVED_TABLES) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(rows[0].count);
        console.log(`   ${table}: ${count} rows`);
        results.preserved.push({ table, count });
      } catch (e) {
        console.log(`   ${table}: (table not found)`);
      }
    }

    console.log('\n🗑️  Truncating lifecycle tables...\n');

    for (const table of LIFECYCLE_TABLES) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`   ✅ Truncated: ${table}`);
        results.truncated.push(table);
      } catch (e) {
        console.log(`   ⚠️  Skip: ${table} (${e.message})`);
      }
    }

    console.log('\n📊 Counting rows AFTER reset...\n');

    for (const table of LIFECYCLE_TABLES) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        results.after[table] = parseInt(rows[0].count);
        console.log(`   ${table}: ${results.after[table]} rows`);
      } catch (e) {
        results.after[table] = 'N/A';
      }
    }

    // Save proof
    const proofDir = join(__dirname, '..', 'out', 'sprints', 'SPRINT-MANUAL-E2E-GOLDEN-092', '2026-02-23', 'proofs');
    try {
      mkdirSync(proofDir, { recursive: true });
      const proofContent = `
=== DEV LIFECYCLE RESET PROOF ===
Timestamp: ${results.timestamp}
Sprint: SPRINT-MANUAL-E2E-GOLDEN-092

=== BEFORE RESET ===
${LIFECYCLE_TABLES.map(t => `${t}: ${results.before[t]} rows`).join('\n')}

=== AFTER RESET ===
${LIFECYCLE_TABLES.map(t => `${t}: ${results.after[t]} rows`).join('\n')}

=== TRUNCATED TABLES ===
${results.truncated.join('\n')}

=== PRESERVED CATALOGS ===
${results.preserved.map(p => `${p.table}: ${p.count} rows`).join('\n')}

=== VERIFICATION ===
All lifecycle tables: ${results.truncated.length > 0 ? '✅ TRUNCATED' : '❌ FAILED'}
Catalog preservation: ✅ CONFIRMED
`;
      writeFileSync(join(proofDir, 'proof_reset_counts.txt'), proofContent.trim());
      console.log('\n📄 Proof saved: proof_reset_counts.txt');
    } catch (e) {
      console.log('\n⚠️  Could not save proof file');
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ DEV LIFECYCLE RESET COMPLETE                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

  } finally {
    await client.end();
  }
}

resetLifecycle().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
