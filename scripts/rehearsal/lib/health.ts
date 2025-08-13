/**
 * @fileoverview Health Checker
 * 
 * Provides comprehensive health checking capabilities for the rehearsal system.
 * Monitors services, databases, APIs, and system thresholds.
 */

import { createClient } from '@supabase/supabase-js';

interface HealthStatus {
  healthy: boolean;
  issues: string[];
  services: Record<string, ServiceHealth>;
  timestamp: number;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: number;
  details?: any;
}

interface HealthThresholds {
  feedFreshness: number; // seconds
  backlogAge: number; // seconds
  canaryLatency: number; // seconds
  errorRate?: number; // percentage
  uptime?: number; // percentage
}

interface HealthGateResult {
  passed: boolean;
  failures: string[];
  metrics: Record<string, number>;
  timestamp: number;
}

export class HealthChecker {
  private environment: 'staging' | 'prod';
  private supabase: any;
  private apiBaseUrl: string;

  constructor(environment: 'staging' | 'prod') {
    this.environment = environment;
    this.apiBaseUrl = this.getApiBaseUrl();
    this.initializeSupabase();
  }

  private getApiBaseUrl(): string {
    if (this.environment === 'prod') {
      return process.env.PROD_API_URL || 'https://api.unit-talk.com';
    }
    return process.env.API_URL || 'http://localhost:3010';
  }

  private initializeSupabase(): void {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = this.environment === 'prod' 
      ? process.env.SUPABASE_SERVICE_ROLE_KEY 
      : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found for health checking');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async checkEnvironment(): Promise<HealthStatus> {
    const services: Record<string, ServiceHealth> = {};
    const issues: string[] = [];

    // Check API health
    services.api = await this.checkApiHealth();
    if (services.api.status === 'unhealthy') {
      issues.push('API service is unhealthy');
    }

    // Check database health
    services.database = await this.checkDatabaseHealth();
    if (services.database.status === 'unhealthy') {
      issues.push('Database is unhealthy');
    }

    // Check Docker services
    services.docker = await this.checkDockerServices();
    if (services.docker.status === 'unhealthy') {
      issues.push('Docker services are unhealthy');
    }

    // Check external dependencies
    services.external = await this.checkExternalDependencies();
    if (services.external.status === 'degraded') {
      issues.push('Some external dependencies are degraded');
    }

    return {
      healthy: issues.length === 0,
      issues,
      services,
      timestamp: Date.now()
    };
  }

