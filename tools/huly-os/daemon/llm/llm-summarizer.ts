// SPRINT-LLM-PROVIDER-INTEGRATION-008: Report summarizer with optional LLM provider
// Flow: if LLM_PROVIDER set → try LLM → validate → return. On failure → deterministic fallback.

import { generateSummaryFromLLM } from './llm-client.js';

import type { RealityReport } from '../adapters/types.js';

export type SummaryProvider = 'openai' | 'anthropic' | 'deterministic';

export interface ReportSummary {
  summary: string;
  risks: string[];
  suggestedActions: string[];
  priorityItems: string[];
}

export interface SummarizeResult {
  summary: ReportSummary;
  provider: SummaryProvider;
}

/**
 * Generate a structured summary from a RealityReport.
 *
 * If LLM_PROVIDER is set, attempts LLM summarization first.
 * On any failure (timeout, schema mismatch, API error), falls back to deterministic.
 */
export async function summarizeReport(report: RealityReport): Promise<SummarizeResult> {
  const llmProvider = process.env.LLM_PROVIDER;

  if (llmProvider === 'openai' || llmProvider === 'anthropic') {
    try {
      const summary = await generateSummaryFromLLM(report);
      return { summary, provider: llmProvider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`LLM summarizer failed, falling back to deterministic: ${msg}`);
    }
  }

  return { summary: summarizeDeterministic(report), provider: 'deterministic' };
}

/**
 * Deterministic summarizer — always available, no external dependencies.
 */
export function summarizeDeterministic(report: RealityReport): ReportSummary {
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
