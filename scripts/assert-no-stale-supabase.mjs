#!/usr/bin/env node

/**
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A
 * CI Guard Script: Assert no references to stale Supabase endpoint
 *
 * This script scans the codebase for any references to the OLD Supabase host
 * and fails the build if any are found.
 *
 * Usage:
 *   node scripts/assert-no-stale-supabase.mjs
 *
 * Exit codes:
 *   0 - No stale references found (success)
 *   1 - Stale references found (fail build)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// OLD Supabase host - should NEVER appear in codebase
const STALE_HOST = 'lxqmuzmqtnnlpfapvief';

// NEW canonical Supabase host
const CANONICAL_HOST = 'cqfnsozknjzvyiziwicl';

// Files/directories to ignore (already validated or not relevant)
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.next',
  'coverage',
  // This script itself (for documentation purposes)
  'assert-no-stale-supabase.mjs',
  // Sprint and proof artifacts (historical documentation)
  'out',
  // JSON lock files
  'pnpm-lock.yaml',
  'package-lock.json',
];

function main() {
  console.log('🔍 SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Scanning for stale Supabase references...\n');
  console.log(`   STALE HOST (forbidden):   ${STALE_HOST}`);
  console.log(`   CANONICAL HOST (allowed): ${CANONICAL_HOST}`);
  console.log('');

  try {
    // Build grep ignore patterns
    const ignoreArgs = IGNORE_PATTERNS.map(p => `--exclude-dir=${p}`).join(' ');
    const fileIgnoreArgs = IGNORE_PATTERNS.map(p => `--exclude=${p}`).join(' ');

    // Search for stale host references
    // Use rg (ripgrep) if available for better ignore handling, otherwise fall back to grep
    const command = `grep -r "${STALE_HOST}" ${ROOT_DIR} ${ignoreArgs} ${fileIgnoreArgs} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.md" --include="*.sql" --include="*.env*" 2>/dev/null | grep -v "assert-no-stale-supabase.mjs" || true`;

    const result = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    if (result.trim()) {
      console.error('❌ GATE FAILED: Stale Supabase host references found!\n');
      console.error('The following files contain references to the OLD Supabase host:\n');

      const lines = result.trim().split('\n');
      lines.forEach(line => {
        console.error(`   ${line}`);
      });

      console.error('\n');
      console.error('📋 REQUIRED ACTION:');
      console.error(`   Replace all occurrences of "${STALE_HOST}" with "${CANONICAL_HOST}"`);
      console.error('');
      console.error('   For service files, use the fail-closed pattern:');
      console.error('   const supabaseUrl = process.env.SUPABASE_URL;');
      console.error('   if (!supabaseUrl) throw new Error("SUPABASE_URL required");');
      console.error('');

      process.exit(1);
    }

    console.log('✅ GATE PASSED: No stale Supabase host references found.');
    console.log(`   All endpoints use canonical host: ${CANONICAL_HOST}.supabase.co`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Guard script error:', error.message);
    process.exit(1);
  }
}

main();
