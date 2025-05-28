// /utils/health.ts

import type { AgentHealthReport } from '../types/agent'
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger';
import { HealthStatus } from '../types/shared';

export function reportAgentHealth(agent: string, level: 'ok' | 'warn' | 'error', uptime = 0, incidents = 0, notes = ''): AgentHealthReport {
  return {
    agent,
    health: level,
    lastCheck: new Date().toISOString(),
    uptime,
    incidents,
    notes,
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
  private checkIntervals: Map<string, NodeJS.Timer> = new Map();

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
    if (this.checkIntervals.has(agentName)) {
      clearInterval(this.checkIntervals.get(agentName));
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
      this.logger.logHealth(agentName, health.status, {
        duration,
        details: health.details
      });
    } catch (error) {
      const unhealthyStatus: HealthStatus = {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: error.message
      };

      this.healthChecks.set(agentName, unhealthyStatus);
      await this.recordHealthCheck(agentName, unhealthyStatus, this.defaultConfig.timeout);
      
      this.logger.error(`Health check failed for agent: ${agentName}`, {
        error,
        agent: agentName
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
      this.logger.error('Failed to record health check:', error);
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
      this.logger.error('Failed to get health history:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    this.healthChecks.clear();
  }
}
