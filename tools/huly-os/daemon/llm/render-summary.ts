// SPRINT-LLM-REALITY-SUMMARIZER-005: Render ReportSummary as markdown section

import type { ReportSummary } from './llm-summarizer.js';

/**
 * Render a ReportSummary into a markdown section suitable for appending
 * to the main report.md before publishing.
 */
export function renderSummaryMarkdown(summary: ReportSummary): string {
  const lines: string[] = [];

  lines.push('## AI Operations Summary');
  lines.push('');
  lines.push('### Summary');
  lines.push(summary.summary);
  lines.push('');

  if (summary.risks.length > 0) {
    lines.push('### Risks');
    for (const r of summary.risks) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  if (summary.suggestedActions.length > 0) {
    lines.push('### Suggested Actions');
    for (const a of summary.suggestedActions) {
      lines.push(`- ${a}`);
    }
    lines.push('');
  }

  if (summary.priorityItems.length > 0) {
    lines.push('### Priority Items');
    for (const p of summary.priorityItems) {
      lines.push(`- ${p}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
