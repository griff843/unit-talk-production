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
export const SINGLE_WRITER_ALLOWLIST: AllowlistEntry[] = [
  // === AGENTS (P0 - high priority) ===
  {
    file: 'agents/AlertAgent/index.ts',
    reason: 'Multi-line writes for Discord posting (dead code at 626, active at 795, 815)',
    migrationTicket: 'SPRINT-SINGLE-WRITER-AGENT-MIGRATION-072',
    targetDate: '2026-02-25',
  },
  {
    file: 'agents/DiscordPromotionAgent/index.ts',
    reason: 'Multi-line write for resetting posted status',
    migrationTicket: 'SPRINT-SINGLE-WRITER-AGENT-MIGRATION-072',
    targetDate: '2026-02-25',
  },
  // SPRINT-E2E-PICK-MACHINE-REMEDIATION-041D: GradingAgent.ts RESOLVED — uses lifecycleInsert
  // SPRINT-E2E-PICK-MACHINE-REMEDIATION-041D: RecapAgent/index.ts RESOLVED — uses lifecycleUpdate
  // === SERVICES (P1 - medium priority) ===
  {
    file: 'services/AutoRecheckService.ts',
    reason: 'Multi-line updates for recheck operations (3 locations)',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  {
    file: 'services/capperService.ts',
    reason: 'Multi-line CRUD operations (insert, update, delete)',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  {
    file: 'services/PickMonitoringService.ts',
    reason: 'Multi-line update for monitoring',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  // SPRINT-E2E-PICK-MACHINE-REMEDIATION-041D: ProfessionalPropProcessor.ts RESOLVED — uses lifecycleInsert
  {
    file: 'services/STierEnforcer.ts',
    reason: 'Multi-line update for S-tier enforcement',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  // === LIB/PROMOTION (P1) ===
  {
    file: 'lib/discordReceiptContract.ts',
    reason: 'Multi-line update for Discord receipt',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  {
    file: 'promotion/PublishGuard.ts',
    reason: 'Multi-line updates for publish guard (2 locations)',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  // === WORKERS (P1) ===
  {
    file: 'workers/BridgeWorker.ts',
    reason: 'Multi-line update in bridge processing',
    migrationTicket: 'SPRINT-SINGLE-WRITER-SERVICES-MIGRATION-073',
    targetDate: '2026-02-28',
  },
  // === UTILS (P2 - lower priority) ===
  {
    file: 'utils/optimizedInsertions.ts',
    reason: 'Multi-line insert/update for optimized operations',
    migrationTicket: 'SPRINT-SINGLE-WRITER-UTILS-MIGRATION-074',
    targetDate: '2026-03-05',
  },
  // === ROUTES (P2 - admin operations) ===
  {
    file: 'routes/ops.ts',
    reason: 'Multi-line delete for admin operations',
    migrationTicket: 'SPRINT-SINGLE-WRITER-UTILS-MIGRATION-074',
    targetDate: '2026-03-05',
  },
  // === SCRIPTS (P3 - utility scripts) ===
  {
    file: 'scripts/backfill-feature-contributions.ts',
    reason: 'Multi-line update for backfill',
    migrationTicket: 'SPRINT-SINGLE-WRITER-UTILS-MIGRATION-074',
    targetDate: '2026-03-05',
  },
  {
    file: 'scripts/discord-canary-webhook.ts',
    reason: 'Multi-line insert for canary testing',
    migrationTicket: 'SPRINT-SINGLE-WRITER-UTILS-MIGRATION-074',
    targetDate: '2026-03-05',
  },
];

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
