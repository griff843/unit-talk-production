// SPRINT-LLM-REALITY-SUMMARIZER-005: Deterministic report summarizer
// Input: RealityReport JSON
// Output: ReportSummary (structured summary, risks, suggested actions, priority items)
// Future: swap deterministic logic for LLM provider call.

import type { RealityReport } from '../adapters/types.js';

export interface ReportSummary {
  summary: string;
  risks: string[];
  suggestedActions: string[];
  priorityItems: string[];
}

/**
 * Generate a structured summary from a RealityReport.
 *
 * Uses deterministic extraction — no external LLM provider yet.
 * Designed so the return type is stable when an LLM provider replaces this logic.
 */
export function summarizeReport(report: RealityReport): ReportSummary {
  const { meta, githubSummary, hulySummary, drift, auditStats } = report;

  const driftErrors = drift.errors;
  const driftWarnings = drift.warnings;
  const issuesWithoutProof = hulySummary?.issuesWithoutProof ?? 0;
  const failedCalls = auditStats.failedCalls;

  // --- Summary ---
  const summaryLines: string[] = [
    `Report generated ${meta.generatedAt} (${meta.dryRun ? 'dry-run' : 'live'}).`,
    `GitHub: ${githubSummary.openPrs} open PRs, ${githubSummary.recentlyMergedPrs} recently merged.`,
  ];

  if (hulySummary) {
    const statusBreakdown = Object.entries(hulySummary.byStatus)
      .map(([s, n]) => `${n} ${s}`)
      .join(', ');
    summaryLines.push(`Huly: ${hulySummary.totalIssues} issues (${statusBreakdown}).`);
  } else {
    summaryLines.push('Huly: unavailable.');
  }

  summaryLines.push(`Drift: ${driftErrors} errors, ${driftWarnings} warnings.`);

  if (failedCalls > 0) {
    summaryLines.push(`Audit: ${failedCalls}/${auditStats.totalCalls} API calls failed.`);
  }

  // --- Risks ---
  const risks: string[] = [];

  if (driftErrors > 0) {
    risks.push(`${driftErrors} error-severity drift violation(s) detected`);
  }
  if (issuesWithoutProof > 0) {
    risks.push(`${issuesWithoutProof} issue(s) marked Done without proof artifacts`);
  }
  if (!meta.hulyAvailable) {
    risks.push('Huly platform unreachable — no write operations possible');
  }
  if (!meta.githubAvailable) {
    risks.push('GitHub API unreachable — data may be stale');
  }
  if (failedCalls > 0) {
    const failRate = Math.round((failedCalls / auditStats.totalCalls) * 100);
    risks.push(`${failRate}% API call failure rate (${failedCalls}/${auditStats.totalCalls})`);
  }
  if (driftWarnings >= 10) {
    risks.push(`High warning count: ${driftWarnings} drift warnings`);
  }

  // --- Suggested Actions ---
  const suggestedActions: string[] = [];

  if (driftErrors > 0) {
    suggestedActions.push('Review and resolve error-severity drift violations');
  }
  if (issuesWithoutProof > 0) {
    suggestedActions.push('Add proof_url to Done issues missing proof artifacts');
  }
  if (!meta.hulyAvailable) {
    suggestedActions.push('Investigate Huly connectivity and restart services if needed');
  }
  if (failedCalls > 0) {
    suggestedActions.push('Investigate API call failures in audit.jsonl');
  }
  if (driftWarnings > 0) {
    suggestedActions.push('Triage drift warnings and resolve or suppress known-good items');
  }

  // --- Priority Items (error-severity violations first) ---
  const priorityItems: string[] = [];

  for (const v of drift.violations) {
    if (v.severity === 'error') {
      priorityItems.push(`[${v.ruleId}] ${v.entityType}:${v.entityId} — ${v.message}`);
    }
  }
  if (issuesWithoutProof > 0) {
    priorityItems.push(`${issuesWithoutProof} Done issue(s) need proof artifacts`);
  }
  if (!meta.hulyAvailable) {
    priorityItems.push('Restore Huly platform connectivity');
  }

  return {
    summary: summaryLines.join(' '),
    risks,
    suggestedActions,
    priorityItems,
  };
}
