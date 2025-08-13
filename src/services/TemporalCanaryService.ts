/**
 * Temporal Canary Service - Health monitoring for Temporal workflows
 * Runs periodic canary workflows to detect Temporal system issues
 */

import { WorkflowClient, WorkflowHandle } from '@temporalio/client';
import { createClient } from '@supabase/supabase-js';

export interface CanaryMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastRunTimestamp: Date;
  lastRunStatus: 'success' | 'failure' | 'timeout';
  consecutiveFailures: number;
}

export interface CanaryResult {
  success: boolean;
  duration: number;
  error?: string;
  workflowId: string;
  runId: string;
  timestamp: Date;
}

export class TemporalCanaryService {
  private client: WorkflowClient;
  private supabase: ReturnType<typeof createClient>;
  private logger: any;
  private metrics: CanaryMetrics;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(
    client: WorkflowClient,
    supabase: ReturnType<typeof createClient>,
    logger: any = console
  ) {
    this.client = client;
    this.supabase = supabase;
    this.logger = logger;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CanaryMetrics {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageDuration: 0,
      lastRunTimestamp: new Date(),
      lastRunStatus: 'success',
      consecutiveFailures: 0
    };
  }

  /**
   * Start the canary service with periodic health checks
   */
  async start(intervalMinutes: number = 5): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Canary service is already running');
      return;
    }

    this.logger.info('Starting Temporal canary service', { intervalMinutes });
    this.isRunning = true;

    // Run initial canary
    await this.runCanary();

    // Schedule periodic canaries
    this.intervalId = setInterval(async () => {
      try {
        await this.runCanary();
      } catch (error) {
        this.logger.error('Periodic canary execution failed', { error });
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the canary service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    this.logger.info('Temporal canary service stopped');
  }

  /**
   * Run a single canary workflow
   */
  async runCanary(): Promise<CanaryResult> {
    const startTime = Date.now();
    const workflowId = `canary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    let workflowHandle: WorkflowHandle | undefined;
    let result: CanaryResult;

    try {
      this.logger.info('Starting canary workflow', { workflowId });

      // Start canary workflow
      workflowHandle = await this.client.start('canaryWorkflow', {
        workflowId,
        taskQueue: 'unit-talk-canary',
        args: [{
          timestamp: new Date().toISOString(),
          testData: 'canary-test-data',
          expectedDuration: 5000 // 5 seconds
        }],
        workflowExecutionTimeout: '30s',
        workflowRunTimeout: '30s',
        workflowTaskTimeout: '10s'
      });

      // Wait for completion
      const workflowResult = await workflowHandle.result();
      const duration = Date.now() - startTime;

      result = {
        success: true,
        duration,
        workflowId,
        runId: workflowHandle.execution.runId,
        timestamp: new Date()
      };

      this.logger.info('Canary workflow completed successfully', {
        workflowId,
        duration,
        result: workflowResult
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      result = {
        success: false,
        duration,
        error: errorMessage,
        workflowId,
        runId: workflowHandle?.execution.runId || 'unknown',
        timestamp: new Date()
      };

      this.logger.error('Canary workflow failed', {
        workflowId,
        duration,
        error: errorMessage
      });
    }

    // Update metrics
    await this.updateMetrics(result);

    // Store result in database
    await this.storeCanaryResult(result);

    // Check for alerts
    await this.checkAlertConditions();

    return result;
  }

  /**
   * Update internal metrics
   */
  private async updateMetrics(result: CanaryResult): Promise<void> {
    this.metrics.totalRuns++;
    this.metrics.lastRunTimestamp = result.timestamp;
    this.metrics.lastRunStatus = result.success ? 'success' : 'failure';

    if (result.success) {
      this.metrics.successfulRuns++;
      this.metrics.consecutiveFailures = 0;
    } else {
      this.metrics.failedRuns++;
      this.metrics.consecutiveFailures++;
    }

    // Calculate rolling average duration
    const alpha = 0.1; // Exponential moving average factor
    this.metrics.averageDuration = this.metrics.totalRuns === 1
      ? result.duration
      : (alpha * result.duration) + ((1 - alpha) * this.metrics.averageDuration);
  }

  /**
   * Store canary result in database for historical analysis
   */
  private async storeCanaryResult(result: CanaryResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('temporal_canary_results')
        .insert({
          workflow_id: result.workflowId,
          run_id: result.runId,
          success: result.success,
          duration_ms: result.duration,
          error_message: result.error,
          timestamp: result.timestamp.toISOString(),
          consecutive_failures: this.metrics.consecutiveFailures
        });

      if (error) {
        this.logger.error('Failed to store canary result', { error });
      }

    } catch (error) {
      this.logger.error('Database error storing canary result', { error });
    }
  }

  /**
   * Check alert conditions and trigger notifications
   */
  private async checkAlertConditions(): Promise<void> {
    // Critical: 3 consecutive failures
    if (this.metrics.consecutiveFailures >= 3) {
      await this.sendAlert('critical', {
        message: 'Temporal canary has failed 3 consecutive times',
        consecutiveFailures: this.metrics.consecutiveFailures,
        lastError: this.metrics.lastRunStatus === 'failure' ? 'Workflow execution failed' : undefined
      });
    }
    // Warning: Average duration > 15 seconds
    else if (this.metrics.averageDuration > 15000) {
      await this.sendAlert('warning', {
        message: 'Temporal canary average duration is high',
        averageDuration: this.metrics.averageDuration,
        threshold: 15000
      });
    }
    // Info: Single failure after successes
    else if (this.metrics.lastRunStatus === 'failure' && this.metrics.consecutiveFailures === 1) {
      await this.sendAlert('info', {
        message: 'Temporal canary single failure detected',
        totalRuns: this.metrics.totalRuns,
        successRate: this.getSuccessRate()
      });
    }
  }

  /**
   * Send alert to monitoring system
   */
  private async sendAlert(severity: 'critical' | 'warning' | 'info', details: any): Promise<void> {
    try {
      // Store alert in database
      await this.supabase
        .from('monitoring_alerts')
        .insert({
          alert_type: 'temporal_canary',
          severity,
          message: details.message,
          details,
          created_at: new Date().toISOString()
        });

      // Send to Discord webhook based on severity
      const webhookUrl = severity === 'critical' 
        ? process.env.DISCORD_WEBHOOK_PROD
        : process.env.DISCORD_WEBHOOK_STAGING;

      if (webhookUrl) {
        await this.sendDiscordAlert(webhookUrl, severity, details);
      }

      this.logger.warn('Canary alert triggered', { severity, details });

    } catch (error) {
      this.logger.error('Failed to send canary alert', { error, severity, details });
    }
  }

  /**
   * Send Discord webhook alert
   */
  private async sendDiscordAlert(webhookUrl: string, severity: string, details: any): Promise<void> {
    const color = {
      critical: 0xFF0000, // Red
      warning: 0xFFA500,  // Orange
      info: 0x0099FF      // Blue
    }[severity] || 0x808080;

    const embed = {
      title: `🚨 Temporal Canary Alert - ${severity.toUpperCase()}`,
      description: details.message,
      color,
      fields: [
        {
          name: 'Metrics',
          value: `Total Runs: ${this.metrics.totalRuns}\nSuccess Rate: ${this.getSuccessRate()}%\nConsecutive Failures: ${this.metrics.consecutiveFailures}\nAvg Duration: ${Math.round(this.metrics.averageDuration)}ms`,
          inline: true
        },
        {
          name: 'Last Run',
          value: `Status: ${this.metrics.lastRunStatus}\nTimestamp: ${this.metrics.lastRunTimestamp.toISOString()}`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }
  }

  /**
   * Get current success rate as percentage
   */
  getSuccessRate(): number {
    if (this.metrics.totalRuns === 0) return 100;
    return Math.round((this.metrics.successfulRuns / this.metrics.totalRuns) * 100);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CanaryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get canary health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  } {
    const successRate = this.getSuccessRate();
    const isRecentFailure = this.metrics.consecutiveFailures > 0;
    const isHighLatency = this.metrics.averageDuration > 10000; // 10s

    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (this.metrics.consecutiveFailures >= 3 || successRate < 90) {
      status = 'unhealthy';
    } else if (isRecentFailure || isHighLatency || successRate < 98) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      details: {
        successRate,
        consecutiveFailures: this.metrics.consecutiveFailures,
        averageDuration: Math.round(this.metrics.averageDuration),
        totalRuns: this.metrics.totalRuns,
        lastRunStatus: this.metrics.lastRunStatus,
        lastRunTimestamp: this.metrics.lastRunTimestamp,
        isRunning: this.isRunning
      }
    };
  }

  /**
   * Get historical canary results
   */
  async getHistoricalResults(hours: number = 24): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

    const { data, error } = await this.supabase
      .from('temporal_canary_results')
      .select('*')
      .gte('timestamp', cutoffTime.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch historical canary results', { error });
      return [];
    }

    return data || [];
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.logger.info('Canary metrics reset');
  }
}

// Canary Workflow Definition (to be registered with Temporal)
export const canaryWorkflowDefinition = `
import { proxyActivities, sleep } from '@temporalio/workflow';

interface CanaryInput {
  timestamp: string;
  testData: string;
  expectedDuration: number;
}

const activities = proxyActivities({
  startToCloseTimeout: '10s',
  retry: {
    maximumAttempts: 1 // No retries for canary
  }
});

export async function canaryWorkflow(input: CanaryInput): Promise<any> {
  const startTime = Date.now();
  
  // Simulate some work
  await sleep('2s');
  
  // Call test activity
  const activityResult = await activities.canaryActivity({
    testData: input.testData,
    timestamp: input.timestamp
  });
  
  // Simulate more work
  await sleep('1s');
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  return {
    success: true,
    duration,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    activityResult,
    input
  };
}
`;

// Export for easy integration
export async function createTemporalCanaryService(
  client: WorkflowClient,
  supabase: ReturnType<typeof createClient>,
  logger?: any
): Promise<TemporalCanaryService> {
  return new TemporalCanaryService(client, supabase, logger);
}