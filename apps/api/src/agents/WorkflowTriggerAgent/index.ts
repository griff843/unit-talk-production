import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult, BaseMetrics } from '../BaseAgent/types';

export interface WorkflowTriggerMetrics extends BaseMetrics {
  workflowsTriggered: number;
  workflowsSucceeded: number;
  workflowsFailed: number;
  averageWorkflowTimeMs: number;
  activeWorkflows: number;
  scheduledWorkflows: number;
  lastTriggerTime: string;
  triggerEvents: number;
  cronJobsExecuted: number;
  eventBasedTriggers: number;
}

export interface WorkflowSchedule {
  workflowId: string;
  cronExpression: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  metadata?: any;
}

export interface TriggerEvent {
  eventType: string;
  workflowId: string;
  data: any;
  timestamp: string;
  processed: boolean;
}

/**
 * Workflow Trigger Agent
 *
 * Responsibilities:
 * - Ensure continuous pipeline automation
 * - Trigger Temporal workflows for agent coordination
 * - Handle scheduled and event-based workflow triggers
 * - Manage workflow lifecycle and retries
 * - Monitor workflow execution health
 */
export class WorkflowTriggerAgent extends BaseAgent {
  private metrics: WorkflowTriggerMetrics;
  private scheduledWorkflows: Map<string, WorkflowSchedule> = new Map();
  private activeWorkflows: Set<string> = new Set();
  private pendingEvents: TriggerEvent[] = [];

  // Configuration
  private readonly TRIGGER_INTERVAL_MS: number;
  private readonly MAX_CONCURRENT_WORKFLOWS: number;
  private readonly WORKFLOW_TIMEOUT_MS: number;
  private readonly RETRY_ATTEMPTS: number;

