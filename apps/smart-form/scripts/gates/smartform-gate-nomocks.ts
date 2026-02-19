#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036
 * Gate: No Mock Data
 *
 * Scans smart form runtime code for prohibited mock patterns.
 * Fails build if hardcoded mock data is found.
 *
 * Usage: npm run smartform:gate:nomocks
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// Patterns that indicate mock data (PROHIBITED in runtime)
const PROHIBITED_PATTERNS = [
  'fallback-1',
  'fallback-2',
  'fallback-3',
  'Mike Johnson',
  'Sarah Wilson',
  'David Chen',
  'Lisa Martinez',
  'sampleData',
  'demoData',
  'MOCK_TEAMS',
  'MOCK_PLAYERS',
  'MOCK_GAMES',
  'mockGames',
  'mockPlayers',
  'mockTeams',
];

// Paths to exclude from scanning (normalized to forward slashes)
const EXCLUDED_PATHS = [
  '.spec.',
  '.test.',
  'cypress',
  'jest.',
  '__tests__',
  '__mocks__',
  'scripts/gates', // This file itself
  'node_modules',
];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

function walkDir(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // Normalize to forward slashes for comparison
    const normalizedPath = fullPath.replace(/\\/g, '/');

    // Check exclusions
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

function scanFileForPatterns(filePath: string, patterns: string[]): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const pattern of patterns) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern,
          content: lines[i].trim().slice(0, 100),
        });
      }
    }
  }

  return violations;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: NO MOCK DATA');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036');
  console.log('========================================\n');

  const files = walkDir(SMART_FORM_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const fileViolations = scanFileForPatterns(file, PROHIBITED_PATTERNS);
    violations.push(...fileViolations);
  }

  if (violations.length > 0) {
    console.log('VIOLATIONS FOUND:\n');
    for (const v of violations) {
      console.log(`  File: ${v.file}`);
      console.log(`  Line: ${v.line}`);
      console.log(`  Pattern: ${v.pattern}`);
      console.log(`  Content: ${v.content}`);
      console.log('');
    }
    console.log(`\nTotal violations: ${violations.length}`);
    console.log('\nGATE FAILED: Mock data found in runtime code.');
    console.log('Per SMART_FORM_PRODUCT_SPEC_V1.1, all data must come from DB.');
    process.exit(1);
  }

  console.log('No prohibited mock patterns found.');
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();
