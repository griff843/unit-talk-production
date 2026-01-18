#!/usr/bin/env node
/**
 * Apply Canonical Migration via Supabase Management API
 * Date: 2025-01-29
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const log = {
  info: (msg) => console.log(`[\x1b[36mINFO\x1b[0m] ${msg}`),
  success: (msg) => console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`),
  error: (msg) => console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`),
  warn: (msg) => console.log(`[\x1b[33mWARN\x1b[0m] ${msg}`)
};

async function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('CANONICAL MIGRATION - MANUAL APPLICATION REQUIRED');
  console.log('='.repeat(80));
  console.log('');

  // Extract project ref
  const supabaseUrl = process.env.SUPABASE_URL;
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  
  if (!match) {
    log.error('Could not extract project ref from SUPABASE_URL');
    process.exit(1);
  }

  const projectRef = match[1];
  log.info(`Project: ${projectRef}`);

  // Load migration SQL
  const migrationPath = path.join(__dirname, '../migrations/2025-01-28_canonical_convergence.sql');
  
  if (!fs.existsSync(migrationPath)) {
    log.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  log.info(`Migration file loaded (${migrationSQL.length} bytes)`);

  console.log('');
  console.log('='.repeat(80));
  console.log('MANUAL MIGRATION STEPS');
  console.log('='.repeat(80));
  console.log('');
  console.log('Due to RLS restrictions, please apply the migration manually:');
  console.log('');
  console.log('Option 1: Supabase SQL Editor (RECOMMENDED)');
  console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log(`  2. Copy SQL from: ${migrationPath}`);
  console.log('  3. Paste into SQL Editor and click "Run"');
  console.log('');
  console.log('Option 2: Copy SQL to clipboard');
  console.log('  The migration SQL is displayed below:');
  console.log('');
  console.log('-'.repeat(80));
  console.log(migrationSQL);
  console.log('-'.repeat(80));
  console.log('');
  console.log('After applying migration:');
  console.log('  1. Run: node scripts/ops/verify-pgrst-visible.ts');
  console.log('  2. If tables not visible, wait 20s and retry');
  console.log('  3. Continue with: ./dev.sh start');
  console.log('');
}

main();

