/**
 * SINGLE-WRITER ALLOWLIST
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037 (baseline capture)
 * Sprint: LIFECYCLE-WRITE-SURFACE-MIGRATION-038 (all migrations complete)
 *
 * Files temporarily allowed to bypass single-writer enforcement.
 * Each entry MUST have a migration ticket and target date.
 *
 * MIGRATION STATUS: ✅ COMPLETE (2026-02-18)
 * All production files have been migrated to use lifecycle adapters.
 * Test utilities are now exempt via gate patterns rather than allowlist.
 */

export interface AllowlistEntry {
  file: string;
  reason: string;
  migrationTicket?: string;
  targetDate?: string;
  completedAt?: string;
}

/**
 * ALLOWLIST - Files pending migration to lifecycle adapters
 * Sprint: SPRINT-SINGLE-WRITER-SETTLEMENT-GUARD-071A (2026-02-20)
 *
 * Previous migration history (completed):
 * - LIFECYCLE-MIGRATE-001: DiscordPromotionAgent/index.ts → atomicClaimForPost + lifecycleUpdate
 * - LIFECYCLE-MIGRATE-002: GradingAgent/gradeAndPromoteFinalPicks.ts → lifecycleInsert
 * - LIFECYCLE-MIGRATE-003: GradingAgent/gradeForFinalPicks.ts → lifecycleInsert
 * - LIFECYCLE-MIGRATE-004: runner/fixSchemaCacheIssues.ts → exempt via gate pattern (test utility)
 * - LIFECYCLE-MIGRATE-005: scripts/smoke-capper-thread-routing.ts → exempt via gate pattern (smoke test)
 * - LIFECYCLE-MIGRATE-006: services/SmartFormBridge.ts → lifecycleInsert
 * - LIFECYCLE-MIGRATE-007: SettlementAgent/index.ts → lifecycleSettle (071A)
 *
 * NEW VIOLATIONS DISCOVERED (071A multi-line gate enhancement):
 * These files were not caught by the original same-line gate pattern.
 * Each requires migration to lifecycle adapters in future sprints.
 */
/**
 * ALLOWLIST — ALL ENTRIES CLEARED
 * Sprint: SPRINT-SINGLE-WRITER-MIGRATION-COMPLETION
 * Date: 2026-03-09
 *
 * All 13 previously-allowlisted files have been resolved:
 * - 10 production files migrated to use lifecycle adapters
 * - 3 structural files (routes/ops.ts, scripts/backfill-*, scripts/discord-canary-*)
 *   added as permanent ALLOWED_PATTERNS in single-writer-gate.ts
 *
 * Migration history (this sprint):
 * - AlertAgent/index.ts → lifecycleUpdate (poster)
 * - DiscordPromotionAgent/index.ts → lifecycleUpdate (poster)
 * - AutoRecheckService.ts → lifecycleUpdate (operator_override) [previous session]
 * - capperService.ts → lifecycleInsert (submitter) + lifecycleUpdate (operator_override)
 * - PickMonitoringService.ts → lifecycleUpdate (operator_override) [previous session]
 * - STierEnforcer.ts → lifecycleUpdate (operator_override) [previous session]
 * - lib/discordReceiptContract.ts → lifecycleUpdate (poster)
 * - promotion/PublishGuard.ts → lifecycleUpdate (promoter)
 * - workers/BridgeWorker.ts → lifecycleUpdate (promoter)
 * - utils/optimizedInsertions.ts → lifecycleInsert (submitter) + lifecycleUpdate (promoter)
 */
export const SINGLE_WRITER_ALLOWLIST: AllowlistEntry[] = [];

/**
 * Check if a file is in the allowlist
 */
export function isFileAllowlisted(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return SINGLE_WRITER_ALLOWLIST.some(entry => normalizedPath.includes(entry.file));
}

/**
 * Get allowlist entry for a file
 */
export function getAllowlistEntry(filePath: string): AllowlistEntry | undefined {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return SINGLE_WRITER_ALLOWLIST.find(entry => normalizedPath.includes(entry.file));
}

/**
 * Get count of allowlisted files
 */
export function getAllowlistCount(): number {
  return SINGLE_WRITER_ALLOWLIST.length;
}

/**
 * Generate migration report
 */
export function generateMigrationReport(): string {
  if (SINGLE_WRITER_ALLOWLIST.length === 0) {
    return [
      '# Single-Writer Migration Report',
      '',
      '✅ **ALL MIGRATIONS COMPLETE**',
      '',
      'Sprint: LIFECYCLE-WRITE-SURFACE-MIGRATION-038',
      'Completed: 2026-02-18',
      '',
      'All production writes to unified_picks now go through lifecycle adapters.',
      'Test utilities are exempt via gate patterns (not allowlist).',
      '',
      '## Completed Migrations',
      '- DiscordPromotionAgent → atomicClaimForPost + lifecycleUpdate',
      '- GradingAgent/gradeAndPromoteFinalPicks.ts → lifecycleInsert',
      '- GradingAgent/gradeForFinalPicks.ts → lifecycleInsert',
      '- SmartFormBridge.ts → lifecycleInsert',
      '',
      '## Test Utilities (gate exempt)',
      '- runner/fixSchemaCacheIssues.ts',
      '- scripts/smoke-capper-thread-routing.ts',
    ].join('\n');
  }

  const lines = [
    '# Single-Writer Migration Report',
    '',
    `Total allowlisted files: ${SINGLE_WRITER_ALLOWLIST.length}`,
    '',
    '## Files Requiring Migration',
    '',
  ];

  for (const entry of SINGLE_WRITER_ALLOWLIST) {
    lines.push(`### ${entry.file}`);
    lines.push(`- Reason: ${entry.reason}`);
    if (entry.migrationTicket) {
      lines.push(`- Ticket: ${entry.migrationTicket}`);
    }
    if (entry.targetDate) {
      lines.push(`- Target: ${entry.targetDate}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
