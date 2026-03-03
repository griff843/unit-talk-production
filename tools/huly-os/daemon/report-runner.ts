// SPRINT-HULY-OS-WRITE-SURFACE-STABILIZATION-003: Report runner orchestrator
// Uses layered publish strategy via publish-orchestrator.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { GitHubAdapter } from './adapters/github-adapter.js';
import { HulyAdapter } from './adapters/huly-adapter.js';
import { AuditLogger } from './audit-log.js';
import { loadConfig, loadConfigGitHubOnly, type DaemonConfig } from './config.js';
import { evaluateDrift } from './drift-rules.js';
import { buildReport, type ReportInputs } from './formatters/json-report.js';
import { renderMarkdown } from './formatters/markdown-report.js';
import { publish } from './publish-orchestrator.js';

import type { HulyIssue, RealityReport } from './adapters/types.js';

const SPRINT_ID = 'SPRINT-HULY-OS-WRITE-SURFACE-STABILIZATION-003';

export interface RunOptions {
  dryRun: boolean;
}

export async function runReport(options: RunOptions): Promise<void> {
  const { dryRun } = options;
  const audit = new AuditLogger();

  // Load config — dry-run only requires GitHub
  let config: DaemonConfig;
  try {
    config = dryRun ? loadConfigGitHubOnly() : loadConfig();
  } catch (err) {
    console.error(`FATAL: ${(err as Error).message}`);
    process.exit(1);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = resolve(config.OUTPUT_DIR, dateStr);
  mkdirSync(outDir, { recursive: true });

  // Redirect console to capture run.log
  const logLines: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const capture =
    (prefix: string) =>
    (...args: unknown[]) => {
      const line = `[${new Date().toISOString()}] [${prefix}] ${args.map(String).join(' ')}`;
      logLines.push(line);
      origLog(line);
    };
  console.log = capture('INFO');
  console.warn = capture('WARN');
  console.error = capture('ERROR');

  try {
    console.log(`Starting report generation (mode: ${dryRun ? 'dry-run' : 'live'})`);

    // Initialize GitHub adapter (always required)
    const github = new GitHubAdapter(config, audit);

    // Gather GitHub data
    console.log('Gathering GitHub data...');
    const [repoSummary, openPRs, mergedPRs] = await Promise.all([
      github.getRepoSummary(),
      github.listOpenPRs(),
      github.listRecentlyMergedPRs(7),
    ]);
    console.log(`GitHub: ${repoSummary.openPrs} open PRs, ${mergedPRs.length} recently merged`);

    // Initialize Huly adapter
    let hulyAvailable = false;
    let hulyIssues: HulyIssue[] = [];
    const huly = new HulyAdapter(config, audit);

    try {
      console.log('Connecting to Huly...');
      await huly.connect();
      const pingOk = await huly.ping();
      if (!pingOk) throw new Error('Huly ping returned false');
      hulyAvailable = true;
      console.log('Huly connected.');

      // Gather Huly data
      console.log(`Listing issues for project: ${config.HULY_PROJECT}...`);
      hulyIssues = await huly.listIssues(config.HULY_PROJECT);
      console.log(`Huly: ${hulyIssues.length} issues found`);
    } catch (err) {
      const msg = (err as Error).message;
      // Huly connection failed — log and continue.
      // In --run mode the publish orchestrator will attempt fallback surfaces.
      console.warn(`Huly unreachable: ${msg}`);
      audit.log({
        source: 'daemon',
        op: 'huly_unavailable',
        target: config.HULY_URL,
        ok: false,
        latencyMs: 0,
        error: msg,
      });
    }

    // Run drift rules
    console.log('Evaluating drift rules...');
    const violations = evaluateDrift(openPRs, mergedPRs, hulyIssues);
    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;
    console.log(`Drift: ${violations.length} violations (${errors} errors, ${warnings} warnings)`);

    // Build report
    const reportInputs: ReportInputs = {
      sprintId: SPRINT_ID,
      dryRun,
      hulyAvailable,
      repo: `${config.GITHUB_OWNER}/${config.GITHUB_REPO}`,
      repoSummary,
      mergedPRs,
      hulyIssues,
      hulyProject: config.HULY_PROJECT,
      violations,
      audit,
    };

    const report: RealityReport = buildReport(reportInputs);
    const markdownContent = renderMarkdown(report);

    // Write local artifacts
    console.log(`Writing artifacts to ${outDir}/`);
    writeArtifact(audit, outDir, 'report.json', JSON.stringify(report, null, 2));
    writeArtifact(audit, outDir, 'report.md', markdownContent);

    // Publish to Huly via layered strategy (--run mode only)
    if (!dryRun && hulyAvailable) {
      console.log('Publishing report via layered strategy...');
      const artifactRelPath = `out/ops/reality/${dateStr}/report.md`;
      const publishResult = await publish(
        huly,
        {
          teamspaceName: config.HULY_TEAMSPACE,
          projectIdentifier: config.HULY_PROJECT,
          title: `Reality Report \u2014 ${dateStr}`,
          markdownContent,
          artifactPath: artifactRelPath,
          fallbackIssueId: config.HULY_REPORT_FALLBACK_ISSUE_ID,
        },
        audit
      );
      console.log(`Published via [${publishResult.surface}]: ${publishResult.id}`);
    }

    // Flush audit + run log
    flushArtifacts(audit, logLines, outDir);

    console.log('Report generation complete.');
    console.log(`Artifacts: ${outDir}/`);

    // Exit with appropriate code
    // dry-run always exits 0 (violations are informational)
    // run mode exits 1 if there are error-severity drift violations
    if (!dryRun && errors > 0) {
      console.warn(`Exiting with code 1: ${errors} error-severity drift violations`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`FATAL: Unhandled error: ${(err as Error).message}`);
    flushArtifacts(audit, logLines, outDir);
    process.exit(1);
  } finally {
    // Restore console
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }
}

function writeArtifact(audit: AuditLogger, dir: string, filename: string, content: string): void {
  const filepath = join(dir, filename);
  audit.log({
    source: 'fs',
    op: 'write_artifact',
    target: filepath,
    ok: true,
    latencyMs: 0,
  });
  writeFileSync(filepath, content, 'utf-8');
}

function flushArtifacts(audit: AuditLogger, logLines: string[], outDir: string): void {
  try {
    audit.flush(join(outDir, 'audit.jsonl'));
    writeFileSync(join(outDir, 'run.log'), logLines.join('\n') + '\n', 'utf-8');
  } catch {
    // Best-effort flush — don't mask the original error
  }
}
