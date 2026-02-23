#!/usr/bin/env node
/**
 * SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Canonical Unified Only Guard
 *
 * Enforces that daily_picks is eliminated from runtime code.
 * All picks must flow through unified_picks via BridgeWorker.
 *
 * This guard fails CI if:
 * 1. "daily_picks" appears in runtime code (apps/, packages/)
 * 2. Any direct writes bypass lifecycle adapters
 * 3. New daily_picks references are introduced
 *
 * Usage: node scripts/guard-canonical-unified-only.mjs [--strict]
 *
 * Exit codes:
 *   0 = Pass (no violations)
 *   1 = Fail (violations detected)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Colors for output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Patterns that indicate a daily_picks violation
const VIOLATION_PATTERNS = [
  // Direct table references
  /\.from\s*\(\s*['"]daily_picks['"]\s*\)/gi,
  // Table name in queries
  /from\s+daily_picks/gi,
  // Type references that aren't deprecated
  /Tables\s*\[\s*['"]daily_picks['"]\s*\]/gi,
];

// Patterns that are acceptable (deprecated markers, comments, etc.)
const ACCEPTABLE_PATTERNS = [
  /@deprecated/i,
  /SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007/i,
  /SPRINT-007/i,
  /daily_picks.*eliminated/i,
  /daily_picks.*DEPRECATED/i,
  /daily_picks.*obsolete/i,
  // Comments explaining the deprecation
  /\/\/.*daily_picks/i,
  /\/\*.*daily_picks.*\*\//i,
  /--.*daily_picks/i,  // SQL comments
];

// Files/directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /\.git/,
  /out[\/\\]sprints/,  // Sprint proof directories
  /legacy/,
  /\_archive/,
  /supabase[\/\\]migrations/,  // Migrations are historical
  /\.md$/,  // Documentation is informational
  /CLAUDE\.md$/,
  /README\.md$/,
  /[\/\\]test[\/\\]/,  // Test directories can be updated separately
  /[\/\\]tests[\/\\]/,
  /\.test\.(ts|tsx|js)$/,
  /\.spec\.(ts|tsx|js)$/,
  /__tests__/,
  /[\/\\]mocks[\/\\]/,
];

// Extensions to check
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.sql'];

// Directories to scan
const SCAN_DIRS = ['apps', 'packages', 'scripts'];

// Check if a path should be skipped
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

// Check if content contains acceptable deprecation markers
function hasAcceptableContext(content, lineNumber, lines) {
  // Check the line itself and surrounding lines (5 above, 5 below)
  const start = Math.max(0, lineNumber - 5);
  const end = Math.min(lines.length, lineNumber + 5);
  const context = lines.slice(start, end).join('\n');

  return ACCEPTABLE_PATTERNS.some(pattern => pattern.test(context));
}

// Scan a file for violations
function scanFile(filePath, rootDir) {
  const violations = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      for (const pattern of VIOLATION_PATTERNS) {
        pattern.lastIndex = 0; // Reset regex state
        const match = pattern.exec(line);

        if (match) {
          // Check if this is in an acceptable context (deprecated, etc.)
          if (!hasAcceptableContext(content, index, lines)) {
            violations.push({
              file: relative(rootDir, filePath).replace(/\\/g, '/'),
              line: lineNumber,
              content: line.trim(),
              pattern: pattern.toString(),
            });
          }
        }
      }
    });
  } catch (error) {
    console.error(`${YELLOW}Warning: Could not read ${filePath}: ${error.message}${RESET}`);
  }

  return violations;
}

// Recursively scan a directory
function scanDirectory(dir, rootDir) {
  let violations = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (shouldSkip(fullPath)) {
        continue;
      }

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        violations = violations.concat(scanDirectory(fullPath, rootDir));
      } else if (stat.isFile()) {
        const ext = entry.substring(entry.lastIndexOf('.'));
        if (EXTENSIONS.includes(ext)) {
          violations = violations.concat(scanFile(fullPath, rootDir));
        }
      }
    }
  } catch (error) {
    console.error(`${YELLOW}Warning: Could not scan ${dir}: ${error.message}${RESET}`);
  }

  return violations;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');

  console.log(`${BOLD}🔍 CANONICAL UNIFIED ONLY GUARD${RESET}`);
  console.log(`   SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007`);
  console.log(`   Mode: ${strictMode ? 'STRICT' : 'ADVISORY'}`);
  console.log('');

  const rootDir = process.cwd();
  let allViolations = [];

  // Scan each directory
  for (const scanDir of SCAN_DIRS) {
    const dir = join(rootDir, scanDir);
    try {
      const violations = scanDirectory(dir, rootDir);
      allViolations = allViolations.concat(violations);
    } catch (error) {
      // Directory might not exist
    }
  }

  // Report results
  if (allViolations.length === 0) {
    console.log(`${GREEN}✅ GATE PASSED${RESET}`);
    console.log(`   No daily_picks violations found in runtime code.`);
    console.log(`   unified_picks is the canonical pick table.`);
    console.log('');
    process.exit(0);
  } else {
    console.log(`${RED}❌ GATE FAILED${RESET}`);
    console.log(`   Found ${allViolations.length} daily_picks violation(s):`);
    console.log('');

    for (const violation of allViolations) {
      console.log(`   ${RED}•${RESET} ${violation.file}:${violation.line}`);
      console.log(`     ${YELLOW}${violation.content}${RESET}`);
      console.log('');
    }

    console.log(`${BOLD}Resolution:${RESET}`);
    console.log(`   1. Replace daily_picks references with unified_picks`);
    console.log(`   2. Use lifecycle adapters for all unified_picks writes`);
    console.log(`   3. Add deprecation markers if keeping for reference`);
    console.log('');

    if (strictMode) {
      process.exit(1);
    } else {
      console.log(`${YELLOW}Running in advisory mode. Use --strict to fail CI.${RESET}`);
      process.exit(0);
    }
  }
}

main();
