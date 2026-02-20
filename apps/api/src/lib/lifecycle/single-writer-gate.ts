/**
 * SINGLE-WRITER GATE
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 * Enhanced: SPRINT-SINGLE-WRITER-SETTLEMENT-GUARD-071A (multi-line detection)
 *
 * CI gate that scans for unauthorized writes to unified_picks.
 * Ensures all writes go through lifecycle-validated adapters.
 *
 * CRITICAL FIX (071A): Now detects multi-line patterns where .from() and
 * .insert()/.update() are on different lines.
 */

import * as fs from 'fs';
import * as path from 'path';

import { isFileAllowlisted, getAllowlistCount } from './single-writer-allowlist';

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
 * SPRINT-SINGLE-WRITER-SETTLEMENT-GUARD-071A: Refined path exemptions
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
  // The lifecycle module itself (these ARE the canonical write surfaces)
  /lib[/\\]lifecycle[/\\]/,
  // Scripts explicitly marked as admin
  /scripts[/\\]admin[/\\]/,
  // Smoke tests and development runners (test utilities)
  // Handle both forward and back slashes for cross-platform compatibility
  /scripts[/\\]smoke-/,
  /runner[/\\]/, // All runner scripts are test utilities
  // E2E test scripts
  /scripts[/\\]e2e/,
  /e2e-test-runner/,
];

/**
 * Patterns that indicate unauthorized direct writes (same-line detection)
 */
const UNAUTHORIZED_PATTERNS = [
  // Direct Supabase writes to unified_picks
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*insert\s*\(/,
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*update\s*\(/,
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*upsert\s*\(/,
  /\.from\s*\(\s*['"]unified_picks['"]\s*\)\s*\.\s*delete\s*\(/,
];

/**
 * Maximum lines to look ahead from .from('unified_picks') for write operations
 * SPRINT-SINGLE-WRITER-SETTLEMENT-GUARD-071A: Multi-line detection
 */
const MULTILINE_LOOKAHEAD = 10;

// ============================================================
// SCANNER HELPERS
// ============================================================

const FROM_PATTERN = /\.from\s*\(\s*['"]unified_picks['"]\s*\)/;
const WRITE_OPS_PATTERN = /^\s*\.\s*(insert|update|upsert|delete)\s*\(/;
const SELECT_PATTERN = /\.select\s*\(/;
const CHAIN_CONTINUATION = /^\s*\./;

function isAllowedFile(filePath: string): boolean {
  if (ALLOWED_PATTERNS.some(pattern => pattern.test(filePath))) {
    return true;
  }
  return isFileAllowlisted(filePath);
}

/** Check same-line violations (Pattern 1) */
function checkSameLineViolation(line: string): boolean {
  for (const pattern of UNAUTHORIZED_PATTERNS) {
    if (pattern.test(line)) {
      const hasAdapter = ALLOWED_PATTERNS.some(p => typeof p === 'object' && p.test(line));
      if (!hasAdapter) return true;
    }
  }
  return false;
}

/** Check multi-line chain for write operation */
function findMultiLineWrite(
  lines: string[],
  startIdx: number
): { found: boolean; lineIdx: number; op: string } {
  const maxLook = Math.min(startIdx + 1 + MULTILINE_LOOKAHEAD, lines.length);

  for (let j = startIdx + 1; j < maxLook; j++) {
    const nextLine = lines[j];
    const trimmed = nextLine.trim();

    if (trimmed === '') continue;
    if (!CHAIN_CONTINUATION.test(nextLine) && !trimmed.startsWith('//')) break;
    if (SELECT_PATTERN.test(nextLine)) break;

    const writeMatch = nextLine.match(WRITE_OPS_PATTERN);
    if (writeMatch) {
      return { found: true, lineIdx: j, op: writeMatch[1] };
    }
  }
  return { found: false, lineIdx: -1, op: '' };
}

/** Scan a file for violations - SPRINT-071A enhanced */
function scanFile(filePath: string): WriteViolation[] {
  if (isAllowedFile(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: WriteViolation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: Same-line
    if (checkSameLineViolation(line)) {
      violations.push({
        file: filePath,
        line: i + 1,
        content: line.trim().substring(0, 100),
        reason:
          'Direct write to unified_picks detected (same-line). Use lifecycle adapters instead.',
      });
    }

    // Pattern 2: Multi-line
    if (FROM_PATTERN.test(line) && !SELECT_PATTERN.test(line) && !WRITE_OPS_PATTERN.test(line)) {
      const result = findMultiLineWrite(lines, i);
      if (
        result.found &&
        !violations.some(v => v.file === filePath && v.line === result.lineIdx + 1)
      ) {
        violations.push({
          file: filePath,
          line: i + 1,
          content: `${line.trim()} ... ${lines[result.lineIdx].trim()}`.substring(0, 120),
          reason: `Direct write (multi-line: .from() L${i + 1}, .${result.op}() L${result.lineIdx + 1}). Use lifecycle adapters.`,
        });
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
    } else if (extensions.some(ext => item.endsWith(ext))) {
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

/* eslint-disable no-console */
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
/* eslint-enable no-console */
