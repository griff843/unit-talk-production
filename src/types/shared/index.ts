import { z } from 'zod';

// --- Base Types ---
export const AgentStatusEnum = z.enum(['idle', 'ready', 'running', 'error', 'stopped']);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeverityEnum>;

// --- Shared Interfaces ---
export const TimestampedSchema = z.object({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

export const IdentifiableSchema = z.object({
  id: z.string().uuid(),
});

export const MetadataSchema = z.object({
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  agent: z.string(),
});

// --- Event System ---
export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  timestamp: z.string().datetime(),
  source: z.string(),
  metadata: MetadataSchema,
  data: z.record(z.unknown()),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

// --- Agent Configuration ---
export const AgentConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  enabled: z.boolean(),
  retryConfig: z.object({
    maxAttempts: z.number().int().positive(),
    backoffMs: z.number().int().positive(),
    maxBackoffMs: z.number().int().positive(),
  }),
  alertConfig: z.object({
    enabled: z.boolean(),
    thresholds: z.record(z.number()),
    channels: z.array(z.string()),
  }),
  metricsConfig: z.object({
    port: z.number().int().positive(),
    path: z.string(),
    interval: z.number().int().positive(),
  }),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// --- Health Check Types ---
export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  components: z.record(z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    message: z.string().optional(),
    lastCheck: z.string().datetime(),
    metrics: z.record(z.unknown()).optional(),
  })),
  timestamp: z.string().datetime(),
  version: z.string(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// --- Validation Helpers ---
export function validateEvent<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

export function validateConfig(config: unknown): AgentConfig {
  return AgentConfigSchema.parse(config);
}

export function validateHealth(health: unknown): HealthStatus {
  return HealthStatusSchema.parse(health);
} 