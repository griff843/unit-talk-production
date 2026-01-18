#!/usr/bin/env npx tsx
/**
 * CI Health Measurement Script
 *
 * Measures key CI health metrics for the Required Checks Rollout:
 * - Main Green Percentage
 * - Per-workflow pass rates
 * - Average execution time
 * - Flake detection
 *
 * Usage:
 *   npx tsx scripts/ops/measure-ci-health.ts
 *   npx tsx scripts/ops/measure-ci-health.ts --workflow="CI Pipeline"
 *   npx tsx scripts/ops/measure-ci-health.ts --days=7
 *
 * @see docs/ops/REQUIRED_CHECKS_ROLLOUT.md
 */

import { execSync } from 'child_process';

// =============================================================================
// Types
// =============================================================================

interface WorkflowRun {
  status: string;
  conclusion: string;
  name: string;
  headBranch: string;
  event: string;
  databaseId: number;
  runStartedAt: string;
  updatedAt: string;
}

interface HealthMetrics {
  mainGreenPercent: number;
  totalRuns: number;
  successRuns: number;
  failureRuns: number;
  cancelledRuns: number;
  workflowBreakdown: Record<
    string,
    {
      total: number;
      success: number;
      failure: number;
      passRate: number;
    }
  >;
  avgExecutionMinutes: number;
  potentialFlakes: string[];
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 50;

// Workflows to track
const TRACKED_WORKFLOWS = [
  'CI Pipeline',
  'Compile Green Validation',
  'Charter Guards - PostgREST Alignment',
  'E2E CI Pipeline',
  'Foundation CI/CD Pipeline',
  'Schema Drift Detection',
  'Playwright Proof Pack',
  'Canonical Convergence CI/CD',
];

// =============================================================================
// Helpers
// =============================================================================

function parseArgs(): { workflow?: string; days: number } {
  const args: { workflow?: string; days: number } = { days: DEFAULT_DAYS };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--workflow=')) {
      args.workflow = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--days=')) {
      args.days = parseInt(arg.split('=')[1], 10);
    }
  }

  return args;
}

function runGhCommand(command: string): string {
  try {
    return execSync(`gh ${command}`, { encoding: 'utf-8' });
  } catch (error) {
    console.error(`Error running gh command: ${command}`);
    return '';
  }
}

function getWorkflowRuns(branch: string, limit: number): WorkflowRun[] {
  const jsonOutput = runGhCommand(
    `run list --branch ${branch} --limit ${limit} --json status,conclusion,name,headBranch,event,databaseId,runStartedAt,updatedAt`
  );

  if (!jsonOutput) return [];

  try {
    return JSON.parse(jsonOutput);
  } catch {
    return [];
  }
}

function calculateExecutionTime(run: WorkflowRun): number {
  const start = new Date(run.runStartedAt).getTime();
  const end = new Date(run.updatedAt).getTime();
  return (end - start) / 1000 / 60; // minutes
}

function detectPotentialFlakes(runs: WorkflowRun[]): string[] {
  const workflowFailures: Record<string, number> = {};
  const workflowTotal: Record<string, number> = {};

  for (const run of runs) {
    workflowTotal[run.name] = (workflowTotal[run.name] || 0) + 1;
    if (run.conclusion === 'failure') {
      workflowFailures[run.name] = (workflowFailures[run.name] || 0) + 1;
    }
  }

  const flakes: string[] = [];

  for (const [workflow, total] of Object.entries(workflowTotal)) {
    const failures = workflowFailures[workflow] || 0;
    const failRate = failures / total;

    // If failure rate is between 10% and 50%, it might be flaky
    // (consistent failures are not flakes, they're bugs)
    if (failRate > 0.1 && failRate < 0.5) {
      flakes.push(`${workflow} (${(failRate * 100).toFixed(1)}% failure rate)`);
    }
  }

  return flakes;
}

function calculateMetrics(runs: WorkflowRun[]): HealthMetrics {
  const metrics: HealthMetrics = {
    mainGreenPercent: 0,
    totalRuns: runs.length,
    successRuns: 0,
    failureRuns: 0,
    cancelledRuns: 0,
    workflowBreakdown: {},
    avgExecutionMinutes: 0,
    potentialFlakes: [],
  };

  let totalExecutionTime = 0;

  for (const run of runs) {
    // Count by conclusion
    if (run.conclusion === 'success') {
      metrics.successRuns++;
    } else if (run.conclusion === 'failure') {
      metrics.failureRuns++;
    } else if (run.conclusion === 'cancelled') {
      metrics.cancelledRuns++;
    }

    // Workflow breakdown
    if (!metrics.workflowBreakdown[run.name]) {
      metrics.workflowBreakdown[run.name] = {
        total: 0,
        success: 0,
        failure: 0,
        passRate: 0,
      };
    }

    metrics.workflowBreakdown[run.name].total++;
    if (run.conclusion === 'success') {
      metrics.workflowBreakdown[run.name].success++;
    } else if (run.conclusion === 'failure') {
      metrics.workflowBreakdown[run.name].failure++;
    }

    // Execution time
    totalExecutionTime += calculateExecutionTime(run);
  }

  // Calculate pass rates
  for (const workflow of Object.keys(metrics.workflowBreakdown)) {
    const w = metrics.workflowBreakdown[workflow];
    w.passRate = w.total > 0 ? (w.success / w.total) * 100 : 0;
  }

  // Calculate overall metrics
  metrics.mainGreenPercent =
    runs.length > 0 ? (metrics.successRuns / runs.length) * 100 : 0;
  metrics.avgExecutionMinutes = runs.length > 0 ? totalExecutionTime / runs.length : 0;
  metrics.potentialFlakes = detectPotentialFlakes(runs);

  return metrics;
}

