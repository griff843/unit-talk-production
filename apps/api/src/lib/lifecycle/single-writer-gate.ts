/**
 * SINGLE-WRITER GATE
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * CI gate that scans for unauthorized writes to unified_picks.
 * Ensures all writes go through lifecycle-validated adapters.
 */

import * as fs from 'fs';
import * as path from 'path';
import { isFileAllowlisted, getAllowlistEntry, getAllowlistCount } from './single-writer-allowlist';

// ============================================================
// TYPES
// ============================================================

interface WriteViolation {
  file: string;
  line: number;
  content: string;
  reason: string;
}

interface GateResult {
  passed: boolean;
  violations: WriteViolation[];
  allowedWrites: number;
  totalWritesScanned: number;
}

// ============================================================
// ALLOWED WRITE PATTERNS
// ============================================================

/**
 * Patterns that are ALLOWED - writes through lifecycle adapters
 * LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Expanded test/dev utility exemptions
 */
const ALLOWED_PATTERNS = [
  // Lifecycle write adapter functions
  /lifecycleInsert\s*\(/,
  /lifecycleUpdate\s*\(/,
  /lifecycleClaimForPosting\s*\(/,
  /lifecycleSettle\s*\(/,
  // Idempotency adapter functions
  /atomicClaimForPost\s*\(/,
  /atomicClaimParlayForPost\s*\(/,
  /atomicClaimForSettle\s*\(/,
  // Test files are allowed to bypass
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /__tests__\//,
  // Migration files
  /migrations\//,
  // The lifecycle module itself
  /lib\/lifecycle\//,
  // Scripts explicitly marked as admin
  /scripts\/admin\//,
  // Smoke tests and development runners (test utilities)
  // Handle both forward and back slashes for cross-platform compatibility
  /scripts[/\\]smoke-/,
  /runner[/\\]fix/,
];

/**
 * Patterns that indicate unauthorized direct writes
 */
const UNAUTHORIZED_PATTERNS = [
  // Direct Supabase writes to unified_picks
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*insert\s*\(/,
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*update\s*\(/,
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*upsert\s*\(/,
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*delete\s*\(/,
];

// ============================================================
// SCANNER
// ============================================================

function isAllowedFile(filePath: string): boolean {
  // Check structural patterns first (tests, migrations, etc.)
  if (ALLOWED_PATTERNS.some((pattern) => pattern.test(filePath))) {
    return true;
  }
  // Check explicit allowlist for legacy code awaiting migration
  return isFileAllowlisted(filePath);
}

function scanFile(filePath: string): WriteViolation[] {
  const violations: WriteViolation[] = [];

  if (isAllowedFile(filePath)) {
    return violations;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of UNAUTHORIZED_PATTERNS) {
      if (pattern.test(line)) {
        // Check if this line also has a lifecycle adapter call (allowed)
        const hasAllowedAdapter = ALLOWED_PATTERNS.some(
          (p) => typeof p === 'object' && p.test(line)
        );

        if (!hasAllowedAdapter) {
          violations.push({
            file: filePath,
            line: lineNumber,
            content: line.trim().substring(0, 100),
            reason: 'Direct write to unified_picks detected. Use lifecycle adapters instead.',
          });
        }
      }
    }
  }

  return violations;
}

function walkDirectory(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (item === 'node_modules' || item === 'dist' || item === '.git') {
        continue;
      }
      files.push(...walkDirectory(fullPath, extensions));
    } else if (extensions.some((ext) => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================
// GATE RUNNER
// ============================================================

export function runSingleWriterGate(rootDir: string): GateResult {
  const files = walkDirectory(rootDir, ['.ts', '.tsx']);
  const violations: WriteViolation[] = [];
  let allowedWrites = 0;

  for (const file of files) {
    const fileViolations = scanFile(file);
    violations.push(...fileViolations);

    // Count allowed writes in lifecycle module
    if (file.includes('lib/lifecycle')) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of UNAUTHORIZED_PATTERNS) {
        const matches = content.match(new RegExp(pattern.source, 'g'));
        if (matches) {
          allowedWrites += matches.length;
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    allowedWrites,
    totalWritesScanned: files.length,
  };
}

// ============================================================
// CLI ENTRY
// ============================================================

if (require.main === module) {
  const rootDir = process.argv[2] || path.join(__dirname, '../../..');
  const strictMode = process.argv.includes('--strict');

  console.log(`\n🔍 SINGLE-WRITER GATE`);
  console.log(`   Scanning: ${rootDir}`);
  console.log(`   Mode: ${strictMode ? 'STRICT (no allowlist)' : 'NORMAL (with allowlist)'}\n`);

  const result = runSingleWriterGate(rootDir);
  const allowlistCount = getAllowlistCount();

  console.log(`📊 Results:`);
  console.log(`   Files scanned: ${result.totalWritesScanned}`);
  console.log(`   Allowed writes (in lifecycle module): ${result.allowedWrites}`);
  console.log(`   Allowlisted files (pending migration): ${allowlistCount}`);
  console.log(`   New violations found: ${result.violations.length}`);

  if (result.violations.length > 0) {
    console.log(`\n❌ VIOLATIONS (new writes outside allowlist):`);
    for (const v of result.violations) {
      console.log(`\n   ${v.file}:${v.line}`);
      console.log(`   > ${v.content}`);
      console.log(`   Reason: ${v.reason}`);
    }
  }

  if (allowlistCount > 0) {
    console.log(`\n⚠️  ALLOWLIST STATUS:`);
    console.log(`   ${allowlistCount} files have legacy writes pending migration.`);
    console.log(`   Run with --strict to fail on allowlisted files too.`);
  }

  const passed = result.passed && (!strictMode || allowlistCount === 0);
  console.log(`\n${passed ? '✅ GATE PASSED' : '❌ GATE FAILED'}\n`);
  process.exit(passed ? 0 : 1);
}
