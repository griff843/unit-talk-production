/**
 * Enhanced Health Checker Class
 * PHASE1-ENFORCEMENT-LOCK-001: Split from enhanced-health-checks.ts for lint compliance
 */

import { logger } from '../../shared/logger';

import { getCoreDependencies } from './dependencies';
import { HealthCheck, SystemHealth, DependencyConfig, TimeoutHandle } from './types';

/**
 * Enhanced health check system with dependency validation,
 * circuit breaker integration, and comprehensive monitoring
 */
export class EnhancedHealthChecker {
  private dependencies: Map<string, DependencyConfig> = new Map();
  private lastResults: Map<string, HealthCheck> = new Map();
  private checkIntervals: Map<string, TimeoutHandle> = new Map();
  private systemStartTime: number = Date.now();

  constructor() {
    this.registerCoreDependencies();
    this.startPeriodicChecks();
  }

  private registerCoreDependencies(): void {
    for (const dep of getCoreDependencies()) {
      this.registerDependency(dep);
    }
    logger.info('Health checker initialized', {
      dependencies: Array.from(this.dependencies.keys()),
    });
  }

  public registerDependency(config: DependencyConfig): void {
    this.dependencies.set(config.name, config);
    if (this.checkIntervals.has(config.name)) {
      clearInterval(this.checkIntervals.get(config.name)!);
    }
    const interval = setInterval(async () => {
      await this.checkDependency(config.name);
    }, config.checkInterval);
    this.checkIntervals.set(config.name, interval);
  }

  public async checkDependency(name: string): Promise<HealthCheck | null> {
    const config = this.dependencies.get(name);
    if (!config) return null;

    try {
      const result = await Promise.race([
        config.healthCheckFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), config.timeout)
        ),
      ]);
      const healthCheck: HealthCheck = {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        responseTime: result.responseTime,
        error: result.error,
        metadata: result.metadata,
        critical: config.critical,
        lastCheck: new Date().toISOString(),
      };
      this.lastResults.set(name, healthCheck);
      if (!result.healthy && config.critical) {
        logger.error('Critical dependency unhealthy', { dependency: name, error: result.error });
      }
      return healthCheck;
    } catch (error) {
      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        critical: config.critical,
        lastCheck: new Date().toISOString(),
      };
      this.lastResults.set(name, healthCheck);
      if (config.critical) {
        logger.error('Critical dependency check failed', { dependency: name });
      }
      return healthCheck;
    }
  }

  public async getSystemHealth(): Promise<SystemHealth> {
    const checkPromises = Array.from(this.dependencies.keys()).map(name =>
      this.checkDependency(name)
    );
    const results = await Promise.all(checkPromises);
    const checks = results.filter((c): c is HealthCheck => c !== null);

    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      critical_failures: checks.filter(c => c.status === 'unhealthy' && c.critical).length,
    };

    let systemStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.critical_failures > 0) systemStatus = 'unhealthy';
    else if (summary.unhealthy > 0 || summary.degraded > 0) systemStatus = 'degraded';
    else systemStatus = 'healthy';

    const memUsage = process.memoryUsage();
    const avgResponseTime =
      checks
        .filter(c => c.responseTime !== undefined)
        .reduce((sum, c) => sum + (c.responseTime || 0), 0) /
      Math.max(1, checks.filter(c => c.responseTime !== undefined).length);

    return {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - this.systemStartTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
      performance: {
        memory_usage_mb: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        response_time_avg_ms: Math.round(avgResponseTime * 100) / 100,
      },
    };
  }

  public getDependencyHealth(name: string): HealthCheck | null {
    return this.lastResults.get(name) || null;
  }

  private startPeriodicChecks(): void {
    setTimeout(async () => {
      for (const name of this.dependencies.keys()) {
        await this.checkDependency(name);
      }
    }, 1000);
  }

  public stopPeriodicChecks(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
  }

  public getHealthSummary(): {
    status: string;
    healthy_dependencies: string[];
    unhealthy_dependencies: string[];
    critical_issues: string[];
  } {
    const checks = Array.from(this.lastResults.values());
    return {
      status: checks.every(c => c.status === 'healthy')
        ? 'healthy'
        : checks.some(c => c.status === 'unhealthy' && c.critical)
          ? 'unhealthy'
          : 'degraded',
      healthy_dependencies: checks.filter(c => c.status === 'healthy').map(c => c.name),
      unhealthy_dependencies: checks.filter(c => c.status === 'unhealthy').map(c => c.name),
      critical_issues: checks
        .filter(c => c.status === 'unhealthy' && c.critical)
        .map(c => `${c.name}: ${c.error}`),
    };
  }
}

export const healthChecker = new EnhancedHealthChecker();