function printReport(metrics: HealthMetrics, days: number): void {
  console.log('='.repeat(70));
  console.log('CI Health Report - Main Branch');
  console.log('='.repeat(70));
  console.log();
  console.log(`Period: Last ${days} days`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log();

  // Overall Health
  console.log('-'.repeat(70));
  console.log('OVERALL HEALTH');
  console.log('-'.repeat(70));
  console.log();

  const greenIcon = metrics.mainGreenPercent >= 95 ? '  ' : metrics.mainGreenPercent >= 80 ? '  ' : '  ';
  console.log(`  Main Green %:      ${greenIcon} ${metrics.mainGreenPercent.toFixed(1)}%`);
  console.log(`  Total Runs:           ${metrics.totalRuns}`);
  console.log(`  Successful:           ${metrics.successRuns}`);
  console.log(`  Failed:               ${metrics.failureRuns}`);
  console.log(`  Cancelled:            ${metrics.cancelledRuns}`);
  console.log(`  Avg Execution Time:   ${metrics.avgExecutionMinutes.toFixed(1)} minutes`);
  console.log();

  // Status Assessment
  if (metrics.mainGreenPercent >= 95) {
    console.log('  Assessment: HEALTHY - Ready for required checks rollout');
  } else if (metrics.mainGreenPercent >= 80) {
    console.log('  Assessment: CAUTION - Fix failures before enabling more checks');
  } else {
    console.log('  Assessment: CRITICAL - Fix failures immediately, do not add required checks');
  }
  console.log();

  // Workflow Breakdown
  console.log('-'.repeat(70));
  console.log('WORKFLOW BREAKDOWN');
  console.log('-'.repeat(70));
  console.log();
  console.log(
    '  ' +
      'Workflow'.padEnd(45) +
      'Total'.padStart(6) +
      'Pass'.padStart(6) +
      'Fail'.padStart(6) +
      'Rate'.padStart(8)
  );
  console.log('  ' + '-'.repeat(65));

  const sortedWorkflows = Object.entries(metrics.workflowBreakdown).sort(
    (a, b) => b[1].total - a[1].total
  );

  for (const [name, data] of sortedWorkflows) {
    const truncatedName = name.length > 43 ? name.substring(0, 40) + '...' : name;
    const rateStr = `${data.passRate.toFixed(0)}%`;
    console.log(
      '  ' +
        truncatedName.padEnd(45) +
        String(data.total).padStart(6) +
        String(data.success).padStart(6) +
        String(data.failure).padStart(6) +
        rateStr.padStart(8)
    );
  }
  console.log();

  // Potential Flakes
  if (metrics.potentialFlakes.length > 0) {
    console.log('-'.repeat(70));
    console.log('POTENTIAL FLAKY WORKFLOWS');
    console.log('-'.repeat(70));
    console.log();
    console.log('  These workflows have intermittent failures (10-50% failure rate):');
    console.log();
    for (const flake of metrics.potentialFlakes) {
      console.log(`    - ${flake}`);
    }
    console.log();
    console.log('  Recommendation: Add retry policy before making these required checks');
    console.log();
  }

  // Recommendations
  console.log('-'.repeat(70));
  console.log('ROLLOUT READINESS');
  console.log('-'.repeat(70));
  console.log();

  const readyChecks: string[] = [];
  const notReadyChecks: string[] = [];

  for (const [name, data] of sortedWorkflows) {
    if (data.passRate >= 95) {
      readyChecks.push(`${name} (${data.passRate.toFixed(0)}%)`);
    } else {
      notReadyChecks.push(`${name} (${data.passRate.toFixed(0)}%)`);
    }
  }

  if (readyChecks.length > 0) {
    console.log('  Ready for Required Check (>95% pass rate):');
    for (const check of readyChecks.slice(0, 5)) {
      console.log(`    [OK] ${check}`);
    }
    console.log();
  }

  if (notReadyChecks.length > 0) {
    console.log('  NOT Ready (fix failures first):');
    for (const check of notReadyChecks.slice(0, 5)) {
      console.log(`    [!!] ${check}`);
    }
    console.log();
  }

  console.log('='.repeat(70));
  console.log();
  console.log('See docs/ops/REQUIRED_CHECKS_ROLLOUT.md for rollout procedures.');
  console.log();
}

function outputJson(metrics: HealthMetrics): void {
  console.log(JSON.stringify(metrics, null, 2));
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  // Verify gh CLI is available
  try {
    execSync('gh --version', { encoding: 'utf-8' });
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed or not in PATH.');
    console.error('Install from: https://cli.github.com/');
    process.exit(1);
  }

  // Verify authentication
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    console.error('Error: Not authenticated with GitHub CLI.');
    console.error('Run: gh auth login');
    process.exit(1);
  }

  console.log(`Fetching CI runs for last ${args.days} days...`);
  console.log();

  // Calculate limit based on days (approximate 10 runs per day)
  const limit = Math.min(args.days * 10, DEFAULT_LIMIT);

  const runs = getWorkflowRuns('main', limit);

  if (runs.length === 0) {
    console.error('No workflow runs found on main branch.');
    process.exit(1);
  }

  // Filter by workflow if specified
  let filteredRuns = runs;
  if (args.workflow) {
    filteredRuns = runs.filter((r) => r.name === args.workflow);
    if (filteredRuns.length === 0) {
      console.error(`No runs found for workflow: ${args.workflow}`);
      process.exit(1);
    }
  }

  const metrics = calculateMetrics(filteredRuns);

  // Check for JSON output flag
  if (process.argv.includes('--json')) {
    outputJson(metrics);
  } else {
    printReport(metrics, args.days);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
