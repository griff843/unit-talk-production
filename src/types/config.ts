// /types/config.ts

import { z } from 'zod';

// Base configuration schema that all agents must implement
export const BaseAgentConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  retryConfig: z.object({
    maxAttempts: z.number().int().positive().default(3),
    backoffMs: z.number().int().positive().default(1000),
    maxBackoffMs: z.number().int().positive().default(30000)
  }),
  healthCheckIntervalMs: z.number().int().positive().default(60000),
  metricsConfig: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().int().positive().default(15000),
    prefix: z.string().optional()
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableActivityLogging: z.boolean().default(true),
    enableMetricsLogging: z.boolean().default(true),
    enableHealthLogging: z.boolean().default(true)
  }),
  supabase: z.object({
    tables: z.object({
      logs: z.string().default('agent_logs'),
      metrics: z.string().default('agent_metrics'),
      health: z.string().default('agent_health'),
      tasks: z.string().default('agent_tasks')
    })
  })
});

export type BaseAgentConfig = z.infer<typeof BaseAgentConfigSchema>;

// Environment configuration validation
export const EnvConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TEMPORAL_TASK_QUEUE: z.string().default('unit-talk-main'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.number().int().positive().default(60000)
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

// Agent-specific configuration schemas
export const AnalyticsAgentConfigSchema = BaseAgentConfigSchema.extend({
  analysisInterval: z.number().int().positive(),
  reportTypes: z.array(z.string())
});

export const GradingAgentConfigSchema = BaseAgentConfigSchema.extend({
  gradingRules: z.array(z.string()),
  validationThreshold: z.number().min(0).max(1)
});

export const ContestAgentConfigSchema = BaseAgentConfigSchema.extend({
  contestTypes: z.array(z.string()),
  validationRules: z.array(z.string())
});

export const AlertAgentConfigSchema = BaseAgentConfigSchema.extend({
  alertChannels: z.array(z.string()),
  priorityLevels: z.array(z.string())
});

export const PromoAgentConfigSchema = BaseAgentConfigSchema.extend({
  promoTypes: z.array(z.string()),
  validationRules: z.array(z.string())
});

export const NotificationAgentConfigSchema = BaseAgentConfigSchema.extend({
  channels: z.array(z.string()),
  templates: z.record(z.string())
});

export const FeedAgentConfigSchema = BaseAgentConfigSchema.extend({
  feedSources: z.array(z.string()),
  updateInterval: z.number().int().positive()
});

export const OperatorAgentConfigSchema = BaseAgentConfigSchema.extend({
  operationTypes: z.array(z.string()),
  permissions: z.array(z.string())
});

export const AuditAgentConfigSchema = BaseAgentConfigSchema.extend({
  auditTypes: z.array(z.string()),
  retentionPeriod: z.number().int().positive()
});

// Export type definitions
export type AnalyticsAgentConfig = z.infer<typeof AnalyticsAgentConfigSchema>;
export type GradingAgentConfig = z.infer<typeof GradingAgentConfigSchema>;
export type ContestAgentConfig = z.infer<typeof ContestAgentConfigSchema>;
export type AlertAgentConfig = z.infer<typeof AlertAgentConfigSchema>;
export type PromoAgentConfig = z.infer<typeof PromoAgentConfigSchema>;
export type NotificationAgentConfig = z.infer<typeof NotificationAgentConfigSchema>;
export type FeedAgentConfig = z.infer<typeof FeedAgentConfigSchema>;
export type OperatorAgentConfig = z.infer<typeof OperatorAgentConfigSchema>;
export type AuditAgentConfig = z.infer<typeof AuditAgentConfigSchema>;
