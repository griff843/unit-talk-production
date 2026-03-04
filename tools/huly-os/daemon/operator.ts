// SPRINT-HULY-OPERATOR-014: Autonomous operator loop
// Pull-based polling: GitHub scan → sprint correlation → Huly sync → incidents/drift → reports
// Idempotent. Fail-closed. No webhooks.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { GitHubAdapter } from './adapters/github-adapter.js';
import { HulyAdapter } from './adapters/huly-adapter.js';
import { AuditLogger } from './audit-log.js';
import { loadConfig, REPO_ROOT } from './config.js';
import { evaluateSprints, applySprintTransitions, branchToSprintId } from './sprint-manager.js';

import type { GitHubPR, HulyIssue, WorkflowRun } from './adapters/types.js';
import type { DaemonConfig } from './config.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface OperatorCycleResult {
  timestamp: string;
  durationMs: number;
  github: {
    openPRs: number;
    mergedPRs: number;
    workflowRuns: number;
    sprintBranches: string[];
  };
  huly: {
    totalIssues: number;
    sprintIssues: number;
  };
  actions: {
    sprintIssuesUpserted: number;
    tasksEnsured: number;
    prLinksCreated: number;
    statusTransitions: number;
    incidentsCreated: number;
    driftIssuesCreated: number;
  };
  errors: string[];
}

// ── Idempotency Tracking ─────────────────────────────────────────────────

// In-memory dedup for the current process lifetime.
// Keys: "incident:{sprintId}:{runId}", "drift:{ruleId}:{entityId}", "prlink:{issueId}:{prNumber}"
const seenKeys = new Set<string>();

function dedupKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

function alreadySeen(key: string): boolean {
  if (seenKeys.has(key)) return true;
  seenKeys.add(key);
  return false;
}

// ── Sprint ID Extraction ─────────────────────────────────────────────────

const SPRINT_ID_RE = /SPRINT-[\w-]+-\d+/i;

