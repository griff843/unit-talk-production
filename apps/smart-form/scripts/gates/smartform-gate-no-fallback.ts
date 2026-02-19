#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Gate: No Fallback
 *
 * Ensures no conditional fallbacks to mock data, hardcoded values,
 * or alternative data sources in error cases.
 *
 * The form must be fail-closed: if data cannot be fetched,
 * show an error - do NOT fall back to mock data.
 *
 * Prohibited patterns:
 * - Fallback to mock data in catch blocks
 * - Default values that bypass API
 * - Silent data coercion
 * - Hardcoded player/team lists
 * - || fallback to non-API data
 *
 * Usage: npm run smartform:gate:no-fallback
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// UI directories to scan
const UI_SCAN_DIRS = [
  'app/submit-ticket/components',
  'components/ui',
  'lib',
];

// Prohibited fallback patterns
const PROHIBITED_PATTERNS = [
  { pattern: 'MOCK_', description: 'Mock constant reference' },
  { pattern: 'mockData', description: 'Mock data variable' },
  { pattern: 'FALLBACK_', description: 'Fallback constant' },
  { pattern: 'fallbackData', description: 'Fallback data variable' },
  { pattern: 'defaultPlayers', description: 'Default players list' },
  { pattern: 'defaultTeams', description: 'Default teams list' },
  { pattern: 'hardcodedPlayers', description: 'Hardcoded players' },
  { pattern: 'hardcodedTeams', description: 'Hardcoded teams' },
  { pattern: 'CAPPER_OPTIONS', description: 'Hardcoded capper options (deprecated)' },
  { pattern: 'TEAM_OPTIONS', description: 'Hardcoded team options' },
  { pattern: 'PLAYER_OPTIONS', description: 'Hardcoded player options' },
  { pattern: 'SPORT_OPTIONS', description: 'Hardcoded sport options (use registry)' },
];

// Risky patterns that need context review
const RISKY_PATTERNS = [
  { pattern: '|| []', description: 'Empty array fallback (check if masking API error)' },
  { pattern: '?? []', description: 'Nullish coalescing to empty array (check context)' },
  { pattern: 'catch (', description: 'Error catch block (verify no mock fallback)' },
  { pattern: '.catch(', description: 'Promise catch (verify no mock fallback)' },
];

// Paths to exclude from scanning
const EXCLUDED_PATHS = [
  'node_modules',
  '.test.',
  '.spec.',
  'cypress',
  '__tests__',
  '__mocks__',
  'scripts/gates/',
];

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
  severity: 'error' | 'warning';
}

function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const normalizedPath = fullPath.replace(/\\/g, '/');

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

function isInComment(line: string, pattern: string): boolean {
  const commentIndex = line.indexOf('//');
  const patternIndex = line.indexOf(pattern);

  if (commentIndex !== -1 && commentIndex < patternIndex) {
    return true;
  }

  if (line.trim().startsWith('*') || line.trim().startsWith('/*')) {
    return true;
  }

  return false;
}

function scanForFallbacks(baseDir: string): Violation[] {
  const violations: Violation[] = [];

  for (const relDir of UI_SCAN_DIRS) {
    const scanDir = path.join(baseDir, relDir);
    const files = walkDir(scanDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check prohibited patterns (errors)
        for (const { pattern, description } of PROHIBITED_PATTERNS) {
          if (line.includes(pattern)) {
            if (isInComment(line, pattern)) {
              continue;
            }

            violations.push({
              file,
              line: i + 1,
              content: line.trim().substring(0, 100) + (line.trim().length > 100 ? '...' : ''),
              pattern: description,
              severity: 'error',
            });
          }
        }

        // Check risky patterns (warnings - for manual review)
        // Only flag if they look like they might be masking errors
        for (const { pattern, description } of RISKY_PATTERNS) {
          if (line.includes(pattern)) {
            if (isInComment(line, pattern)) {
              continue;
            }

            // Check if it's a legitimate API error handling or potential fallback
            const isSuspicious =
              (pattern === '|| []' && line.includes('data')) ||
              (pattern === '?? []' && line.includes('data')) ||
              (pattern.includes('catch') && (
                lines[i + 1]?.includes('return []') ||
                lines[i + 1]?.includes('= []') ||
                lines[i + 2]?.includes('return []') ||
                lines[i + 2]?.includes('= []')
              ));

            if (isSuspicious) {
              violations.push({
                file,
                line: i + 1,
                content: line.trim().substring(0, 100) + (line.trim().length > 100 ? '...' : ''),
                pattern: description,
                severity: 'warning',
              });
            }
          }
        }
      }
    }
  }

  return violations;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: NO FALLBACK');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)');
  console.log('========================================\n');

  console.log('Scanning for fallback patterns that bypass API...\n');
  console.log('Directories to scan:');
  UI_SCAN_DIRS.forEach(d => console.log(`  - ${d}`));
  console.log('');

  const violations = scanForFallbacks(SMART_FORM_DIR);

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (warnings.length > 0) {
    console.log('WARNINGS (manual review recommended):');
    for (const v of warnings) {
      const relPath = path.relative(SMART_FORM_DIR, v.file);
      console.log(`\n  ${relPath}:${v.line}`);
      console.log(`    Pattern: ${v.pattern}`);
      console.log(`    Content: ${v.content}`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log('VIOLATIONS FOUND:');
    for (const v of errors) {
      const relPath = path.relative(SMART_FORM_DIR, v.file);
      console.log(`\n  ${relPath}:${v.line}`);
      console.log(`    Pattern: ${v.pattern}`);
      console.log(`    Content: ${v.content}`);
    }
    console.log('\n\nGATE FAILED: Fallback patterns detected.');
    console.log('The form must be fail-closed: show errors, not mock data.');
    console.log('\nMigration guide:');
    console.log('  - Remove all MOCK_* and fallback* constants');
    console.log('  - Replace || [] with proper error handling');
    console.log('  - Show error UI when API fails');
    process.exit(1);
  }

  console.log(`No prohibited fallback patterns found. (${warnings.length} warnings for review)`);
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();
