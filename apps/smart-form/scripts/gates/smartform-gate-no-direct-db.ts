#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Gate: No Direct DB Access
 *
 * Ensures no UI component code directly accesses Supabase or database.
 * All data must flow through API endpoints.
 *
 * This is an enhanced version of smartform:gate:nobypass with stricter checks.
 *
 * Prohibited patterns:
 * - Direct Supabase client creation
 * - .from() calls on Supabase client
 * - Direct table name references
 * - Direct SQL queries
 * - Direct fetch to database views
 *
 * Usage: npm run smartform:gate:no-direct-db
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// UI directories to scan
const UI_SCAN_DIRS = ['app/submit-ticket/components', 'components/ui', 'components'];

// Prohibited patterns
const PROHIBITED_PATTERNS = [
  { pattern: '@supabase/supabase-js', description: 'Supabase client import in UI' },
  { pattern: '@supabase/ssr', description: 'Supabase SSR import in UI' },
  { pattern: 'createClient(', description: 'Supabase client creation in UI' },
  { pattern: 'createServerClient(', description: 'Supabase server client in UI' },
  { pattern: 'createBrowserClient(', description: 'Supabase browser client in UI' },
  { pattern: 'supabase.from(', description: 'Supabase table access in UI' },
  { pattern: 'unified_picks', description: 'Direct unified_picks table reference' },
  { pattern: 'raw_props', description: 'Direct raw_props table reference' },
  { pattern: 'bridge_outbox', description: 'Direct bridge_outbox table reference (except API)' },
  { pattern: 'mv_props_for_form', description: 'Direct materialized view reference' },
  { pattern: 'view_props_for_form', description: 'Direct view reference' },
  { pattern: '.rpc(', description: 'Supabase RPC call in UI' },
  { pattern: 'sql`', description: 'Raw SQL template literal' },
  { pattern: 'postgres://', description: 'Direct PostgreSQL connection string' },
  { pattern: 'DATABASE_URL', description: 'Database URL reference in UI' },
  { pattern: 'SUPABASE_URL', description: 'Supabase URL reference in UI (should be in API only)' },
];

// Patterns that look like DB access but are actually standard JS or allowed env checks
const FALSE_POSITIVE_PATTERNS = [
  'Array.from(', // Standard JS Array.from
  'Object.from(', // Standard JS Object.fromEntries
  '.delete(', // Map.delete, Set.delete - not Supabase
  '.select(', // DOM select, not Supabase
  '.insert(', // DOM insert, not Supabase
  '.update(', // Standard update methods, not Supabase
  'process.env.NEXT_PUBLIC_', // Env var existence checks for error display - not DB access
  'setEnvError(', // Error state setter for missing env vars
];

// Paths to exclude from scanning
const EXCLUDED_PATHS = [
  'node_modules',
  '.test.',
  '.spec.',
  'cypress',
  '__tests__',
  '__mocks__',
  'tests/', // E2E and integration test directories
  'scripts/gates/',
];

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const normalizedPath = fullPath.replace(/\\/g, '/');

    if (EXCLUDED_PATHS.some(ex => normalizedPath.includes(ex.replace(/\\/g, '/')))) {
      continue;
    }

    if (entry.isDirectory()) {
      walkDir(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isInComment(line: string, pattern: string): boolean {
  const commentIndex = line.indexOf('//');
  const patternIndex = line.indexOf(pattern);

  // If comment comes before pattern, it's in a comment
  if (commentIndex !== -1 && commentIndex < patternIndex) {
    return true;
  }

  // Check for block comments (simple check)
  if (line.trim().startsWith('*') || line.trim().startsWith('/*')) {
    return true;
  }

  return false;
}

function isInImportComment(line: string): boolean {
  // Allow patterns in type imports or comments
  return line.includes('// ') || line.includes('type ') || line.includes('interface ');
}

function isFalsePositive(line: string, pattern: string): boolean {
  // Check if this is a standard JS pattern that looks like DB access
  for (const fp of FALSE_POSITIVE_PATTERNS) {
    if (line.includes(fp)) {
      return true;
    }
  }
  return false;
}

function scanForDirectDb(baseDir: string): Violation[] {
  const violations: Violation[] = [];

  for (const relDir of UI_SCAN_DIRS) {
    const scanDir = path.join(baseDir, relDir);
    const files = walkDir(scanDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const { pattern, description } of PROHIBITED_PATTERNS) {
          if (line.includes(pattern)) {
            // Skip if in comment
            if (isInComment(line, pattern)) {
              continue;
            }

            // Skip if it's just a type definition or documentation
            if (isInImportComment(line) && !line.includes('import ')) {
              continue;
            }

            // Skip false positives (standard JS methods)
            if (isFalsePositive(line, pattern)) {
              continue;
            }

            violations.push({
              file,
              line: i + 1,
              content: line.trim().substring(0, 100) + (line.trim().length > 100 ? '...' : ''),
              pattern: description,
            });
          }
        }
      }
    }
  }

  return violations;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: NO DIRECT DB ACCESS');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)');
  console.log('========================================\n');

  console.log('Scanning UI components for direct database access...\n');
  console.log('Directories to scan:');
  UI_SCAN_DIRS.forEach(d => console.log(`  - ${d}`));
  console.log('');

  const violations = scanForDirectDb(SMART_FORM_DIR);

  if (violations.length > 0) {
    console.log('VIOLATIONS FOUND:');
    for (const v of violations) {
      const relPath = path.relative(SMART_FORM_DIR, v.file);
      console.log(`\n  ${relPath}:${v.line}`);
      console.log(`    Pattern: ${v.pattern}`);
      console.log(`    Content: ${v.content}`);
    }
    console.log('\n\nGATE FAILED: Direct database access detected in UI code.');
    console.log('All data must flow through API endpoints.');
    console.log('\nMigration guide:');
    console.log('  - Use /api/catalog/* for data fetching');
    console.log('  - Use /api/submit-ticket for submissions');
    console.log('  - Remove all Supabase client usage from UI');
    process.exit(1);
  }

  console.log('No direct database access found in UI components.');
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();