  private async checkApiHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'go-live-rehearsal/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'healthy',
          responseTime,
          lastCheck: Date.now(),
          details: data
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          lastCheck: Date.now(),
          details: { statusCode: response.status, statusText: response.statusText }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: Date.now(),
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.supabase
        .from('app_system_config')
        .select('count')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          status: 'unhealthy',
          responseTime,
          lastCheck: Date.now(),
          details: { error: error.message }
        };
      }

      return {
        status: 'healthy',
        responseTime,
        lastCheck: Date.now(),
        details: { recordCount: data?.length || 0 }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: Date.now(),
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async checkDockerServices(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const { execSync } = require('child_process');
      const output = execSync('docker-compose ps --services --filter status=running', { 
        encoding: 'utf8',
        timeout: 10000
      });

      const runningServices = output.trim().split('\n').filter(Boolean);
      const requiredServices = ['api', 'postgres', 'redis'];
      const missingServices = requiredServices.filter(service => 
        !runningServices.some(running => running.includes(service))
      );

      const responseTime = Date.now() - startTime;

      return {
        status: missingServices.length === 0 ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: Date.now(),
        details: {
          running: runningServices,
          missing: missingServices,
          total: runningServices.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: Date.now(),
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async checkExternalDependencies(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const dependencies = [
      { name: 'GitHub API', url: 'https://api.github.com' },
      { name: 'Docker Hub', url: 'https://hub.docker.com' }
    ];

    const results = [];
    let healthyCount = 0;

    for (const dep of dependencies) {
      try {
        const response = await fetch(dep.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });

        const isHealthy = response.ok;
        if (isHealthy) healthyCount++;

        results.push({
          name: dep.name,
          healthy: isHealthy,
          status: response.status
        });
      } catch (error) {
        results.push({
          name: dep.name,
          healthy: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const responseTime = Date.now() - startTime;
    const healthRatio = healthyCount / dependencies.length;

    return {
      status: healthRatio >= 1.0 ? 'healthy' : healthRatio >= 0.5 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: Date.now(),
      details: { results, healthyCount, total: dependencies.length }
    };
  }

  async checkTiles(): Promise<{ healthy: boolean; tiles: Record<string, any> }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tiles/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'go-live-rehearsal/1.0' },
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          healthy: data.healthy || false,
          tiles: data.tiles || {}
        };
      } else {
        return {
          healthy: false,
          tiles: { error: `HTTP ${response.status}` }
        };
      }
    } catch (error) {
      return {
        healthy: false,
        tiles: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  async waitForHealthThresholds(thresholds: HealthThresholds, timeoutMs: number = 300000): Promise<HealthGateResult> {
    const startTime = Date.now();
    const failures: string[] = [];
    const metrics: Record<string, number> = {};

    while (Date.now() - startTime < timeoutMs) {
      // Check feed freshness
      const feedMetrics = await this.checkFeedFreshness();
      metrics.feedFreshness = feedMetrics.secondsSinceLastUpdate;
      
      if (feedMetrics.secondsSinceLastUpdate > thresholds.feedFreshness) {
        failures.push(`Feed freshness: ${feedMetrics.secondsSinceLastUpdate}s > ${thresholds.feedFreshness}s`);
      }

      // Check backlog age
      const backlogMetrics = await this.checkBacklogAge();
      metrics.backlogAge = backlogMetrics.oldestItemAge;
      
      if (backlogMetrics.oldestItemAge > thresholds.backlogAge) {
        failures.push(`Backlog age: ${backlogMetrics.oldestItemAge}s > ${thresholds.backlogAge}s`);
      }

      // Check canary latency
      const latencyMetrics = await this.checkCanaryLatency();
      metrics.canaryLatency = latencyMetrics.averageLatency;
      
      if (latencyMetrics.averageLatency > thresholds.canaryLatency) {
        failures.push(`Canary latency: ${latencyMetrics.averageLatency}s > ${thresholds.canaryLatency}s`);
      }

      // If all thresholds pass, return success
      if (failures.length === 0) {
        return {
          passed: true,
          failures: [],
          metrics,
          timestamp: Date.now()
        };
      }

      // Clear failures for next iteration
      failures.length = 0;

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return {
      passed: false,
      failures,
      metrics,
      timestamp: Date.now()
    };
  }

  private async checkFeedFreshness(): Promise<{ secondsSinceLastUpdate: number }> {
    try {
      const { data, error } = await this.supabase
        .from('raw_props')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return { secondsSinceLastUpdate: 9999 };
      }

      const lastUpdate = new Date(data[0].created_at);
      const secondsSinceLastUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

      return { secondsSinceLastUpdate };
    } catch (error) {
      return { secondsSinceLastUpdate: 9999 };
    }
  }

  private async checkBacklogAge(): Promise<{ oldestItemAge: number }> {
    try {
      const { data, error } = await this.supabase
        .from('bridge_outbox')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        return { oldestItemAge: 0 };
      }

      const oldestItem = new Date(data[0].created_at);
      const oldestItemAge = Math.floor((Date.now() - oldestItem.getTime()) / 1000);

      return { oldestItemAge };
    } catch (error) {
      return { oldestItemAge: 0 };
    }
  }

  private async checkCanaryLatency(): Promise<{ averageLatency: number }> {
    try {
      // Simulate canary latency check
      const startTime = Date.now();
      
      const response = await fetch(`${this.apiBaseUrl}/api/health/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      const latency = Date.now() - startTime;

      return { averageLatency: latency / 1000 }; // Convert to seconds
    } catch (error) {
      return { averageLatency: 9999 };
    }
  }

  async performContinuousHealthCheck(durationMs: number = 60000, intervalMs: number = 5000): Promise<HealthStatus[]> {
    const results: HealthStatus[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
      const status = await this.checkEnvironment();
      results.push(status);

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return results;
  }

  async getHealthSummary(): Promise<{ uptime: number; errorRate: number; avgResponseTime: number }> {
    try {
      // This would typically query metrics from Prometheus or similar
      // For now, return mock data
      return {
        uptime: 99.9,
        errorRate: 0.1,
        avgResponseTime: 150
      };
    } catch (error) {
      return {
        uptime: 0,
        errorRate: 100,
        avgResponseTime: 9999
      };
    }
  }
}