import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export interface HealthStatus {
  status: 'ok' | 'warn' | 'error';
  message?: string;
  details?: Record<string, any>;
}

export interface BaseMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  lastRunAt?: Date;
  processingTimeMs: number;
  memoryUsageMb: number;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  shouldRetry: (error: Error) => boolean;
}

export const BaseAgentConfigSchema = z.object({
  agentName: z.string(),
  enabled: z.boolean(),
  version: z.string(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  metricsEnabled: z.boolean().default(true),
  retryConfig: z.object({
    maxRetries: z.number().min(0),
    backoffMs: z.number().min(100),
    maxBackoffMs: z.number().min(1000),
  }),
});

export type BaseAgentConfig = z.infer<typeof BaseAgentConfigSchema>;

export interface AgentContext {
  supabase: SupabaseClient;
  config: BaseAgentConfig;
  errorConfig: ErrorHandlerConfig;
  logger: any; // Will be properly typed when we implement logging
  metrics: BaseMetrics;
} 