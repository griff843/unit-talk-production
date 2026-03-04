// SPRINT-OPERATOR-SCHEDULER-010: Automated report cycle scheduler
// Runs report cycles on a configurable interval.
// Normal cycles: --dry-run. Deep cycles at OPERATOR_DEEP_RUN_HOUR: --run.
// Overlap prevention via simple lock. Failure-isolated — never crashes the process.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { runReport } from './report-runner.js';

import type { DaemonConfig } from './config.js';

export interface OperatorState {
  running: boolean;
  cycleCount: number;
  lastCycleAt: string | null;
  lastError: string | null;
  timer: ReturnType<typeof setInterval> | null;
}

export interface RunReceipt {
  cycle: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  mode: 'dry-run' | 'deep';
  ok: boolean;
  error: string | null;
}

const REPO_ROOT = resolve(import.meta.dirname ?? __dirname, '..', '..', '..');

/**
 * Start the operator scheduler. Returns state for inspection/shutdown.
 * Does nothing if OPERATOR_ENABLED is false.
 */
export function startOperator(config: DaemonConfig): OperatorState | null {
  if (!config.OPERATOR_ENABLED) {
    console.log('Operator scheduler: disabled (OPERATOR_ENABLED=false)');
    return null;
  }

  const intervalMs = config.OPERATOR_INTERVAL_MINUTES * 60_000;

  const state: OperatorState = {
    running: false,
    cycleCount: 0,
    lastCycleAt: null,
    lastError: null,
    timer: null,
  };

  console.log(
    `Operator scheduler: starting (interval=${config.OPERATOR_INTERVAL_MINUTES}m, ` +
      `deep_hour=${config.OPERATOR_DEEP_RUN_HOUR}, max_concurrent=${config.OPERATOR_MAX_CONCURRENT})`
  );

  // Run first cycle immediately
  void executeCycle(state, config);

  // Schedule recurring cycles
  state.timer = setInterval(() => {
    void executeCycle(state, config);
  }, intervalMs);

  // Unref the timer so it doesn't prevent process exit on SIGINT
  if (state.timer && typeof state.timer.unref === 'function') {
    state.timer.unref();
  }

  return state;
}

/**
 * Stop the operator scheduler gracefully.
 */
export function stopOperator(state: OperatorState): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  console.log(`Operator scheduler: stopped after ${state.cycleCount} cycle(s)`);
}

/**
 * Execute a single report cycle with overlap lock and receipt writing.
 */
async function executeCycle(state: OperatorState, config: DaemonConfig): Promise<void> {
  // Overlap lock — skip if already running
  if (state.running) {
    console.log('Operator scheduler: skipping cycle (previous run still active)');
    return;
  }

  state.running = true;
  state.cycleCount++;
  const cycleNum = state.cycleCount;
  const startedAt = new Date().toISOString();
  const currentHour = new Date().getUTCHours();
  const isDeep = currentHour === config.OPERATOR_DEEP_RUN_HOUR;
  const mode: 'dry-run' | 'deep' = isDeep ? 'deep' : 'dry-run';

  console.log(`Operator cycle #${cycleNum}: starting (mode=${mode}, hour=${currentHour} UTC)`);

  let ok = true;
  let error: string | null = null;

  try {
    await runReport({
      dryRun: !isDeep,
      suppressExit: true,
    });
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : String(err);
    console.warn(`Operator cycle #${cycleNum}: failed — ${error}`);
    state.lastError = error;
  }

  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  state.lastCycleAt = finishedAt;
  state.running = false;

  console.log(`Operator cycle #${cycleNum}: ${ok ? 'completed' : 'failed'} in ${durationMs}ms`);

  // Write receipt artifacts
  const receipt: RunReceipt = {
    cycle: cycleNum,
    startedAt,
    finishedAt,
    durationMs,
    mode,
    ok,
    error,
  };

  writeReceipt(receipt);
}

/**
 * Write run receipt to out/operator-runs/<date>/.
 * Best-effort — never throws.
 */
function writeReceipt(receipt: RunReceipt): void {
  try {
    const dateStr = receipt.startedAt.slice(0, 10);
    const outDir = join(REPO_ROOT, 'out', 'operator-runs', dateStr);
    mkdirSync(outDir, { recursive: true });

    const timestamp = receipt.startedAt.replace(/[:.]/g, '-');
    const prefix = `cycle-${receipt.cycle}-${timestamp}`;

    writeFileSync(join(outDir, `${prefix}.json`), JSON.stringify(receipt, null, 2), 'utf-8');

    writeFileSync(join(outDir, `${prefix}.duration`), `${receipt.durationMs}ms`, 'utf-8');
  } catch (err) {
    console.warn(`Operator: failed to write receipt — ${(err as Error).message}`);
  }
}
