import * as z from 'zod';
import { BaseMetrics } from '../BaseAgent/types';
export declare const RawPropSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    player_name: z.ZodNullable<z.ZodString>;
    sport: z.ZodNullable<z.ZodString>;
    team: z.ZodNullable<z.ZodString>;
    stat_type: z.ZodNullable<z.ZodString>;
    outcome: z.ZodNullable<z.ZodString>;
    line: z.ZodNullable<z.ZodNumber>;
    odds: z.ZodNullable<z.ZodNumber>;
    game_date: z.ZodNullable<z.ZodString>;
    matchup: z.ZodNullable<z.ZodString>;
    trend_confidence: z.ZodNullable<z.ZodNumber>;
    matchup_quality: z.ZodNullable<z.ZodNumber>;
    line_value_score: z.ZodNullable<z.ZodNumber>;
    role_stability: z.ZodNullable<z.ZodNumber>;
    confidence_score: z.ZodNullable<z.ZodNumber>;
    edge_score: z.ZodNullable<z.ZodNumber>;
    tier_tag: z.ZodNullable<z.ZodString>;
    auto_approved: z.ZodNullable<z.ZodBoolean>;
    context_flag: z.ZodNullable<z.ZodBoolean>;
    created_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    scraped_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    source: z.ZodNullable<z.ZodString>;
    provider: z.ZodNullable<z.ZodString>;
    promoted_to_picks: z.ZodNullable<z.ZodBoolean>;
    promoted_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    promoted: z.ZodNullable<z.ZodBoolean>;
    is_promoted: z.ZodNullable<z.ZodBoolean>;
    game_id: z.ZodNullable<z.ZodString>;
    bet_type: z.ZodNullable<z.ZodString>;
    market_type: z.ZodNullable<z.ZodString>;
    outcomes: z.ZodNullable<z.ZodAny>;
    player_id: z.ZodNullable<z.ZodNumber>;
    player_slug: z.ZodNullable<z.ZodString>;
    external_game_id: z.ZodNullable<z.ZodString>;
    external_id: z.ZodNullable<z.ZodString>;
    sport_key: z.ZodNullable<z.ZodString>;
    league: z.ZodNullable<z.ZodString>;
    over_odds: z.ZodNullable<z.ZodNumber>;
    under_odds: z.ZodNullable<z.ZodNumber>;
    fair_odds: z.ZodNullable<z.ZodString>;
    market: z.ZodNullable<z.ZodString>;
    game_time: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    start_time: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    home_team: z.ZodNullable<z.ZodString>;
    home_team_id: z.ZodNullable<z.ZodNumber>;
    away_team: z.ZodNullable<z.ZodString>;
    away_team_id: z.ZodNullable<z.ZodNumber>;
    opponent: z.ZodNullable<z.ZodString>;
    unit_size: z.ZodNullable<z.ZodNumber>;
    tier: z.ZodNullable<z.ZodString>;
    ev_percent: z.ZodNullable<z.ZodNumber>;
    trend_score: z.ZodNullable<z.ZodNumber>;
    matchup_score: z.ZodNullable<z.ZodNumber>;
    line_score: z.ZodNullable<z.ZodNumber>;
    role_score: z.ZodNullable<z.ZodNumber>;
    direction: z.ZodNullable<z.ZodString>;
    unique_key: z.ZodNullable<z.ZodString>;
    event_id: z.ZodNullable<z.ZodString>;
    book: z.ZodNullable<z.ZodString>;
    updated_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    is_alt_line: z.ZodNullable<z.ZodBoolean>;
    is_primary: z.ZodNullable<z.ZodBoolean>;
    is_valid: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sport: string | null;
    market: string | null;
    book: string | null;
    tier: string | null;
    created_at: string | Date | null;
    line: number | null;
    game_id: string | null;
    player_id: number | null;
    stat_type: string | null;
    player_name: string | null;
    over_odds: number | null;
    under_odds: number | null;
    updated_at: string | Date | null;
    home_team: string | null;
    away_team: string | null;
    start_time: string | Date | null;
    provider: string | null;
    team: string | null;
    matchup: string | null;
    source: string | null;
    odds: number | null;
    opponent: string | null;
    market_type: string | null;
    league: string | null;
    game_date: string | null;
    outcome: string | null;
    external_id: string | null;
    game_time: string | Date | null;
    scraped_at: string | Date | null;
    promoted: boolean | null;
    is_valid: boolean | null;
    external_game_id: string | null;
    sport_key: string | null;
    trend_confidence: number | null;
    matchup_quality: number | null;
    line_value_score: number | null;
    role_stability: number | null;
    confidence_score: number | null;
    edge_score: number | null;
    tier_tag: string | null;
    auto_approved: boolean | null;
    context_flag: boolean | null;
    promoted_to_picks: boolean | null;
    promoted_at: string | Date | null;
    is_promoted: boolean | null;
    bet_type: string | null;
    player_slug: string | null;
    fair_odds: string | null;
    home_team_id: number | null;
    away_team_id: number | null;
    unit_size: number | null;
    ev_percent: number | null;
    trend_score: number | null;
    matchup_score: number | null;
    line_score: number | null;
    role_score: number | null;
    direction: string | null;
    unique_key: string | null;
    event_id: string | null;
    is_alt_line: boolean | null;
    is_primary: boolean | null;
    id?: string | undefined;
    outcomes?: any;
}, {
    sport: string | null;
    market: string | null;
    book: string | null;
    tier: string | null;
    created_at: string | Date | null;
    line: number | null;
    game_id: string | null;
    player_id: number | null;
    stat_type: string | null;
    player_name: string | null;
    over_odds: number | null;
    under_odds: number | null;
    updated_at: string | Date | null;
    home_team: string | null;
    away_team: string | null;
    start_time: string | Date | null;
    provider: string | null;
    team: string | null;
    matchup: string | null;
    source: string | null;
    odds: number | null;
    opponent: string | null;
    market_type: string | null;
    league: string | null;
    game_date: string | null;
    outcome: string | null;
    external_id: string | null;
    game_time: string | Date | null;
    scraped_at: string | Date | null;
    promoted: boolean | null;
    is_valid: boolean | null;
    external_game_id: string | null;
    sport_key: string | null;
    trend_confidence: number | null;
    matchup_quality: number | null;
    line_value_score: number | null;
    role_stability: number | null;
    confidence_score: number | null;
    edge_score: number | null;
    tier_tag: string | null;
    auto_approved: boolean | null;
    context_flag: boolean | null;
    promoted_to_picks: boolean | null;
    promoted_at: string | Date | null;
    is_promoted: boolean | null;
    bet_type: string | null;
    player_slug: string | null;
    fair_odds: string | null;
    home_team_id: number | null;
    away_team_id: number | null;
    unit_size: number | null;
    ev_percent: number | null;
    trend_score: number | null;
    matchup_score: number | null;
    line_score: number | null;
    role_score: number | null;
    direction: string | null;
    unique_key: string | null;
    event_id: string | null;
    is_alt_line: boolean | null;
    is_primary: boolean | null;
    id?: string | undefined;
    outcomes?: any;
}>;
export type RawProp = z.infer<typeof RawPropSchema>;
export declare const DataProviderSchema: z.ZodObject<{
    name: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    url: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    timeout: z.ZodDefault<z.ZodNumber>;
    retryAttempts: z.ZodDefault<z.ZodNumber>;
    retryDelay: z.ZodDefault<z.ZodNumber>;
    rateLimit: z.ZodOptional<z.ZodObject<{
        requests: z.ZodDefault<z.ZodNumber>;
        window: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        window: number;
        requests: number;
    }, {
        window?: number | undefined;
        requests?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timeout: number;
    name: string;
    retryAttempts: number;
    url: string;
    enabled: boolean;
    retryDelay: number;
    apiKey?: string | undefined;
    headers?: Record<string, string> | undefined;
    rateLimit?: {
        window: number;
        requests: number;
    } | undefined;
}, {
    name: string;
    url: string;
    apiKey?: string | undefined;
    timeout?: number | undefined;
    retryAttempts?: number | undefined;
    enabled?: boolean | undefined;
    headers?: Record<string, string> | undefined;
    rateLimit?: {
        window?: number | undefined;
        requests?: number | undefined;
    } | undefined;
    retryDelay?: number | undefined;
}>;
export type DataProvider = z.infer<typeof DataProviderSchema>;
export declare const IngestionAgentConfigSchema: z.ZodObject<{
    providers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        url: z.ZodString;
        apiKey: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        timeout: z.ZodDefault<z.ZodNumber>;
        retryAttempts: z.ZodDefault<z.ZodNumber>;
        retryDelay: z.ZodDefault<z.ZodNumber>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            requests: z.ZodDefault<z.ZodNumber>;
            window: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            window: number;
            requests: number;
        }, {
            window?: number | undefined;
            requests?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        name: string;
        retryAttempts: number;
        url: string;
        enabled: boolean;
        retryDelay: number;
        apiKey?: string | undefined;
        headers?: Record<string, string> | undefined;
        rateLimit?: {
            window: number;
            requests: number;
        } | undefined;
    }, {
        name: string;
        url: string;
        apiKey?: string | undefined;
        timeout?: number | undefined;
        retryAttempts?: number | undefined;
        enabled?: boolean | undefined;
        headers?: Record<string, string> | undefined;
        rateLimit?: {
            window?: number | undefined;
            requests?: number | undefined;
        } | undefined;
        retryDelay?: number | undefined;
    }>, "many">;
    batchSize: z.ZodDefault<z.ZodNumber>;
    processingTimeout: z.ZodDefault<z.ZodNumber>;
    duplicateCheckEnabled: z.ZodDefault<z.ZodBoolean>;
    duplicateCheckWindow: z.ZodDefault<z.ZodNumber>;
    validationEnabled: z.ZodDefault<z.ZodBoolean>;
    normalizationEnabled: z.ZodDefault<z.ZodBoolean>;
} & {
    name: z.ZodString;
    version: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    logLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<["debug", "info", "warn", "error"]>>>;
    metrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        interval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        port: z.ZodOptional<z.ZodNumber>;
        endpoint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
        port?: number | undefined;
        endpoint?: string | undefined;
    }, {
        port?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
    }>>;
    health: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        interval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        checkDb: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        checkExternal: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        endpoint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        enabled: boolean;
        interval: number;
        checkDb: boolean;
        checkExternal: boolean;
        endpoint?: string | undefined;
    }, {
        timeout?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
        checkDb?: boolean | undefined;
        checkExternal?: boolean | undefined;
    }>>;
    retry: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        maxRetries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        backoffMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        maxBackoffMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        exponential: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        jitter: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
        exponential: boolean;
        jitter: boolean;
    }, {
        enabled?: boolean | undefined;
        maxRetries?: number | undefined;
        backoffMs?: number | undefined;
        maxBackoffMs?: number | undefined;
        exponential?: boolean | undefined;
        jitter?: boolean | undefined;
    }>>;
    schedule: z.ZodDefault<z.ZodOptional<z.ZodEnum<["disabled", "enabled", "manual"]>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    version: string;
    logLevel: "error" | "warn" | "info" | "debug";
    schedule: "disabled" | "enabled" | "manual";
    batchSize: number;
    providers: {
        timeout: number;
        name: string;
        retryAttempts: number;
        url: string;
        enabled: boolean;
        retryDelay: number;
        apiKey?: string | undefined;
        headers?: Record<string, string> | undefined;
        rateLimit?: {
            window: number;
            requests: number;
        } | undefined;
    }[];
    processingTimeout: number;
    duplicateCheckEnabled: boolean;
    duplicateCheckWindow: number;
    validationEnabled: boolean;
    normalizationEnabled: boolean;
    metrics?: {
        enabled: boolean;
        interval: number;
        port?: number | undefined;
        endpoint?: string | undefined;
    } | undefined;
    health?: {
        timeout: number;
        enabled: boolean;
        interval: number;
        checkDb: boolean;
        checkExternal: boolean;
        endpoint?: string | undefined;
    } | undefined;
    retry?: {
        enabled: boolean;
        maxRetries: number;
        backoffMs: number;
        maxBackoffMs: number;
        exponential: boolean;
        jitter: boolean;
    } | undefined;
}, {
    name: string;
    providers: {
        name: string;
        url: string;
        apiKey?: string | undefined;
        timeout?: number | undefined;
        retryAttempts?: number | undefined;
        enabled?: boolean | undefined;
        headers?: Record<string, string> | undefined;
        rateLimit?: {
            window?: number | undefined;
            requests?: number | undefined;
        } | undefined;
        retryDelay?: number | undefined;
    }[];
    enabled?: boolean | undefined;
    version?: string | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        port?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
    } | undefined;
    health?: {
        timeout?: number | undefined;
        enabled?: boolean | undefined;
        interval?: number | undefined;
        endpoint?: string | undefined;
        checkDb?: boolean | undefined;
        checkExternal?: boolean | undefined;
    } | undefined;
    retry?: {
        enabled?: boolean | undefined;
        maxRetries?: number | undefined;
        backoffMs?: number | undefined;
        maxBackoffMs?: number | undefined;
        exponential?: boolean | undefined;
        jitter?: boolean | undefined;
    } | undefined;
    schedule?: "disabled" | "enabled" | "manual" | undefined;
    batchSize?: number | undefined;
    processingTimeout?: number | undefined;
    duplicateCheckEnabled?: boolean | undefined;
    duplicateCheckWindow?: number | undefined;
    validationEnabled?: boolean | undefined;
    normalizationEnabled?: boolean | undefined;
}>;
export type IngestionAgentConfig = z.infer<typeof IngestionAgentConfigSchema>;
export interface IngestionMetrics extends BaseMetrics {
    ingestedCount: number;
    skippedCount: number;
    errorCount: number;
    lastIngestionTime: Date | null;
    providersConfigured: number;
    batchSize: number;
    propsIngested: number;
    duplicatesFiltered: number;
    validationErrors: number;
    providerStats: Record<string, any>;
    processingTimeMs: number;
}
export interface IngestionResult {
    totalFetched: number;
    ingested: number;
    skipped: number;
    errors: number;
    duration: number;
    timestamp: Date;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface NormalizationResult {
    normalized: RawProp;
    changes: string[];
    warnings: string[];
}
export declare const schemas: {
    RawProp: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        player_name: z.ZodNullable<z.ZodString>;
        sport: z.ZodNullable<z.ZodString>;
        team: z.ZodNullable<z.ZodString>;
        stat_type: z.ZodNullable<z.ZodString>;
        outcome: z.ZodNullable<z.ZodString>;
        line: z.ZodNullable<z.ZodNumber>;
        odds: z.ZodNullable<z.ZodNumber>;
        game_date: z.ZodNullable<z.ZodString>;
        matchup: z.ZodNullable<z.ZodString>;
        trend_confidence: z.ZodNullable<z.ZodNumber>;
        matchup_quality: z.ZodNullable<z.ZodNumber>;
        line_value_score: z.ZodNullable<z.ZodNumber>;
        role_stability: z.ZodNullable<z.ZodNumber>;
        confidence_score: z.ZodNullable<z.ZodNumber>;
        edge_score: z.ZodNullable<z.ZodNumber>;
        tier_tag: z.ZodNullable<z.ZodString>;
        auto_approved: z.ZodNullable<z.ZodBoolean>;
        context_flag: z.ZodNullable<z.ZodBoolean>;
        created_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        scraped_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        source: z.ZodNullable<z.ZodString>;
        provider: z.ZodNullable<z.ZodString>;
        promoted_to_picks: z.ZodNullable<z.ZodBoolean>;
        promoted_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        promoted: z.ZodNullable<z.ZodBoolean>;
        is_promoted: z.ZodNullable<z.ZodBoolean>;
        game_id: z.ZodNullable<z.ZodString>;
        bet_type: z.ZodNullable<z.ZodString>;
        market_type: z.ZodNullable<z.ZodString>;
        outcomes: z.ZodNullable<z.ZodAny>;
        player_id: z.ZodNullable<z.ZodNumber>;
        player_slug: z.ZodNullable<z.ZodString>;
        external_game_id: z.ZodNullable<z.ZodString>;
        external_id: z.ZodNullable<z.ZodString>;
        sport_key: z.ZodNullable<z.ZodString>;
        league: z.ZodNullable<z.ZodString>;
        over_odds: z.ZodNullable<z.ZodNumber>;
        under_odds: z.ZodNullable<z.ZodNumber>;
        fair_odds: z.ZodNullable<z.ZodString>;
        market: z.ZodNullable<z.ZodString>;
        game_time: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        start_time: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        home_team: z.ZodNullable<z.ZodString>;
        home_team_id: z.ZodNullable<z.ZodNumber>;
        away_team: z.ZodNullable<z.ZodString>;
        away_team_id: z.ZodNullable<z.ZodNumber>;
        opponent: z.ZodNullable<z.ZodString>;
        unit_size: z.ZodNullable<z.ZodNumber>;
        tier: z.ZodNullable<z.ZodString>;
        ev_percent: z.ZodNullable<z.ZodNumber>;
        trend_score: z.ZodNullable<z.ZodNumber>;
        matchup_score: z.ZodNullable<z.ZodNumber>;
        line_score: z.ZodNullable<z.ZodNumber>;
        role_score: z.ZodNullable<z.ZodNumber>;
        direction: z.ZodNullable<z.ZodString>;
        unique_key: z.ZodNullable<z.ZodString>;
        event_id: z.ZodNullable<z.ZodString>;
        book: z.ZodNullable<z.ZodString>;
        updated_at: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
        is_alt_line: z.ZodNullable<z.ZodBoolean>;
        is_primary: z.ZodNullable<z.ZodBoolean>;
        is_valid: z.ZodNullable<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        sport: string | null;
        market: string | null;
        book: string | null;
        tier: string | null;
        created_at: string | Date | null;
        line: number | null;
        game_id: string | null;
        player_id: number | null;
        stat_type: string | null;
        player_name: string | null;
        over_odds: number | null;
        under_odds: number | null;
        updated_at: string | Date | null;
        home_team: string | null;
        away_team: string | null;
        start_time: string | Date | null;
        provider: string | null;
        team: string | null;
        matchup: string | null;
        source: string | null;
        odds: number | null;
        opponent: string | null;
        market_type: string | null;
        league: string | null;
        game_date: string | null;
        outcome: string | null;
        external_id: string | null;
        game_time: string | Date | null;
        scraped_at: string | Date | null;
        promoted: boolean | null;
        is_valid: boolean | null;
        external_game_id: string | null;
        sport_key: string | null;
        trend_confidence: number | null;
        matchup_quality: number | null;
        line_value_score: number | null;
        role_stability: number | null;
        confidence_score: number | null;
        edge_score: number | null;
        tier_tag: string | null;
        auto_approved: boolean | null;
        context_flag: boolean | null;
        promoted_to_picks: boolean | null;
        promoted_at: string | Date | null;
        is_promoted: boolean | null;
        bet_type: string | null;
        player_slug: string | null;
        fair_odds: string | null;
        home_team_id: number | null;
        away_team_id: number | null;
        unit_size: number | null;
        ev_percent: number | null;
        trend_score: number | null;
        matchup_score: number | null;
        line_score: number | null;
        role_score: number | null;
        direction: string | null;
        unique_key: string | null;
        event_id: string | null;
        is_alt_line: boolean | null;
        is_primary: boolean | null;
        id?: string | undefined;
        outcomes?: any;
    }, {
        sport: string | null;
        market: string | null;
        book: string | null;
        tier: string | null;
        created_at: string | Date | null;
        line: number | null;
        game_id: string | null;
        player_id: number | null;
        stat_type: string | null;
        player_name: string | null;
        over_odds: number | null;
        under_odds: number | null;
        updated_at: string | Date | null;
        home_team: string | null;
        away_team: string | null;
        start_time: string | Date | null;
        provider: string | null;
        team: string | null;
        matchup: string | null;
        source: string | null;
        odds: number | null;
        opponent: string | null;
        market_type: string | null;
        league: string | null;
        game_date: string | null;
        outcome: string | null;
        external_id: string | null;
        game_time: string | Date | null;
        scraped_at: string | Date | null;
        promoted: boolean | null;
        is_valid: boolean | null;
        external_game_id: string | null;
        sport_key: string | null;
        trend_confidence: number | null;
        matchup_quality: number | null;
        line_value_score: number | null;
        role_stability: number | null;
        confidence_score: number | null;
        edge_score: number | null;
        tier_tag: string | null;
        auto_approved: boolean | null;
        context_flag: boolean | null;
        promoted_to_picks: boolean | null;
        promoted_at: string | Date | null;
        is_promoted: boolean | null;
        bet_type: string | null;
        player_slug: string | null;
        fair_odds: string | null;
        home_team_id: number | null;
        away_team_id: number | null;
        unit_size: number | null;
        ev_percent: number | null;
        trend_score: number | null;
        matchup_score: number | null;
        line_score: number | null;
        role_score: number | null;
        direction: string | null;
        unique_key: string | null;
        event_id: string | null;
        is_alt_line: boolean | null;
        is_primary: boolean | null;
        id?: string | undefined;
        outcomes?: any;
    }>;
    DataProvider: z.ZodObject<{
        name: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        url: z.ZodString;
        apiKey: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        timeout: z.ZodDefault<z.ZodNumber>;
        retryAttempts: z.ZodDefault<z.ZodNumber>;
        retryDelay: z.ZodDefault<z.ZodNumber>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            requests: z.ZodDefault<z.ZodNumber>;
            window: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            window: number;
            requests: number;
        }, {
            window?: number | undefined;
            requests?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        name: string;
        retryAttempts: number;
        url: string;
        enabled: boolean;
        retryDelay: number;
        apiKey?: string | undefined;
        headers?: Record<string, string> | undefined;
        rateLimit?: {
            window: number;
            requests: number;
        } | undefined;
    }, {
        name: string;
        url: string;
        apiKey?: string | undefined;
        timeout?: number | undefined;
        retryAttempts?: number | undefined;
        enabled?: boolean | undefined;
        headers?: Record<string, string> | undefined;
        rateLimit?: {
            window?: number | undefined;
            requests?: number | undefined;
        } | undefined;
        retryDelay?: number | undefined;
    }>;
    IngestionAgentConfig: z.ZodObject<{
        providers: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
            url: z.ZodString;
            apiKey: z.ZodOptional<z.ZodString>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            timeout: z.ZodDefault<z.ZodNumber>;
            retryAttempts: z.ZodDefault<z.ZodNumber>;
            retryDelay: z.ZodDefault<z.ZodNumber>;
            rateLimit: z.ZodOptional<z.ZodObject<{
                requests: z.ZodDefault<z.ZodNumber>;
                window: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                window: number;
                requests: number;
            }, {
                window?: number | undefined;
                requests?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            timeout: number;
            name: string;
            retryAttempts: number;
            url: string;
            enabled: boolean;
            retryDelay: number;
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            rateLimit?: {
                window: number;
                requests: number;
            } | undefined;
        }, {
            name: string;
            url: string;
            apiKey?: string | undefined;
            timeout?: number | undefined;
            retryAttempts?: number | undefined;
            enabled?: boolean | undefined;
            headers?: Record<string, string> | undefined;
            rateLimit?: {
                window?: number | undefined;
                requests?: number | undefined;
            } | undefined;
            retryDelay?: number | undefined;
        }>, "many">;
        batchSize: z.ZodDefault<z.ZodNumber>;
        processingTimeout: z.ZodDefault<z.ZodNumber>;
        duplicateCheckEnabled: z.ZodDefault<z.ZodBoolean>;
        duplicateCheckWindow: z.ZodDefault<z.ZodNumber>;
        validationEnabled: z.ZodDefault<z.ZodBoolean>;
        normalizationEnabled: z.ZodDefault<z.ZodBoolean>;
    } & {
        name: z.ZodString;
        version: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        logLevel: z.ZodDefault<z.ZodOptional<z.ZodEnum<["debug", "info", "warn", "error"]>>>;
        metrics: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            interval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            port: z.ZodOptional<z.ZodNumber>;
            endpoint: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            interval: number;
            port?: number | undefined;
            endpoint?: string | undefined;
        }, {
            port?: number | undefined;
            enabled?: boolean | undefined;
            interval?: number | undefined;
            endpoint?: string | undefined;
        }>>;
        health: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            interval: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            checkDb: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            checkExternal: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            endpoint: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timeout: number;
            enabled: boolean;
            interval: number;
            checkDb: boolean;
            checkExternal: boolean;
            endpoint?: string | undefined;
        }, {
            timeout?: number | undefined;
            enabled?: boolean | undefined;
            interval?: number | undefined;
            endpoint?: string | undefined;
            checkDb?: boolean | undefined;
            checkExternal?: boolean | undefined;
        }>>;
        retry: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            maxRetries: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            backoffMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            maxBackoffMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            exponential: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            jitter: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            maxRetries: number;
            backoffMs: number;
            maxBackoffMs: number;
            exponential: boolean;
            jitter: boolean;
        }, {
            enabled?: boolean | undefined;
            maxRetries?: number | undefined;
            backoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            exponential?: boolean | undefined;
            jitter?: boolean | undefined;
        }>>;
        schedule: z.ZodDefault<z.ZodOptional<z.ZodEnum<["disabled", "enabled", "manual"]>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        enabled: boolean;
        version: string;
        logLevel: "error" | "warn" | "info" | "debug";
        schedule: "disabled" | "enabled" | "manual";
        batchSize: number;
        providers: {
            timeout: number;
            name: string;
            retryAttempts: number;
            url: string;
            enabled: boolean;
            retryDelay: number;
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            rateLimit?: {
                window: number;
                requests: number;
            } | undefined;
        }[];
        processingTimeout: number;
        duplicateCheckEnabled: boolean;
        duplicateCheckWindow: number;
        validationEnabled: boolean;
        normalizationEnabled: boolean;
        metrics?: {
            enabled: boolean;
            interval: number;
            port?: number | undefined;
            endpoint?: string | undefined;
        } | undefined;
        health?: {
            timeout: number;
            enabled: boolean;
            interval: number;
            checkDb: boolean;
            checkExternal: boolean;
            endpoint?: string | undefined;
        } | undefined;
        retry?: {
            enabled: boolean;
            maxRetries: number;
            backoffMs: number;
            maxBackoffMs: number;
            exponential: boolean;
            jitter: boolean;
        } | undefined;
    }, {
        name: string;
        providers: {
            name: string;
            url: string;
            apiKey?: string | undefined;
            timeout?: number | undefined;
            retryAttempts?: number | undefined;
            enabled?: boolean | undefined;
            headers?: Record<string, string> | undefined;
            rateLimit?: {
                window?: number | undefined;
                requests?: number | undefined;
            } | undefined;
            retryDelay?: number | undefined;
        }[];
        enabled?: boolean | undefined;
        version?: string | undefined;
        logLevel?: "error" | "warn" | "info" | "debug" | undefined;
        metrics?: {
            port?: number | undefined;
            enabled?: boolean | undefined;
            interval?: number | undefined;
            endpoint?: string | undefined;
        } | undefined;
        health?: {
            timeout?: number | undefined;
            enabled?: boolean | undefined;
            interval?: number | undefined;
            endpoint?: string | undefined;
            checkDb?: boolean | undefined;
            checkExternal?: boolean | undefined;
        } | undefined;
        retry?: {
            enabled?: boolean | undefined;
            maxRetries?: number | undefined;
            backoffMs?: number | undefined;
            maxBackoffMs?: number | undefined;
            exponential?: boolean | undefined;
            jitter?: boolean | undefined;
        } | undefined;
        schedule?: "disabled" | "enabled" | "manual" | undefined;
        batchSize?: number | undefined;
        processingTimeout?: number | undefined;
        duplicateCheckEnabled?: boolean | undefined;
        duplicateCheckWindow?: number | undefined;
        validationEnabled?: boolean | undefined;
        normalizationEnabled?: boolean | undefined;
    }>;
};
//# sourceMappingURL=types.d.ts.map