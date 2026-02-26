/**
 * Unit Talk API - Configuration Adapter
 *
 * This adapter provides API-specific configuration by importing from the
 * centralized environment configuration. This follows SaaS-level monorepo
 * best practices by maintaining a single source of truth while providing
 * application-specific interfaces.
 */

// Import centralized configuration
// Path works in Docker container: /app/config/environment.ts
let env: any;
try {
  // Try Docker container path first
  env = require('/app/config/environment').env;
} catch (dockerError) {
  try {
    // Fallback to relative path for local development
    env = require('../../../../config/environment').env;
  } catch (relativeError) {
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
        // PHASE1-ENFORCEMENT-LOCK-001: No fallback for secrets in production
        jwtSecret:
          process.env.JWT_SECRET ||
          (process.env.NODE_ENV === 'production'
            ? (() => {
                throw new Error('PHASE1: JWT_SECRET required in production');
              })()
            : 'dev-only-jwt-secret-32-characters'),
        encryptionKey:
          process.env.ENCRYPTION_KEY ||
          (process.env.NODE_ENV === 'production'
            ? (() => {
                throw new Error('PHASE1: ENCRYPTION_KEY required in production');
              })()
            : 'dev-only-encryption-key-32chars'),
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
// API-SPECIFIC CONFIGURATION INTERFACE
// =============================================================================

export interface ApiConfiguration {
  // Server Configuration
  port: number;
  nodeEnv: string;
  logLevel: string;
  debugMode: boolean;

  // Database Configuration (v3.0.0 Unified Schema)
  database: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    supabaseAnonKey: string;
  };

  // External API Keys (CRITICAL FOR MONITORING)
  apiKeys: {
    optimal: string;
    odds: string;
    agents: string;
  };

  // Discord Integration
  discord: {
    botToken: string;
    clientId: string;
    guildId: string;
    alertWebhook?: string;
    alertsChannelId?: string;
  };

  // Temporal Workflow Engine
  temporal: {
    address: string;
    serverUrl: string;
    namespace: string;
    taskQueue: string;
  };

  // Redis & Caching
  redis: {
    url: string;
    enabled: boolean;
  };

  // Security
  security: {
    jwtSecret: string;
    encryptionKey: string;
  };

  // Performance & System
  performance: {
    rateLimitEnabled: boolean;
    hotReload: boolean;
    securityHeadersEnabled: boolean;
    autoBackupEnabled: boolean;
  };

  // Feature Flags
  features: {
    autoGradingEnabled: boolean;
    analyticsEnabled: boolean;
    capperTrackingEnabled: boolean;
    capperPerformanceTracking: boolean;
  };
}

// =============================================================================
// API CONFIGURATION IMPLEMENTATION
// =============================================================================

class ApiConfig implements ApiConfiguration {
  // Server Configuration
  get port(): number {
    return env.ports.api;
  }

  get nodeEnv(): string {
    return env.environment;
  }

  get logLevel(): string {
    return env.logLevel;
  }

  get debugMode(): boolean {
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
  get isProduction(): boolean {
    return env.isProduction;
  }

  get isDevelopment(): boolean {
    return env.isDevelopment;
  }

  get isStaging(): boolean {
    return env.isStaging;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const apiConfig = new ApiConfig();
export default apiConfig;

// =============================================================================
// LEGACY SUPPORT (for existing code)
// =============================================================================

/**
 * Legacy environment variable access
 * @deprecated Use apiConfig instead
 */
export const config = {
  PORT: apiConfig.port,
  NODE_ENV: apiConfig.nodeEnv,
  LOG_LEVEL: apiConfig.logLevel,
  DEBUG_MODE: apiConfig.debugMode,

  // Database
  SUPABASE_URL: apiConfig.database.supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: apiConfig.database.supabaseServiceRoleKey,
  SUPABASE_ANON_KEY: apiConfig.database.supabaseAnonKey,

  // API Keys
  OPTIMAL_API_KEY: apiConfig.apiKeys.optimal,
  ODDS_API_KEY: apiConfig.apiKeys.odds,

  // Discord
  DISCORD_BOT_TOKEN: apiConfig.discord.botToken,
  DISCORD_CLIENT_ID: apiConfig.discord.clientId,
  DISCORD_GUILD_ID: apiConfig.discord.guildId,

  // Temporal
  TEMPORAL_ADDRESS: apiConfig.temporal.address,
  TEMPORAL_NAMESPACE: apiConfig.temporal.namespace,
  TEMPORAL_TASK_QUEUE: apiConfig.temporal.taskQueue,

  // Redis
  REDIS_URL: apiConfig.redis.url,

  // Security
  JWT_SECRET: apiConfig.security.jwtSecret,
  ENCRYPTION_KEY: apiConfig.security.encryptionKey,
};
