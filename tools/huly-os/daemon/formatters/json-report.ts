// SPRINT-HULY-WORKOS-V1-LOCAL-001: Build typed RealityReport from gathered data

import type { DriftViolation, GitHubPR, HulyIssue, RealityReport } from '../adapters/types.js';
import type { AuditLogger } from '../audit-log.js';

const DAEMON_VERSION = '0.1.0';

export interface ReportInputs {
  sprintId: string;
  dryRun: boolean;
  hulyAvailable: boolean;
  repo: string;
  repoSummary: {
    defaultBranch: string;
    openPrs: number;
    lastCommitSha: string;
    lastCommitDate: string;
  };
  mergedPRs: GitHubPR[];
  hulyIssues: HulyIssue[];
  hulyProject: string;
  violations: DriftViolation[];
  audit: AuditLogger;
}

export function buildReport(inputs: ReportInputs): RealityReport {
  const {
    sprintId,
    dryRun,
    hulyAvailable,
    repo,
    repoSummary,
    mergedPRs,
    hulyIssues,
    hulyProject,
    violations,
    audit,
  } = inputs;

  // Build status counts
  const byStatus: Record<string, number> = {};
  let issuesWithoutProof = 0;
  for (const issue of hulyIssues) {
    byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1;
    if (issue.status === 'Done' && !issue.proofUrl) {
      issuesWithoutProof++;
    }
  }

  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;
  const auditStats = audit.stats();

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      daemonVersion: DAEMON_VERSION,
      sprintId,
      dryRun,
      hulyAvailable,
      githubAvailable: true,
    },
    githubSummary: {
      repo,
      defaultBranch: repoSummary.defaultBranch,
      openPrs: repoSummary.openPrs,
      recentlyMergedPrs: mergedPRs.length,
      lastCommit: {
        sha: repoSummary.lastCommitSha,
        date: repoSummary.lastCommitDate,
      },
    },
    hulySummary: hulyAvailable
      ? {
          project: hulyProject,
          totalIssues: hulyIssues.length,
          byStatus,
          issuesWithoutProof,
        }
      : null,
    drift: {
      totalViolations: violations.length,
      errors,
      warnings,
      violations,
    },
    auditStats: {
      totalCalls: auditStats.totalCalls,
      failedCalls: auditStats.failedCalls,
      totalLatencyMs: auditStats.totalLatencyMs,
    },
  };
}
