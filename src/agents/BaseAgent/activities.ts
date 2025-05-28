import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { BaseAgentActivities, ActivityParams, ActivityResult } from '../../types/activities';
import { AgentStatus, HealthStatus, Metrics } from '../../types/shared';
import { SupabaseClient } from '@supabase/supabase-js';
import { proxyActivities } from '@temporalio/workflow';
import { AgentCommand, AgentTaskInput, HealthCheckResult } from '../../types/agent';

export interface BaseAgentActivities {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  checkHealth(): Promise<HealthCheckResult>;
  collectMetrics(): Promise<Metrics>;
  handleCommand(command: AgentCommand): Promise<void>;
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
    this.errorHandler = ErrorHandler.getInstance();
  }

  // Core operations
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent activities');
      await this.validateDependencies();
      await this.initializeResources();
      this.status = 'ready';
      await this.logActivity('initialize', { status: this.status });
    } catch (error) {
      await this.handleError(error, 'initialization');
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting agent activities');
      this.status = 'running';
      await this.logActivity('start', { status: this.status });
    } catch (error) {
      await this.handleError(error, 'start');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping agent activities');
      this.status = 'stopped';
      await this.logActivity('stop', { status: this.status });
    } catch (error) {
      await this.handleError(error, 'stop');
      throw error;
    }
  }

  // Health and monitoring
  public async checkHealth(): Promise<HealthStatus> {
    try {
      const health: HealthStatus = {
        status: 'healthy',
        lastChecked: new Date().toISOString(),
        details: {
          agentName: this.name,
          agentStatus: this.status,
        }
      };
      await this.logActivity('health_check', health);
      return health;
    } catch (error) {
      await this.handleError(error, 'health_check');
      return {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: error.message
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
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to log activity:', error);
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
        message: `Successfully executed ${activityName}`,
        data,
        timestamp: new Date().toISOString()
      };

      await this.logActivity(activityName, {
        params,
        result,
        startTime,
        endTime: result.timestamp
      });

      return result;
    } catch (error) {
      await this.handleError(error, activityName);
      
      return {
        success: false,
        message: `Failed to execute ${activityName}`,
        error,
        timestamp: new Date().toISOString()
      };
    }
  }
} 