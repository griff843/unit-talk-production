"use strict";
/**
 * Unit Talk API - Configuration Adapter
 *
 * This adapter provides API-specific configuration by importing from the
 * centralized environment configuration. This follows SaaS-level monorepo
 * best practices by maintaining a single source of truth while providing
 * application-specific interfaces.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.apiConfig = void 0;
// Import centralized configuration
// Path works in Docker container: /app/config/environment.ts
let env;
try {
    // Try Docker container path first
    env = require('/app/config/environment').env;
}
catch (dockerError) {
    try {
        // Fallback to relative path for local development
        env = require('../../../../config/environment').env;
    }
    catch (relativeError) {
        // Final fallback - use process.env directly
        console.error('❌ Failed to load centralized configuration, using process.env fallback');
        env = {
            ports: { api: Number(process.env.API_PORT) || 3000 },
            environment: process.env.NODE_ENV || 'development',
            logLevel: process.env.LOG_LEVEL || 'info',
            debugMode: process.env.DEBUG_MODE === 'true',
            database: {
                supabaseUrl: process.env.SUPABASE_URL || '',
                supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
            },
            apiKeys: {
                optimal: process.env.OPTIMAL_API_KEY || '',
                odds: process.env.ODDS_API_KEY || '',
                agents: process.env.AGENTS_API_KEY || '',
            },
            discord: {
                botToken: process.env.DISCORD_BOT_TOKEN || '',
                clientId: process.env.DISCORD_CLIENT_ID || '',
                guildId: process.env.DISCORD_GUILD_ID || '',
            },
            temporal: {
                address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
                serverUrl: process.env.TEMPORAL_SERVER_URL || 'unit-talk-temporal:7233',
                namespace: process.env.TEMPORAL_NAMESPACE || 'default',
                taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'unit-talk-dev',
            },
            performance: {
                redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
                cacheEnabled: process.env.CACHE_ENABLED === 'true',
                rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
                hotReload: process.env.HOT_RELOAD === 'true',
                securityHeadersEnabled: process.env.SECURITY_HEADERS_ENABLED !== 'false',
                autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED !== 'false',
            },
            security: {
                jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-development-only-32chars',
                encryptionKey: process.env.ENCRYPTION_KEY || 'fallback-encryption-key-32-chars',
            },
            features: {
                autoGradingEnabled: process.env.AUTO_GRADING_ENABLED !== 'false',
                analyticsEnabled: process.env.ANALYTICS_ENABLED !== 'false',
                capperTrackingEnabled: process.env.CAPPER_TRACKING_ENABLED !== 'false',
                capperPerformanceTracking: process.env.CAPPER_PERFORMANCE_TRACKING !== 'false',
            },
            isProduction: process.env.NODE_ENV === 'production',
            isDevelopment: process.env.NODE_ENV === 'development',
            isStaging: process.env.NODE_ENV === 'staging',
            all: process.env,
        };
    }
}
// =============================================================================
// API CONFIGURATION IMPLEMENTATION
// =============================================================================
class ApiConfig {
    // Server Configuration
    get port() {
        return env.ports.api;
    }
    get nodeEnv() {
        return env.environment;
    }
    get logLevel() {
        return env.logLevel;
    }
    get debugMode() {
        return env.debugMode;
    }
    // Database Configuration (v3.0.0 Unified Schema)
    get database() {
        return {
            supabaseUrl: env.database.supabaseUrl,
            supabaseServiceRoleKey: env.database.supabaseServiceRoleKey,
            supabaseAnonKey: env.database.supabaseAnonKey,
        };
    }
    // External API Keys (CRITICAL FOR MONITORING)
    get apiKeys() {
        return {
            optimal: env.apiKeys.optimal,
            odds: env.apiKeys.odds,
            agents: env.apiKeys.agents,
        };
    }
    // Discord Integration
    get discord() {
        return {
            botToken: env.discord.botToken,
            clientId: env.discord.clientId,
            guildId: env.discord.guildId,
            alertWebhook: env.all.DISCORD_ALERT_WEBHOOK,
            alertsChannelId: env.all.ALERTS_CHANNEL_ID,
        };
    }
    // Temporal Workflow Engine
    get temporal() {
        return env.temporal;
    }
    // Redis & Caching
    get redis() {
        return {
            url: env.performance.redis.url,
            enabled: env.performance.cacheEnabled,
        };
    }
    // Security
    get security() {
        return env.security;
    }
    // Performance & System
    get performance() {
        return {
            rateLimitEnabled: env.performance.rateLimitEnabled,
            hotReload: env.performance.hotReload,
            securityHeadersEnabled: env.performance.securityHeadersEnabled,
            autoBackupEnabled: env.performance.autoBackupEnabled,
        };
    }
    // Feature Flags
    get features() {
        return {
            autoGradingEnabled: env.features.autoGradingEnabled,
            analyticsEnabled: env.features.analyticsEnabled,
            capperTrackingEnabled: env.features.capperTrackingEnabled,
            capperPerformanceTracking: env.features.capperPerformanceTracking,
        };
    }
    // Convenience Methods
    get isProduction() {
        return env.isProduction;
    }
    get isDevelopment() {
        return env.isDevelopment;
    }
    get isStaging() {
        return env.isStaging;
    }
}
// =============================================================================
// SINGLETON EXPORT
// =============================================================================
exports.apiConfig = new ApiConfig();
exports.default = exports.apiConfig;
// =============================================================================
// LEGACY SUPPORT (for existing code)
// =============================================================================
/**
 * Legacy environment variable access
 * @deprecated Use apiConfig instead
 */
exports.config = {
    PORT: exports.apiConfig.port,
    NODE_ENV: exports.apiConfig.nodeEnv,
    LOG_LEVEL: exports.apiConfig.logLevel,
    DEBUG_MODE: exports.apiConfig.debugMode,
    // Database
    SUPABASE_URL: exports.apiConfig.database.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: exports.apiConfig.database.supabaseServiceRoleKey,
    SUPABASE_ANON_KEY: exports.apiConfig.database.supabaseAnonKey,
    // API Keys
    OPTIMAL_API_KEY: exports.apiConfig.apiKeys.optimal,
    ODDS_API_KEY: exports.apiConfig.apiKeys.odds,
    // Discord
    DISCORD_BOT_TOKEN: exports.apiConfig.discord.botToken,
    DISCORD_CLIENT_ID: exports.apiConfig.discord.clientId,
    DISCORD_GUILD_ID: exports.apiConfig.discord.guildId,
    // Temporal
    TEMPORAL_ADDRESS: exports.apiConfig.temporal.address,
    TEMPORAL_NAMESPACE: exports.apiConfig.temporal.namespace,
    TEMPORAL_TASK_QUEUE: exports.apiConfig.temporal.taskQueue,
    // Redis
    REDIS_URL: exports.apiConfig.redis.url,
    // Security
    JWT_SECRET: exports.apiConfig.security.jwtSecret,
    ENCRYPTION_KEY: exports.apiConfig.security.encryptionKey,
};
