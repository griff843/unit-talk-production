#!/usr/bin/env node
/**
 * SPRINT-ARCHITECTURE-HARDENING-002A: Env Proliferation Guard
 *
 * Scans the codebase for process.env access outside of allowed locations.
 * This ensures all env access is centralized and build-safe.
 *
 * Usage: node scripts/guard-env-proliferation.mjs [--strict]
 *
 * Exit codes:
 *   0 = Pass (no violations or only warnings)
 *   1 = Fail (violations found in strict mode)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Configuration
const ALLOWED_PATTERNS = [
  // Config packages are allowed to access process.env
  'packages/config/',
  // Build config files
  'next.config.js',
  'next.config.mjs',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'tsconfig.json',
  '.eslintrc',
  // Scripts are allowed
  'scripts/',
  // Test files
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '__tests__/',
  '__mocks__/',
  // Node modules (skip entirely)
  'node_modules/',
  // Build output (skip entirely)
  'dist/',
  '.next/',
  'out/',
  // Env files (not code)
  '.env',
];

// Patterns that indicate lazy/safe access (inside functions)
const SAFE_PATTERNS = [
  'function get',
  'function getDemoMode',
  'function getEnv',
  '() =>',
  '() {',
  'get()',
];

// Extensions to scan
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

// Colors for output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function isAllowedPath(filePath) {
  // Normalize path separators for cross-platform support
  const normalizedPath = filePath.replace(/\\/g, '/');
  return ALLOWED_PATTERNS.some(pattern => normalizedPath.includes(pattern));
}

function hasExtension(filePath) {
  return EXTENSIONS.some(ext => filePath.endsWith(ext));
}

function isModuleScopeEnvAccess(content, lineNumber, line) {
  // Check if this line is inside a function by looking at context
  const lines = content.split('\n');
  let braceCount = 0;
  let inFunction = false;

  for (let i = 0; i < lineNumber; i++) {
    const currentLine = lines[i];

    // Check for function declarations
    if (/^(export\s+)?(async\s+)?function\s+/.test(currentLine.trim())) {
      inFunction = true;
    }
    if (/^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/.test(currentLine.trim())) {
      inFunction = true;
    }
    if (/constructor\s*\(/.test(currentLine)) {
      inFunction = true;
    }
    if (/^(export\s+)?class\s+/.test(currentLine.trim())) {
      // Class body - methods inside are functions
      inFunction = false;
    }
    if (/(get|set)\s+\w+\s*\(/.test(currentLine)) {
      inFunction = true;
    }

    // Track braces
    const openBraces = (currentLine.match(/{/g) || []).length;
    const closeBraces = (currentLine.match(/}/g) || []).length;
    braceCount += openBraces - closeBraces;

    // If we're back to 0 braces, we're at module scope
    if (braceCount === 0 && i > 0) {
      inFunction = false;
    }
  }

  // Check if current line is at module scope (braceCount near 0)
  // or if it's a const/let/var at module scope
  const isModuleScope = braceCount <= 1;
  const isConstDecl = /^(export\s+)?(const|let|var)\s+/.test(line.trim());

  return isModuleScope && isConstDecl && !inFunction;
}

function scanFile(filePath) {
  const violations = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }

    // Check for process.env access
    if (/process\.env\./.test(line) || /process\.env\[/.test(line)) {
      const lineNumber = index + 1;

      // Check if this is inside a function (safe) or at module scope (violation)
      const isSafe = SAFE_PATTERNS.some(pattern => {
        // Look at surrounding context
        const context = lines.slice(Math.max(0, index - 5), index + 1).join('\n');
        return context.includes(pattern);
      });

      if (!isSafe && isModuleScopeEnvAccess(content, index, line)) {
        violations.push({
          file: filePath,
          line: lineNumber,
          code: line.trim(),
          type: 'module-scope',
        });
      }
    }
  });

  return violations;
}

function walkDir(dir, callback) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);

    try {
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and other excluded dirs
        if (!['node_modules', '.git', 'dist', '.next', 'out'].includes(file)) {
          walkDir(filePath, callback);
        }
      } else if (stat.isFile() && hasExtension(filePath)) {
        callback(filePath);
      }
    } catch (err) {
      // Skip files we can't read
    }
  }
}

function main() {
  const isStrict = process.argv.includes('--strict');
  const rootDir = process.cwd();

  console.log(`${BOLD}ENV PROLIFERATION GUARD${RESET}`);
  console.log(`   Scanning: ${rootDir}`);
  console.log(`   Mode: ${isStrict ? 'STRICT' : 'WARNING'}`);
  console.log('');

  const allViolations = [];
  const allowedFiles = [];
  let scannedFiles = 0;

  walkDir(rootDir, (filePath) => {
    const relativePath = relative(rootDir, filePath);

    // Skip allowed paths
    if (isAllowedPath(relativePath)) {
      allowedFiles.push(relativePath);
      return;
    }

    scannedFiles++;
    const violations = scanFile(filePath);

    if (violations.length > 0) {
      allViolations.push(...violations);
    }
  });

  // Report results
  console.log(`${BOLD}RESULTS${RESET}`);
  console.log(`   Files scanned: ${scannedFiles}`);
  console.log(`   Allowed files skipped: ${allowedFiles.length}`);
  console.log(`   Violations found: ${allViolations.length}`);
  console.log('');

  if (allViolations.length > 0) {
    console.log(`${RED}${BOLD}VIOLATIONS${RESET}`);
    console.log('');

    for (const v of allViolations) {
      const relativePath = relative(rootDir, v.file);
      console.log(`${RED}  ${relativePath}:${v.line}${RESET}`);
      console.log(`     ${v.code}`);
      console.log(`     ${YELLOW}Type: ${v.type} (env access at module scope)${RESET}`);
      console.log('');
    }

    if (isStrict) {
      console.log(`${RED}${BOLD}GATE FAILED${RESET}`);
      console.log('   Module-scope process.env access detected.');
      console.log('   Move env access into functions or use @unit-talk/config.');
      process.exit(1);
    } else {
      console.log(`${YELLOW}${BOLD}GATE WARNING${RESET}`);
      console.log('   Run with --strict to fail on violations.');
      process.exit(0);
    }
  } else {
    console.log(`${GREEN}${BOLD}GATE PASSED${RESET}`);
    console.log('   No module-scope env proliferation detected.');
    process.exit(0);
  }
}

main();
