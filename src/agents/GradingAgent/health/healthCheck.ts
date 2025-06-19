import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../../services/logging';
import { ConfigManager } from '../config';
import { PerformanceTracker } from '../tracking/performanceTracker';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: ComponentHealth;
    config: ComponentHealth;
    metrics: ComponentHealth;
    performance: ComponentHealth;
  };
  last_check: string;
  version: string;
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  last_success?: string;
  error?: string;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private lastStatus: HealthStatus | undefined;
  private readonly version: string = '2.0.0';

  private constructor(
    private supabase: SupabaseClient,
    private configManager: ConfigManager,
    private performanceTracker: PerformanceTracker
  ) {
    this.setupHealthCheck();
  }

  public static getInstance(
    supabase: SupabaseClient,
    configManager: ConfigManager,
    performanceTracker: PerformanceTracker
  ): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker(supabase, configManager, performanceTracker);
    }
    return HealthChecker.instance;
  }

  private setupHealthCheck(): void {
    setInterval(() => this.check(), 30000); // Check every 30 seconds
  }

  public async check(): Promise<HealthStatus> {
    const start = Date.now();
    const components = {
      database: await this.checkDatabase(),
      config: await this.checkConfig(),
      metrics: await this.checkMetrics(),
      performance: await this.checkPerformance()
    };

    const status = this.determineOverallStatus(components);
    
    this.lastStatus = {
      status,
      components,
      last_check: new Date().toISOString(),
      version: this.version
    };

    if (status !== 'healthy') {
      logger.warn('Health check detected issues:', this.lastStatus);
    }

    return this.lastStatus;
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('health_checks')
        .select('count')
        .single();

      if (error) throw error;

      return {
        status: 'healthy',
        latency_ms: Date.now() - start,
        last_success: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        latency_ms: Date.now() - start
      };
    }
  }

  private async checkConfig(): Promise<ComponentHealth> {
    try {
      const config = this.configManager.getConfig();
      const lastUpdate = this.configManager.getLastUpdate();
      const configAge = Date.now() - lastUpdate.getTime();

      return {
        status: configAge < 600000 ? 'healthy' : 'degraded', // Degraded if config older than 10 minutes
        latency_ms: configAge,
        last_success: lastUpdate.toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkMetrics(): Promise<ComponentHealth> {
    try {
      const metrics = await fetch('http://localhost:9002/metrics');
      if (!metrics.ok) throw new Error('Metrics endpoint returned non-200 status');

      return {
        status: 'healthy',
        latency_ms: metrics.status === 200 ? 0 : undefined,
        last_success: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkPerformance(): Promise<ComponentHealth> {
    try {
      const metrics = this.performanceTracker.getMetrics();
      const failureRate = metrics.failed / (metrics.total_processed || 1);

      return {
        status: failureRate < 0.05 ? 'healthy' : failureRate < 0.1 ? 'degraded' : 'unhealthy',
        latency_ms: metrics.processing_time_ms / (metrics.total_processed || 1),
        last_success: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private determineOverallStatus(components: HealthStatus['components']): HealthStatus['status'] {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.some(s => s === 'unhealthy')) return 'unhealthy';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  }

  public getLastStatus(): HealthStatus | undefined {
    return this.lastStatus;
  }
} 