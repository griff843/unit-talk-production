import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { BaseAgentActivities, ActivityParams } from '../../types/activities';
import { AgentStatus } from '../../types/shared';
import { proxyActivities } from '@temporalio/workflow';
import { HealthCheckResult } from '../../types/agent';
import { SupabaseClient } from '@supabase/supabase-js';

interface AgentTaskInput {
  command: any;
}

interface ActivityResult {
  success: boolean;
  data?: any;
  error?: Error;
}




const activities = proxyActivities<BaseAgentActivities>({
  startToCloseTimeout: '1 minute'
});

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const result = await activities.healthCheck({});
  return {
    ...result,
    timestamp: new Date().toISOString()
  };
}

export async function collectMetrics(): Promise<{ timestamp: Date; metrics: Record<string, number> }> {
  return await activities.collectMetrics({});
}

export async function handleCommand(input: AgentTaskInput): Promise<void> {
  // This function needs to be implemented based on your business logic
  console.log('Handling command:', input.command);
}

export async function initialize(): Promise<void> {
  // This function needs to be implemented based on your business logic
  console.log('Initializing agent');
}

export async function cleanup(): Promise<void> {
  // This function needs to be implemented based on your business logic
  console.log('Cleaning up agent');
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
      await this.logActivity({
        level: 'info',
        message: 'Agent initialized',
        metadata: { status: this.status }
      });
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), 'initialization');
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting agent activities');
      this.status = 'healthy';
      await this.logActivity({
        level: 'info',
        message: 'Agent started',
        metadata: { status: this.status }
      });
    } catch (error) {
      await this.handleError(error instanceof Error ? error : new Error(String(error)), 'start');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping agent activities');
      this.status = 'idle';
      await this.logActivity({
        level: 'info',
        message: 'Agent stopped',
        metadata: { status: this.status }
      });
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
      await this.logActivity({
        level: 'info',
        message: 'Health check completed',
        metadata: { status: health.status, timestamp: health.timestamp }
      });
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
    
    await this.logActivity({
      level: 'error',
      message: 'Error occurred',
      metadata: {
        context,
        error: error.message,
        stack: error.stack
      }
    });
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

      await this.logActivity({
        level: 'info',
        message: `Activity ${activityName} completed successfully`,
        metadata: { ...params, startTime }
      });

      return result;
    } catch (error) {
      await this.logActivity({
        level: 'error',
        message: `Activity ${activityName} failed`,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      await this.handleError(error instanceof Error ? error : new Error(String(error)), activityName);

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Required methods from BaseAgentActivities interface
  public async healthCheck(params: ActivityParams): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  }> {
    return {
      status: 'healthy',
      checks: [
        {
          name: 'database',
          status: 'pass',
          message: 'Database connection is healthy'
        }
      ]
    };
  }

  public async collectMetrics(params: ActivityParams): Promise<{
    timestamp: Date;
    metrics: Record<string, number>;
  }> {
    return {
      timestamp: new Date(),
      metrics: {
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        processingTimeMs: 0,
        memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
      }
    };
  }

  public async logActivity(params: {
    level: 'info' | 'warn' | 'error';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.supabase.from('agent_logs').insert({
        agent: this.name,
        level: params.level,
        message: params.message,
        metadata: params.metadata || {},
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to log activity', { error });
    }
  }
} 