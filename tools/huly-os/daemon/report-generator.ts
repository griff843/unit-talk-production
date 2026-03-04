// SPRINT-HULY-OPERATOR-014: Daily + Weekly report generators
// Publishes structured operating reports to Huly Documents.

import { GitHubAdapter } from './adapters/github-adapter.js';
import { HulyAdapter } from './adapters/huly-adapter.js';
import { AuditLogger } from './audit-log.js';
import { loadConfig } from './config.js';
import { evaluateDrift } from './drift-rules.js';
import { evaluateSprints } from './sprint-manager.js';

import type { DriftViolation, GitHubPR, HulyIssue, WorkflowRun } from './adapters/types.js';
import type { DaemonConfig } from './config.js';
import type { SprintInfo } from './sprint-manager.js';

// ── Data Gathering ───────────────────────────────────────────────────────

interface ReportData {
  openPRs: GitHubPR[];
  mergedPRs: GitHubPR[];
  hulyIssues: HulyIssue[];
  workflowRuns: WorkflowRun[];
  sprintInfos: SprintInfo[];
  driftViolations: DriftViolation[];
  repoSummary: {
    defaultBranch: string;
    openPrs: number;
    lastCommitSha: string;
    lastCommitDate: string;
  };
}

async function gatherData(config: DaemonConfig): Promise<ReportData> {
  const audit = new AuditLogger();
  const github = new GitHubAdapter(config, audit);
  const huly = new HulyAdapter(config, audit);
  await huly.connect();

  const [openPRs, mergedPRs, hulyIssues, workflowRuns, repoSummary] = await Promise.all([
    github.listOpenPRs(),
    github.listRecentlyMergedPRs(30),
    huly.listIssues(config.HULY_PROJECT),
    github.getWorkflowRuns().then(runs => runs.filter(r => r.headBranch.startsWith('sprint/'))),
    github.getRepoSummary(),
  ]);

  const sprintResult = evaluateSprints(hulyIssues, openPRs, mergedPRs, workflowRuns);
  const driftViolations = evaluateDrift(openPRs, mergedPRs, hulyIssues, workflowRuns);

  return {
    openPRs,
    mergedPRs,
    hulyIssues,
    workflowRuns,
    sprintInfos: sprintResult.sprints,
    driftViolations,
    repoSummary,
  };
}

// ── Daily Reality Report ─────────────────────────────────────────────────

function buildDailyReport(data: ReportData): string {
  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10);

  const activeSprints = data.sprintInfos.filter(s => s.currentState !== 'Closed');
  const ciFailures = data.workflowRuns.filter(r => r.conclusion === 'failure');
  const incidents = data.hulyIssues.filter(i => i.title.startsWith('[INCIDENT]'));
  const driftIssues = data.hulyIssues.filter(i => i.title.startsWith('[DRIFT]'));

  // Merges in last 24h
  const yesterday = new Date(Date.now() - 86_400_000);
  const recentMerges = data.mergedPRs.filter(
    pr => pr.mergedAt && new Date(pr.mergedAt) >= yesterday
  );

  let md = `# Daily Reality Report — ${dateStr}\n\n`;
  md += `**Generated:** ${now}\n`;
  md += `**Repo:** ${data.repoSummary.defaultBranch} (last commit: ${data.repoSummary.lastCommitSha})\n\n`;

  // Active Sprints
  md += `## Active Sprints (${activeSprints.length})\n\n`;
  if (activeSprints.length === 0) {
    md += `_No active sprints._\n\n`;
  } else {
    md += `| Sprint | State | Open PRs | CI Status | Proof |\n`;
    md += `|--------|-------|----------|-----------|-------|\n`;
    for (const s of activeSprints) {
      const openCount = s.linkedPRs.filter(pr => pr.state === 'open').length;
      const latestCI = s.ciRuns.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      const ciStatus = latestCI
        ? latestCI.conclusion === 'success'
          ? 'passing'
          : latestCI.conclusion === 'failure'
            ? 'FAILING'
            : latestCI.status
        : 'none';
      md += `| ${s.sprintId} | ${s.currentState} | ${openCount} | ${ciStatus} | ${s.proofExists ? 'yes' : 'no'} |\n`;
    }
    md += `\n`;
  }

  // CI Failures
  md += `## CI Failures (${ciFailures.length})\n\n`;
  if (ciFailures.length === 0) {
    md += `_No CI failures on sprint branches._\n\n`;
  } else {
    for (const run of ciFailures.slice(0, 10)) {
      md += `- **${run.name}** on \`${run.headBranch}\` (${run.headSha}) — [view](${run.url})\n`;
    }
    md += `\n`;
  }

  // Incidents + Drift
  md += `## Incidents (${incidents.length}) / Drift (${driftIssues.length})\n\n`;
  const openIncidents = incidents.filter(i => i.status !== 'Done' && i.status !== 'Cancelled');
  if (openIncidents.length > 0) {
    for (const i of openIncidents) {
      md += `- **${i.title}** (${i.identifier || i.id}) — ${i.status}\n`;
    }
  } else {
    md += `_No open incidents._\n`;
  }
  if (data.driftViolations.length > 0) {
    md += `\n**Drift violations detected:** ${data.driftViolations.length}\n`;
    for (const v of data.driftViolations.slice(0, 5)) {
      md += `- [${v.severity}] ${v.ruleId}: ${v.message}\n`;
    }
  }
  md += `\n`;

  // Recent Merges
  md += `## Merges (last 24h): ${recentMerges.length}\n\n`;
  if (recentMerges.length === 0) {
    md += `_No merges in the last 24 hours._\n\n`;
  } else {
    for (const pr of recentMerges) {
      md += `- PR #${pr.number}: ${pr.title} (merged ${pr.mergedAt?.slice(0, 10)})\n`;
    }
    md += `\n`;
  }

  // Summary stats
  md += `## Stats\n\n`;
  md += `- Open PRs: ${data.openPRs.length}\n`;
  md += `- Total Huly issues: ${data.hulyIssues.length}\n`;
  md += `- Sprint branches tracked: ${data.sprintInfos.length}\n`;
  md += `- Drift violations: ${data.driftViolations.length} (${data.driftViolations.filter(v => v.severity === 'error').length} errors)\n`;

  return md;
}

