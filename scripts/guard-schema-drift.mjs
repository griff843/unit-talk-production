#!/usr/bin/env node
/**
 * SPRINT-ARCHITECTURE-HARDENING-002A: Schema Drift Guard
 *
 * Validates that Supabase types match the expected schema.
 * Detects drift between generated types and schema expectations.
 *
 * Usage: node scripts/guard-schema-drift.mjs
 *
 * Exit codes:
 *   0 = Pass (no drift detected)
 *   1 = Fail (drift detected or types missing)
 */

import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

// Colors for output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Expected canonical tables (from SYSTEM_INVARIANTS.md)
const CANONICAL_TABLES = [
  'unified_picks',
  'bridge_outbox',
  'agent_health',
  'prop_settlements',
  'users',
  'raw_props',
  'games',
  'players',
  'closing_snapshots',
];

// Paths to check for generated types
const TYPE_PATHS = [
  'packages/shared-types/src/supabase.ts',
  'packages/shared-types/src/database.ts',
  'apps/api/src/types/supabase.ts',
  'apps/command-center/src/types/database.ts',
];

function findTypesFile(rootDir) {
  for (const typePath of TYPE_PATHS) {
    const fullPath = join(rootDir, typePath);
    if (existsSync(fullPath)) {
      return { path: typePath, fullPath };
    }
  }
  return null;
}

function extractTablesFromTypes(content) {
  // Extract table names from Supabase generated types
  // Pattern: Tables: { tableName: { Row: ...
  const tablePattern = /Tables:\s*{([^}]+(?:{[^}]*}[^}]*)*)}/s;
  const match = content.match(tablePattern);

  if (!match) {
    // Try alternative pattern for different type structures
    const altPattern = /from\(['"](\w+)['"]\)/g;
    const tables = new Set();
    let altMatch;
    while ((altMatch = altPattern.exec(content)) !== null) {
      tables.add(altMatch[1]);
    }
    return Array.from(tables);
  }

  const tablesBlock = match[1];
  const tableNames = [];
  const tablePattern2 = /(\w+):\s*{/g;
  let tableMatch;

  while ((tableMatch = tablePattern2.exec(tablesBlock)) !== null) {
    // Skip Row, Insert, Update which are nested objects
    if (!['Row', 'Insert', 'Update', 'Relationships'].includes(tableMatch[1])) {
      tableNames.push(tableMatch[1]);
    }
  }

  return tableNames;
}

function hashContent(content) {
  // Normalize content for consistent hashing
  const normalized = content
    .replace(/\s+/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\/\/.*/g, '')
    .trim();

  return createHash('sha256').update(normalized).digest('hex').substring(0, 12);
}

function checkDrift(rootDir) {
  const results = {
    typesFound: false,
    typesPath: null,
    tablesFound: [],
    missingTables: [],
    hash: null,
    driftDetected: false,
  };

  // Find types file
  const typesFile = findTypesFile(rootDir);

  if (!typesFile) {
    console.log(`${YELLOW}WARNING: No Supabase types file found${RESET}`);
    console.log('   Searched paths:');
    TYPE_PATHS.forEach(p => console.log(`     - ${p}`));
    results.driftDetected = true;
    return results;
  }

  results.typesFound = true;
  results.typesPath = typesFile.path;

  // Read and analyze types
  const content = readFileSync(typesFile.fullPath, 'utf-8');
  results.hash = hashContent(content);

  // Extract tables
  results.tablesFound = extractTablesFromTypes(content);

  // Check for missing canonical tables
  for (const table of CANONICAL_TABLES) {
    const found = results.tablesFound.some(t =>
      t.toLowerCase() === table.toLowerCase()
    );
    if (!found) {
      // Check if table name appears anywhere in the file
      const inContent = content.toLowerCase().includes(table.toLowerCase());
      if (!inContent) {
        results.missingTables.push(table);
      }
    }
  }

  results.driftDetected = results.missingTables.length > 0;

  return results;
}

function main() {
  const rootDir = process.cwd();

  console.log(`${BOLD}SCHEMA DRIFT GUARD${RESET}`);
  console.log(`   Checking: ${rootDir}`);
  console.log('');

  const results = checkDrift(rootDir);

  console.log(`${BOLD}RESULTS${RESET}`);

  if (results.typesFound) {
    console.log(`${GREEN}   Types file: ${results.typesPath}${RESET}`);
    console.log(`   Hash: ${results.hash}`);
    console.log(`   Tables found: ${results.tablesFound.length}`);
  } else {
    console.log(`${RED}   Types file: NOT FOUND${RESET}`);
  }

  console.log('');

  if (results.tablesFound.length > 0) {
    console.log('   Detected tables:');
    results.tablesFound.slice(0, 10).forEach(t => {
      console.log(`     - ${t}`);
    });
    if (results.tablesFound.length > 10) {
      console.log(`     ... and ${results.tablesFound.length - 10} more`);
    }
    console.log('');
  }

  if (results.missingTables.length > 0) {
    console.log(`${YELLOW}   Missing canonical tables:${RESET}`);
    results.missingTables.forEach(t => {
      console.log(`${RED}     - ${t}${RESET}`);
    });
    console.log('');
  }

  if (results.driftDetected) {
    console.log(`${RED}${BOLD}GATE FAILED${RESET}`);
    console.log('   Schema drift detected.');
    console.log('   Run: npx supabase gen types typescript --local > packages/shared-types/src/supabase.ts');
    // SPRINT-SCHEMA-ENV-GATES-002: Fail-closed on drift
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}GATE PASSED${RESET}`);
    console.log('   No schema drift detected.');
    process.exit(0);
  }
}

main();
