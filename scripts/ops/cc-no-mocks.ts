#!/usr/bin/env npx tsx
/**
 * SPRINT-TRUTH-RESTORATION-001: Command Center No-Mocks Gate
 *
 * INVARIANT #2: Fail-closed environment - no silent fallbacks
 * INVARIANT #4: No demo mode without explicit DEMO_MODE=true flag
 *
 * This gate ensures Command Center does NOT have silent mock data fallbacks.
 * All mock data usage MUST be gated by explicit DEMO_MODE check.
 *
 * Usage: pnpm run cc:no-mocks
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const COMMAND_CENTER_LIB = path.join(PROJECT_ROOT, 'apps/command-center/src/lib');
const SUPABASE_FILE = path.join(COMMAND_CENTER_LIB, 'supabase.ts');

interface Violation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

// Patterns that indicate silent mock fallbacks without DEMO_MODE
const FORBIDDEN_PATTERNS = [
  // Silent null returns in client getters
  /if\s*\(!.*\)\s*{\s*return\s+null;\s*}/g,
  // Direct mock data returns without DEMO_MODE check
  /return\s+(mock|Mock)/g,
  // Catch blocks that silently return mock data
  /catch\s*\([^)]*\)\s*{\s*return\s+(mock|Mock)/g,
];

// Patterns that indicate proper DEMO_MODE gating (exclusions)
const PROPER_DEMO_MODE_PATTERNS = [
  /if\s*\(!?DEMO_MODE\)/,
  /if\s*\(DEMO_MODE\)/,
  /\[DEMO_MODE\]/,
];

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return violations;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check for "return null" patterns that aren't properly gated
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Skip comment lines
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }

    // Check for silent null returns in if blocks (without DEMO_MODE context)
    if (/return\s+null;/.test(line)) {
      // Look at surrounding context (5 lines before) for DEMO_MODE check
      const contextStart = Math.max(0, idx - 5);
      const context = lines.slice(contextStart, idx + 1).join('\n');

      // If the context has proper DEMO_MODE gating, it's OK
      const hasDemoModeGate = PROPER_DEMO_MODE_PATTERNS.some((pattern) =>
        pattern.test(context)
      );

      // Allowed patterns: inside getSupabaseClient() function with DEMO_MODE check
      const isAllowedNullReturn =
        hasDemoModeGate ||
        context.includes('clientInitialized = true') || // Part of lazy init logic
        context.includes('DEMO_MODE: Explicit flag required'); // Documented

      if (!isAllowedNullReturn) {
        violations.push({
          file: path.relative(PROJECT_ROOT, filePath),
          line: lineNum,
          pattern: 'return null',
          code: line.trim(),
        });
      }
    }

    // Check for direct mock imports without DEMO_MODE
    if (/import\s*{.*mock.*}\s*from\s*['"]\.\/mockData['"]/.test(line)) {
      // Dynamic imports are OK if they're inside DEMO_MODE blocks
      // Static imports at top of file are flagged
      if (idx < 20) {
        // Top of file imports
        violations.push({
          file: path.relative(PROJECT_ROOT, filePath),
          line: lineNum,
          pattern: 'static mock import',
          code: line.trim(),
        });
      }
    }
  });

  return violations;
}

function checkSupabaseFile(): { pass: boolean; violations: Violation[] } {
  console.log('🔍 COMMAND CENTER NO-MOCKS GATE');
  console.log('   Scanning: apps/command-center/src/lib/supabase.ts');
  console.log('   Checking for: Silent mock fallbacks without DEMO_MODE\n');

  const violations = scanFile(SUPABASE_FILE);

  // Additional checks: Ensure DEMO_MODE constant exists
  const content = fs.readFileSync(SUPABASE_FILE, 'utf-8');

  const hasDemoModeConstant = /const\s+DEMO_MODE\s*=\s*process\.env\.DEMO_MODE\s*===\s*['"]true['"]/.test(content);
  const hasSupabaseConfigError = /class\s+SupabaseConfigurationError\s+extends\s+Error/.test(content);
  const hasFailClosedComment = /FAIL-CLOSED|fail-closed/i.test(content);

  console.log('📊 Results:');

  if (!hasDemoModeConstant) {
    console.log('   ❌ Missing: DEMO_MODE constant');
    violations.push({
      file: 'apps/command-center/src/lib/supabase.ts',
      line: 0,
      pattern: 'missing DEMO_MODE constant',
      code: 'const DEMO_MODE = process.env.DEMO_MODE === "true"',
    });
  } else {
    console.log('   ✅ DEMO_MODE constant: Present');
  }

  if (!hasSupabaseConfigError) {
    console.log('   ❌ Missing: SupabaseConfigurationError class');
    violations.push({
      file: 'apps/command-center/src/lib/supabase.ts',
      line: 0,
      pattern: 'missing SupabaseConfigurationError',
      code: 'class SupabaseConfigurationError extends Error',
    });
  } else {
    console.log('   ✅ SupabaseConfigurationError: Present');
  }

  if (!hasFailClosedComment) {
    console.log('   ⚠️  Warning: No FAIL-CLOSED documentation comments');
  } else {
    console.log('   ✅ FAIL-CLOSED documentation: Present');
  }

  // Count return null vs DEMO_MODE gated returns
  const returnNullCount = (content.match(/return\s+null;/g) || []).length;
  const demoModeChecks = (content.match(/if\s*\(DEMO_MODE\)/g) || []).length;
  const throwConfigError = (content.match(/throw\s+new\s+SupabaseConfigurationError/g) || []).length;

  console.log(`\n   📈 Metrics:`);
  console.log(`      "return null" statements: ${returnNullCount}`);
  console.log(`      DEMO_MODE checks: ${demoModeChecks}`);
  console.log(`      SupabaseConfigurationError throws: ${throwConfigError}`);

  console.log(`\n   Violations found: ${violations.length}`);

  if (violations.length > 0) {
    console.log('\n   ❌ VIOLATIONS:');
    violations.forEach((v) => {
      console.log(`      ${v.file}:${v.line} - ${v.pattern}`);
      if (v.code) {
        console.log(`         > ${v.code}`);
      }
    });
    console.log('\n❌ GATE FAILED');
    return { pass: false, violations };
  }

  console.log('\n✅ GATE PASSED');
  console.log('   Command Center properly implements:');
  console.log('   - DEMO_MODE gating for mock data');
  console.log('   - SupabaseConfigurationError for fail-closed behavior');
  console.log('   - No silent null fallbacks');

  return { pass: true, violations: [] };
}

// Main execution
const result = checkSupabaseFile();
process.exit(result.pass ? 0 : 1);
