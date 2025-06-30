// /utils/health.ts

import { Logger } from '../shared/logger/types';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
  // Add timestamp property
  timestamp?: string;
}

export interface AgentStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
  timestamp?: string;
}

export class HealthCheck {
  private logger: Logger;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private healthChecks: Map<string, () => Promise<HealthStatus>> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public registerHealthCheck(
    agentName: string,
    checkFn: () => Promise<HealthStatus>
  ): void {
    this.healthChecks.set(agentName, checkFn);
  }

  public async performHealthCheck(agentName: string): Promise<HealthStatus> {
    const checkFn = this.healthChecks.get(agentName);
    if (!checkFn) {
      const errorStatus: HealthStatus = {
        status: 'unhealthy',
        details: { error: `No health check registered for agent: ${agentName}` },
        timestamp: new Date().toISOString()
      };
      this.logger.warn('Health check failed', { agentName, status: errorStatus });
      return errorStatus;
    }

    try {
      const status = await checkFn();
      this.logger.info('Health check performed', { agentName, status });
      return status;
    } catch (error) {
      const errorStatus: HealthStatus = {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString()
      };
      this.logger.warn('Health check failed', { agentName, status: errorStatus });
      return errorStatus;
    }
  }

  public startHealthCheck(agentName: string, interval: number): NodeJS.Timeout {
    const intervalId = setInterval(() => {
      // Perform health check for the specific agent
      this.performHealthCheck(agentName).catch(error => {
        this.logger.error('Unhandled error in health check', { agentName, error });
      });
    }, interval);

    this.checkIntervals.set(agentName, intervalId);
    return intervalId;
  }

  public async cleanup(): Promise<void> {
    for (const [, interval] of this.checkIntervals.entries()) {
      if (interval) {
        clearInterval(Number(interval)); // Explicitly cast to number
      }
    }
    this.checkIntervals.clear();
    this.healthChecks.clear();
  }
}

export interface HealthReport {
  agentName: string;
  status: AgentStatus;
  timestamp: string;
  details?: {
    errors: string[];
    warnings: string[];
    info: Record<string, unknown>;
  };
}

export class HealthMonitor {
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public startHealthCheck(agentName: string, interval: number): NodeJS.Timeout {
    const intervalId = setInterval(() => {
      // Perform health check for the specific agent
      this.performHealthCheck(agentName);
    }, interval);

    this.checkIntervals.set(agentName, intervalId);
    return intervalId;
  }

  private performHealthCheck(agentName: string): void {
    // Implement specific health check logic for the agent
    this.logger.info(`Performing health check for agent: ${agentName}`);
  }

  public stopHealthCheck(agentName: string): void {
    const intervalId = this.checkIntervals.get(agentName);
    if (intervalId) {
      clearInterval(Number(intervalId)); // Explicitly cast to number
      this.checkIntervals.delete(agentName);
    }
  }
}