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
 * EMPTY ALLOWLIST - ALL MIGRATIONS COMPLETE
 * Sprint: LIFECYCLE-WRITE-SURFACE-MIGRATION-038 completed 2026-02-18
 *
 * Migration history (for audit trail):
 * - LIFECYCLE-MIGRATE-001: DiscordPromotionAgent/index.ts → atomicClaimForPost + lifecycleUpdate
 * - LIFECYCLE-MIGRATE-002: GradingAgent/gradeAndPromoteFinalPicks.ts → lifecycleInsert
 * - LIFECYCLE-MIGRATE-003: GradingAgent/gradeForFinalPicks.ts → lifecycleInsert
 * - LIFECYCLE-MIGRATE-004: runner/fixSchemaCacheIssues.ts → exempt via gate pattern (test utility)
 * - LIFECYCLE-MIGRATE-005: scripts/smoke-capper-thread-routing.ts → exempt via gate pattern (smoke test)
 * - LIFECYCLE-MIGRATE-006: services/SmartFormBridge.ts → lifecycleInsert
 */
export const SINGLE_WRITER_ALLOWLIST: AllowlistEntry[] = [];

/**
 * Check if a file is in the allowlist
 */
export function isFileAllowlisted(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return SINGLE_WRITER_ALLOWLIST.some(
    (entry) => normalizedPath.includes(entry.file)
  );
}

/**
 * Get allowlist entry for a file
 */
export function getAllowlistEntry(filePath: string): AllowlistEntry | undefined {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return SINGLE_WRITER_ALLOWLIST.find(
    (entry) => normalizedPath.includes(entry.file)
  );
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
