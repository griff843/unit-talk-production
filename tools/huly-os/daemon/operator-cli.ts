// SPRINT-HULY-OPERATOR-CLI-FIX-015A: CLI entry point for operator + reports
// Usage:
//   pnpm -C tools/huly-os run huly:operator          (continuous loop)
//   pnpm -C tools/huly-os run huly:operator:once      (single cycle)
//   pnpm -C tools/huly-os run huly:operator -- --once  (single cycle, flag style)
//   pnpm -C tools/huly-os run huly:report:daily
//   pnpm -C tools/huly-os run huly:report:weekly

import { resolve } from 'node:path';

import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';

import { startOperatorLoop, stopOperatorLoop } from './operator.js';
import { publishDailyReport, publishWeeklyReport } from './report-generator.js';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

// ── Argv Sanitization ───────────────────────────────────────────────────
// pnpm injects a literal "--" separator between script args and user args.
// tsx may also shift argv positions. Strip ALL bare "--" arguments that are
// not part of a known flag value to prevent commander from choking.
const argv = process.argv.filter(arg => arg !== '--');

// ── Shared operator action ──────────────────────────────────────────────

async function runOperator(opts: { once?: boolean; interval: string }): Promise<void> {
  const intervalSec = parseInt(opts.interval, 10);
  if (isNaN(intervalSec) || intervalSec < 5) {
    console.error('Interval must be >= 5 seconds');
    process.exit(1);
  }

  const state = await startOperatorLoop({
    once: opts.once,
    intervalSec,
  });

  if (opts.once) {
    if (state.lastResult) {
      console.log('\n── Operator Cycle Result ──');
      console.log(JSON.stringify(state.lastResult, null, 2));
    }
    const hasErrors = (state.lastResult?.errors.length ?? 0) > 0;
    process.exit(hasErrors ? 1 : 0);
  }

  // Long-running mode — handle shutdown
  const shutdown = () => {
    console.log('\n[operator] Received shutdown signal');
    stopOperatorLoop(state);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep-alive
  await new Promise(() => {});
}

// ── CLI Definition ──────────────────────────────────────────────────────

const program = new Command();

program
  .name('huly-operator')
  .description('HULY-OS Autonomous Operator')
  .version('1.0.0')
  .option('--once', 'Run exactly one cycle then exit')
  .option('--interval <seconds>', 'Polling interval in seconds', '60')
  .action(async (opts: { once?: boolean; interval: string }) => {
    await runOperator(opts);
  });

// Keep 'run' as an explicit subcommand alias for backwards compatibility
program
  .command('run')
  .description('Start the operator polling loop (alias for default)')
  .option('--once', 'Run exactly one cycle then exit')
  .option('--interval <seconds>', 'Polling interval in seconds', '60')
  .action(async (opts: { once?: boolean; interval: string }) => {
    await runOperator(opts);
  });

program
  .command('report-daily')
  .description('Publish daily reality report to Huly Documents')
  .action(async () => {
    try {
      const markdown = await publishDailyReport();
      console.log('\n── Daily Report Content ──');
      console.log(markdown);
    } catch (err) {
      console.error('FATAL:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('report-weekly')
  .description('Publish weekly ops digest to Huly Documents')
  .action(async () => {
    try {
      const markdown = await publishWeeklyReport();
      console.log('\n── Weekly Report Content ──');
      console.log(markdown);
    } catch (err) {
      console.error('FATAL:', (err as Error).message);
      process.exit(1);
    }
  });

program.parseAsync(argv).catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