/** Extract sprint ID from branch name, PR title, or commit messages */
function extractSprintId(sources: string[]): string | null {
  for (const src of sources) {
    // Try branch name convention: sprint/<id>
    const branchId = branchToSprintId(src);
    if (branchId) return branchId;

    // Try regex match on SPRINT-*-### pattern
    const m = src.match(SPRINT_ID_RE);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

/** Derive a sprint ID from a branch name using convention */
function branchToNormalizedSprintId(branch: string): string | null {
  if (!branch.startsWith('sprint/')) return null;
  const suffix = branch.replace('sprint/', '').toUpperCase();
  return `SPRINT-${suffix}`;
}

// ── Core Tasks ───────────────────────────────────────────────────────────

const CORE_SPRINT_TASKS = ['Plan', 'Implement', 'Verify', 'Proof', 'Closeout'];

// ── Operator Cycle ───────────────────────────────────────────────────────

/**
 * Execute a single operator cycle: scan → correlate → sync → incidents → drift.
 * Fail-closed: if GitHub or Huly auth fails, creates ONE incident entry and exits.
 */
export async function runOperatorCycle(opts?: {
  config?: DaemonConfig;
}): Promise<OperatorCycleResult> {
  const start = Date.now();
  const result: OperatorCycleResult = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    github: { openPRs: 0, mergedPRs: 0, workflowRuns: 0, sprintBranches: [] },
    huly: { totalIssues: 0, sprintIssues: 0 },
    actions: {
      sprintIssuesUpserted: 0,
      tasksEnsured: 0,
      prLinksCreated: 0,
      statusTransitions: 0,
      incidentsCreated: 0,
      driftIssuesCreated: 0,
    },
    errors: [],
  };

  // ── Load config (fail-closed) ────────────────────────────────────────
  let config: DaemonConfig;
  try {
    config = opts?.config ?? loadConfig();
  } catch (err) {
    const msg = `Config load failed: ${(err as Error).message}`;
    console.error(`[operator] FATAL: ${msg}`);
    result.errors.push(msg);
    result.durationMs = Date.now() - start;
    return result;
  }

  const audit = new AuditLogger();
  const github = new GitHubAdapter(config, audit);
  let huly: HulyAdapter;

  // ── Connect to Huly (fail-closed) ────────────────────────────────────
  try {
    huly = new HulyAdapter(config, audit);
    await huly.connect();
  } catch (err) {
    const msg = `Huly connection failed: ${(err as Error).message}`;
    console.error(`[operator] FAIL-CLOSED: ${msg}`);

    // Create single incident and exit
    try {
      const fallbackHuly = new HulyAdapter(config, audit);
      await fallbackHuly.connect();
      await fallbackHuly.upsertIssueByTitle(
        config.HULY_PROJECT,
        '[INCIDENT] Huly-OS operator down',
        `Operator failed to connect to Huly.\n\nError: ${msg}\nTimestamp: ${result.timestamp}`
      );
    } catch {
      // Can't even create the incident — truly down
    }

    result.errors.push(msg);
    result.durationMs = Date.now() - start;
    return result;
  }

  console.log('[operator] Connected to Huly + GitHub');

  // ── Phase 1: GitHub Scan ─────────────────────────────────────────────
  let openPRs: GitHubPR[] = [];
  let mergedPRs: GitHubPR[] = [];
  let workflowRuns: WorkflowRun[] = [];

  try {
    [openPRs, mergedPRs] = await Promise.all([
      github.listOpenPRs(),
      github.listRecentlyMergedPRs(30),
    ]);
    result.github.openPRs = openPRs.length;
    result.github.mergedPRs = mergedPRs.length;
  } catch (err) {
    const msg = `GitHub PR scan failed: ${(err as Error).message}`;
    console.error(`[operator] FAIL-CLOSED: ${msg}`);
    // Create incident for GitHub auth failure
    try {
      await huly.upsertIssueByTitle(
        config.HULY_PROJECT,
        '[INCIDENT] Huly-OS operator down',
        `Operator failed to access GitHub API.\n\nError: ${msg}\nTimestamp: ${result.timestamp}`
      );
    } catch {
      // best-effort
    }
    result.errors.push(msg);
    result.durationMs = Date.now() - start;
    return result;
  }

  // Collect sprint branches from PRs
  const sprintBranches = new Set<string>();
  for (const pr of [...openPRs, ...mergedPRs]) {
    if (pr.headBranch.startsWith('sprint/')) {
      sprintBranches.add(pr.headBranch);
    }
  }
  result.github.sprintBranches = [...sprintBranches];

  // Fetch workflow runs for sprint branches
  try {
    const runs = await github.getWorkflowRuns();
    workflowRuns = runs.filter(r => r.headBranch.startsWith('sprint/'));
    result.github.workflowRuns = workflowRuns.length;
  } catch (err) {
    result.errors.push(`Workflow runs fetch failed: ${(err as Error).message}`);
  }

  console.log(
    `[operator] GitHub: ${openPRs.length} open PRs, ${mergedPRs.length} merged, ` +
      `${workflowRuns.length} sprint CI runs, ${sprintBranches.size} sprint branches`
  );

  // ── Phase 2: Huly Issue Scan ─────────────────────────────────────────
  let hulyIssues: HulyIssue[] = [];
  try {
    hulyIssues = await huly.listIssues(config.HULY_PROJECT);
    result.huly.totalIssues = hulyIssues.length;
    result.huly.sprintIssues = hulyIssues.filter(i => i.title.startsWith('[SPRINT]')).length;
  } catch (err) {
    result.errors.push(`Huly issue scan failed: ${(err as Error).message}`);
  }

  console.log(`[operator] Huly: ${hulyIssues.length} issues (${result.huly.sprintIssues} sprints)`);

  // ── Phase 3: Sprint Correlation + Huly Sync ──────────────────────────
  // For each sprint branch, ensure a [SPRINT] issue exists and is linked
  for (const branch of sprintBranches) {
    const sprintId = extractSprintId([branch]) ?? branchToNormalizedSprintId(branch);

    if (!sprintId) continue;

    const sprintTitle = `[SPRINT] ${sprintId}`;

    // Upsert sprint issue (idempotent by title)
    try {
      const { id, created } = await huly.upsertIssueByTitle(
        config.HULY_PROJECT,
        sprintTitle,
        `Sprint: ${sprintId}\nBranch: ${branch}\nAuto-managed by Huly-OS operator.`
      );

      if (created) {
        result.actions.sprintIssuesUpserted++;
        console.log(`[operator] Created sprint issue: ${sprintTitle}`);
      }

      // Ensure core tasks exist
      const freshIssues = created ? await huly.listIssues(config.HULY_PROJECT) : hulyIssues;
      for (const taskName of CORE_SPRINT_TASKS) {
        const taskTitle = `${taskName} — ${sprintId}`;
        const exists = freshIssues.some(i => i.title === taskTitle);
        if (!exists) {
          const taskKey = dedupKey('task', sprintId, taskName);
          if (!alreadySeen(taskKey)) {
            try {
              await huly.upsertIssueByTitle(
                config.HULY_PROJECT,
                taskTitle,
                `Sprint task: ${taskName} for ${sprintId}`
              );
              result.actions.tasksEnsured++;
            } catch (err) {
              result.errors.push(`Task creation failed: ${taskTitle} — ${(err as Error).message}`);
            }
          }
        }
      }

      // Link PRs to sprint issue
      const sprintPRs = [...openPRs, ...mergedPRs].filter(pr => pr.headBranch === branch);
      for (const pr of sprintPRs) {
        const linkKey = dedupKey('prlink', id, pr.number);
        if (!alreadySeen(linkKey)) {
          try {
            await huly.linkIssueToPR(id, pr.number, pr.title, pr.url);
            result.actions.prLinksCreated++;
          } catch (err) {
            result.errors.push(
              `PR link failed: #${pr.number} → ${sprintId} — ${(err as Error).message}`
            );
          }
        }
      }
    } catch (err) {
      result.errors.push(`Sprint upsert failed: ${sprintTitle} — ${(err as Error).message}`);
    }
  }

  // ── Phase 4: Status Evaluation + Transitions ─────────────────────────
  // Re-fetch issues to include any newly created sprint issues
  try {
    hulyIssues = await huly.listIssues(config.HULY_PROJECT);
  } catch {
    // Use cached version
  }

  const evalResult = evaluateSprints(hulyIssues, openPRs, mergedPRs, workflowRuns);

  if (evalResult.transitions.length > 0 || evalResult.incidents.length > 0) {
    const applied = await applySprintTransitions(huly, config, evalResult);
    result.actions.statusTransitions = applied.applied;
    result.actions.incidentsCreated += applied.incidentsCreated;
    console.log(
      `[operator] Sprint transitions: ${applied.applied}, incidents: ${applied.incidentsCreated}`
    );
  }

  // ── Phase 5: Additional Drift/Incident Rules ─────────────────────────

  // Build set of "active" sprint branches — those with at least one open PR.
  // Branches that are fully merged have no open work and should not generate
  // new incidents or drift issues (prevents stale noise).
  const activeBranches = new Set<string>();
  for (const pr of openPRs) {
    if (pr.headBranch.startsWith('sprint/')) {
      activeBranches.add(pr.headBranch);
    }
  }

  // Also treat workflow runs younger than 7 days as potentially active
  // (covers branches where the PR was just opened or CI re-triggered).
  const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // CI Failure Incidents (per sprint branch, per run — idempotent)
  for (const run of workflowRuns) {
    if (run.conclusion !== 'failure') continue;

    // Skip stale runs on branches with no open PR
    if (!activeBranches.has(run.headBranch)) {
      const runAge = now - new Date(run.createdAt).getTime();
      if (runAge > STALE_THRESHOLD_MS) continue;
    }

    const sprintId =
      extractSprintId([run.headBranch]) ?? branchToNormalizedSprintId(run.headBranch);
    if (!sprintId) continue;

    const incidentKey = dedupKey('incident', sprintId, run.id);
    if (alreadySeen(incidentKey)) continue;

    const incidentTitle = `[INCIDENT] CI failure blocking ${sprintId}`;
    try {
      const { created } = await huly.upsertIssueByTitle(
        config.HULY_PROJECT,
        incidentTitle,
        `CI workflow "${run.name}" failed on branch ${run.headBranch}.\n\n` +
          `Run: ${run.url}\n` +
          `SHA: ${run.headSha}\n` +
          `Detected: ${result.timestamp}`
      );
      if (created) {
        result.actions.incidentsCreated++;
        console.log(`[operator] Created incident: ${incidentTitle}`);

        // Comment on sprint issue with CI failure link
        const sprintIssue = hulyIssues.find(
          i => i.title.startsWith('[SPRINT]') && i.title.includes(sprintId)
        );
        if (sprintIssue) {
          try {
            await huly.addComment(
              sprintIssue.id,
              `**CI Failure detected:** ${run.name}\nBranch: ${run.headBranch}\nRun: ${run.url}`
            );
          } catch {
            // best-effort comment
          }
        }
      }
    } catch (err) {
      result.errors.push(`Incident creation failed: ${incidentTitle} — ${(err as Error).message}`);
    }
  }

  // Orphan PR Rule: open PR on sprint/* branch but no Huly sprint issue exists
  for (const pr of openPRs) {
    if (!pr.headBranch.startsWith('sprint/')) continue;

    const sprintId =
      extractSprintId([pr.headBranch, pr.title]) ?? branchToNormalizedSprintId(pr.headBranch);
    if (!sprintId) continue;

    const hasSprintIssue = hulyIssues.some(
      i => i.title.startsWith('[SPRINT]') && i.title.includes(sprintId)
    );

    if (!hasSprintIssue) {
      const orphanKey = dedupKey('orphan', sprintId, pr.number);
      if (!alreadySeen(orphanKey)) {
        try {
          const { created } = await huly.upsertIssueByTitle(
            config.HULY_PROJECT,
            `[SPRINT] ${sprintId}`,
            `Sprint auto-created for orphan PR #${pr.number}: ${pr.title}\n\nBranch: ${pr.headBranch}`
          );
          if (created) {
            result.actions.sprintIssuesUpserted++;
            console.log(`[operator] Created sprint for orphan PR #${pr.number}: ${sprintId}`);
          }
          // Link the PR
          await huly.linkIssueToPR(
            (await huly.findIssueByTitle(config.HULY_PROJECT, `[SPRINT] ${sprintId}`))?.id ?? '',
            pr.number,
            pr.title,
            pr.url
          );
          result.actions.prLinksCreated++;
        } catch (err) {
          result.errors.push(`Orphan PR sync failed: #${pr.number} — ${(err as Error).message}`);
        }
      }
    }
  }

  // Proof Missing Rule: merged PR + CI passing but no proof bundle
  for (const pr of mergedPRs) {
    if (!pr.headBranch.startsWith('sprint/')) continue;

    const sprintId =
      extractSprintId([pr.headBranch, pr.title]) ?? branchToNormalizedSprintId(pr.headBranch);
    if (!sprintId) continue;

    // Check if CI is passing for this branch
    const branchRuns = workflowRuns.filter(r => r.headBranch === pr.headBranch);
    const latestRun = branchRuns.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const ciPassing = latestRun?.conclusion === 'success';

    if (!ciPassing) continue;

    // Check for proof bundle
    const proofDir = resolve(REPO_ROOT, 'out', 'sprints', sprintId);
    if (!existsSync(proofDir)) {
      const driftKey = dedupKey('drift', 'PROOF_MISSING', sprintId);
      if (!alreadySeen(driftKey)) {
        try {
          const { created } = await huly.upsertIssueByTitle(
            config.HULY_PROJECT,
            `[DRIFT] Missing proof bundle for ${sprintId}`,
            `PR #${pr.number} merged and CI passing, but proof bundle not found.\n\n` +
              `Expected: ${proofDir}\n` +
              `Branch: ${pr.headBranch}\n` +
              `Detected: ${result.timestamp}`
          );
          if (created) {
            result.actions.driftIssuesCreated++;
            console.log(`[operator] Created drift issue: Missing proof for ${sprintId}`);
          }
        } catch (err) {
          result.errors.push(
            `Drift issue creation failed: ${sprintId} — ${(err as Error).message}`
          );
        }
      }
    }
  }

  result.durationMs = Date.now() - start;
  console.log(
    `[operator] Cycle complete in ${result.durationMs}ms — ` +
      `${result.actions.sprintIssuesUpserted} sprints, ` +
      `${result.actions.statusTransitions} transitions, ` +
      `${result.actions.incidentsCreated} incidents, ` +
      `${result.actions.driftIssuesCreated} drift, ` +
      `${result.errors.length} errors`
  );

  return result;
}

// ── Polling Loop ─────────────────────────────────────────────────────────

export interface OperatorLoopState {
  running: boolean;
  cycleCount: number;
  lastResult: OperatorCycleResult | null;
  timer: ReturnType<typeof setInterval> | null;
}

/**
 * Start the operator polling loop.
 * @param intervalSec - Polling interval in seconds (default: 60)
 * @param once - If true, run exactly one cycle and return
 */
export async function startOperatorLoop(opts: {
  intervalSec?: number;
  once?: boolean;
  config?: DaemonConfig;
}): Promise<OperatorLoopState> {
  const intervalSec = opts.intervalSec ?? 60;
  const state: OperatorLoopState = {
    running: true,
    cycleCount: 0,
    lastResult: null,
    timer: null,
  };

  console.log(
    `[operator] Starting ${opts.once ? 'single cycle' : `loop (interval=${intervalSec}s)`}`
  );

  // Run first cycle
  state.cycleCount++;
  state.lastResult = await runOperatorCycle({ config: opts.config });

  if (opts.once) {
    state.running = false;
    return state;
  }

  // Schedule recurring cycles
  state.timer = setInterval(async () => {
    if (!state.running) return;
    state.cycleCount++;
    console.log(`\n[operator] === Cycle #${state.cycleCount} ===`);
    state.lastResult = await runOperatorCycle({ config: opts.config });
  }, intervalSec * 1000);

  return state;
}

export function stopOperatorLoop(state: OperatorLoopState): void {
  state.running = false;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  console.log(`[operator] Stopped after ${state.cycleCount} cycle(s)`);
}
