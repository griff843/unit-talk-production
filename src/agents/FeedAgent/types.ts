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

export interface FeedAgentConfig extends AgentConfig {
  agentName: 'FeedAgent';
  enabled: boolean;
  metricsConfig: {
    interval: number;
    prefix: string;
  };
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
  cron?: string;
}

export const FeedConfigSchema = z.object({
  agentName: z.literal('FeedAgent'),
  enabled: z.boolean(),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  }),
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