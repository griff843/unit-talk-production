// SPRINT-HULY-OPERATOR-014: CLI entry point for operator + reports
// Usage:
//   pnpm -C tools/huly-os run huly:operator -- [options]
//   pnpm -C tools/huly-os run huly:report:daily
//   pnpm -C tools/huly-os run huly:report:weekly

import { resolve } from 'node:path';

import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';

import { startOperatorLoop, stopOperatorLoop } from './operator.js';
import { publishDailyReport, publishWeeklyReport } from './report-generator.js';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const program = new Command();

program.name('huly-operator').description('HULY-OS Autonomous Operator').version('1.0.0');

program
  .command('run')
  .description('Start the operator polling loop')
  .option('--once', 'Run exactly one cycle then exit')
  .option('--interval <seconds>', 'Polling interval in seconds', '60')
  .action(async (opts: { once?: boolean; interval: string }) => {
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
      // Single cycle — report and exit
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

// Default command: if invoked without a subcommand, show help
program.command('help-operator', { isDefault: true, hidden: true }).action(() => {
  program.outputHelp();
});

// Strip pnpm '--' separator
const argv = process.argv.filter((arg, i) => !(arg === '--' && i === 2));

program.parseAsync(argv).catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
