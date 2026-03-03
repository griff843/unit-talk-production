// SPRINT-HULY-WORKOS-V1-LOCAL-001: CLI entry point for Truth Daemon

import { runSmoke } from './huly-smoke.js';
import { runReport } from './report-runner.js';

const args = process.argv.slice(2);

function printUsage(): void {
  console.log(`
Truth Daemon - Daily Reality Report Generator

Usage:
  tsx daemon/index.ts --dry-run    Generate report (GitHub required, Huly optional)
  tsx daemon/index.ts --run        Generate report + write Huly doc (both required)
  tsx daemon/index.ts --smoke      Huly connectivity proof (create→read→verify doc)

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
  } else {
    printUsage();
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
