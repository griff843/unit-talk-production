/**
 * PHASE 5: Autonomous Burn-In Scheduler
 *
 * Production-grade scheduler for 72-hour autonomous system validation.
 * Runs ingestion, autopilot, SLO evaluation, and alert emission on fixed intervals.
 *
 * Safety Features:
 * - Pre-flight health checks before each execution
 * - Fail-closed error handling
 * - Comprehensive logging
 * - Emergency stop mechanism
 * - Graceful shutdown
 *
 * @module burn-in/scheduler
 */

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { burnInRunner } from './runner';

const execAsync = promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

interface SchedulerConfig {
  mode: 'log_only' | 'live';
  durationHours: number;
  autopilotIntervalMinutes: number;
  sloIntervalMinutes: number;
  ingestionIntervalMinutes: number;
  alertsEnabled: boolean;
  discordEnabled: boolean;
  startTimestamp: Date;
  expectedEndTimestamp: Date;
  safetyChecks: boolean;
}

interface TaskExecution {
  taskName: string;
  status: 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  output?: string;
}

interface SchedulerState {
  isRunning: boolean;
  isPaused: boolean;
  config: SchedulerConfig;
  startedAt?: Date;
  executionLog: TaskExecution[];
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
}

// ============================================================================
// SCHEDULER CLASS
// ============================================================================

export class BurnInScheduler {
  private state: SchedulerState;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private logFilePath: string;

  constructor(config: SchedulerConfig) {
    this.state = {
      isRunning: false,
      isPaused: false,
      config,
      executionLog: [],
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    };

    this.logFilePath = path.join(
      process.cwd(),
      'apps',
      'command-center',
      'phase5-evidence',
      'scheduler-log.jsonl'
    );
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Start the burn-in scheduler
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Scheduler is already running');
    }

    console.log('========================================');
    console.log('PHASE 5: AUTONOMOUS BURN-IN SCHEDULER');
    console.log('========================================');
    console.log(`Mode: ${this.state.config.mode.toUpperCase()}`);
    console.log(`Duration: ${this.state.config.durationHours} hours`);
    console.log(`Start: ${this.state.config.startTimestamp.toISOString()}`);
    console.log(`End: ${this.state.config.expectedEndTimestamp.toISOString()}`);
    console.log('========================================\n');

    // CRITICAL: Enforce log_only mode
    if (this.state.config.mode !== 'log_only') {
      throw new Error(
        `REJECTED: Burn-in must run in log_only mode (current: ${this.state.config.mode})`
      );
    }

    // CRITICAL: Enforce Discord disabled
    if (this.state.config.discordEnabled === true) {
      throw new Error(
        'REJECTED: Discord publishing must be disabled for burn-in'
      );
    }

