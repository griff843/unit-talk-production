#!/usr/bin/env node

import { Command } from 'commander';
import { SettlementAgent } from '../src/workflows/agents/SettlementAgent';
import { supabaseClient } from '../src/services/supabaseClient';
import { createLogger } from '../src/utils/logger';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('SettlementCLI');
const program = new Command();

program
  .name('settlement-runner')
  .description('CLI tool for running settlement operations on Unit Talk picks')
  .version('1.0.0');

// Backfill command
program
  .command('backfill')
  .description('Backfill settlement for unsettled picks')
  .option('-l, --league <league>', 'Filter by league (MLB, NFL, NBA, NCAAF, WNBA)')
  .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
  .option('--date-to <date>', 'End date (YYYY-MM-DD)')
  .option('-b, --batch <size>', 'Batch size', '100')
  .option('-r, --rate <rps>', 'Rate limit (requests per second)', '4')
  .option('--dry-run', 'Simulate without writing to database')
  .option('--force', 'Force re-settlement of already settled picks')
  .action(async (options) => {
    const spinner = ora('Initializing settlement agent...').start();
    
    try {
      const agent = new SettlementAgent();
      await agent.initialize();
      spinner.succeed('Settlement agent initialized');

      // Display job configuration
      console.log(chalk.cyan('\n📊 Backfill Configuration:'));
      console.log(chalk.gray('  League:'), options.league || 'All');
      console.log(chalk.gray('  Date From:'), options.dateFrom || 'Beginning');
      console.log(chalk.gray('  Date To:'), options.dateTo || 'Today');
      console.log(chalk.gray('  Batch Size:'), options.batch);
      console.log(chalk.gray('  Rate Limit:'), options.rate, 'RPS');
      console.log(chalk.gray('  Mode:'), options.dryRun ? chalk.yellow('DRY RUN') : chalk.green('LIVE'));

      if (!options.dryRun) {
        const confirm = await promptConfirm('\nProceed with backfill?');
        if (!confirm) {
          console.log(chalk.red('Backfill cancelled'));
          process.exit(0);
        }
      }

      spinner.start('Running backfill...');
      
      const jobId = await agent.runBackfill({
        league: options.league,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        batchSize: parseInt(options.batch),
        rateLimit: parseInt(options.rate),
        dryRun: options.dryRun,
        force: options.force
      });

      spinner.succeed(`Backfill completed: ${jobId}`);

      // Display results
      const job = agent.getJobStatus(jobId);
      if (job) {
        console.log(chalk.cyan('\n📈 Backfill Results:'));
        console.log(chalk.gray('  Scanned:'), job.progress.scanned);
        console.log(chalk.gray('  Settled:'), chalk.green(job.progress.settled));
        console.log(chalk.gray('  Skipped:'), chalk.yellow(job.progress.skipped));
        console.log(chalk.gray('  Errors:'), chalk.red(job.progress.errors));
        
        if (job.progress.failed.length > 0) {
          console.log(chalk.red('\n❌ Failed Pick IDs:'));
          job.progress.failed.forEach(id => console.log(chalk.gray(`  - ${id}`)));
        }
      }

    } catch (error) {
      spinner.fail('Backfill failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Settle specific IDs command
program
  .command('ids')
  .description('Settle specific picks by ID')
  .option('--ids <ids...>', 'Pick IDs to settle')
  .option('--file <path>', 'Read IDs from file (one per line)')
  .option('--dry-run', 'Simulate without writing to database')
  .option('--force', 'Force re-settlement even if already settled')
  .action(async (options) => {
    const spinner = ora('Loading pick IDs...').start();
    
    try {
      // Get IDs from options or file
      let ids: string[] = [];
      
      if (options.ids) {
        ids = options.ids;
      } else if (options.file) {
        const content = await fs.readFile(options.file, 'utf-8');
        ids = content.split('\n').filter(line => line.trim());
      } else {
        spinner.fail('No IDs provided');
        console.error(chalk.red('Error: Provide IDs via --ids or --file'));
        process.exit(1);
      }

      spinner.succeed(`Loaded ${ids.length} pick IDs`);

      const agent = new SettlementAgent();
      await agent.initialize();

      console.log(chalk.cyan('\n📊 Settlement Configuration:'));
      console.log(chalk.gray('  Pick Count:'), ids.length);
      console.log(chalk.gray('  Mode:'), options.dryRun ? chalk.yellow('DRY RUN') : chalk.green('LIVE'));
      console.log(chalk.gray('  Force:'), options.force ? 'Yes' : 'No');

      if (!options.dryRun) {
        const confirm = await promptConfirm('\nProceed with settlement?');
        if (!confirm) {
          console.log(chalk.red('Settlement cancelled'));
          process.exit(0);
        }
      }

      spinner.start('Settling picks...');
      
      const jobId = await agent.runIds({
        ids,
        dryRun: options.dryRun,
        force: options.force
      });

      spinner.succeed(`Settlement completed: ${jobId}`);

      // Display results
      const job = agent.getJobStatus(jobId);
      if (job) {
        console.log(chalk.cyan('\n📈 Settlement Results:'));
        console.log(chalk.gray('  Processed:'), job.progress.scanned);
        console.log(chalk.gray('  Settled:'), chalk.green(job.progress.settled));
        console.log(chalk.gray('  Errors:'), chalk.red(job.progress.errors));
        
        if (job.progress.failed.length > 0) {
          console.log(chalk.red('\n❌ Failed Pick IDs:'));
          job.progress.failed.forEach(id => console.log(chalk.gray(`  - ${id}`)));
        }
      }

    } catch (error) {
      spinner.fail('Settlement failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Display settlement statistics')
  .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
  .option('--date-to <date>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    const spinner = ora('Fetching statistics...').start();
    
    try {
      const supabase = supabaseClient;
      const agent = new SettlementAgent();
      await agent.initialize();
      
      const store = (agent as any).store;
      const stats = await store.getSettlementStats(
        options.dateFrom,
        options.dateTo
      );

      spinner.succeed('Statistics fetched');

      console.log(chalk.cyan('\n📊 Settlement Statistics:'));
      console.log(chalk.gray('  Period:'), 
        options.dateFrom || 'All time',
        '-',
        options.dateTo || 'Today'
      );
      console.log(chalk.gray('  Total Picks:'), stats.total);
      console.log(chalk.gray('  Settled:'), chalk.green(stats.settled));
      console.log(chalk.gray('  Unsettled:'), chalk.yellow(stats.unsettled));
      console.log(chalk.gray('  Settlement Rate:'), 
        ((stats.settled / stats.total) * 100).toFixed(1) + '%'
      );

      if (Object.keys(stats.byOutcome).length > 0) {
        console.log(chalk.cyan('\n📈 By Outcome:'));
        for (const [outcome, count] of Object.entries(stats.byOutcome)) {
          const color = outcome === 'win' ? chalk.green :
                       outcome === 'loss' ? chalk.red :
                       outcome === 'push' ? chalk.yellow :
                       chalk.gray;
          console.log(chalk.gray(`  ${outcome}:`), color(count));
        }
      }

      if (Object.keys(stats.byLeague).length > 0) {
        console.log(chalk.cyan('\n🏆 By League:'));
        for (const [league, count] of Object.entries(stats.byLeague)) {
          console.log(chalk.gray(`  ${league}:`), count);
        }
      }

    } catch (error) {
      spinner.fail('Failed to fetch statistics');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Health check command
program
  .command('health')
  .description('Check settlement system health')
  .action(async () => {
    const spinner = ora('Checking system health...').start();
    
    try {
      const agent = new SettlementAgent();
      await agent.initialize();
      
      const adapters = (agent as any).adapters;
      const supabase = supabaseClient;

      spinner.succeed('System health check complete');

      console.log(chalk.cyan('\n🏥 Settlement System Health:'));
      
      // Check database connection
      const { error: dbError } = await supabase.from('unified_picks').select('id').limit(1);
      console.log(chalk.gray('  Database:'), 
        dbError ? chalk.red('❌ Failed') : chalk.green('✅ Connected')
      );

      // Check adapters
      console.log(chalk.gray('  Adapters:'));
      for (const [league, adapter] of adapters) {
        console.log(chalk.gray(`    ${league}:`), chalk.green('✅ Loaded'));
      }

      // Check for unsettled picks
      const { count } = await supabase
        .from('raw_props')
        .select('id', { count: 'exact', head: true })
        .is('outcome', null)
        .is('processed_at', null);
      
      console.log(chalk.gray('  Unsettled Picks:'), chalk.yellow(count || 0));

    } catch (error) {
      spinner.fail('Health check failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Helper function for confirmation prompts
async function promptConfirm(message: string): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(message + ' (y/n): '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}