#!/usr/bin/env npx tsx
/**
 * Canonical Schema Audit Script
 *
 * PURPOSE: Detect write operations targeting the 'picks' VIEW which should be read-only.
 *
 * CANONICAL RULES:
 * 1. unified_picks is the ONLY writable pick table
 * 2. picks is a READ-ONLY VIEW over unified_picks
 * 3. pick_publish.pick_id FK references unified_picks(id)
 * 4. All writes MUST target unified_picks, NOT picks
 *
 * ALLOWED EXCEPTIONS:
 * - scripts/phase6-e2e-validation.ts (intentional test to verify picks VIEW blocks writes)
 *
 * EXIT CODES:
 * - 0: All checks passed
 * - 1: Violations found (blocks CI)
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');

// Files that are ALLOWED to write to picks (for testing purposes only)
const ALLOWED_EXCEPTIONS = [
  'scripts/phase6-e2e-validation.ts', // Intentional test that writes should be blocked
  'scripts/audit/canonical-schema-audit.ts', // This script contains documentation examples
];

// Directories to scan for violations
const SCAN_DIRS = [
  'apps',
  'packages',
  'scripts',
];

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
];

interface Violation {
  file: string;
  line: number;
  operation: string;
  content: string;
}

function scanFile(filePath: string, relativePath: string): Violation[] {
  const violations: Violation[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Pattern to find write operations targeting picks
    const pattern = /\.from\(['"]picks['"]\)\.\s*(insert|update|upsert|delete)/;

    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        // Check if file is in allowed exceptions
        const isAllowed = ALLOWED_EXCEPTIONS.some(exception =>
          relativePath.includes(exception) || relativePath.endsWith(exception)
        );

        if (!isAllowed) {
          violations.push({
            file: relativePath,
            line: index + 1,
            operation: match[1].toUpperCase(),
            content: line.trim(),
          });
        }
      }
    });
  } catch (error) {
    // Skip files that can't be read
  }

  return violations;
}

function scanDirectory(dir: string, relativePath: string = ''): Violation[] {
  const violations: Violation[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name)) {
          violations.push(...scanDirectory(fullPath, relPath));
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        violations.push(...scanFile(fullPath, relPath));
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }

  return violations;
}

function runAudit(): Violation[] {
  const violations: Violation[] = [];

  console.log('='.repeat(70));
  console.log('CANONICAL SCHEMA AUDIT');
  console.log('='.repeat(70));
  console.log('\nScanning repository for picks write operations...\n');

  for (const scanDir of SCAN_DIRS) {
    const fullPath = path.join(REPO_ROOT, scanDir);
    if (fs.existsSync(fullPath)) {
      console.log(`Scanning ${scanDir}/...`);
      violations.push(...scanDirectory(fullPath, scanDir));
    }
  }

  return violations;
}

function printResults(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log('\n' + '='.repeat(70));
    console.log('AUDIT PASSED');
    console.log('='.repeat(70));
    console.log('\nAll write operations correctly target unified_picks (canonical).');
    console.log('\nCanonical Schema Rules:');
    console.log('  - unified_picks is the ONLY writable pick table');
    console.log('  - picks is a READ-ONLY VIEW');
    console.log('  - pick_publish.pick_id references unified_picks(id)');
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`AUDIT FAILED - ${violations.length} VIOLATION(S) FOUND`);
  console.log('='.repeat(70));

  console.log('\nViolations:');
  for (const v of violations) {
    console.log(`\n  [${v.operation}] ${v.file}:${v.line}`);
    console.log(`    Code: ${v.content}`);
    console.log(`    Fix:  Change .from('picks') to .from('unified_picks')`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log('CANONICAL SCHEMA RULES:');
  console.log('-'.repeat(70));
  console.log(`
1. unified_picks is the ONLY writable pick table
2. picks is a READ-ONLY VIEW over unified_picks
3. pick_publish.pick_id FK references unified_picks(id)
4. All writes MUST target unified_picks, NOT picks

To fix violations:
  Change: .from('picks').insert/update/delete(...)
  To:     .from('unified_picks').insert/update/delete(...)

Documentation: docs/CANONICAL_SCHEMA_MIGRATION_REPORT.md
`);
}

// Main execution
const violations = runAudit();
printResults(violations);

if (violations.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
