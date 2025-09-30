import { z } from 'zod';

export interface AgentConfig {
  name: string;
  version: string;
  description: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeout?: number;
  };
  metrics?: {
    enabled: boolean;
    interval: number;
  };
  health?: {
    enabled: boolean;
    interval: number;
    checks?: Array<{
      name: string;
      check: () => Promise<boolean>;
      timeout?: number;
    }>;
  };
}

export const AgentConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  circuitBreaker: z.object({
    failureThreshold: z.number().positive().optional(),
    resetTimeout: z.number().positive().optional()
  }).optional(),
  metrics: z.object({
    enabled: z.boolean(),
    interval: z.number().positive()
  }).optional(),
  health: z.object({
    enabled: z.boolean(),
    interval: z.number().positive(),
    checks: z.array(z.object({
      name: z.string(),
      check: z.any(),
      timeout: z.number().positive().optional()
    })).optional()
  }).optional()
});

export interface FeedAgentConfig extends AgentConfig {
  feedSources: string[];
  updateInterval: number;
  batchSize: number;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export const FeedAgentConfigSchema = AgentConfigSchema.extend({
  feedSources: z.array(z.string()),
  updateInterval: z.number().positive(),
  batchSize: z.number().positive(),
  retryConfig: z.object({
    maxRetries: z.number().int().positive(),
    backoffMs: z.number().positive()
  }).optional()
});

export interface AlertAgentConfig extends AgentConfig {
  alertTypes: string[];
  channels: {
    discord?: {
      webhookUrl: string;
      roleId?: string;
    };
    slack?: {
      webhookUrl: string;
      channel: string;
    };
    email?: {
      recipients: string[];
      from: string;
    };
  };
  throttling?: {
    maxAlerts: number;
    windowMs: number;
  };
}

export const AlertAgentConfigSchema = AgentConfigSchema.extend({
  alertTypes: z.array(z.string()),
  channels: z.object({
    discord: z.object({
      webhookUrl: z.string().url(),
      roleId: z.string().optional()
    }).optional(),
    slack: z.object({
      webhookUrl: z.string().url(),
      channel: z.string()
    }).optional(),
    email: z.object({
      recipients: z.array(z.string().email()),
      from: z.string().email()
    }).optional()
  }),
  throttling: z.object({
    maxAlerts: z.number().positive(),
    windowMs: z.number().positive()
  }).optional()
});

export interface ScoringAgentConfig extends AgentConfig {
  models: {
    name: string;
    version: string;
    path: string;
  }[];
  thresholds: {
    confidence: number;
    quality: number;
  };
  features: string[];
  validation?: {
    enabled: boolean;
    sampleSize: number;
  };
}

export const ScoringAgentConfigSchema = AgentConfigSchema.extend({
  models: z.array(z.object({
    name: z.string(),
    version: z.string(),
    path: z.string()
  })),
  thresholds: z.object({
    confidence: z.number().min(0).max(1),
    quality: z.number().min(0).max(1)
  }),
  features: z.array(z.string()),
  validation: z.object({
    enabled: z.boolean(),
    sampleSize: z.number().positive()
  }).optional()
});

export function createAgentConfig(config: Partial<AgentConfig>): AgentConfig {
  const defaultConfig: AgentConfig = {
    name: 'unnamed-agent',
    version: '0.0.1',
    description: 'No description provided',
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60000
    }
  };

  return {
    ...defaultConfig,
    ...config
  };
} 