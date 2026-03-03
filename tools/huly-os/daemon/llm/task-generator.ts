// SPRINT-LLM-TASK-GENERATOR-006: Generate GitHub issues from ReportSummary
// Idempotent via fingerprint dedup. Failure-isolated from publish pipeline.

import {
  computeFingerprint,
  type GitHubIssueResult,
  type GitHubIssuesAdapter,
} from '../adapters/github-issues.js';

import type { ReportSummary } from './llm-summarizer.js';

export interface TaskCandidate {
  title: string;
  body: string;
  labels: string[];
  fingerprint: string;
  source: 'risk' | 'action' | 'priority';
}

export interface TaskGenerationResult {
  candidates: TaskCandidate[];
  created: GitHubIssueResult[];
  updated: GitHubIssueResult[];
  failed: Array<{ title: string; error: string }>;
}

/**
 * Build task candidates from a ReportSummary.
 * Each candidate gets a stable fingerprint for dedup.
 */
export function buildTaskCandidates(
  summary: ReportSummary,
  sprintId: string,
  repo: string
): TaskCandidate[] {
  const candidates: TaskCandidate[] = [];

  for (const risk of summary.risks) {
    candidates.push({
      title: `[Risk] ${risk}`,
      body: `**Risk detected by Reality Report**\n\n${risk}\n\n**Sprint:** ${sprintId}`,
      labels: ['reality-report', 'risk'],
      fingerprint: computeFingerprint(risk, sprintId, repo),
      source: 'risk',
    });
  }

  for (const action of summary.suggestedActions) {
    candidates.push({
      title: `[Action] ${action}`,
      body: `**Suggested action from Reality Report**\n\n${action}\n\n**Sprint:** ${sprintId}`,
      labels: ['reality-report', 'action'],
      fingerprint: computeFingerprint(action, sprintId, repo),
      source: 'action',
    });
  }

  for (const item of summary.priorityItems) {
    candidates.push({
      title: `[Priority] ${item}`,
      body: `**Priority item from Reality Report**\n\n${item}\n\n**Sprint:** ${sprintId}`,
      labels: ['reality-report', 'priority'],
      fingerprint: computeFingerprint(item, sprintId, repo),
      source: 'priority',
    });
  }

  return candidates;
}

/**
 * Generate GitHub issues from a ReportSummary.
 * Each issue is upserted idempotently via fingerprint.
 * Individual failures are captured but don't abort the batch.
 */
export async function generateTasks(
  adapter: GitHubIssuesAdapter,
  summary: ReportSummary,
  sprintId: string,
  repo: string
): Promise<TaskGenerationResult> {
  const candidates = buildTaskCandidates(summary, sprintId, repo);
  const created: GitHubIssueResult[] = [];
  const updated: GitHubIssueResult[] = [];
  const failed: Array<{ title: string; error: string }> = [];

  for (const candidate of candidates) {
    try {
      const result = await adapter.upsertIssue(
        candidate.title,
        candidate.body,
        candidate.labels,
        candidate.fingerprint
      );
      if (result.created) {
        created.push(result);
      } else {
        updated.push(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ title: candidate.title, error: msg });
    }
  }

  return { candidates, created, updated, failed };
}

/**
 * Render a task generation result as a markdown section for appending to the report.
 */
export function renderTasksMarkdown(result: TaskGenerationResult): string {
  if (result.candidates.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## Generated Tasks');
  lines.push('');

  if (result.created.length > 0) {
    lines.push(`**Created:** ${result.created.length} issue(s)`);
    for (const issue of result.created) {
      lines.push(`- [#${issue.number}](${issue.url})`);
    }
    lines.push('');
  }

  if (result.updated.length > 0) {
    lines.push(`**Updated:** ${result.updated.length} issue(s)`);
    for (const issue of result.updated) {
      lines.push(`- [#${issue.number}](${issue.url})`);
    }
    lines.push('');
  }

  if (result.failed.length > 0) {
    lines.push(`**Failed:** ${result.failed.length} issue(s)`);
    for (const f of result.failed) {
      lines.push(`- ${f.title}: ${f.error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