  // Timers and scheduling
  private triggerTimer?: NodeJS.Timeout;
  private cronTimer?: NodeJS.Timeout;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);

    this.TRIGGER_INTERVAL_MS = parseInt(process.env.WORKFLOW_TRIGGER_INTERVAL_MS || '60000'); // 1 minute
    this.MAX_CONCURRENT_WORKFLOWS = parseInt(process.env.MAX_CONCURRENT_WORKFLOWS || '10');
    this.WORKFLOW_TIMEOUT_MS = parseInt(process.env.WORKFLOW_TIMEOUT_MS || '300000'); // 5 minutes
    this.RETRY_ATTEMPTS = parseInt(process.env.WORKFLOW_RETRY_ATTEMPTS || '3');

    this.metrics = {
      ...this.metrics,
      workflowsTriggered: 0,
      workflowsSucceeded: 0,
      workflowsFailed: 0,
      averageWorkflowTimeMs: 0,
      activeWorkflows: 0,
      scheduledWorkflows: 0,
      lastTriggerTime: new Date().toISOString(),
      triggerEvents: 0,
      cronJobsExecuted: 0,
      eventBasedTriggers: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('⚡ Initializing Workflow Trigger Agent', {
      triggerIntervalMs: this.TRIGGER_INTERVAL_MS,
      maxConcurrentWorkflows: this.MAX_CONCURRENT_WORKFLOWS,
      workflowTimeoutMs: this.WORKFLOW_TIMEOUT_MS
    });

    // Initialize core pipeline workflows
    await this.initializePipelineWorkflows();

    // Start trigger timers
    this.startTriggerTimer();
    this.startCronTimer();

    this.logger.info('✅ Workflow Trigger Agent initialized successfully');
  }

  async process(): Promise<void> {
    const startTime = Date.now();

    try {
      // Process pending trigger events
      await this.processPendingEvents();

      // Check and trigger scheduled workflows
      await this.checkScheduledWorkflows();

      // Monitor active workflows
      await this.monitorActiveWorkflows();

      // Trigger continuous pipeline workflow if needed
      await this.ensurePipelineWorkflowRunning();

      this.metrics.lastTriggerTime = new Date().toISOString();
      this.logger.debug('⚡ Workflow trigger cycle completed', {
        processingTimeMs: Date.now() - startTime,
        activeWorkflows: this.activeWorkflows.size,
        pendingEvents: this.pendingEvents.length
      });

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('❌ Workflow trigger process failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Workflow Trigger Agent');

    // Stop timers
    if (this.triggerTimer) {
      clearInterval(this.triggerTimer);
    }
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
    }

    // Wait for active workflows to complete
    await this.waitForActiveWorkflows();

    this.logger.info('✅ Workflow Trigger Agent cleanup completed');
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: Array<{ service: string; status: string; error?: string; details?: any }> = [];

    // Check workflow execution health
    const successRate = this.metrics.workflowsTriggered > 0 
      ? this.metrics.workflowsSucceeded / this.metrics.workflowsTriggered 
      : 1;
    
    const workflowHealthy = successRate > 0.8 && this.activeWorkflows.size <= this.MAX_CONCURRENT_WORKFLOWS;

    checks.push({
      service: 'workflowExecution',
      status: workflowHealthy ? 'healthy' : 'degraded',
      details: {
        successRate: Math.round(successRate * 100) / 100,
        activeWorkflows: this.activeWorkflows.size,
        maxConcurrent: this.MAX_CONCURRENT_WORKFLOWS,
        averageWorkflowTime: this.metrics.averageWorkflowTimeMs
      }
    });

    // Check trigger responsiveness
    const lastTriggerAge = Date.now() - new Date(this.metrics.lastTriggerTime).getTime();
    const triggerHealthy = lastTriggerAge < this.TRIGGER_INTERVAL_MS * 2; // Within 2 intervals

    checks.push({
      service: 'triggerResponsiveness',
      status: triggerHealthy ? 'healthy' : 'degraded',
      details: {
        lastTriggerAgeMs: lastTriggerAge,
        expectedIntervalMs: this.TRIGGER_INTERVAL_MS,
        pendingEvents: this.pendingEvents.length
      }
    });

    // Check scheduled workflows
    const enabledSchedules = Array.from(this.scheduledWorkflows.values()).filter(s => s.enabled).length;
    checks.push({
      service: 'scheduledWorkflows',
      status: enabledSchedules > 0 ? 'healthy' : 'degraded',
      details: {
        enabledSchedules,
        totalSchedules: this.scheduledWorkflows.size
      }
    });

    const isHealthy = checks.every(check => check.status === 'healthy');

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      details: { checks, metrics: this.metrics }
    };
  }

  /**
   * Trigger a workflow manually
   */
  async triggerWorkflow(workflowId: string, data?: any): Promise<void> {
    try {
      this.logger.info(`⚡ Triggering workflow: ${workflowId}`, { data });

      // Check concurrent workflow limit
      if (this.activeWorkflows.size >= this.MAX_CONCURRENT_WORKFLOWS) {
        throw new Error(`Maximum concurrent workflows reached (${this.MAX_CONCURRENT_WORKFLOWS})`);
      }

      const workflowRunId = `${workflowId}-${Date.now()}`;
      this.activeWorkflows.add(workflowRunId);
      this.metrics.activeWorkflows = this.activeWorkflows.size;

      const startTime = Date.now();

      try {
        // Execute the workflow based on type
        await this.executeWorkflow(workflowId, data);

        const executionTime = Date.now() - startTime;
        this.updateWorkflowMetrics(true, executionTime);

        this.logger.info(`✅ Workflow completed: ${workflowId}`, {
          executionTimeMs: executionTime,
          workflowRunId
        });

      } catch (error) {
        const executionTime = Date.now() - startTime;
        this.updateWorkflowMetrics(false, executionTime);
        
        this.logger.error(`❌ Workflow failed: ${workflowId}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTimeMs: executionTime,
          workflowRunId
        });

        throw error;
      } finally {
        this.activeWorkflows.delete(workflowRunId);
        this.metrics.activeWorkflows = this.activeWorkflows.size;
      }

    } catch (error) {
      this.metrics.workflowsFailed++;
      throw error;
    }
  }

  /**
   * Schedule a workflow with cron expression
   */
  async scheduleWorkflow(workflowId: string, cronExpression: string, metadata?: any): Promise<void> {
    this.logger.info(`📅 Scheduling workflow: ${workflowId}`, { cronExpression, metadata });

    const schedule: WorkflowSchedule = {
      workflowId,
      cronExpression,
      enabled: true,
      lastRun: null,
      nextRun: this.calculateNextRun(cronExpression),
      metadata
    };

    this.scheduledWorkflows.set(workflowId, schedule);
    this.metrics.scheduledWorkflows = this.scheduledWorkflows.size;

    this.logger.info(`✅ Workflow scheduled: ${workflowId}`, {
      nextRun: schedule.nextRun
    });
  }

  /**
   * Add an event-based trigger
   */
  async addTriggerEvent(eventType: string, workflowId: string, data: any): Promise<void> {
    const event: TriggerEvent = {
      eventType,
      workflowId,
      data,
      timestamp: new Date().toISOString(),
      processed: false
    };

    this.pendingEvents.push(event);
    this.metrics.triggerEvents++;

    this.logger.info(`📨 Trigger event added: ${eventType}`, {
      workflowId,
      pendingEvents: this.pendingEvents.length
    });
  }

  // Private implementation methods

  private async initializePipelineWorkflows(): Promise<void> {
    // Schedule core pipeline workflows
    
    // 1. Continuous pipeline orchestration workflow
    await this.scheduleWorkflow(
      'pipeline-orchestration',
      '*/30 * * * * *', // Every 30 seconds
      { 
        description: 'Main pipeline orchestration workflow',
        priority: 'high'
      }
    );

    // 2. Health monitoring workflow
    await this.scheduleWorkflow(
      'health-monitoring',
      '0 */1 * * * *', // Every minute
      {
        description: 'Agent health monitoring and alerting',
        priority: 'medium'
      }
    );

    // 3. Performance optimization workflow
    await this.scheduleWorkflow(
      'performance-optimization',
      '0 */5 * * * *', // Every 5 minutes
      {
        description: 'Pipeline performance optimization',
        priority: 'low'
      }
    );

    // 4. Data lifecycle management workflow
    await this.scheduleWorkflow(
      'data-lifecycle',
      '0 0 */1 * * *', // Every hour
      {
        description: 'Data archiving and cleanup',
        priority: 'low'
      }
    );

    this.logger.info(`📅 Initialized ${this.scheduledWorkflows.size} pipeline workflows`);
  }

  private async processPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    this.logger.debug(`📨 Processing ${this.pendingEvents.length} pending trigger events`);

    const eventsToProcess = this.pendingEvents.filter(event => !event.processed);

    for (const event of eventsToProcess) {
      try {
        await this.triggerWorkflow(event.workflowId, event.data);
        event.processed = true;
        this.metrics.eventBasedTriggers++;

        this.logger.info(`✅ Event-triggered workflow completed: ${event.eventType}`, {
          workflowId: event.workflowId
        });
      } catch (error) {
        this.logger.error(`❌ Event-triggered workflow failed: ${event.eventType}`, {
          workflowId: event.workflowId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Clean up processed events (keep last 100 for debugging)
    this.pendingEvents = this.pendingEvents.filter(event => !event.processed).slice(-100);
  }

  private async checkScheduledWorkflows(): Promise<void> {
    const now = new Date();

    for (const [workflowId, schedule] of this.scheduledWorkflows.entries()) {
      if (!schedule.enabled || !schedule.nextRun) continue;

      const nextRunTime = new Date(schedule.nextRun);
      
      if (now >= nextRunTime) {
        try {
          this.logger.info(`📅 Executing scheduled workflow: ${workflowId}`);
          
          await this.triggerWorkflow(workflowId, schedule.metadata);
          
          // Update schedule
          schedule.lastRun = now.toISOString();
          schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
          this.metrics.cronJobsExecuted++;

          this.logger.info(`✅ Scheduled workflow completed: ${workflowId}`, {
            nextRun: schedule.nextRun
          });

        } catch (error) {
          this.logger.error(`❌ Scheduled workflow failed: ${workflowId}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Still update next run time to prevent repeated failures
          schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
        }
      }
    }
  }

  private async monitorActiveWorkflows(): Promise<void> {
    // In a production system, this would monitor actual Temporal workflow executions
    // For now, we track our internal workflow state
    
    this.metrics.activeWorkflows = this.activeWorkflows.size;
    
    if (this.activeWorkflows.size > this.MAX_CONCURRENT_WORKFLOWS * 0.8) {
      this.logger.warn(`⚠️ High workflow concurrency detected`, {
        activeWorkflows: this.activeWorkflows.size,
        maxConcurrent: this.MAX_CONCURRENT_WORKFLOWS
      });
    }
  }

  private async ensurePipelineWorkflowRunning(): Promise<void> {
    // Ensure the main pipeline orchestration workflow is always running
    // This is a safeguard to prevent pipeline stalls
    
    const pipelineSchedule = this.scheduledWorkflows.get('pipeline-orchestration');
    if (pipelineSchedule && pipelineSchedule.enabled) {
      const lastRun = pipelineSchedule.lastRun ? new Date(pipelineSchedule.lastRun) : null;
      const now = new Date();
      
      // If no run in the last 2 minutes, trigger immediately
      if (!lastRun || (now.getTime() - lastRun.getTime()) > 120000) {
        this.logger.info('🚀 Ensuring pipeline workflow continuity - triggering immediate run');
        await this.addTriggerEvent('pipeline_continuity_check', 'pipeline-orchestration', {
          reason: 'continuity_safeguard',
          lastRun: lastRun?.toISOString() || 'never'
        });
      }
    }
  }

  private async executeWorkflow(workflowId: string, data?: any): Promise<void> {
    // This is where we would integrate with Temporal to execute actual workflows
    // For now, we simulate workflow execution
    
    this.logger.info(`🔄 Executing workflow: ${workflowId}`, { data });

    switch (workflowId) {
      case 'pipeline-orchestration':
        await this.executePipelineOrchestrationWorkflow(data);
        break;
      case 'health-monitoring':
        await this.executeHealthMonitoringWorkflow(data);
        break;
      case 'performance-optimization':
        await this.executePerformanceOptimizationWorkflow(data);
        break;
      case 'data-lifecycle':
        await this.executeDataLifecycleWorkflow(data);
        break;
      default:
        throw new Error(`Unknown workflow: ${workflowId}`);
    }

    this.metrics.workflowsTriggered++;
  }

  private async executePipelineOrchestrationWorkflow(data?: any): Promise<void> {
    // This would trigger the Pipeline Orchestrator Agent to process new props
    this.logger.info('🎛️ Executing pipeline orchestration workflow');
    
    // Simulate workflow execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.metrics.workflowsSucceeded++;
  }

  private async executeHealthMonitoringWorkflow(data?: any): Promise<void> {
    // This would trigger comprehensive health checks across all agents
    this.logger.info('🏥 Executing health monitoring workflow');
    
    // Simulate workflow execution
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.metrics.workflowsSucceeded++;
  }

  private async executePerformanceOptimizationWorkflow(data?: any): Promise<void> {
    // This would analyze and optimize pipeline performance
    this.logger.info('⚡ Executing performance optimization workflow');
    
    // Simulate workflow execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.metrics.workflowsSucceeded++;
  }

  private async executeDataLifecycleWorkflow(data?: any): Promise<void> {
    // This would handle data archiving and cleanup
    this.logger.info('📁 Executing data lifecycle workflow');
    
    // Simulate workflow execution
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    this.metrics.workflowsSucceeded++;
  }

  private calculateNextRun(cronExpression: string): string {
    // Simplified cron calculation - in production use a proper cron library
    const now = new Date();
    
    // For this demo, we'll add a fixed interval based on the cron pattern
    const intervals: Record<string, number> = {
      '*/30 * * * * *': 30000, // 30 seconds
      '0 */1 * * * *': 60000,  // 1 minute
      '0 */5 * * * *': 300000, // 5 minutes
      '0 0 */1 * * *': 3600000 // 1 hour
    };
    
    const interval = intervals[cronExpression] || 60000; // Default 1 minute
    return new Date(now.getTime() + interval).toISOString();
  }

  private updateWorkflowMetrics(success: boolean, executionTime: number): void {
    if (success) {
      this.metrics.workflowsSucceeded++;
    } else {
      this.metrics.workflowsFailed++;
    }

    // Update average workflow time
    const totalWorkflows = this.metrics.workflowsSucceeded + this.metrics.workflowsFailed;
    if (totalWorkflows === 1) {
      this.metrics.averageWorkflowTimeMs = executionTime;
    } else {
      this.metrics.averageWorkflowTimeMs = 
        (this.metrics.averageWorkflowTimeMs * (totalWorkflows - 1) + executionTime) / totalWorkflows;
    }
  }

  private async waitForActiveWorkflows(): Promise<void> {
    const maxWaitMs = 30000; // 30 seconds max wait
    const startTime = Date.now();

    while (this.activeWorkflows.size > 0 && (Date.now() - startTime) < maxWaitMs) {
      this.logger.info(`⏳ Waiting for ${this.activeWorkflows.size} active workflows to complete`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeWorkflows.size > 0) {
      this.logger.warn(`⚠️ Force shutdown with ${this.activeWorkflows.size} workflows still active`);
    }
  }

  private startTriggerTimer(): void {
    this.triggerTimer = setInterval(async () => {
      try {
        await this.process();
      } catch (error) {
        this.logger.error('❌ Trigger timer error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.TRIGGER_INTERVAL_MS);

    this.logger.info(`⚡ Workflow trigger timer started - interval: ${this.TRIGGER_INTERVAL_MS}ms`);
  }

  private startCronTimer(): void {
    // Check cron schedules every 10 seconds for accuracy
    this.cronTimer = setInterval(async () => {
      try {
        await this.checkScheduledWorkflows();
      } catch (error) {
        this.logger.error('❌ Cron timer error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 10000);

    this.logger.info('📅 Cron timer started - checking every 10 seconds');
  }

  // Public interface methods

  public getWorkflowMetrics(): WorkflowTriggerMetrics {
    return { ...this.metrics };
  }

  public getScheduledWorkflows(): WorkflowSchedule[] {
    return Array.from(this.scheduledWorkflows.values());
  }

  public getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows);
  }

  public async enableScheduledWorkflow(workflowId: string): Promise<void> {
    const schedule = this.scheduledWorkflows.get(workflowId);
    if (schedule) {
      schedule.enabled = true;
      schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
      this.logger.info(`✅ Enabled scheduled workflow: ${workflowId}`);
    } else {
      throw new Error(`Scheduled workflow not found: ${workflowId}`);
    }
  }

  public async disableScheduledWorkflow(workflowId: string): Promise<void> {
    const schedule = this.scheduledWorkflows.get(workflowId);
    if (schedule) {
      schedule.enabled = false;
      schedule.nextRun = null;
      this.logger.info(`⏸️ Disabled scheduled workflow: ${workflowId}`);
    } else {
      throw new Error(`Scheduled workflow not found: ${workflowId}`);
    }
  }
}