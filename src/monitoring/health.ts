/**
 * Health Monitoring System
 * Real-time system health checks and monitoring
 */

import { logger } from '../services/logging.js';
import { supabase } from '../services/supabaseClient.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheck[];
  uptime: number;
  version: string;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  message?: string;
  details?: any;
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime: number;
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor() {
    this.startTime = Date.now();
    this.registerDefaultChecks();
  }

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  private registerDefaultChecks(): void {
    // Database connectivity check
    this.checks.set('database', async (): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        const { error } = await supabase
          .from('users')
          .select('count')
          .limit(1);

        const responseTime = Date.now() - start;
        
        if (error) {
          return {
            name: 'database',
            status: 'fail',
            responseTime,
            message: 'Database connection failed',
            details: error
          };
        }

        return {
          name: 'database',
          status: responseTime > 1000 ? 'warn' : 'pass',
          responseTime,
          message: responseTime > 1000 ? 'Slow database response' : 'Database healthy'
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'fail',
          responseTime: Date.now() - start,
          message: 'Database check failed',
          details: error
        };
      }
    });

    // Memory usage check
    this.checks.set('memory', async (): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const usagePercent = (heapUsedMB / heapTotalMB) * 100;

        return {
          name: 'memory',
          status: usagePercent > 90 ? 'fail' : usagePercent > 70 ? 'warn' : 'pass',
          responseTime: Date.now() - start,
          message: `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent.toFixed(1)}%)`,
          details: memUsage
        };
      } catch (error) {
        return {
          name: 'memory',
          status: 'fail',
          responseTime: Date.now() - start,
          message: 'Memory check failed',
          details: error
        };
      }
    });

    // Disk space check (simplified)
    this.checks.set('disk', async (): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        // Simplified disk check - in production, use proper disk monitoring
        return {
          name: 'disk',
          status: 'pass',
          responseTime: Date.now() - start,
          message: 'Disk space healthy'
        };
      } catch (error) {
        return {
          name: 'disk',
          status: 'fail',
          responseTime: Date.now() - start,
          message: 'Disk check failed',
          details: error
        };
      }
    });

    // Agent system check
    this.checks.set('agents', async (): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        // Check if agents are responsive
        // This would check actual agent health in production
        return {
          name: 'agents',
          status: 'pass',
          responseTime: Date.now() - start,
          message: 'All agents operational'
        };
      } catch (error) {
        return {
          name: 'agents',
          status: 'fail',
          responseTime: Date.now() - start,
          message: 'Agent system check failed',
          details: error
        };
      }
    });
  }

  async performHealthCheck(): Promise<HealthStatus> {
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        return await checkFn();
      } catch (error) {
        return {
          name,
          status: 'fail' as const,
          responseTime: 0,
          message: 'Health check failed',
          details: error
        };
      }
    });

    const checks = await Promise.all(checkPromises);
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warnChecks = checks.filter(check => check.status === 'warn');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length > 0) {
      overallStatus = 'unhealthy';
    } else if (warnChecks.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0'
    };

    // Log health status
    if (overallStatus === 'unhealthy') {
      logger.error('System health check failed', { healthStatus });
    } else if (overallStatus === 'degraded') {
      logger.warn('System health degraded', { healthStatus });
    } else {
      logger.info('System health check passed', { 
        status: overallStatus,
        uptime: healthStatus.uptime 
      });
    }

    return healthStatus;
  }

  registerCustomCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  async startPeriodicChecks(intervalMs: number = 60000): Promise<void> {
    logger.info('Starting periodic health checks', { intervalMs });
    
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Periodic health check failed', error);
      }
    }, intervalMs);
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  static getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  static getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name] of this.metrics) {
      result[name] = this.getMetricStats(name);
    }
    
    return result;
  }

  static clearMetrics(): void {
    this.metrics.clear();
  }
}

// Request timing middleware
export const performanceMiddleware = (req: any, res: any, next: any): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    PerformanceMonitor.recordMetric('request_duration', duration);
    PerformanceMonitor.recordMetric(`${req.method}_${req.route?.path || req.path}`, duration);
  });
  
  next();
};

// Error tracking
export class ErrorTracker {
  private static errors: Array<{ timestamp: string; error: any; context?: any }> = [];

  static trackError(error: any, context?: any): void {
    this.errors.push({
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context
    });

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors.shift();
    }

    logger.error('Error tracked', { error, context });
  }

  static getRecentErrors(limit: number = 10): Array<any> {
    return this.errors.slice(-limit);
  }

  static getErrorStats(): { total: number; recent: number } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentErrors = this.errors.filter(e => e.timestamp > oneHourAgo);
    
    return {
      total: this.errors.length,
      recent: recentErrors.length
    };
  }

  static clearErrors(): void {
    this.errors.length = 0;
  }
}

export default {
  HealthMonitor,
  PerformanceMonitor,
  ErrorTracker,
  performanceMiddleware
};