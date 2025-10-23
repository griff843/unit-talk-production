/**
 * Unit Talk API - Configuration Adapter
 *
 * This adapter provides API-specific configuration by importing from the
 * centralized environment configuration. This follows SaaS-level monorepo
 * best practices by maintaining a single source of truth while providing
 * application-specific interfaces.
 */
export interface ApiConfiguration {
    port: number;
    nodeEnv: string;
    logLevel: string;
    debugMode: boolean;
    database: {
        supabaseUrl: string;
        supabaseServiceRoleKey: string;
        supabaseAnonKey: string;
    };
    apiKeys: {
        optimal: string;
        odds: string;
        agents: string;
    };
    discord: {
        botToken: string;
        clientId: string;
        guildId: string;
        alertWebhook?: string;
        alertsChannelId?: string;
    };
    temporal: {
        address: string;
        serverUrl: string;
        namespace: string;
        taskQueue: string;
    };
    redis: {
        url: string;
        enabled: boolean;
    };
    security: {
        jwtSecret: string;
        encryptionKey: string;
    };
    performance: {
        rateLimitEnabled: boolean;
        hotReload: boolean;
        securityHeadersEnabled: boolean;
        autoBackupEnabled: boolean;
    };
    features: {
        autoGradingEnabled: boolean;
        analyticsEnabled: boolean;
        capperTrackingEnabled: boolean;
        capperPerformanceTracking: boolean;
    };
}
declare class ApiConfig implements ApiConfiguration {
    get port(): number;
    get nodeEnv(): string;
    get logLevel(): string;
    get debugMode(): boolean;
    get database(): {
        supabaseUrl: any;
        supabaseServiceRoleKey: any;
        supabaseAnonKey: any;
    };
    get apiKeys(): {
        optimal: any;
        odds: any;
        agents: any;
    };
    get discord(): {
        botToken: any;
        clientId: any;
        guildId: any;
        alertWebhook: any;
        alertsChannelId: any;
    };
    get temporal(): any;
    get redis(): {
        url: any;
        enabled: any;
    };
    get security(): any;
    get performance(): {
        rateLimitEnabled: any;
        hotReload: any;
        securityHeadersEnabled: any;
        autoBackupEnabled: any;
    };
    get features(): {
        autoGradingEnabled: any;
        analyticsEnabled: any;
        capperTrackingEnabled: any;
        capperPerformanceTracking: any;
    };
    get isProduction(): boolean;
    get isDevelopment(): boolean;
    get isStaging(): boolean;
}
export declare const apiConfig: ApiConfig;
export default apiConfig;
/**
 * Legacy environment variable access
 * @deprecated Use apiConfig instead
 */
export declare const config: {
    PORT: number;
    NODE_ENV: string;
    LOG_LEVEL: string;
    DEBUG_MODE: boolean;
    SUPABASE_URL: any;
    SUPABASE_SERVICE_ROLE_KEY: any;
    SUPABASE_ANON_KEY: any;
    OPTIMAL_API_KEY: any;
    ODDS_API_KEY: any;
    DISCORD_BOT_TOKEN: any;
    DISCORD_CLIENT_ID: any;
    DISCORD_GUILD_ID: any;
    TEMPORAL_ADDRESS: any;
    TEMPORAL_NAMESPACE: any;
    TEMPORAL_TASK_QUEUE: any;
    REDIS_URL: any;
    JWT_SECRET: any;
    ENCRYPTION_KEY: any;
};
//# sourceMappingURL=index.d.ts.map