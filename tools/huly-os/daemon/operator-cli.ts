// SPRINT-HULY-OPERATOR-CLI-FIX-015A: CLI entry point for operator + reports
// Usage:
//   pnpm -C tools/huly-os run huly:operator          (continuous loop)
//   pnpm -C tools/huly-os run huly:operator:once      (single cycle)
//   pnpm -C tools/huly-os run huly:operator -- --once  (single cycle, flag style)
//   pnpm -C tools/huly-os run huly:report:daily
//   pnpm -C tools/huly-os run huly:report:weekly

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';

import { HulyAdapter } from './adapters/huly-adapter.js';
import { AuditLogger } from './audit-log.js';
import { loadConfig } from './config.js';
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

program
  .command('health')
  .description('Check daemon health: pm2 status, Huly connectivity, last cycle')
  .action(async () => {
    const health: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      pm2: 'unknown',
      huly: false,
      github: false,
      lastCycle: null,
      uptime: null,
    };

    // pm2 status
    try {
      const pm2Out = execSync('npx pm2 jlist', { encoding: 'utf-8', timeout: 10_000 });
      const pm2Apps = JSON.parse(pm2Out);
      const op = pm2Apps.find((a: Record<string, unknown>) => a.name === 'huly-operator');
      if (op) {
        health.pm2 = op.pm2_env?.status ?? 'unknown';
        const uptimeMs = op.pm2_env?.pm_uptime ? Date.now() - Number(op.pm2_env.pm_uptime) : null;
        if (uptimeMs) {
          const mins = Math.floor(uptimeMs / 60_000);
          health.uptime = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60}m`;
        }
      } else {
        health.pm2 = 'not_found';
      }
    } catch {
      health.pm2 = 'pm2_unavailable';
    }

    // Huly connectivity
    try {
      const config = loadConfig();
      const huly = new HulyAdapter(config, new AuditLogger());
      await huly.connect();
      health.huly = await huly.ping();
      await huly.disconnect();
    } catch {
      health.huly = false;
    }

    // GitHub reachability
    try {
      const config = loadConfig();
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: config.GITHUB_TOKEN });
      await octokit.rateLimit.get();
      health.github = true;
    } catch {
      health.github = false;
    }

    // Last cycle from health file
    const healthFile = resolve(import.meta.dirname ?? '.', '..', 'logs', 'operator-health.json');
    if (existsSync(healthFile)) {
      try {
        health.lastCycle = JSON.parse(readFileSync(healthFile, 'utf-8'));
      } catch {
        health.lastCycle = 'corrupt';
      }
    }

    console.log(JSON.stringify(health, null, 2));
  });

program.parseAsync(argv).catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
