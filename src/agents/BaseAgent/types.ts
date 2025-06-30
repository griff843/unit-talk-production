import { Logger } from '../../shared/logger/types';
import { z } from 'zod';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: Record<string, unknown>;
  // Add timestamp property
  timestamp?: string;
}

// Export HealthCheckResult as an alias for HealthStatus for backward compatibility
export type HealthCheckResult = HealthStatus;


export interface BaseMetrics {
  // Add agentName property
  agentName: string;
  // Add errorCount property
  errorCount: number;
  // Add successCount property
  successCount: number;
  // Add warningCount property
  warningCount: number;
  // Add processingTimeMs property
  processingTimeMs: number;
  // Add memoryUsageMb property
  memoryUsageMb: number;
  // Optional metrics properties
  port?: number;
  enabled?: boolean;
  interval?: number;
  endpoint?: string;
}

// Export AgentMetrics as an alias for BaseMetrics for backward compatibility
export type AgentMetrics = BaseMetrics;

export interface HealthConfig {
  // Health configuration properties
  enabled?: boolean;
  interval?: number;
  timeout?: number;
  checkDb?: boolean;
  checkExternal?: boolean;
  endpoint?: string;
}

export interface RetryConfig {
  // Retry configuration properties
  enabled?: boolean;
  maxRetries?: number;
  maxAttempts?: number;
  backoffMs?: number;
  backoff?: number;
  maxBackoffMs?: number;
  exponential?: boolean;
  jitter?: boolean;
}

export interface MetricsConfig {
  enabled?: boolean;
  interval?: number;
  port?: number;
  endpoint?: string;
}

export interface BaseAgentConfig {
  // Required properties
  name: string;
  // Optional properties
  version?: string;
  enabled?: boolean;
  logLevel?: 'info' | 'warn' | 'error' | 'debug';
  schedule?: 'disabled' | 'enabled' | 'manual';
  // Configuration objects
  metrics?: MetricsConfig;
  health?: HealthConfig;
  retry?: RetryConfig;
}

export interface BaseAgentDependencies {
  // Required dependencies
  logger: Logger;
  // Optional dependencies
  supabase?: any;
  errorHandler?: ErrorHandler;
}

// Add missing types
export type AgentStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error' | 'degraded';

export interface ErrorHandler {
  handleError(error: Error, context?: Record<string, unknown>): void;
}

// Zod schema for BaseAgentConfig
export const BaseAgentConfigSchema = z.object({
  name: z.string(),
  version: z.string().optional().default('1.0.0'),
  enabled: z.boolean().optional().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  metrics: z.object({
    enabled: z.boolean().optional().default(true),
    interval: z.number().min(5).optional().default(60), // seconds
    port: z.number().optional(),
    endpoint: z.string().optional()
  }).optional().default({}),
  health: z.object({
    enabled: z.boolean().optional().default(true),
    interval: z.number().min(5).optional().default(30), // seconds
    timeout: z.number().optional().default(5000),
    checkDb: z.boolean().optional().default(true),
    checkExternal: z.boolean().optional().default(false),
    endpoint: z.string().optional()
  }).optional().default({}),
  retry: z.object({
    enabled: z.boolean().optional().default(true),
    maxRetries: z.number().min(0).optional().default(3),
    backoffMs: z.number().min(100).optional().default(200),
    maxBackoffMs: z.number().min(500).optional().default(5000),
    exponential: z.boolean().optional().default(true),
    jitter: z.boolean().optional().default(true)
  }).optional().default({}),
  schedule: z.enum(['disabled', 'enabled', 'manual']).optional().default('enabled')
});

// Export the Logger type
export { Logger };