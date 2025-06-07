import { z } from 'zod';
import { AgentConfig } from '../../types/agent';
import { RawProp } from '../../types/rawProps';

export type Provider = 'SportsGameOdds';

export interface FeedMetrics {
  totalProps: number;
  uniqueProps: number;
  duplicates: number;
  errors: number;
  latencyMs: number;
  providerStats: Record<Provider, {
    success: number;
    failed: number;
    avgLatencyMs: number;
  }>;
}

export interface ProcessedResult {
  inserted: number;
  duplicates: number;
  errors: number;
  details: {
    newExternalIds: string[];
    duplicateExternalIds: string[];
    errorMessages: string[];
  };
}

export interface PropCoverage {
  provider: Provider;
  timestamp: string;
  total: number;
  covered: number;
  missing: string[];
}

export interface FeedAgentConfig extends AgentConfig {
  name: string;
  enabled: boolean;
  providers: Partial<Record<Provider, {
    enabled: boolean;
    retryConfig: {
      maxAttempts: number;
      backoffMs: number;
    };
    baseUrl: string;
    apiKey: string;
    rateLimit: number;
  }>>;
  dedupeConfig: {
    checkInterval: number;
    ttlHours: number;
  };
  metricsConfig: {
    interval: number;
    prefix: string;
  };
  cron?: string;
}

export const FeedConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  healthCheckInterval: z.number().optional(),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  }).optional(),
  providers: z.record(z.enum(['SportsGameOdds']), z.object({
    enabled: z.boolean(),
    retryConfig: z.object({
      maxAttempts: z.number(),
      backoffMs: z.number()
    }),
    baseUrl: z.string().url(),
    apiKey: z.string(),
    rateLimit: z.number()
  })).optional(),
  dedupeConfig: z.object({
    checkInterval: z.number(),
    ttlHours: z.number()
  }),
  cron: z.string().optional()
});

export interface FetchResult {
  success: boolean;
  props?: RawProp[];
  error?: string;
  latencyMs: number;
  provider: Provider;
  timestamp: string;
} 