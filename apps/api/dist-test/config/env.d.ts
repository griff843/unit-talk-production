export declare const env: {
    isTest: boolean;
    NODE_ENV: string;
    TEMPORAL_TASK_QUEUE: string;
    TEMPORAL_SERVER_URL: string;
    SUPABASE_URL: string;
    SUPABASE_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SUPABASE_ANON_KEY: string;
    LOG_LEVEL: string;
    METRICS_ENABLED: boolean;
    HEALTH_CHECK_INTERVAL: number;
    REDIS_URL: string;
    OPENAI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_FROM_NUMBER: string;
    MICRO_RECAP_COOLDOWN: number;
    supabase: {
        url: string;
        serviceRoleKey: string;
        key: string;
        anonKey: string;
    };
    logging: {
        level: string;
        file: string;
    };
    test: {
        enabled: boolean;
        skipRateLimits: boolean;
        mockExternalServices: boolean;
        timeouts: {
            test: number;
            retryDelay: number;
            maxRetries: number;
        };
    };
    capperThreads: {
        Noahthegoon: string;
        KingRo623: string;
        Griff843: string;
        Jaybird: string;
        dub: string;
        Vicgo: string;
        Sauced: string;
        Ziplock: string;
        Squirrel: string;
        Polo: string;
        MoneyReef: string;
    };
    systemAlertsThreadId: string;
    alertsChannelId: string;
};
//# sourceMappingURL=env.d.ts.map