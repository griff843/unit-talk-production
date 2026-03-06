#!/usr/bin/env tsx
/**
 * Command Center Write Ban Gate
 * Sprint: SPRINT-023-PRODUCTION-SURFACE-LOCK
 *
 * CI gate that scans apps/command-center/src/ for unauthorized writes
 * to canonical business tables. The Command Center is READ-ONLY for
 * business tables per CLAUDE.md service boundaries.
 *
 * Canonical tables (writes BANNED from CC):
 *   - unified_picks
 *   - prop_settlements
 *   - bridge_outbox
 *   - pick_publish
 *
 * Operational tables (writes ALLOWED from CC):
 *   - system_config, system_status, system_metrics, system_alerts
 *   - security_events, audit_log
 *   - agent_health, agents
 *   - api_alerts, workflow_executions, events
 *   - users (sync only)
 *
 * Usage:
 *   npx tsx scripts/gates/cc-write-ban.ts
 *
 * Exit codes:
 *   0 = PASS (no violations)
 *   1 = FAIL (violations found — FAIL-CLOSED per SPRINT-023B)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CC_SRC = path.resolve(__dirname, '../../apps/command-center/src');
// SPRINT-023B: Gate is always fail-closed (no --strict flag needed)

/** Canonical tables where CC writes are BANNED */
const BANNED_TABLES = [
  'unified_picks',
  'prop_settlements',
  'bridge_outbox',
  'pick_publish',
  'daily_picks',
  'closing_snapshots',
];

/** Write method patterns to detect */
const WRITE_METHODS = ['.insert(', '.update(', '.upsert(', '.delete('];

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

interface Violation {
  file: string;
  line: number;
  table: string;
  content: string;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Check for .from('<banned_table>')
    for (const table of BANNED_TABLES) {
      const fromPattern = `.from('${table}')`;
      const fromPatternDQ = `.from("${table}")`;

      if (line.includes(fromPattern) || line.includes(fromPatternDQ)) {
        // Check this line and next few lines for write methods
        const window = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
        for (const method of WRITE_METHODS) {
          if (window.includes(method)) {
            violations.push({
              file: path.relative(CC_SRC, filePath),
              line: i + 1,
              table,
              content: line.trim(),
            });
            break; // One violation per .from() call
          }
        }
      }
    }
  }

  return violations;
}

function walkDir(dir: string, ext: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and .next
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      files.push(...walkDir(fullPath, ext));
    } else if (entry.name.endsWith(ext) || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('🔍 COMMAND CENTER WRITE BAN GATE');
  console.log(`   Scanning: ${CC_SRC}`);
  console.log(`   Mode: FAIL-CLOSED`);
  console.log(`   Banned tables: ${BANNED_TABLES.join(', ')}\n`);

  if (!fs.existsSync(CC_SRC)) {
    console.log('⚠️  Command Center src directory not found — skipping.');
    process.exit(0);
  }

  const files = walkDir(CC_SRC, '.ts');
  console.log(`   Files to scan: ${files.length}\n`);

  const allViolations: Violation[] = [];

  for (const file of files) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  // Report
  console.log('📊 Results:');
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Violations found: ${allViolations.length}\n`);

  if (allViolations.length > 0) {
    console.log('❌ VIOLATIONS:');
    for (const v of allViolations) {
      console.log(`   ${v.file}:${v.line} — writes to "${v.table}"`);
      console.log(`     ${v.content}\n`);
    }

    console.log('\n❌ GATE FAILED — Command Center must NOT write to canonical business tables.');
    console.log('   Fix: Move these writes to API layer via operator endpoints.');
    console.log('   See: SPRINT-023B-CC-WRITE-BAN-ENFORCEMENT for migration guidance.\n');

    // SPRINT-023B: Gate is now FAIL-CLOSED — always exit 1 on violations
    process.exit(1);
  }

  console.log('✅ GATE PASSED — No canonical table writes found in Command Center.\n');
  process.exit(0);
}

main();
