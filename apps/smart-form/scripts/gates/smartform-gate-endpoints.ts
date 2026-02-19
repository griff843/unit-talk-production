#!/usr/bin/env tsx
/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Gate: SPEC-TRUE Endpoint Compliance
 *
 * STRICT ENFORCEMENT - Only spec-defined endpoints allowed.
 * Reference: SMART_FORM_PRODUCT_SPEC_V1.1
 *
 * APPROVED CATEGORIES:
 * - /api/catalog/*     (Section 2: Canonical Data Source)
 * - /api/registry/*    (Section 7: Prop Type Enforcement)
 * - /api/search        (Section 4: Auto-Normalization)
 * - /api/normalize     (Section 4: Auto-Normalization)
 * - /api/cappers       (Capper selection)
 * - /api/submit-ticket (Core submission)
 * - /api/version       (Section 15: Build Integrity)
 *
 * PROHIBITED:
 * - /api/dev/*         NOT IN SPEC
 * - /api/teams         USE /api/catalog/teams
 * - /api/players       USE /api/catalog/players
 * - /api/props         USE /api/catalog/props
 * - /api/games         USE /api/catalog/games
 * - Any other endpoint NOT explicitly approved
 *
 * Usage: npm run smartform:gate:endpoints
 */

import * as fs from 'fs';
import * as path from 'path';

const SMART_FORM_DIR = path.resolve(__dirname, '../..');

// SPEC-TRUE: Only these endpoint patterns are allowed
const APPROVED_ENDPOINTS = [
  '/api/catalog/',      // All catalog endpoints (teams, players, props, games, leagues)
  '/api/registry/',     // Registry endpoints (stat-types, sports)
  '/api/search',        // Unified search endpoint
  '/api/normalize',     // Normalization endpoint
  '/api/cappers',       // Capper selection
  '/api/submit-ticket', // Core submission
  '/api/version',       // Build/version info
];

// EXPLICITLY PROHIBITED - these are violations
const PROHIBITED_ENDPOINTS = [
  '/api/dev/',          // Dev routes not in spec
  '/api/teams',         // Use /api/catalog/teams
  '/api/players',       // Use /api/catalog/players
  '/api/props',         // Use /api/catalog/props
  '/api/games',         // Use /api/catalog/games
];

// Paths to exclude from scanning
const EXCLUDED_PATHS = [
  'node_modules',
  '.test.',
  '.spec.',
  'cypress',
  '__tests__',
  '__mocks__',
  'scripts/gates/', // Don't scan gate scripts themselves
];

interface EndpointUsage {
  file: string;
  line: number;
  endpoint: string;
  approved: boolean;
  violation?: string;
}

function isProhibited(endpoint: string): string | null {
  for (const prohibited of PROHIBITED_ENDPOINTS) {
    // Check for exact match (not inside catalog path)
    if (endpoint.includes(prohibited) && !endpoint.includes('/api/catalog/')) {
      return `PROHIBITED: ${prohibited} - Use spec-compliant endpoint instead`;
    }
  }
  return null;
}

function isApproved(endpoint: string): boolean {
  return APPROVED_ENDPOINTS.some(ap => endpoint.includes(ap));
}

function extractEndpoints(content: string, filePath: string): EndpointUsage[] {
  const usages: EndpointUsage[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    // Look for fetch calls with string literals
    const fetchMatch = line.match(/fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/);
    if (fetchMatch) {
      const endpoint = fetchMatch[1];
      if (endpoint.includes('/api/')) {
        const violation = isProhibited(endpoint);
        const approved = !violation && isApproved(endpoint);
        usages.push({
          file: filePath,
          line: i + 1,
          endpoint,
          approved,
          violation: violation || undefined,
        });
      }
    }

    // Look for template literal fetch with /api
    const templateMatch = line.match(/fetch\s*\(\s*`([^`]*\/api[^`]*)`/);
    if (templateMatch) {
      const endpoint = templateMatch[1];
      const violation = isProhibited(endpoint);
      const approved = !violation && isApproved(endpoint);

      // Avoid duplicates
      const exists = usages.some(u => u.file === filePath && u.line === i + 1);
      if (!exists) {
        usages.push({
          file: filePath,
          line: i + 1,
          endpoint,
          approved,
          violation: violation || undefined,
        });
      }
    }
  }

  return usages;
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

function scanDirectory(dir: string): EndpointUsage[] {
  const allUsages: EndpointUsage[] = [];
  const files = walkDir(dir);

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const usages = extractEndpoints(content, file);
    allUsages.push(...usages);
  }

  return allUsages;
}

function main() {
  console.log('========================================');
  console.log('SMART FORM GATE: SPEC-TRUE ENDPOINT COMPLIANCE');
  console.log('Sprint: SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)');
  console.log('========================================\n');

  console.log('APPROVED ENDPOINT PATTERNS (spec-defined):');
  APPROVED_ENDPOINTS.forEach(ep => console.log(`  ✓ ${ep}`));
  console.log('');

  console.log('PROHIBITED ENDPOINTS (violations):');
  PROHIBITED_ENDPOINTS.forEach(ep => console.log(`  ✗ ${ep}`));
  console.log('');

  const usages = scanDirectory(SMART_FORM_DIR);
  const violations = usages.filter(u => !u.approved);
  const approved = usages.filter(u => u.approved);

  console.log(`Found ${usages.length} endpoint usages:`);
  console.log(`  Approved: ${approved.length}`);
  console.log(`  Violations: ${violations.length}\n`);

  if (approved.length > 0) {
    console.log('APPROVED ENDPOINTS:');
    for (const u of approved) {
      const relPath = path.relative(SMART_FORM_DIR, u.file);
      console.log(`  ${relPath}:${u.line}`);
      console.log(`    ${u.endpoint}`);
    }
    console.log('');
  }

  if (violations.length > 0) {
    console.log('VIOLATIONS (non-spec endpoints):');
    for (const v of violations) {
      const relPath = path.relative(SMART_FORM_DIR, v.file);
      console.log(`  ${relPath}:${v.line}`);
      console.log(`    ${v.endpoint}`);
      if (v.violation) {
        console.log(`    → ${v.violation}`);
      }
    }
    console.log('\nGATE FAILED: Non-spec endpoint usage found.');
    console.log('Only SMART_FORM_PRODUCT_SPEC_V1.1 defined endpoints allowed.');
    console.log('\nMigration guide:');
    console.log('  /api/teams   → /api/catalog/teams');
    console.log('  /api/players → /api/catalog/players');
    console.log('  /api/props   → /api/catalog/props');
    console.log('  /api/games   → /api/catalog/games');
    console.log('  /api/dev/*   → REMOVE (not in spec)');
    process.exit(1);
  }

  console.log('All endpoints are spec-compliant.');
  console.log('\nGATE PASSED');
  process.exit(0);
}

main();
