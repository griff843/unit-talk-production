// Scaffold: LLM-based report summarizer (next sprint)
// Input: RealityReport JSON
// Output: ReportSummary (structured summary, risks, suggested tasks)
// No LLM provider integrated yet — this is a typed interface only.

import type { RealityReport } from '../adapters/types.js';

export interface ReportSummary {
  summary: string;
  risks: string[];
  suggestedTasks: string[];
}

/**
 * Generate a structured summary from a RealityReport.
 *
 * TODO (next sprint): Integrate LLM provider to generate summary from report data.
 * For now, returns a placeholder that extracts basic stats from the report.
 */
export function summarizeReport(report: RealityReport): ReportSummary {
  const driftErrors = report.drift.errors;
  const driftWarnings = report.drift.warnings;
  const issuesWithoutProof = report.hulySummary?.issuesWithoutProof ?? 0;

  return {
    summary: [
      `Report generated ${report.meta.generatedAt}.`,
      `GitHub: ${report.githubSummary.openPrs} open PRs, ${report.githubSummary.recentlyMergedPrs} recently merged.`,
      report.hulySummary
        ? `Huly: ${report.hulySummary.totalIssues} issues tracked.`
        : 'Huly: unavailable.',
      `Drift: ${driftErrors} errors, ${driftWarnings} warnings.`,
    ].join(' '),
    risks: [
      ...(driftErrors > 0 ? [`${driftErrors} error-severity drift violations detected`] : []),
      ...(issuesWithoutProof > 0
        ? [`${issuesWithoutProof} issues marked Done without proof artifacts`]
        : []),
      ...(!report.meta.hulyAvailable ? ['Huly platform unreachable'] : []),
    ],
    suggestedTasks: [
      ...(driftErrors > 0 ? ['Review and resolve error-severity drift violations'] : []),
      ...(issuesWithoutProof > 0 ? ['Add proof_url to Done issues missing proof artifacts'] : []),
      ...(!report.meta.hulyAvailable ? ['Investigate Huly connectivity'] : []),
    ],
  };
}
