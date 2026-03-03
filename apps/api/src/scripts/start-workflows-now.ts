#!/usr/bin/env tsx
/**
 * IMMEDIATE WORKFLOW STARTER
 * Run this script to immediately start all Unit Talk workflows
 * Usage: npx tsx src/scripts/start-workflows-now.ts
 */

import 'dotenv/config';
import startAllWorkflows from './start-all-workflows';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkflowStarterCLI');

async function main() {
  const args = process.argv.slice(2);

  logger.info('🚀 Unit Talk Workflow Starter CLI');
  logger.info('==================================');

  if (args.includes('--help') || args.includes('-h')) {
    // eslint-disable-next-line no-console
    console.log(`
Usage: npx tsx src/scripts/start-workflows-now.ts [options]

Options:
  --critical-only    Start only critical workflows (syndicate scheduler, monitors)
  --dry-run         Show what would be started without actually starting
  --help, -h        Show this help message

Examples:
  npx tsx src/scripts/start-workflows-now.ts                    # Start all workflows
  npx tsx src/scripts/start-workflows-now.ts --critical-only   # Start critical workflows only
  npx tsx src/scripts/start-workflows-now.ts --dry-run         # Show what would be started
    `);
    process.exit(0);
  }

  const options = {
    criticalOnly: args.includes('--critical-only'),
    dryRun: args.includes('--dry-run'),
  };

  if (options.criticalOnly) {
    logger.info('🎯 Starting CRITICAL workflows only');
  }

  if (options.dryRun) {
    logger.info('🧪 DRY RUN mode - no workflows will actually start');
  }

  try {
    await startAllWorkflows(options);

    logger.info('✅ Workflow startup completed!');
    logger.info('📊 Access Temporal UI: http://localhost:8088');
    logger.info('🏈 NFL Preseason: Data ingestion should start within 1 minute');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Workflow startup failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// eslint-disable-next-line no-console
main().catch(console.error);
