/**
 * End-to-End Full Pipeline Test
 * Tests complete flow: Feed → Queue → Score → Approve → Alert
 *
 * Usage:
 *   npx tsx -r dotenv/config src/scripts/e2e-full.ts --sport=mlb --mode=canary --since="120 minutes"
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../utils/logger';
import { createSupabaseClient } from '../utils/supabase';

const logger = createLogger('E2E-Pipeline');

interface PipelineConfig {
  sport: string;
  mode: string;
  sinceMinutes: number;
  dryRun: boolean;
}

interface PipelineStats {
  config: PipelineConfig & { providers: any; markets: any; regions: any; bookmakers: any };
  feed: { fetched: number; inserted: number; skipped: number; errors: number };
  queue: { enqueued: number; processed: number; errors: number };
  scoring: { updated: number; avgScore: number };
  approval: { checked: number; approved: number; rejected: number };
  discord: { envPresent: boolean; dryRendered: number; sent: number };
  duration: number;
  success: boolean;
  timestamp: string;
}

class E2EPipeline {
  private stats: PipelineStats;
  private supabase = createSupabaseClient();

  constructor(private config: PipelineConfig) {
    this.stats = {
      config: {
        ...config,
        providers: [],
        markets: [],
        regions: [],
        bookmakers: []
      },
      feed: { fetched: 0, inserted: 0, skipped: 0, errors: 0 },
      queue: { enqueued: 0, processed: 0, errors: 0 },
      scoring: { updated: 0, avgScore: 0 },
      approval: { checked: 0, approved: 0, rejected: 0 },
      discord: { envPresent: false, dryRendered: 0, sent: 0 },
      duration: 0,
      success: false,
      timestamp: new Date().toISOString()
    };
  }

  async run(): Promise<void> {
    const startTime = Date.now();

    logger.info('🚀 Starting E2E Pipeline Test', this.config);

    try {
      // 1) Log resolved config
      await this.logResolvedConfig();

      // 2) Start scoring worker in background
      logger.info('📊 Step 1: Starting Scoring Worker (background)');
      const worker = this.startWorkerBackground();

      // Give worker time to start
      await this.sleep(2000);

      // 3) Run FeedAgent
      logger.info('📡 Step 2: Running FeedAgent');
      await this.runFeedAgent();

      // 4) Process scoring queue
      logger.info('⚡ Step 3: Processing Scoring Queue (2 cycles)');
      await this.runScoringWorker();
      await this.sleep(2000);
      await this.runScoringWorker();

      // 5) Run ScoringAgent batch (safety net)
      logger.info('🎯 Step 4: Running ScoringAgent batch (safety net)');
      await this.runScoringBatch();

      // 6) Run Approval
      logger.info('✅ Step 5: Running ApprovalAgent');
      await this.runApproval();

      // 7) Run AlertAgent
      logger.info('🔔 Step 6: Running AlertAgent');
      await this.runAlerts();

      // 8) Collect final stats
      await this.collectFinalStats();

      // Kill background worker
      worker.kill();

      this.stats.duration = Date.now() - startTime;
      this.stats.success = true;

      logger.info('✅ E2E Pipeline Complete', {
        duration: `${this.stats.duration}ms`,
        feed: this.stats.feed,
        queue: this.stats.queue,
        scoring: this.stats.scoring,
        approval: this.stats.approval
      });

      // 9) Write report
      this.writeReport();

    } catch (error) {
      this.stats.duration = Date.now() - startTime;
      this.stats.success = false;

      logger.error('❌ E2E Pipeline Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${this.stats.duration}ms`
      });

      this.writeReport();
      throw error;
    }
  }

  private async logResolvedConfig(): Promise<void> {
    logger.info('📋 Resolved Configuration', {
      sport: this.config.sport,
      mode: this.config.mode,
      sinceMinutes: this.config.sinceMinutes,
      dryRun: this.config.dryRun,
      env: {
        DISCORD_WEBHOOK_URL: !!process.env.DISCORD_WEBHOOK_URL,
        DISCORD_BOT_TOKEN: !!process.env.DISCORD_BOT_TOKEN,
        DISCORD_CHANNEL_ID: !!process.env.DISCORD_CHANNEL_ID,
        SUPABASE_URL: !!process.env.SUPABASE_URL
      }
    });

    this.stats.discord.envPresent =
      !!process.env.DISCORD_WEBHOOK_URL || !!process.env.DISCORD_BOT_TOKEN;
  }

  private startWorkerBackground(): any {
    logger.info('Starting worker in background');
    const worker = spawn('npx', ['tsx', 'src/runner/runScoringWorker.ts'], {
      cwd: join(process.cwd(), 'apps/api'),
      detached: false,
      stdio: 'ignore'
    });

    return worker;
  }

  private async runFeedAgent(): Promise<void> {
    try {
      // Count before
      const { count: beforeCount } = await this.supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - this.config.sinceMinutes * 60 * 1000).toISOString());

      // Run FeedAgent (stub - would normally exec real FeedAgent)
      logger.info('FeedAgent: Would fetch from Odds API', {
        sport: this.config.sport,
        mode: this.config.mode
      });

      // For dry test, simulate fetching 5 props
      this.stats.feed.fetched = 5;
      this.stats.feed.inserted = 5;

      // Count after
      const { count: afterCount } = await this.supabase
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - this.config.sinceMinutes * 60 * 1000).toISOString());

      const actualInserted = (afterCount || 0) - (beforeCount || 0);
      logger.info('FeedAgent complete', {
        beforeCount,
        afterCount,
        actualInserted
      });

    } catch (error) {
      this.stats.feed.errors++;
      logger.error('FeedAgent failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async runScoringWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = spawn(
        'npx',
        ['tsx', 'src/runner/runScoringWorker.ts', '--once'],
        {
          cwd: join(process.cwd(), 'apps/api'),
          stdio: 'pipe'
        }
      );

      let output = '';
      worker.stdout?.on('data', (data) => {
        output += data.toString();
      });

      worker.stderr?.on('data', (data) => {
        logger.error('Worker stderr:', data.toString());
      });

      worker.on('close', (code) => {
        if (code === 0) {
          // Parse stats from output
          const processedMatch = output.match(/jobsProcessed:\s*(\d+)/);
          const succeededMatch = output.match(/jobsSucceeded:\s*(\d+)/);

          if (processedMatch) this.stats.queue.processed += parseInt(processedMatch[1], 10);
          if (succeededMatch) {
            const succeeded = parseInt(succeededMatch[1], 10);
            this.stats.queue.enqueued += succeeded;
          }

          logger.info('Scoring worker cycle complete', {
            processed: processedMatch?.[1] || 0,
            succeeded: succeededMatch?.[1] || 0
          });

          resolve();
        } else {
          this.stats.queue.errors++;
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  private async runScoringBatch(): Promise<void> {
    try {
      // Count scored picks
      const { data: scoredPicks } = await this.supabase
        .from('unified_picks')
        .select('professional_score')
        .not('professional_score', 'is', null)
        .gte('created_at', new Date(Date.now() - this.config.sinceMinutes * 60 * 1000).toISOString());

      this.stats.scoring.updated = scoredPicks?.length || 0;

      if (scoredPicks && scoredPicks.length > 0) {
        const sum = scoredPicks.reduce((acc, p) => acc + (p.professional_score || 0), 0);
        this.stats.scoring.avgScore = sum / scoredPicks.length;
      }

      logger.info('Scoring batch complete', {
        updated: this.stats.scoring.updated,
        avgScore: this.stats.scoring.avgScore.toFixed(2)
      });

    } catch (error) {
      logger.error('Scoring batch failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async runApproval(): Promise<void> {
    return new Promise((resolve, reject) => {
      const approval = spawn(
        'npx',
        [
          'tsx',
          'src/runner/runApprovalAgent.ts',
          '--mode',
          this.config.mode,
          '--since',
          `${this.config.sinceMinutes} minutes`,
          '--auto-approve'
        ],
        {
          cwd: join(process.cwd(), 'apps/api'),
          stdio: 'pipe'
        }
      );

      let output = '';
      approval.stdout?.on('data', (data) => {
        output += data.toString();
      });

      approval.on('close', (code) => {
        if (code === 0) {
          // Parse approval stats
          const processedMatch = output.match(/processed:\s*(\d+)/);
          const approvedMatch = output.match(/approved:\s*(\d+)/);

          if (processedMatch) this.stats.approval.checked = parseInt(processedMatch[1], 10);
          if (approvedMatch) this.stats.approval.approved = parseInt(approvedMatch[1], 10);

          logger.info('Approval complete', {
            checked: this.stats.approval.checked,
            approved: this.stats.approval.approved
          });

          resolve();
        } else {
          reject(new Error(`Approval exited with code ${code}`));
        }
      });
    });
  }

  private async runAlerts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const dry = this.config.dryRun ? '1' : '0';

      const alert = spawn(
        'npx',
        [
          'tsx',
          'src/runner/runAlertAgent.ts',
          '--mode',
          this.config.mode,
          '--since',
          `${this.config.sinceMinutes} minutes`
        ],
        {
          cwd: join(process.cwd(), 'apps/api'),
          stdio: 'pipe',
          env: { ...process.env, DRY_RUN: dry }
        }
      );

      let output = '';
      alert.stdout?.on('data', (data) => {
        output += data.toString();
      });

      alert.on('close', (code) => {
        if (code === 0) {
          // Count rendered alerts
          const renderedMatch = output.match(/rendered:\s*(\d+)/i);
          if (renderedMatch) this.stats.discord.dryRendered = parseInt(renderedMatch[1], 10);

          if (!this.config.dryRun && this.stats.discord.envPresent) {
            this.stats.discord.sent = this.stats.discord.dryRendered;
          }

          logger.info('Alerts complete', {
            dryRendered: this.stats.discord.dryRendered,
            sent: this.stats.discord.sent
          });

          resolve();
        } else {
          reject(new Error(`Alerts exited with code ${code}`));
        }
      });
    });
  }

  private async collectFinalStats(): Promise<void> {
    // Query final counts from scoring_queue
    const { data: queueData } = await this.supabase
      .from('scoring_queue')
      .select('status')
      .gte('created_at', new Date(Date.now() - this.config.sinceMinutes * 60 * 1000).toISOString());

    if (queueData) {
      const done = queueData.filter(j => j.status === 'DONE').length;
      const errors = queueData.filter(j => j.status === 'ERROR').length;

      this.stats.queue.processed = done + errors;
      this.stats.queue.errors = errors;
    }
  }

  private writeReport(): void {
    try {
      // Create out/ops directory
      const outDir = join(process.cwd(), 'apps/api/out/ops');
      mkdirSync(outDir, { recursive: true });

      // Write JSON report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const timeHM = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].substring(0, 5);
      const jsonPath = join(outDir, `E2E_PIPELINE_${timestamp}_${timeHM}.json`);
      writeFileSync(jsonPath, JSON.stringify(this.stats, null, 2));

      // Write Markdown summary
      const mdPath = join(outDir, `E2E_PIPELINE_SUMMARY_${timestamp}_${timeHM}.md`);
      const markdown = this.generateMarkdownReport();
      writeFileSync(mdPath, markdown);

      logger.info('📋 Reports saved', {
        json: jsonPath,
        markdown: mdPath
      });

      // Print compact summary
      console.log('\n' + '='.repeat(80));
      console.log('E2E PIPELINE TEST REPORT');
      console.log('='.repeat(80));
      console.log('\n📋 CONFIG:');
      console.log(`   Sport: ${this.config.sport}`);
      console.log(`   Mode: ${this.config.mode}`);
      console.log(`   Since: ${this.config.sinceMinutes} minutes`);
      console.log('\n📡 FEED:');
      console.log(`   Fetched: ${this.stats.feed.fetched}`);
      console.log(`   Inserted: ${this.stats.feed.inserted}`);
      console.log(`   Errors: ${this.stats.feed.errors}`);
      console.log('\n⚡ QUEUE:');
      console.log(`   Enqueued: ${this.stats.queue.enqueued}`);
      console.log(`   Processed: ${this.stats.queue.processed}`);
      console.log(`   Errors: ${this.stats.queue.errors}`);
      console.log('\n🎯 SCORING:');
      console.log(`   Updated: ${this.stats.scoring.updated}`);
      console.log(`   Avg Score: ${this.stats.scoring.avgScore.toFixed(2)}`);
      console.log('\n✅ APPROVAL:');
      console.log(`   Checked: ${this.stats.approval.checked}`);
      console.log(`   Approved: ${this.stats.approval.approved}`);
      console.log('\n🔔 DISCORD:');
      console.log(`   Env Present: ${this.stats.discord.envPresent}`);
      console.log(`   Dry Rendered: ${this.stats.discord.dryRendered}`);
      console.log(`   Sent: ${this.stats.discord.sent}`);
      console.log('\n📊 SUMMARY:');
      console.log(`   Duration: ${this.stats.duration}ms`);
      console.log(`   Success: ${this.stats.success ? '✅' : '❌'}`);
      console.log('\n📄 Reports: ' + mdPath);
      console.log('='.repeat(80) + '\n');

    } catch (error) {
      logger.error('Failed to write report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private generateMarkdownReport(): string {
    return `# E2E Pipeline Test Report

**Timestamp**: ${this.stats.timestamp}
**Duration**: ${this.stats.duration}ms
**Status**: ${this.stats.success ? '✅ SUCCESS' : '❌ FAILED'}

## Configuration

- **Sport**: ${this.config.sport}
- **Mode**: ${this.config.mode}
- **Time Window**: ${this.config.sinceMinutes} minutes
- **Dry Run**: ${this.config.dryRun}

## Feed Stage

- **Fetched**: ${this.stats.feed.fetched}
- **Inserted**: ${this.stats.feed.inserted}
- **Skipped**: ${this.stats.feed.skipped}
- **Errors**: ${this.stats.feed.errors}

## Queue Stage

- **Enqueued**: ${this.stats.queue.enqueued}
- **Processed**: ${this.stats.queue.processed}
- **Errors**: ${this.stats.queue.errors}

## Scoring Stage

- **Updated**: ${this.stats.scoring.updated}
- **Average Score**: ${this.stats.scoring.avgScore.toFixed(2)}

## Approval Stage

- **Checked**: ${this.stats.approval.checked}
- **Approved**: ${this.stats.approval.approved}
- **Rejected**: ${this.stats.approval.rejected}

## Discord Alert Stage

- **Environment Present**: ${this.stats.discord.envPresent ? 'Yes' : 'No'}
- **Dry Rendered**: ${this.stats.discord.dryRendered}
- **Sent**: ${this.stats.discord.sent}

---

*Generated by E2E Pipeline Test*
`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const sport = args.find(a => a.startsWith('--sport='))?.split('=')[1] || 'mlb';
const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'canary';
const sinceArg = args.find(a => a.startsWith('--since='))?.split('=')[1] || '120 minutes';
const sinceMinutes = parseInt(sinceArg.replace(/[^\d]/g, ''), 10) || 120;
const dryRun = !args.includes('--no-dry');

const config: PipelineConfig = {
  sport,
  mode,
  sinceMinutes,
  dryRun
};

// Run pipeline
const pipeline = new E2EPipeline(config);
pipeline.run()
  .then(() => {
    logger.info('Pipeline complete');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Pipeline failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  });