// /utils/health.ts

import type { AgentHealthReport } from '../types/agent'
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger';
import { HealthStatus } from '../types/shared';
import { AgentStatus, HealthCheckResult, healthCheckResultSchema, isValidAgentStatus } from '../types/agent';

export function reportAgentHealth(agent: string, level: 'ok' | 'warn' | 'error', uptime = 0, incidents = 0, notes = ''): AgentHealthReport {
  return {
    agentName: agent,
    status: level === 'ok' ? 'healthy' : level === 'warn' ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    details: {
      errors: [],
      warnings: [],
      info: {
        uptime,
        incidents,
        notes
      }
    }
  }
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private readonly logger: Logger;
  private healthChecks: Map<string, HealthStatus> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout | null> = new Map();

  private constructor(
    private readonly supabase: SupabaseClient,
    private readonly defaultConfig: HealthCheckConfig = {
      interval: 60000, // 1 minute
      timeout: 5000, // 5 seconds
      unhealthyThreshold: 3,
      healthyThreshold: 2
    }
  ) {
    this.logger = new Logger('HealthChecker');
  }

  public static getInstance(
    supabase?: SupabaseClient,
    config?: HealthCheckConfig
  ): HealthChecker {
    if (!HealthChecker.instance && supabase) {
      HealthChecker.instance = new HealthChecker(supabase, config);
    }
    return HealthChecker.instance;
  }

  public async registerHealthCheck(
    agentName: string,
    checkFn: () => Promise<HealthStatus>,
    config?: Partial<HealthCheckConfig>
  ): Promise<void> {
    const fullConfig = { ...this.defaultConfig, ...config };

    // Clear existing interval if any
    const existingInterval = this.checkIntervals.get(agentName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new health check interval
    const interval = setInterval(async () => {
      await this.performHealthCheck(agentName, checkFn);
    }, fullConfig.interval);

    this.checkIntervals.set(agentName, interval);
    this.logger.info(`Health check registered for agent: ${agentName}`);
  }

  public async unregisterHealthCheck(agentName: string): Promise<void> {
    const interval = this.checkIntervals.get(agentName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(agentName);
      this.healthChecks.delete(agentName);
      this.logger.info(`Health check unregistered for agent: ${agentName}`);
    }
  }

  private async performHealthCheck(
    agentName: string,
    checkFn: () => Promise<HealthStatus>
  ): Promise<void> {
    try {
      const startTime = Date.now();
      const health = await Promise.race([
        checkFn(),
        new Promise<HealthStatus>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Health check timed out'));
          }, this.defaultConfig.timeout);
        })
      ]);

      const duration = Date.now() - startTime;
      
      // Update health status
      this.healthChecks.set(agentName, health);

      // Record health check result
      await this.recordHealthCheck(agentName, health, duration);

      // Log health status
      this.logger.logHealth(agentName, health.status === 'degraded' ? 'unhealthy' : health.status, {
        duration,
        details: health.details
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const unhealthyStatus: HealthStatus = {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: errorMessage
      };

      this.healthChecks.set(agentName, unhealthyStatus);
      await this.recordHealthCheck(agentName, unhealthyStatus, this.defaultConfig.timeout);
      
      this.logger.error(`Health check failed for agent: ${agentName}`, {
        error: errorMessage
      });
    }
  }

  private async recordHealthCheck(
    agentName: string,
    health: HealthStatus,
    duration: number
  ): Promise<void> {
    try {
      await this.supabase.from('agent_health').insert({
        agent: agentName,
        status: health.status,
        details: health.details || {},
        duration_ms: duration,
        error: health.error,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Failed to record health check:', { error: errorMessage });
    }
  }

  public getAgentHealth(agentName: string): HealthStatus | undefined {
    return this.healthChecks.get(agentName);
  }

  public getAllHealthStatus(): Map<string, HealthStatus> {
    return new Map(this.healthChecks);
  }

  public async getHealthHistory(
    agentName?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<any> {
    try {
      let query = this.supabase
        .from('agent_health')
        .select('*')
        .order('timestamp', { ascending: false });

      if (agentName) {
        query = query.eq('agent', agentName);
      }

      if (timeRange) {
        query = query
          .gte('timestamp', timeRange.start.toISOString())
          .lte('timestamp', timeRange.end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Failed to get health history:', { error: errorMessage });
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    for (const [agentName, interval] of this.checkIntervals.entries()) {
      if (interval) {
        clearInterval(interval);
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
    info: Record<string, any>;
  };
}

export class HealthMonitor {
  private readonly logger: Logger;
  private readonly supabase: SupabaseClient;
  private readonly checkIntervals = new Map<string, NodeJS.Timeout | null>();

  constructor(supabase: SupabaseClient) {
    this.logger = new Logger('HealthMonitor');
    this.supabase = supabase;
  }

  public async recordHealth(agentName: string, health: HealthCheckResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agent_health')
        .insert({
          agent_name: agentName,
          status: health.status,
          details: health.details,
          timestamp: health.timestamp
        });

      if (error) {
        this.logger.error('Failed to record health check:', { error: error.message });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to record health check:', { error: errorMessage });
    }
  }

  public async getHealthHistory(agentName: string, limit = 10): Promise<HealthReport[]> {
    try {
      const { data, error } = await this.supabase
        .from('agent_health')
        .select('*')
        .eq('agent_name', agentName)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map(record => {
        const status = record.status;
        if (!isValidAgentStatus(status)) {
          throw new Error(`Invalid health status: ${status}`);
        }

        return {
          agentName: record.agent_name,
          status,
          timestamp: record.timestamp,
          details: record.details
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get health history:', { error: errorMessage });
      return [];
    }
  }

  public startMonitoring(agentName: string, interval: number, checkFn: () => Promise<void>): void {
    const existingInterval = this.checkIntervals.get(agentName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const intervalId = setInterval(async () => {
      try {
        await checkFn();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Health check failed for ${agentName}:`, { error: errorMessage });
      }
    }, interval);

    this.checkIntervals.set(agentName, intervalId);
  }

  public stopMonitoring(agentName: string): void {
    const intervalId = this.checkIntervals.get(agentName);
    if (intervalId) {
      clearInterval(intervalId);
      this.checkIntervals.delete(agentName);
    }
  }

  public stopAll(): void {
    for (const [agentName, intervalId] of this.checkIntervals.entries()) {
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
    this.checkIntervals.clear();
  }
}
