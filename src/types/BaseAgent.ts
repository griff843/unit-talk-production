import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { HealthCheckResult, AgentStatus, AgentConfig, AgentCommand } from './agent';

export abstract class BaseAgent {
  protected supabase: SupabaseClient;
  protected logger: Logger;
  protected status: AgentStatus = 'idle';
  protected config: AgentConfig;
  protected healthCheckInterval: NodeJS.Timer;
  protected metricsInterval: NodeJS.Timer;

  constructor(
    protected readonly name: string,
    config: AgentConfig,
    supabase: SupabaseClient
  ) {
    this.config = config;
    this.supabase = supabase;
    this.logger = new Logger(name);
  }

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract handleCommand(command: AgentCommand): Promise<void>;
  abstract healthCheck(): Promise<HealthCheckResult>;

  protected async setupHealthCheck(): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        await this.supabase.from('agent_health').insert({
          agent: this.name,
          status: health.status,
          details: health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, this.config.healthCheckIntervalMs || 30000);
  }

  protected async setupMetrics(): Promise<void> {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        await this.supabase.from('agent_metrics').insert({
          agent: this.name,
          metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Metrics collection failed:', error);
      }
    }, this.config.metricsIntervalMs || 60000);
  }

  protected async collectMetrics(): Promise<Record<string, any>> {
    return {
      status: this.status,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }

  protected async handleError(error: Error, context: string): Promise<void> {
    this.logger.error(`Error in ${context}:`, error);
    
    await this.supabase.from('agent_errors').insert({
      agent: this.name,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });

    if (this.shouldEnterErrorState(error)) {
      this.status = 'error';
      await this.stop();
    }
  }

  protected shouldEnterErrorState(error: Error): boolean {
    // Implement logic to determine if error is severe enough to enter error state
    return false;
  }

  protected async validateConfig(config: AgentConfig): Promise<void> {
    if (!config) throw new Error('Config is required');
    if (!config.id) throw new Error('Config must have an id');
    if (!config.version) throw new Error('Config must have a version');
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public getName(): string {
    return this.name;
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  protected async cleanup(): Promise<void> {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
  }
} 