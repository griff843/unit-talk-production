#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Gate: No Dev Routes
 *
 * Ensures no UI runtime code references /api/dev/* endpoints.
 * Dev routes are NOT in spec and must not be used in production.
 *
 * Usage: npm run smartform:gate:no-dev-routes
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// Pattern to detect dev route usage
const DEV_ROUTE_PATTERNS = [
  { pattern: '/api/dev/', description: 'Dev route reference' },
  { pattern: 'api/dev/', description: 'Dev route reference (relative)' },
  { pattern: '/dev/simulate', description: 'Dev simulation endpoint' },
];

// Paths to exclude from scanning
const EXCLUDED_PATHS = [
  'node_modules',
  '.test.',
  '.spec.',
  'cypress',
  '__tests__',
  '__mocks__',
  'scripts/gates/',
  'app/api/dev/', // The dev route implementation itself is OK
];

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

function walkDir(dir: string, files: string[] = []): string[] {
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

function hasNodeEnvGuard(content: string, lineIndex: number): boolean {
  // Check if there's a NODE_ENV production guard within 10 lines before
  const lines = content.split('\n');
  const startLine = Math.max(0, lineIndex - 10);

  for (let i = startLine; i < lineIndex; i++) {
    const line = lines[i];
    if (line.includes("process.env.NODE_ENV") &&
        (line.includes("'production'") || line.includes('"production"'))) {
      return true;
    }
  }
  return false;
}

function scanForDevRoutes(dir: string): Violation[] {
  const violations: Violation[] = [];
  const files = walkDir(dir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }

      for (const { pattern, description } of DEV_ROUTE_PATTERNS) {
        if (line.includes(pattern)) {
          // V1.1 HARDENED: Allow dev routes if properly guarded by NODE_ENV
          if (hasNodeEnvGuard(content, i)) {
            continue;
          }

          violations.push({
            file,
            line: i + 1,
            content: line.trim(),
            pattern: description,
          });
        }
      }
    }
  }

  return violations;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: NO DEV ROUTES');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)');
  console.log('========================================\n');

  console.log('Scanning for /api/dev/* references in UI code...\n');

  const violations = scanForDevRoutes(SMART_FORM_DIR);

  if (violations.length > 0) {
    console.log('VIOLATIONS FOUND:');
    for (const v of violations) {
      const relPath = path.relative(SMART_FORM_DIR, v.file);
      console.log(`\n  ${relPath}:${v.line}`);
      console.log(`    Pattern: ${v.pattern}`);
      console.log(`    Content: ${v.content}`);
    }
    console.log('\n\nGATE FAILED: Dev route references found in UI code.');
    console.log('/api/dev/* endpoints are NOT in spec and must be removed.');
    process.exit(1);
  }

  console.log('No dev route references found in UI code.');
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();
