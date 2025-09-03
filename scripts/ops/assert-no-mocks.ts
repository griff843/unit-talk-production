#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { glob } from 'glob';

interface MockViolation {
  file: string;
  line: number;
  content: string;
  pattern: string;
  reason: string;
}

interface NoMocksReport {
  ok: boolean;
  timestamp: string;
  violationsCount: number;
  scannedFiles: number;
  violations: MockViolation[];
}

// Patterns that indicate mock/fake/fixture usage
const MOCK_PATTERNS = [
  { pattern: /__mocks__/, reason: 'Mock directory reference' },
  { pattern: /fixtures/, reason: 'Fixture reference' },
  { pattern: /faker/i, reason: 'Faker library usage' },
  { pattern: /msw/i, reason: 'Mock Service Worker usage' },
  { pattern: /\.spec\./, reason: 'Spec file in runtime code' },
  { pattern: /\.test\./, reason: 'Test file in runtime code' },
  { pattern: /mock[A-Z]/, reason: 'Mock variable/function (camelCase)' },
  { pattern: /Mock[A-Z]/, reason: 'Mock class/type (PascalCase)' },
  { pattern: /fake[A-Z]/, reason: 'Fake variable/function (camelCase)' },
  { pattern: /Fake[A-Z]/, reason: 'Fake class/type (PascalCase)' },
  { pattern: /fixture[A-Z]/, reason: 'Fixture variable/function (camelCase)' },
  { pattern: /Fixture[A-Z]/, reason: 'Fixture class/type (PascalCase)' },
  { pattern: /mockData/, reason: 'Mock data reference' },
  { pattern: /fakeData/, reason: 'Fake data reference' },
  { pattern: /testData/, reason: 'Test data in runtime code' },
  { pattern: /stub[A-Z]/, reason: 'Stub variable/function (camelCase)' },
  { pattern: /Stub[A-Z]/, reason: 'Stub class/type (PascalCase)' }
];

// Allowed directories where mocks are permitted
const ALLOWED_MOCK_DIRS = [
  'tests/',
  '__tests__/',
  'test/',
  '.test.',
  '.spec.',
  'mocks/',
  '__mocks__/',
  'fixtures/',
  'qa/',
  'qa-framework/'
];

async function scanForMocks(): Promise<NoMocksReport> {
  const report: NoMocksReport = {
    ok: true,
    timestamp: new Date().toISOString(),
    violationsCount: 0,
    scannedFiles: 0,
    violations: []
  };

  // Scan runtime source files in apps and packages
  const patterns = [
    'apps/**/src/**/*.ts',
    'apps/**/src/**/*.tsx', 
    'apps/**/src/**/*.js',
    'apps/**/src/**/*.jsx',
    'packages/**/src/**/*.ts',
    'packages/**/src/**/*.tsx',
    'packages/**/src/**/*.js',
    'packages/**/src/**/*.jsx',
    // Also scan root level files in apps (like index.ts, etc.)
    'apps/**/*.ts',
    'apps/**/*.tsx',
    'apps/**/*.js',
    'apps/**/*.jsx',
    'packages/**/*.ts',
    'packages/**/*.tsx', 
    'packages/**/*.js',
    'packages/**/*.jsx',
    // Exclude common non-runtime directories
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/.next/**',
    '!**/tests/**',
    '!**/__tests__/**',
    '!**/test/**',
    '!**/*.test.*',
    '!**/*.spec.*',
    '!**/mocks/**',
    '!**/__mocks__/**',
    '!**/fixtures/**',
    '!**/qa/**',
    '!**/qa-framework/**'
  ];

  const files = await glob(patterns, { 
    cwd: process.cwd(),
    absolute: true 
  });

  report.scannedFiles = files.length;

  for (const file of files) {
    const relativePath = relative(process.cwd(), file);
    
    // Double-check that file is not in an allowed directory
    const isInAllowedDir = ALLOWED_MOCK_DIRS.some(dir => 
      relativePath.includes(dir)
    );
    
    if (isInAllowedDir) {
      continue;
    }

    try {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const { pattern, reason } of MOCK_PATTERNS) {
          if (pattern.test(line)) {
            report.violations.push({
              file: relativePath,
              line: i + 1,
              content: line.trim(),
              pattern: pattern.toString(),
              reason
            });
            report.ok = false;
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read file ${relativePath}: ${error}`);
    }
  }

  report.violationsCount = report.violations.length;
  return report;
}

async function main() {
  console.log('🔍 Scanning for mock/fake/fixture usage in runtime code...');
  
  const report = await scanForMocks();
  
  // Ensure output directory exists
  const outDir = join(process.cwd(), 'out', 'ops');
  mkdirSync(outDir, { recursive: true });
  
  // Write main report
  const reportPath = join(outDir, 'no-mocks.report.json');
  writeFileSync(reportPath, JSON.stringify({
    ok: report.ok,
    violationsCount: report.violationsCount,
    timestamp: report.timestamp,
    scannedFiles: report.scannedFiles
  }, null, 2));
  
  // Write violations details if any
  if (report.violations.length > 0) {
    const violationsPath = join(outDir, 'no-mocks.violations.json');
    writeFileSync(violationsPath, JSON.stringify(report.violations, null, 2));
  }
  
  // Log results
  console.log(`\n📊 Mock Usage Scan Results:`);
  console.log(`Files Scanned: ${report.scannedFiles}`);
  console.log(`Overall Status: ${report.ok ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Violations Found: ${report.violationsCount}`);
  
  if (report.violations.length > 0) {
    console.log(`\n❌ Mock/Fake/Fixture violations found in runtime code:`);
    for (const violation of report.violations.slice(0, 10)) { // Show first 10
      console.log(`  ${violation.file}:${violation.line} - ${violation.reason}`);
      console.log(`    ${violation.content}`);
    }
    if (report.violations.length > 10) {
      console.log(`  ... and ${report.violations.length - 10} more violations`);
    }
    console.log(`\n📄 Full violations report: ${join('out', 'ops', 'no-mocks.violations.json')}`);
  }
  
  console.log(`📄 Summary report: ${join('out', 'ops', 'no-mocks.report.json')}`);
  
  process.exit(report.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
