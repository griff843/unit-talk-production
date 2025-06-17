import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { BaseAgentActivities, ActivityParams, ActivityResult } from '../../types/activities';
import { AgentStatus, Metrics } from '../../types/shared';
import { SupabaseClient } from '@supabase/supabase-js';
import { proxyActivities } from '@temporalio/workflow';
import { HealthCheckResult, AgentCommand } from '../../types/agent';

interface AgentTaskInput {
  command: any;
}



const activities = proxyActivities<BaseAgentActivities>({
  startToCloseTimeout: '1 minute'
});

export async function runHealthCheck(): Promise<HealthCheckResult> {
  return await activities.checkHealth();
}

export async function collectMetrics(): Promise<Metrics> {
  return await activities.collectMetrics();
}

export async function handleCommand(input: AgentTaskInput): Promise<void> {
  await activities.handleCommand(input.command);
}

export async function initialize(): Promise<void> {
  await activities.initialize();
}

export async function cleanup(): Promise<void> {
  await activities.cleanup();
}

export abstract class BaseAgentActivitiesImpl implements BaseAgentActivities {
  protected readonly logger: Logger;
  protected readonly errorHandler: ErrorHandler;
  protected status: AgentStatus = 'idle';

  constructor(
    protected readonly name: string,
    protected readonly supabase: SupabaseClient
  ) {
    this.logger = new Logger(name);
    this.errorHandler = new ErrorHandler(name, supabase);
  }

  // Core operations
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent activities');
      await this.validateDependencies();
      await this.initializeResources();
      this.status = 'idle';
      await this.logActivity('initialize', { status: this.status });
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), 'initialization');
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting agent activities');
      this.status = 'healthy';
      await this.logActivity('start', { status: this.status });
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), 'start');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping agent activities');
      this.status = 'idle';
      await this.logActivity('stop', { status: this.status });
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), 'stop');
      throw error;
    }
  }

  // Health and monitoring
  public async checkHealth(): Promise<HealthCheckResult> {
    try {
      const health: HealthCheckResult = {
        status: 'idle',
        timestamp: new Date().toISOString(),
        details: {
          errors: [],
          warnings: [],
          info: {
            agentName: this.name,
            agentStatus: this.status,
          }
        }
      };
      await this.logActivity('health_check', { status: health.status, timestamp: health.timestamp });
      return health;
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), 'health_check');
      return {
        status: 'unhealthy', // Changed from 'error' to match AgentStatus type
        timestamp: new Date().toISOString(),
        details: {
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
          info: {}
        }
      };
    }
  }

  public async reportStatus(): Promise<AgentStatus> {
    return this.status;
  }

  // Error handling
  public async handleError(error: Error, context: string): Promise<void> {
    await this.errorHandler.handleError(error, {
      agent: this.name,
      context,
      status: this.status
    });
    
    await this.logActivity('error', {
      context,
      error: error.message,
      stack: error.stack
    });
  }

  // Activity logging
  protected async logActivity(
    activityType: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('agent_logs').insert({
        agent: this.name,
        activity_type: activityType,
        details: details as Record<string, any>,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to log activity:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Helper methods that should be implemented by specific agents
  protected abstract validateDependencies(): Promise<void>;
  protected abstract initializeResources(): Promise<void>;

  // Utility methods for standardized activity execution
  protected async executeActivity<T>(
    activityName: string,
    params: ActivityParams,
    operation: () => Promise<T>
  ): Promise<ActivityResult> {
    try {
      const startTime = new Date().toISOString();
      const data = await operation();

      const result: ActivityResult = {
        success: true,
        data
      };

      await this.logActivity(activityName, { ...params, startTime });

      return result;
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), activityName);

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Missing required methods from BaseAgentActivities interface
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up agent activities');
    this.status = 'idle';
  }

  public async collectMetrics(): Promise<Metrics> {
    return {
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  public async handleCommand(command: AgentCommand): Promise<void> {
    this.logger.info('Handling command', { command: command.type });
    // Default implementation - subclasses should override
  }
} 