    // Validate environment variables
    const missingEnvVars: string[] = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL_DEV) {
      missingEnvVars.push('SUPABASE_URL');
    }
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY_DEV
    ) {
      missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing critical environment variables: ${missingEnvVars.join(', ')}`
      );
    }

    // Safety check before starting
    if (this.state.config.safetyChecks) {
      const healthCheck = await this.runHealthCheck();
      if (!healthCheck.passed) {
        throw new Error(
          `Pre-flight health check failed: ${healthCheck.errors.join(', ')}`
        );
      }
    }

    // Ensure log directory exists
    await this.ensureLogDirectory();

    this.state.isRunning = true;
    this.state.startedAt = new Date();

    // Schedule tasks based on configuration
    this.scheduleIngestion();
    this.scheduleAutopilot();
    this.scheduleSLOEvaluation();

    await this.log({
      event: 'scheduler_started',
      config: this.state.config,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Scheduler started successfully\n');
  }

  /**
   * Stop the burn-in scheduler
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      throw new Error('Scheduler is not running');
    }

    console.log('\n========================================');
    console.log('STOPPING SCHEDULER');
    console.log('========================================\n');

    // Stop all cron jobs
    for (const [taskName, job] of this.jobs.entries()) {
      job.stop();
      console.log(`✅ Stopped task: ${taskName}`);
    }

    this.jobs.clear();
    this.state.isRunning = false;

    await this.log({
      event: 'scheduler_stopped',
      totalExecutions: this.state.totalExecutions,
      successfulExecutions: this.state.successfulExecutions,
      failedExecutions: this.state.failedExecutions,
      timestamp: new Date().toISOString(),
    });

    console.log('\n✅ Scheduler stopped successfully');
  }

  /**
   * Pause the scheduler (stops job execution but maintains state)
   */
  pause(): void {
    this.state.isPaused = true;
    console.log('⏸️  Scheduler paused');
  }

  /**
   * Resume the scheduler
   */
  resume(): void {
    this.state.isPaused = false;
    console.log('▶️  Scheduler resumed');
  }

  /**
   * Get current scheduler state
   */
  getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const now = new Date();
    const runtimeMs = this.state.startedAt
      ? now.getTime() - this.state.startedAt.getTime()
      : 0;
    const runtimeHours = runtimeMs / (1000 * 60 * 60);

    return {
      isRunning: this.state.isRunning,
      isPaused: this.state.isPaused,
      runtimeHours: Math.round(runtimeHours * 100) / 100,
      totalExecutions: this.state.totalExecutions,
      successfulExecutions: this.state.successfulExecutions,
      failedExecutions: this.state.failedExecutions,
      successRate:
        this.state.totalExecutions > 0
          ? Math.round(
              (this.state.successfulExecutions / this.state.totalExecutions) *
                100
            )
          : 0,
      recentExecutions: this.state.executionLog.slice(-10),
    };
  }

  // ==========================================================================
  // TASK SCHEDULING
  // ==========================================================================

  private scheduleIngestion(): void {
    const interval = this.state.config.ingestionIntervalMinutes;
    const cronPattern = `*/${interval} * * * *`; // Every N minutes

    const job = cron.schedule(cronPattern, async () => {
      if (this.state.isPaused) return;

      await this.executeTask('ingestion_check', async () => {
        console.log('[INGESTION] Running ingestion freshness check...');
        const result = await burnInRunner.runIngestionCheck();
        if (!result.success) {
          throw new Error(result.error || 'Ingestion check failed');
        }
        console.log('[INGESTION] Completed:', result.data);
      });
    });

    this.jobs.set('ingestion', job);
    console.log(
      `📅 Scheduled ingestion check: every ${interval} minutes (${cronPattern})`
    );
  }

  private scheduleAutopilot(): void {
    const interval = this.state.config.autopilotIntervalMinutes;
    const cronPattern = `*/${interval} * * * *`; // Every N minutes

    const job = cron.schedule(cronPattern, async () => {
      if (this.state.isPaused) return;

      await this.executeTask('autopilot_log_only', async () => {
        console.log('[AUTOPILOT] Running autopilot in log_only mode...');
        const result = await burnInRunner.runAutopilotLogOnly();
        if (!result.success) {
          throw new Error(result.error || 'Autopilot failed');
        }
        console.log('[AUTOPILOT] Completed:', result.data);
      });
    });

    this.jobs.set('autopilot', job);
    console.log(
      `📅 Scheduled autopilot (log_only): every ${interval} minutes (${cronPattern})`
    );
  }

  private scheduleSLOEvaluation(): void {
    const interval = this.state.config.sloIntervalMinutes;
    const cronPattern = `*/${interval} * * * *`; // Every N minutes

    const job = cron.schedule(cronPattern, async () => {
      if (this.state.isPaused) return;

      await this.executeTask('slo_and_alerts', async () => {
        console.log('[SLO] Running SLO evaluation and alert generation...');
        const result = await burnInRunner.runSLOAndAlerts();
        if (!result.success) {
          throw new Error(result.error || 'SLO evaluation failed');
        }
        console.log('[SLO] Completed:', result.data);
      });
    });

    this.jobs.set('slo_evaluation', job);
    console.log(
      `📅 Scheduled SLO + Alerts: every ${interval} minutes (${cronPattern})`
    );
  }

  // ==========================================================================
  // TASK EXECUTION
  // ==========================================================================

  private async executeTask(
    taskName: string,
    taskFn: () => Promise<void>
  ): Promise<void> {
    const execution: TaskExecution = {
      taskName,
      status: 'running',
      startedAt: new Date(),
    };

    this.state.executionLog.push(execution);
    this.state.totalExecutions++;

    try {
      await taskFn();

      execution.status = 'success';
      execution.completedAt = new Date();
      execution.duration =
        execution.completedAt.getTime() - execution.startedAt.getTime();
      this.state.successfulExecutions++;

      await this.log({
        event: 'task_success',
        taskName,
        duration: execution.duration,
        timestamp: execution.completedAt.toISOString(),
      });
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.duration =
        execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = error instanceof Error ? error.message : String(error);
      this.state.failedExecutions++;

      await this.log({
        event: 'task_failed',
        taskName,
        error: execution.error,
        timestamp: execution.completedAt.toISOString(),
      });

      console.error(`❌ Task failed: ${taskName} - ${execution.error}`);
    }
  }

  // ==========================================================================
  // SAFETY CHECKS
  // ==========================================================================

  private async runHealthCheck(): Promise<{
    passed: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    console.log('Running pre-flight health checks...');

    // Check database connectivity
    try {
      const { stdout } = await execAsync(
        'docker exec unit-talk-postgres psql -U postgres -d unit_talk_dev -c "SELECT 1" -t'
      );

      if (!stdout.includes('1')) {
        errors.push('Database connectivity check failed');
      }
    } catch (error) {
      errors.push(`Database check error: ${error}`);
    }

    // Check Command Center
    try {
      const response = await fetch('http://localhost:3015/api/health');
      if (!response.ok) {
        errors.push('Command Center health check failed');
      }
    } catch (error) {
      errors.push(`Command Center check error: ${error}`);
    }

    // Check required tables exist
    try {
      const { stdout } = await execAsync(
        `docker exec unit-talk-postgres psql -U postgres -d unit_talk_dev -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('autopilot_decisions', 'alert_events', 'picks', 'pick_publish')" -t`
      );

      const tables = stdout.split('\n').filter(line => line.trim());
      if (tables.length < 4) {
        errors.push(
          `Missing required tables (found ${tables.length}/4): autopilot_decisions, alert_events, picks, pick_publish`
        );
      }
    } catch (error) {
      errors.push(`Table check error: ${error}`);
    }

    const passed = errors.length === 0;
    if (passed) {
      console.log('✅ All health checks passed\n');
    } else {
      console.error('❌ Health checks failed:');
      errors.forEach(err => console.error(`   - ${err}`));
    }

    return { passed, errors };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private async ensureLogDirectory(): Promise<void> {
    const logDir = path.dirname(this.logFilePath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.warn(`Warning: Could not create log directory: ${error}`);
    }
  }

  private async log(entry: Record<string, any>): Promise<void> {
    const logLine = JSON.stringify(entry) + '\n';
    try {
      await fs.appendFile(this.logFilePath, logLine, 'utf-8');
    } catch (error) {
      console.error(`Failed to write log: ${error}`);
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a burn-in scheduler with Phase 5 defaults
 */
export function createBurnInScheduler(
  overrides?: Partial<SchedulerConfig>
): BurnInScheduler {
  const now = new Date();
  const endTime = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours from now

  const defaultConfig: SchedulerConfig = {
    mode: 'log_only',
    durationHours: 72,
    autopilotIntervalMinutes: 15,
    sloIntervalMinutes: 5,
    ingestionIntervalMinutes: 5,
    alertsEnabled: true,
    discordEnabled: false,
    startTimestamp: now,
    expectedEndTimestamp: endTime,
    safetyChecks: true,
    ...overrides,
  };

  return new BurnInScheduler(defaultConfig);
}
