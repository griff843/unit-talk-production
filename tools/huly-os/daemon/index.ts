// SPRINT-EVENT-BUS-011: CLI entry point for Truth Daemon

import { loadConfig, loadConfigGitHubOnly } from './config.js';
import { startConsumer } from './event-bus/consumer.js';
import { runSmoke } from './huly-smoke.js';
import { startOperator, stopOperator } from './operator-scheduler.js';
import { runReport } from './report-runner.js';

const args = process.argv.slice(2);

function printUsage(): void {
  console.log(`
Truth Daemon - Daily Reality Report Generator

Usage:
  tsx daemon/index.ts --dry-run    Generate report (GitHub required, Huly optional)
  tsx daemon/index.ts --run        Generate report + write Huly doc (both required)
  tsx daemon/index.ts --smoke      Huly connectivity proof (create→read→verify doc)
  tsx daemon/index.ts --operator   Start automated scheduler (requires OPERATOR_ENABLED=true)
  tsx daemon/index.ts --bus        Start event bus consumer (requires EVENTBUS_ENABLED=true)

Environment variables: See .env.example

Exit codes:
  0  Success (--dry-run always 0; --run 0 if no error-severity drift)
  1  Failure (config error, Huly unavailable in --run, error drift violations)
`);
}

async function main(): Promise<void> {
  if (args.includes('--dry-run')) {
    await runReport({ dryRun: true });
  } else if (args.includes('--run')) {
    await runReport({ dryRun: false });
  } else if (args.includes('--smoke')) {
    await runSmoke();
  } else if (args.includes('--operator')) {
    await runOperator();
  } else if (args.includes('--bus')) {
    await runBus();
  } else {
    printUsage();
    process.exit(1);
  }
}

async function runOperator(): Promise<void> {
  // Load full config for operator mode
  let config;
  try {
    config = loadConfig();
  } catch {
    // Fall back to GitHub-only if Huly isn't configured
    // (operator will run dry-run cycles which only need GitHub)
    config = loadConfigGitHubOnly();
  }

  if (!config.OPERATOR_ENABLED) {
    console.error('OPERATOR_ENABLED is not set to true. Set OPERATOR_ENABLED=true in .env');
    process.exit(1);
  }

  const state = startOperator(config);
  if (!state) {
    process.exit(1);
  }

  // Keep process alive and handle graceful shutdown
  const shutdown = () => {
    console.log('\nOperator: received shutdown signal');
    stopOperator(state);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep-alive: prevent Node from exiting while scheduler is running.
  // The interval timer is unref'd so this ref keeps the process alive.
  await new Promise(() => {
    // Never resolves — process stays alive until signal
  });
}

async function runBus(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch {
    config = loadConfigGitHubOnly();
  }

  if (!config.EVENTBUS_ENABLED) {
    console.error('EVENTBUS_ENABLED is not set to true. Set EVENTBUS_ENABLED=true in .env');
    process.exit(1);
  }

  // startConsumer blocks until SIGINT/SIGTERM
  await startConsumer(config);
}

main().catch(err => {
  console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