// ── Weekly Ops Digest ────────────────────────────────────────────────────

function buildWeeklyReport(data: ReportData): string {
  const now = new Date().toISOString();
  const weekStart = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const weekEnd = now.slice(0, 10);

  const closedSprints = data.sprintInfos.filter(s => s.currentState === 'Closed');
  const activeSprints = data.sprintInfos.filter(s => s.currentState !== 'Closed');

  // Week merges
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const weekMerges = data.mergedPRs.filter(pr => pr.mergedAt && new Date(pr.mergedAt) >= weekAgo);

  // Time-to-merge estimates
  const mergeTimes: number[] = [];
  for (const pr of weekMerges) {
    if (pr.mergedAt && pr.createdAt) {
      const created = new Date(pr.createdAt).getTime();
      const merged = new Date(pr.mergedAt).getTime();
      mergeTimes.push((merged - created) / 3_600_000); // hours
    }
  }
  const avgMergeHours =
    mergeTimes.length > 0 ? mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length : 0;

  // CI failure count for the week
  const ciFailures = data.workflowRuns.filter(r => r.conclusion === 'failure');
  const incidents = data.hulyIssues.filter(i => i.title.startsWith('[INCIDENT]'));

  // Top failure causes (by workflow name)
  const failureCounts = new Map<string, number>();
  for (const run of ciFailures) {
    failureCounts.set(run.name, (failureCounts.get(run.name) ?? 0) + 1);
  }
  const topFailures = [...failureCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  let md = `# Weekly Ops Digest — ${weekStart} to ${weekEnd}\n\n`;
  md += `**Generated:** ${now}\n\n`;

  // Sprints completed
  md += `## Sprints Completed: ${closedSprints.length}\n\n`;
  if (closedSprints.length > 0) {
    for (const s of closedSprints) {
      md += `- **${s.sprintId}** — proof: ${s.proofExists ? 'yes' : 'missing'}\n`;
    }
  } else {
    md += `_No sprints completed this week._\n`;
  }
  md += `\n`;

  // Active sprints
  md += `## Active Sprints: ${activeSprints.length}\n\n`;
  for (const s of activeSprints) {
    md += `- **${s.sprintId}** — ${s.currentState} (${s.linkedPRs.length} PRs)\n`;
  }
  md += `\n`;

  // Merge velocity
  md += `## Merge Velocity\n\n`;
  md += `- PRs merged this week: ${weekMerges.length}\n`;
  md += `- Average time-to-merge: ${avgMergeHours > 0 ? `${avgMergeHours.toFixed(1)}h` : 'N/A'}\n\n`;

  // Top failure causes
  md += `## Top CI Failure Causes (${ciFailures.length} total)\n\n`;
  if (topFailures.length === 0) {
    md += `_No CI failures on sprint branches._\n`;
  } else {
    for (const [name, count] of topFailures) {
      md += `- **${name}**: ${count} failure(s)\n`;
    }
  }
  md += `\n`;

  // Incident summary
  md += `## Incidents: ${incidents.length}\n\n`;
  const openIncidents = incidents.filter(i => i.status !== 'Done' && i.status !== 'Cancelled');
  md += `- Open: ${openIncidents.length}\n`;
  md += `- Total: ${incidents.length}\n\n`;

  // Drift summary
  md += `## Drift Violations: ${data.driftViolations.length}\n\n`;
  const errorCount = data.driftViolations.filter(v => v.severity === 'error').length;
  const warnCount = data.driftViolations.filter(v => v.severity === 'warning').length;
  md += `- Errors: ${errorCount}\n`;
  md += `- Warnings: ${warnCount}\n`;

  return md;
}

// ── Public API ───────────────────────────────────────────────────────────

export async function publishDailyReport(cfgOverride?: DaemonConfig): Promise<string> {
  const config = cfgOverride ?? loadConfig();
  console.log('[report] Gathering data for daily report...');

  const data = await gatherData(config);
  const markdown = buildDailyReport(data);

  console.log('[report] Publishing daily report to Huly...');
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);
  await huly.connect();

  const dateStr = new Date().toISOString().slice(0, 10);
  const docTitle = `Daily Reality Report — ${dateStr}`;
  const { id, created } = await huly.upsertDoc(config.HULY_TEAMSPACE, docTitle, markdown);

  console.log(`[report] Daily report ${created ? 'created' : 'updated'}: ${id}`);
  return markdown;
}

export async function publishWeeklyReport(cfgOverride?: DaemonConfig): Promise<string> {
  const config = cfgOverride ?? loadConfig();
  console.log('[report] Gathering data for weekly report...');

  const data = await gatherData(config);
  const markdown = buildWeeklyReport(data);

  console.log('[report] Publishing weekly report to Huly...');
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);
  await huly.connect();

  const weekEnd = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const docTitle = `Weekly Ops Digest — ${weekStart} to ${weekEnd}`;
  const { id, created } = await huly.upsertDoc(config.HULY_TEAMSPACE, docTitle, markdown);

  console.log(`[report] Weekly report ${created ? 'created' : 'updated'}: ${id}`);
  return markdown;
}
