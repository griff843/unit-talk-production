import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { HealthCheckResult as BaseHealthCheckResult, AgentCommand as BaseAgentCommand } from '../../types/agent';
export declare const ProviderSchema: z.ZodEnum<["SportsGameOdds", "OddsAPI", "Pinnacle", "Optimal"]>;
export type Provider = z.infer<typeof ProviderSchema>;
export declare const FeedAgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    enabled: z.ZodBoolean;
    version: z.ZodString;
    logLevel: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    metrics: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
    }, {
        enabled?: boolean | undefined;
    }>;
    retryConfig: z.ZodObject<{
        maxRetries: z.ZodNumber;
        backoffMs: z.ZodNumber;
        maxBackoffMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
    }, {
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
    }>;
    providers: z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodBoolean;
        baseUrl: z.ZodString;
        apiKey: z.ZodString;
        rateLimit: z.ZodNumber;
        retryConfig: z.ZodObject<{
            maxAttempts: z.ZodNumber;
            backoffMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            backoffMs: number;
            maxAttempts: number;
        }, {
            backoffMs: number;
            maxAttempts: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        apiKey: string;
        enabled: boolean;
        rateLimit: number;
        retryConfig: {
            backoffMs: number;
            maxAttempts: number;
        };
        baseUrl: string;
    }, {
        apiKey: string;
        enabled: boolean;
        rateLimit: number;
        retryConfig: {
            backoffMs: number;
            maxAttempts: number;
        };
        baseUrl: string;
    }>>;
    dedupeConfig: z.ZodObject<{
        checkInterval: z.ZodNumber;
        ttlHours: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        checkInterval: number;
        ttlHours: number;
    }, {
        checkInterval: number;
        ttlHours: number;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    version: string;
    logLevel: "error" | "warn" | "info" | "debug";
    metrics: {
        enabled: boolean;
    };
    providers: Record<string, {
        apiKey: string;
        enabled: boolean;
        rateLimit: number;
        retryConfig: {
            backoffMs: number;
            maxAttempts: number;
        };
        baseUrl: string;
    }>;
    retryConfig: {
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
    };
    dedupeConfig: {
        checkInterval: number;
        ttlHours: number;
    };
}, {
    name: string;
    enabled: boolean;
    version: string;
    metrics: {
        enabled?: boolean | undefined;
    };
    providers: Record<string, {
        apiKey: string;
        enabled: boolean;
        rateLimit: number;
        retryConfig: {
            backoffMs: number;
            maxAttempts: number;
        };
        baseUrl: string;
    }>;
    retryConfig: {
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
    };
    dedupeConfig: {
        checkInterval: number;
        ttlHours: number;
    };
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
}>;
export type FeedAgentConfig = z.infer<typeof FeedAgentConfigSchema>;
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
export interface FetchFeedCommand extends BaseAgentCommand {
    type: 'FETCH_FEED';
    payload: {
        provider: Provider;
    };
}
export type AgentCommand = FetchFeedCommand;
export interface HealthCheckResult extends BaseHealthCheckResult {
    details: {
        errors: string[];
        warnings: string[];
        info: {
            metrics: FeedMetrics;
        };
    };
}
export interface Metrics extends FeedMetrics {
    errorCount: number;
    warningCount: number;
    successCount: number;
}
export interface RawProp {
    id: string;
    player_name: string;
    team: string;
    opponent: string;
    market: string;
    line: number;
    over: number;
    under: number;
    market_type: string;
    game_time: string;
    [key: string]: any;
}
export interface NormalizedProp {
    external_id: string;
    player_name: string;
    team: string;
    opponent: string;
    stat_type: string;
    line: number;
    over: number;
    under: number;
    market_type: string;
    game_time: string;
    created_at: string;
    [key: string]: any;
}
export interface BaseAgentDependencies {
    supabase: SupabaseClient;
    errorHandler: any;
    logger?: any;
}
//# sourceMappingURL=types.d.ts.map