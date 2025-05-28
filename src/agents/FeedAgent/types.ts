import { AgentConfig } from '../../types/agentTypes';
import { RawProp } from '../../types/rawProps';
import * as z from 'zod';

export const ProviderSchema = z.enum(['SportsGameOdds']);
export type Provider = z.infer<typeof ProviderSchema>;

export const FeedConfigSchema = z.object({
  agentName: z.literal('FeedAgent'),
  enabled: z.boolean(),
  cron: z.string().optional(),
  providers: z.record(ProviderSchema, z.object({
    enabled: z.boolean(),
    baseUrl: z.string().url(),
    apiKey: z.string(),
    rateLimit: z.number().min(1),
    retryConfig: z.object({
      maxAttempts: z.number().min(1),
      backoffMs: z.number().min(100)
    })
  })),
  dedupeConfig: z.object({
    checkInterval: z.number().min(1),
    ttlHours: z.number().min(1)
  }),
  metricsConfig: z.object({
    interval: z.number(),
    prefix: z.string()
  })
});

export type FeedAgentConfig = z.infer<typeof FeedConfigSchema>;

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

export interface FetchResult {
  success: boolean;
  props?: RawProp[];
  error?: string;
  latencyMs: number;
  provider: Provider;
  timestamp: string;
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