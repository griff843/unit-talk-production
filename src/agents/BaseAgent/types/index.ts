import { SupabaseClient } from '@supabase/supabase-js';
import * as z from 'zod';

// Base configuration schema
export const BaseAgentConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  version: z.string(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  schedule: z.string().optional(), // Cron schedule
  metrics: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(60), // Metrics collection interval in seconds
    endpoint: z.string().optional(), // Metrics endpoint
    port: z.number().optional(), // Metrics server port
  }),
  retryConfig: z.object({
    maxRetries: z.number().min(0),
    backoffMs: z.number().min(100),
    maxBackoffMs: z.number().min(1000),
  }).optional(), // Made optional since we have retry config
  retry: z.object({
    maxRetries: z.number().min(0).default(3),
    backoffMs: z.number().min(100).default(1000),
    maxBackoffMs: z.number().min(1000).default(30000), // Added maxBackoffMs
    enabled: z.boolean().default(true), // Added enabled flag
    maxAttempts: z.number().min(1).default(3), // Added maxAttempts for compatibility
    backoff: z.number().min(100).default(1000), // Added backoff for compatibility
    exponential: z.boolean().default(true), // Added exponential backoff flag
    jitter: z.boolean().default(false), // Added jitter flag
  }).optional(),
  health: z.object({
    enabled: z.boolean().default(true), // Changed from checkInterval to enabled
    interval: z.number().default(30), // Changed from checkInterval to interval (in seconds)
    timeout: z.number().default(5000), // Health check timeout in ms
    checkDb: z.boolean().default(true), // Added checkDb flag
    checkExternal: z.boolean().default(false), // Added checkExternal flag
    endpoint: z.string().optional(), // Added endpoint for health checks
  }).optional()
});

export type BaseAgentConfig = z.infer<typeof BaseAgentConfigSchema>;

// Agent status types - added 'initializing' status
export type AgentStatus = 'initializing' | 'idle' | 'running' | 'stopping' | 'stopped' | 'error';

// Health status types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  details: Record<string, any>;
  error?: string;
}

// Base metrics interface
export interface BaseMetrics {
  agentName: string;
  successCount: number;
  errorCount: number;
  warningCount: number;
  processingTimeMs: number;
  memoryUsageMb: number;
}

// Agent command interface
export interface AgentCommand {
  type: string;
  payload: any;
  timestamp?: string;
}

// Health check result interface (alias for HealthStatus)
export interface HealthCheckResult extends HealthStatus {}

// Logger interface
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, context?: any): void;
  child(context: any): Logger;
}

// Error handler interface
export interface ErrorHandler {
  handleError(error: Error, context?: any): void;
  withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T>;
}

// Base agent dependencies
export interface BaseAgentDependencies {
  supabase: SupabaseClient;
  logger: Logger;
  errorHandler: ErrorHandler;
  metricsCollector?: any;
}

// Agent configuration type (alias for backward compatibility)
export type AgentConfig = BaseAgentConfig;