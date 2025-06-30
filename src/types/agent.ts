import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandling';
/* import { Metrics } from './shared'; */
import { z } from 'zod';

// Health Status Types
export type AgentStatus = 'idle' | 'healthy' | 'unhealthy' | 'degraded';

export const AgentStatusSchema = z.enum(['idle', 'healthy', 'unhealthy', 'degraded']);

export function isValidAgentStatus(status: unknown): status is AgentStatus {
  return typeof status === 'string' && ['idle', 'healthy', 'unhealthy', 'degraded'].includes(status);
}

// Timer Types are now handled by @types/node
// No custom timer type declarations needed

// Core Agent Types
export interface AgentConfig {
  name: string;
  enabled: boolean;
  healthCheckInterval?: number;
  metricsConfig?: {
    interval: number;
    prefix: string;
  };
}

export interface AgentMetrics {
  agentName: string;
  status: AgentStatus;
  successCount: number;
  warningCount: number;
  errorCount: number;
  timestamp: string;
  [key: string]: unknown;
}

export interface HealthCheckResult {
  status: AgentStatus;
  timestamp: string;
  details?: {
    errors: string[];
    warnings: string[];
    info: Record<string, unknown>;
  };
}

export interface AgentCommand {
  type: string;
  payload: unknown;
  timestamp?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentError {
  message: string;
  code: string;
  stack?: string;
  context?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentTaskInput {
  command: AgentCommand;
  metadata?: Record<string, unknown>;
}

export interface AgentHealthReport {
  agentName: string;
  status: AgentStatus;
  details?: {
    errors: string[];
    warnings: string[];
    info: Record<string, unknown>;
  };
  timestamp: string;
}

export interface BaseAgentDependencies {
  supabase: SupabaseClient;
  config: AgentConfig;
  errorHandler?: ErrorHandler;
  logger?: Logger;
}

// Zod Schemas
export const agentConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  healthCheckInterval: z.number().optional(),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  }).optional()
});

export const healthCheckResultSchema = z.object({
  status: AgentStatusSchema,
  timestamp: z.string(),
  details: z.object({
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    info: z.record(z.any())
  }).optional()
});

export const agentMetricsSchema = z.object({
  agentName: z.string(),
  status: AgentStatusSchema,
  successCount: z.number(),
  warningCount: z.number(),
  errorCount: z.number(),
  timestamp: z.string()
}).catchall(z.any()); // DRAGON PATCH: add name field if missing
export interface FeedAgentConfig { name: string; }
