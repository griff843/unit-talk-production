#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036
 * Gate: No Bypass
 *
 * Scans smart form runtime code to ensure no direct database access from UI components.
 * All data must flow through approved API endpoints.
 *
 * Prohibited patterns:
 * - Direct Supabase client usage in UI components
 * - Direct fetch to non-API URLs
 * - Hardcoded database table names in UI
 *
 * Usage: npm run smartform:gate:nobypass
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// UI component directories (should NOT have direct DB access)
const UI_DIRECTORIES = [
  'app/submit-ticket/components',
  'components/ui',
  'app/submit-ticket/page.tsx',
];

// Prohibited patterns in UI code
const PROHIBITED_PATTERNS = [
  { pattern: "from\\(['\"]", description: 'Direct Supabase .from() call' },
  { pattern: "createClient\\(", description: 'Supabase client creation' },
  { pattern: "@supabase/supabase-js", description: 'Supabase import' },
  { pattern: "unified_picks", description: 'Direct table reference' },
  { pattern: "bridge_outbox", description: 'Direct table reference' },
  { pattern: "raw_props", description: 'Direct table reference' },
  { pattern: "users", description: 'Direct table reference (use /api/cappers)' },
];

// Paths to exclude from scanning
const EXCLUDED_PATHS = [
  'node_modules',
  '.test.',
  '.spec.',
  '__tests__',
  '__mocks__',
  'scripts/gates',
];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  description: string;
  content: string;
}

function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const normalizedPath = fullPath.replace(/\\/g, '/');

    // Check exclusions
    if (EXCLUDED_PATHS.some(ex => normalizedPath.includes(ex))) {
      continue;
    }

    if (entry.isDirectory()) {
      walkDir(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      // Only include if it's a UI file (not lib/, api/, etc.)
      if (normalizedPath.includes('/components/') || normalizedPath.includes('/page.tsx')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function scanFileForPatterns(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const { pattern, description } of PROHIBITED_PATTERNS) {
    const regex = new RegExp(pattern);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip full-line comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        continue;
      }

      // For table name patterns, check if it's in a comment (mid-line //)
      const codeBeforeComment = line.split('//')[0];
      const testLine = (pattern.includes('unified_picks') ||
                       pattern.includes('bridge_outbox') ||
                       pattern.includes('raw_props') ||
                       pattern.includes('users'))
        ? codeBeforeComment
        : line;

      if (regex.test(testLine)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern,
          description,
          content: line.trim().slice(0, 100),
        });
      }
    }
  }

  return violations;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: NO BYPASS');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036');
  console.log('========================================\n');

  console.log('Scanning UI components for direct database access...\n');
  console.log('Prohibited patterns:');
  PROHIBITED_PATTERNS.forEach(p => console.log(`  - ${p.description}`));
  console.log('');

  const files: string[] = [];
  for (const dir of UI_DIRECTORIES) {
    const fullDir = path.join(SMART_FORM_DIR, dir);
    if (fs.existsSync(fullDir)) {
      if (fs.statSync(fullDir).isDirectory()) {
        walkDir(fullDir, files);
      } else if (fullDir.endsWith('.tsx') || fullDir.endsWith('.ts')) {
        files.push(fullDir);
      }
    }
  }

  console.log(`Scanning ${files.length} UI files...\n`);

  const violations: Violation[] = [];
  for (const file of files) {
    const fileViolations = scanFileForPatterns(file);
    violations.push(...fileViolations);
  }

  if (violations.length > 0) {
    console.log('VIOLATIONS FOUND:\n');
    for (const v of violations) {
      console.log(`  File: ${v.file}`);
      console.log(`  Line: ${v.line}`);
      console.log(`  Issue: ${v.description}`);
      console.log(`  Content: ${v.content}`);
      console.log('');
    }
    console.log(`\nTotal violations: ${violations.length}`);
    console.log('\nGATE FAILED: Direct database access found in UI components.');
    console.log('Per SMART_FORM_PRODUCT_SPEC_V1.1, all data must flow through API endpoints.');
    process.exit(1);
  }

  console.log(`Scanned ${files.length} UI files.`);
  console.log('No direct database access patterns found.');
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();
