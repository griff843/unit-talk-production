/**
 * Enhanced Health Check Types
 * PHASE1-ENFORCEMENT-LOCK-001: Split from enhanced-health-checks.ts for lint compliance
 */

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  metadata?: Record<string, unknown>;
  critical: boolean;
  lastCheck: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_failures: number;
  };
  performance: {
    memory_usage_mb: number;
    cpu_usage_percent?: number;
    response_time_avg_ms: number;
  };
}

export interface HealthCheckResult {
  healthy: boolean;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface DependencyConfig {
  name: string;
  critical: boolean;
  timeout: number;
  checkInterval: number;
  healthCheckFn: () => Promise<HealthCheckResult>;
}

// PHASE1-ENFORCEMENT-LOCK-001: Use ReturnType instead of NodeJS.Timeout
export type TimeoutHandle = ReturnType<typeof setTimeout>;
