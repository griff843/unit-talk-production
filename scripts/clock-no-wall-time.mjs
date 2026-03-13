#!/usr/bin/env node
/**
 * NO-WALL-TIME CLOCK ENFORCEMENT GATE
 * Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R1
 *
 * Scans the governed lifecycle pipeline surfaces for direct wall-clock access
 * (Date.now() / new Date()) that should instead use resolveNow(clock).
 *
 * Governed scope:
 *   apps/api/src/lib/lifecycle/write-adapter.ts
 *   apps/api/src/lib/lifecycle/idempotency.ts
 *   apps/api/src/lib/verification/**\/*.ts  (must never use wall clock directly)
 *
 * Allowed exceptions (will not be flagged):
 *   - clock.ts itself (the sole authorised wall-clock location)
 *   - null-notification.ts (records suppressed-at for proof only, non-lifecycle)
 *   - Any line containing "// WALL-CLOCK-ALLOWED:" annotation
 *   - Audit ID generation (Date.now() in traceId/auditId string concat)
 *   - Test files (**\/__tests__/**\/*.ts)
 *
 * Exit codes:
 *   0 — PASS: no unguarded wall-clock access in governed scope
 *   1 — FAIL: violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

/** Files that MUST be scanned — violations here are blocking. */
const GOVERNED_FILES = [
  'apps/api/src/lib/lifecycle/write-adapter.ts',
  'apps/api/src/lib/lifecycle/idempotency.ts',
];

/** Directories scanned recursively — violations in .ts files (non-test) are blocking. */
const GOVERNED_DIRS = [
  'apps/api/src/lib/verification',
];

/** Files where wall-clock is explicitly allowed (canonical exceptions). */
const ALLOWED_FILES = new Set([
  'apps/api/src/lib/verification/clock.ts',                          // sole authorised wall-clock location
  'apps/api/src/lib/verification/adapters/null-notification.ts',     // non-lifecycle audit timestamps
  'apps/api/src/lib/verification/adapters/recording-publish.ts',     // non-production adapter, internal receipt timestamps only
  'apps/api/src/lib/verification/adapters/recording-recap.ts',       // non-production adapter, internal receipt timestamps only
  'apps/api/src/lib/verification/adapters/null-recap.ts',            // non-production adapter, internal timestamps only
  'apps/api/src/lib/verification/event-store.ts',                    // producedAt is event record metadata, non-lifecycle
  'apps/api/src/lib/verification/production-event-recorder.ts',      // producedAt delegated to event-store, fail-open observer
  'apps/api/src/lib/verification/replay-proof-writer.ts',            // proof bundle metadata timestamps, non-lifecycle
  'apps/api/src/lib/verification/replay-orchestrator.ts',            // run startedAt/completedAt metadata, non-lifecycle
  'apps/api/src/scripts/run-replay.ts',                              // CLI script, wall clock used only for run ID and metadata
  'apps/api/src/lib/verification/shadow-orchestrator.ts',            // run startedAt/completedAt metadata, non-lifecycle
  'apps/api/src/lib/verification/shadow-comparator.ts',              // divergence detectedAt/generatedAt metadata, non-lifecycle
  'apps/api/src/lib/verification/shadow-proof-writer.ts',            // proof bundle metadata timestamps, non-lifecycle
  'apps/api/src/scripts/run-shadow.ts',                              // CLI script, wall clock used only for run ID and metadata
  'apps/api/src/lib/verification/shadow/shadow-runner.ts',           // run startedAt/completedAt metadata + alert timestamp, non-lifecycle
  'apps/api/src/lib/verification/shadow/shadow-proof-writer.ts',     // proof bundle metadata timestamps, non-lifecycle
  'apps/api/src/lib/verification/shadow/shadow-verdict.ts',          // verdict generatedAt metadata, non-lifecycle
  'apps/api/src/scripts/run-shadow-guardrails.ts',                   // CLI script, wall clock used only for run ID and metadata
]);

