// src/agents/FeedAgent/types.ts

import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  AgentConfig,
  HealthCheckResult as BaseHealthCheckResult,
  AgentCommand as BaseAgentCommand,
  BaseAgentDependencies as BaseDeps
} from '../../types/agent';

// --- Provider Types ---
export const ProviderSchema = z.enum(['SportsGameOdds', 'OddsAPI', 'Pinnacle']);
export type Provider = z.infer<typeof ProviderSchema>;

// --- Agent Config ---
export const FeedAgentConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  version: z.string(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  metrics.enabled: z.boolean().default(true),
  retryConfig: z.object({
    maxRetries: z.number().min(0),
    backoffMs: z.number().min(100),
    maxBackoffMs: z.number().min(1000),
  }),
  providers: z.record(z.object({
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
  })
});

export type FeedAgentConfig = z.infer<typeof FeedAgentConfigSchema>;
export type { BaseDeps as BaseAgentDependencies };

// --- Metrics Types ---
export interface ProviderStats {
  success: number;
  failed: number;
  avgLatencyMs: number;
}

export interface FeedMetrics {
  totalProps: number;
  uniqueProps: number;
  duplicates: number;
  errors: number;
  latencyMs: number;
  providerStats: Record<Provider, ProviderStats>;
}

// --- Activity Types ---
export interface FetchProviderInput {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  timestamp: string;
}

export interface FetchResult {
  success: boolean;
  data?: any[];
  error?: string;
  latencyMs: number;
  timestamp: string;
  statusCode?: number;
  responseText?: string;
}

// --- Processing Types ---
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

// --- Command Types ---
export interface FetchFeedCommand extends BaseAgentCommand {
  type: 'FETCH_FEED';
  payload: {
    provider: Provider;
  };
}

export type AgentCommand = FetchFeedCommand;

// --- Health Check Types ---
export interface HealthCheckResult extends BaseHealthCheckResult {
  details: {
    errors: string[];
    warnings: string[];
    info: {
      metrics: FeedMetrics;
    };
  };
}

// --- Metrics Types (for test compatibility) ---
export interface Metrics extends FeedMetrics {
  errorCount: number;
  warningCount: number;
  successCount: number;
}

// --- Raw Prop from Provider ---
export interface RawProp {
  id: string; // unique prop id from provider
  player_name: string;
  team: string;
  opponent: string;
  market: string; // e.g. "Points", "Rebounds"
  line: number;
  over: number; // over odds
  under: number; // under odds
  market_type: string; // "player_prop", "team_total", etc.
  game_time: string; // ISO string
  [key: string]: any; // allow for flexible provider responses
}

// --- Normalized Prop (your internal shape) ---
export interface NormalizedProp {
  external_id: string; // original id
  player_name: string;
  team: string;
  opponent: string;
  stat_type: string;
  line: number;
  over: number;
  under: number;
  market_type: string;
  game_time: string;
  created_at: string; // ingestion time
  [key: string]: any;
}

// --- Dependency Injection for Agent ---
export interface BaseAgentDependencies {
  supabase: SupabaseClient;
  errorHandler: any;
  logger?: any;
}
