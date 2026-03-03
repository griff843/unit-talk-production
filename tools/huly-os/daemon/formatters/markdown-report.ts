// SPRINT-HULY-WORKOS-V1-LOCAL-001: Render RealityReport as markdown

import type { RealityReport } from '../adapters/types.js';

export function renderMarkdown(report: RealityReport): string {
  const lines: string[] = [];

  // Header
  const dateStr = report.meta.generatedAt.slice(0, 10);
  lines.push(`# Daily Reality Report - ${dateStr}`);
  lines.push('');
  lines.push(`**Sprint**: ${report.meta.sprintId}`);
  lines.push(`**Generated**: ${report.meta.generatedAt}`);
  lines.push(
    `**Huly**: ${report.meta.hulyAvailable ? 'Connected' : 'Unreachable'} | ` +
      `**GitHub**: ${report.meta.githubAvailable ? 'Connected' : 'Unreachable'}`
  );
  lines.push(`**Mode**: ${report.meta.dryRun ? 'Dry Run' : 'Live'}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // GitHub Summary
  lines.push('## GitHub Summary');
  lines.push('');
  lines.push(`- **Repo**: ${report.githubSummary.repo}`);
  lines.push(`- **Default Branch**: ${report.githubSummary.defaultBranch}`);
  lines.push(`- **Open PRs**: ${report.githubSummary.openPrs}`);
  lines.push(`- **Recently Merged**: ${report.githubSummary.recentlyMergedPrs} (last 7 days)`);
  lines.push(
    `- **Last Commit**: \`${report.githubSummary.lastCommit.sha}\` (${report.githubSummary.lastCommit.date})`
  );
  lines.push('');

  // Huly Summary
  if (report.hulySummary) {
    lines.push('## Huly Summary');
    lines.push('');
    lines.push(`- **Project**: ${report.hulySummary.project}`);
    lines.push(`- **Total Issues**: ${report.hulySummary.totalIssues}`);

    const statusEntries = Object.entries(report.hulySummary.byStatus).sort(([, a], [, b]) => b - a);
    if (statusEntries.length > 0) {
      const statusStr = statusEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
      lines.push(`- **By Status**: ${statusStr}`);
    }

    lines.push(`- **Issues Missing Proof**: ${report.hulySummary.issuesWithoutProof}`);
    lines.push('');
  } else {
    lines.push('## Huly Summary');
    lines.push('');
    lines.push('> **Huly Unreachable** — Huly instance was not available during this report run.');
    lines.push('> Huly-dependent drift rules were not evaluated.');
    lines.push('> This section will populate once Huly connectivity is restored.');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Drift Violations
  const { drift } = report;
  lines.push(
    `## Drift Violations (${drift.totalViolations} total: ${drift.errors} error${drift.errors !== 1 ? 's' : ''}, ${drift.warnings} warning${drift.warnings !== 1 ? 's' : ''})`
  );
  lines.push('');

  if (drift.violations.length === 0) {
    lines.push('No drift violations detected.');
    lines.push('');
  } else {
    // Errors table
    const errors = drift.violations.filter(v => v.severity === 'error');
    if (errors.length > 0) {
      lines.push('### Errors');
      lines.push('');
      lines.push('| Entity | Rule | Message |');
      lines.push('|--------|------|---------|');
      for (const v of errors) {
        lines.push(`| ${v.entityId} | \`${v.ruleId}\` | ${v.message} |`);
      }
      lines.push('');
    }

    // Warnings table
    const warnings = drift.violations.filter(v => v.severity === 'warning');
    if (warnings.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      lines.push('| Entity | Rule | Message |');
      lines.push('|--------|------|---------|');
      for (const w of warnings) {
        lines.push(`| ${w.entityId} | \`${w.ruleId}\` | ${w.message} |`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  // Audit stats
  lines.push('## Audit');
  lines.push('');
  lines.push(
    `- **Total calls**: ${report.auditStats.totalCalls} | ` +
      `**Failed**: ${report.auditStats.failedCalls} | ` +
      `**Total latency**: ${report.auditStats.totalLatencyMs}ms`
  );
  lines.push('');

  return lines.join('\n');
}