// ─────────────────────────────────────────────────────────────
// PATTERNS
// ─────────────────────────────────────────────────────────────

/** Patterns that constitute a wall-clock violation. */
const WALL_CLOCK_PATTERNS = [
  /\bDate\.now\(\)/,
  /\bnew Date\(\)/,
];

/**
 * Patterns on the same line that indicate an ALLOWED exception.
 * These suppress the violation for that line only.
 */
const ALLOWED_LINE_PATTERNS = [
  /\/\/\s*WALL-CLOCK-ALLOWED:/,                  // explicit annotation
  /wallTimeMs\s*[:=]/,                            // advancement log (audit only, in clock.ts)
  /`.*Date\.now\(\).*`/,                          // Date.now() inside template literal (audit IDs)
  /auditId\s*=.*Date\.now\(\)/,                   // audit ID generation (non-lifecycle)
  /traceId.*Date\.now\(\)/,                       // traceId generation (logging, non-lifecycle)
  /resolveNow\(/,                                  // line already uses the clock abstraction
];

// ─────────────────────────────────────────────────────────────
// SCANNER
// ─────────────────────────────────────────────────────────────

function isAllowedLine(line) {
  return ALLOWED_LINE_PATTERNS.some(p => p.test(line));
}

function scanFile(absPath) {
  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isAllowedLine(line)) continue;

    for (const pattern of WALL_CLOCK_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          line: i + 1,
          content: line.trim(),
          pattern: pattern.toString(),
        });
      }
    }
  }

  return violations;
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else if (full.endsWith('.ts') && !full.includes('__tests__') && !full.includes('.spec.')) {
      results.push(full);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

let totalViolations = 0;
const report = [];

console.log('');
console.log('🔍 NO-WALL-TIME CLOCK ENFORCEMENT GATE');
console.log('   Sprint: SPRINT-VERIFICATION-SIMULATION-LAYER-R1');
console.log('');

// Collect all files to scan
const filesToScan = [];

for (const rel of GOVERNED_FILES) {
  filesToScan.push({ abs: resolve(repoRoot, rel), rel });
}

for (const dir of GOVERNED_DIRS) {
  const absDir = resolve(repoRoot, dir);
  try {
    for (const abs of walkDir(absDir)) {
      const rel = relative(repoRoot, abs).replace(/\\/g, '/');
      filesToScan.push({ abs, rel });
    }
  } catch {
    console.log(`   ⚠ Dir not found (may not exist yet): ${dir}`);
  }
}

for (const { abs, rel } of filesToScan) {
  const isAllowedFile = ALLOWED_FILES.has(rel);

  let violations;
  try {
    violations = isAllowedFile ? [] : scanFile(abs);
  } catch (err) {
    console.log(`   ⚠ Could not scan ${rel}: ${err.message}`);
    continue;
  }

  if (violations.length > 0) {
    totalViolations += violations.length;
    report.push({ rel, violations });
    console.log(`   ❌ VIOLATION: ${rel}`);
    for (const v of violations) {
      console.log(`      Line ${v.line}: ${v.content}`);
    }
  } else {
    const tag = isAllowedFile ? '(allowed exception)' : '';
    console.log(`   ✅ CLEAN: ${rel} ${tag}`);
  }
}

console.log('');
console.log('📊 Results:');
console.log(`   Files scanned:   ${filesToScan.length}`);
console.log(`   Violations:      ${totalViolations}`);
console.log('');

if (totalViolations > 0) {
  console.log('❌ GATE FAILED — Direct wall-clock access in governed pipeline scope.');
  console.log('   Fix: Replace Date.now() / new Date() with resolveNow(context.clock)');
  console.log('   Reference: apps/api/src/lib/verification/clock.ts');
  process.exit(1);
} else {
  console.log('✅ GATE PASSED — No unguarded wall-clock access in governed scope.');
  process.exit(0);
}
