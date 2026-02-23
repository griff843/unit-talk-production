#!/usr/bin/env node
/**
 * SPRINT-DATABASE-TYPE-CENTRALIZATION-003: DB Type Drift Guard
 *
 * Detects local database type definitions in apps/** that should be imported
 * from @unit-talk/shared-types instead.
 *
 * This guard enforces SYSTEM_INVARIANT #10: Schema Single Source of Truth.
 *
 * Usage: node scripts/guard-db-type-drift.mjs [--strict]
 *
 * Exit codes:
 *   0 = Pass (no violations or all allowlisted)
 *   1 = Fail (violations detected in strict mode)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

// Colors for output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Canonical table names that MUST be imported from shared-types
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
  'cappers',
  'teams',
  'smart_tickets',
];

// Patterns that indicate a local DB type definition
const VIOLATION_PATTERNS = [
  // Interface definitions for Row types
  /interface\s+(UnifiedPicks?Row|BridgeOutboxRow|AgentHealthRow|PropSettlementsRow|UsersRow|RawPropsRow|GamesRow|PlayersRow|ClosingSnapshotsRow|CappersRow|TeamsRow|SmartTicketsRow)\s*\{/gi,
  // Interface definitions for canonical tables (e.g., interface UnifiedPick {)
  /interface\s+(UnifiedPick|BridgeOutbox|AgentHealth|PropSettlement|User|RawProp|Game|Player|ClosingSnapshot|Capper|Team|SmartTicket)\s*\{/gi,
  // Type definitions that match Row patterns
  /type\s+(UnifiedPicks?Row|BridgeOutboxRow|AgentHealthRow)\s*=/gi,
];

// Files/directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /\.git/,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /__tests__/,
  /test\//,
  /tests\//,
];

// Allowlisted files that are permitted to have these definitions
// SPRINT-DATABASE-TYPE-CENTRALIZATION-003: These are pending migration
const ALLOWLIST = [
  // =========================================================================
  // SUPABASE-GENERATED FILES (canonical schema - will migrate to shared-types)
  // =========================================================================
  'apps/command-center/src/types/database.ts',
  'apps/command-center/src/types/database-extensions.ts',
  'apps/discord-bot/src/db/types/supabase-complete.ts',

  // =========================================================================
  // RE-EXPORT FILES (import from shared-types)
  // =========================================================================
  'apps/smart-form/types/database.ts',
  'apps/command-center/src/types/index.ts',

  // =========================================================================
  // API TYPE FILES (pending migration - Sprint 4+)
  // =========================================================================
  'apps/api/src/db/types/supabase.ts',
  'apps/api/src/db/types/supabase-types.ts',
  'apps/api/src/db/types/unified_picks.ts',
  'apps/api/src/types/supabase.ts',
  'apps/api/src/types/supabase-types.ts',
  'apps/api/src/types/enhanced-supabase-types.ts',
  'apps/api/src/types/picks.ts',
  'apps/api/src/types/rawProps.ts',
  'apps/api/src/types/pickPresentation.ts',
  'apps/api/src/types/smartForm.ts',
  'apps/api/src/types/shared/activity-types.ts',
  'apps/api/src/agents/FeedAgent/types.ts',
  'apps/api/src/agents/SettlementAgent/index.ts',
  'apps/api/src/utils/normalizers/playerNormalizer.ts',
  'apps/api/scripts/populate-live-props.ts',
  'apps/api/src/scripts/edge-validation-report.ts',
  'apps/api/src/scripts/sgo/market-universe-report.ts',
  'apps/api/src/scripts/test-edge-engine-v1.ts',

  // =========================================================================
  // COMMAND CENTER FILES (pending migration - Sprint 4+)
  // =========================================================================
  'apps/command-center/src/app/dashboard/ops-submit/useOpsSubmit.ts',
  'apps/command-center/src/lib/analytics.ts',
  'apps/command-center/src/lib/middleware/auth.ts',
  'apps/command-center/src/lib/supabase.ts',

  // =========================================================================
  // DASHBOARD FILES (pending migration - Sprint 4+)
  // =========================================================================
  'apps/dashboard/components/dashboard/CapperProgram.tsx',
  'apps/dashboard/components/dashboard/PickManagement.tsx',
  'apps/dashboard/components/dashboard/QuickActions.tsx',
  'apps/dashboard/components/dashboard/UserAnalytics.tsx',

  // =========================================================================
  // SMART FORM FILES (pending migration - Sprint 4+)
  // =========================================================================
  'apps/smart-form/app/submit-ticket/components/GamesList.tsx',
  'apps/smart-form/app/submit-ticket/components/LegCard.tsx',
  'apps/smart-form/app/submit-ticket/components/SmartPlayerInput.tsx',
  'apps/smart-form/app/submit-ticket/components/SportsbookManualEntry.tsx',
  'apps/smart-form/app/submit-ticket/lib/services.ts',
  'apps/smart-form/app/submit-ticket/types.ts',
  'apps/smart-form/app/submit-ticket/v2/components/BetSlip.tsx',
  'apps/smart-form/lib/api-client.ts',
  'apps/smart-form/lib/supabase-queries.ts',

  // =========================================================================
  // DISCORD BOT FILES (pending migration - Sprint 4+)
  // =========================================================================
  'apps/discord-bot/src/services/database.ts',
];

// Check if a path should be skipped
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

// Check if a file is allowlisted
function isAllowlisted(filePath, rootDir) {
  const relativePath = relative(rootDir, filePath).replace(/\\/g, '/');
  return ALLOWLIST.some(allowed => relativePath === allowed || relativePath.endsWith(allowed));
}

// Recursively find all TypeScript files in apps/
function findTsFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    if (shouldSkip(fullPath)) continue;

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Check a file for violations
function checkFile(filePath, rootDir) {
  const content = readFileSync(filePath, 'utf-8');
  const violations = [];

  for (const pattern of VIOLATION_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      const lines = content.substring(0, match.index).split('\n');
      const lineNumber = lines.length;

      violations.push({
        file: relative(rootDir, filePath).replace(/\\/g, '/'),
        line: lineNumber,
        match: match[0].trim(),
        typeName: match[1],
      });
    }
  }

  return violations;
}

function main() {
  const rootDir = process.cwd();
  const appsDir = join(rootDir, 'apps');
  const isStrict = process.argv.includes('--strict');

  console.log(`${BOLD}DB TYPE DRIFT GUARD${RESET}`);
  console.log(`   Mode: ${isStrict ? 'STRICT' : 'WARNING'}`);
  console.log(`   Scope: apps/**`);
  console.log('');

  if (!existsSync(appsDir)) {
    console.log(`${YELLOW}WARNING: apps/ directory not found${RESET}`);
    process.exit(0);
  }

  // Find all TypeScript files
  const files = findTsFiles(appsDir);
  console.log(`   Scanning ${files.length} files...`);
  console.log('');

  // Check each file
  const allViolations = [];
  const allowlistedViolations = [];

  for (const file of files) {
    const violations = checkFile(file, rootDir);

    for (const v of violations) {
      if (isAllowlisted(file, rootDir)) {
        allowlistedViolations.push(v);
      } else {
        allViolations.push(v);
      }
    }
  }

  // Report results
  console.log(`${BOLD}RESULTS${RESET}`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Violations found: ${allViolations.length}`);
  console.log(`   Allowlisted: ${allowlistedViolations.length}`);
  console.log('');

  if (allViolations.length > 0) {
    console.log(`${RED}VIOLATIONS (should import from @unit-talk/shared-types):${RESET}`);
    for (const v of allViolations) {
      console.log(`   ${RED}${v.file}:${v.line}${RESET}`);
      console.log(`      ${v.match}`);
    }
    console.log('');
  }

  if (allowlistedViolations.length > 0) {
    console.log(`${YELLOW}ALLOWLISTED (migration pending):${RESET}`);
    for (const v of allowlistedViolations.slice(0, 5)) {
      console.log(`   ${YELLOW}${v.file}:${v.line}${RESET} - ${v.typeName}`);
    }
    if (allowlistedViolations.length > 5) {
      console.log(`   ... and ${allowlistedViolations.length - 5} more`);
    }
    console.log('');
  }

  // Final verdict
  if (allViolations.length === 0) {
    console.log(`${GREEN}${BOLD}GATE PASSED${RESET}`);
    console.log('   No unallowlisted DB type drift detected.');
    console.log('');
    console.log('   Canonical types should be imported from:');
    console.log("      import { UnifiedPicksRow, ... } from '@unit-talk/shared-types';");
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}GATE FAILED${RESET}`);
    console.log(`   ${allViolations.length} violation(s) detected.`);
    console.log('');
    console.log('   To fix:');
    console.log("   1. Import canonical types from @unit-talk/shared-types");
    console.log('   2. Remove local type definitions');
    console.log('   3. Or add to allowlist if migration pending');

    if (isStrict) {
      process.exit(1);
    } else {
      console.log('');
      console.log(`${YELLOW}   (Running in warning mode - use --strict to fail)${RESET}`);
      process.exit(0);
    }
  }
}

main();
