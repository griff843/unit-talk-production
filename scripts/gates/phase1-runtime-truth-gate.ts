#!/usr/bin/env npx tsx
/**
 * PHASE1-ENFORCEMENT-LOCK-001: Runtime Truth Gate
 *
 * CI guard to prevent regression on Phase 1 invariants:
 * - No mock/fallback values for required secrets
 * - Binary health (200 only if healthy, not degraded)
 * - Production mode blocked outside Docker
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');

interface Violation {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

const violations: Violation[] = [];

// Patterns that indicate Phase 1 violations
const FORBIDDEN_PATTERNS = [
  // Mock fallback values for secrets
  { pattern: /SUPABASE_URL.*\|\|.*['"]http:\/\/mock/i, name: 'Mock SUPABASE_URL fallback' },
  { pattern: /SUPABASE.*KEY.*\|\|.*['"]mock-/i, name: 'Mock Supabase key fallback' },
  { pattern: /DISCORD_TOKEN.*\|\|.*['"]['"]/, name: 'Empty DISCORD_TOKEN fallback' },
  { pattern: /fallback-secret-for-dev/i, name: 'Dev fallback secret' },
  // Warn-pass health configuration (degraded returns 200)
  { pattern: /status\s*===\s*['"]degraded['"]\s*\?\s*200/, name: 'Warn-pass degraded=200' },
];

// Files to scan
const FILES_TO_SCAN = [
  'apps/api/src/config/env.ts',
  'apps/api/src/config/index.ts',
  'apps/api/src/routes/health.ts',
  'apps/discord-bot/config/index.ts',
  'apps/command-center/src/config/index.ts',
  'apps/command-center/src/app/api/health/route.ts',
];

function scanFile(filePath: string): void {
  const fullPath = path.join(REPO_ROOT, filePath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: index + 1,
          pattern: name,
          content: line.trim().substring(0, 100),
        });
      }
    });
  });
}

function checkDockerContainerEnforcement(): void {
  const entrypoints = ['apps/api/src/index.ts', 'apps/discord-bot/src/index.ts'];

  entrypoints.forEach(filePath => {
    const fullPath = path.join(REPO_ROOT, filePath);
    if (!fs.existsSync(fullPath)) return;

    const content = fs.readFileSync(fullPath, 'utf-8');
    if (!content.includes('DOCKER_CONTAINER')) {
      violations.push({
        file: filePath,
        line: 1,
        pattern: 'Missing DOCKER_CONTAINER enforcement',
        content: 'Entrypoint must check DOCKER_CONTAINER in production',
      });
    }
  });
}

function main(): void {
  console.log('🔍 PHASE1 Runtime Truth Gate');
  console.log('   Scanning for invariant violations...\n');

  // Scan files for forbidden patterns
  FILES_TO_SCAN.forEach(scanFile);

  // Check Docker container enforcement
  checkDockerContainerEnforcement();

  // Report results
  if (violations.length === 0) {
    console.log('✅ PHASE1 GATE PASSED');
    console.log('   No invariant violations detected.\n');
    process.exit(0);
  } else {
    console.error('❌ PHASE1 GATE FAILED');
    console.error(`   Found ${violations.length} violation(s):\n`);

    violations.forEach((v, i) => {
      console.error(`   ${i + 1}. ${v.pattern}`);
      console.error(`      File: ${v.file}:${v.line}`);
      console.error(`      Content: ${v.content}\n`);
    });

    process.exit(1);
  }
}

main();
