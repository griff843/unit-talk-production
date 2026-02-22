/**
 * Unit Talk Command Center - Configuration Adapter
 *
 * SPRINT-ARCHITECTURE-HARDENING-002A: Lazy env access pattern
 *
 * This adapter provides Command Center-specific configuration by importing from the
 * centralized environment configuration. This follows SaaS-level monorepo
 * best practices by maintaining a single source of truth while providing
 * application-specific interfaces.
 *
 * CRITICAL: All env access is lazy (via getters) to prevent module-scope evaluation
 * at build time. This ensures builds succeed without runtime env vars.
 */

// =============================================================================
// LAZY ENV ACCESS HELPERS
// =============================================================================

/**
 * Get environment config lazily - evaluated at runtime, not build time.
 * SPRINT-ARCHITECTURE-HARDENING-002A: No module-scope env access
 */
function getEnvConfig() {
  const isClient = typeof window !== 'undefined';

  if (isClient) {
    // Browser environment - use only NEXT_PUBLIC_* vars (available at build time)
    return {
      ports: { commandCenter: 3015 },
      environment: 'development',
      logLevel: 'info',
      debugMode: false,
      database: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        supabaseServiceRoleKey: '', // Not available in browser
        publicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        publicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      apiKeys: {
        optimal: '',
        odds: '',
        sync: '',
      },
      urls: {
        app: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3015',
        platformApi: process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3000',
        analytics: process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:3005',
        agents: 'http://localhost:3001',
        production: 'http://localhost:3000',
        nextAuth: 'http://localhost:3015',
      },
      performance: {
        redis: { url: 'redis://localhost:6379' },
        cacheEnabled: true,
        rateLimitEnabled: true,
        securityHeadersEnabled: true,
      },
      security: {
        nextAuthSecret: 'client-side-placeholder',
      },
      features: {
        analyticsEnabled: true,
        capperTrackingEnabled: true,
      },
      isProduction: false,
      isDevelopment: true,
      isStaging: false,
    };
  }

  // Server-side environment - access process.env lazily
  return {
    ports: { commandCenter: Number(process.env.COMMAND_CENTER_PORT) || 3015 },
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    debugMode: process.env.DEBUG_MODE === 'true',
    database: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      publicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      publicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    apiKeys: {
      optimal: process.env.OPTIMAL_API_KEY || '',
      odds: process.env.ODDS_API_KEY || '',
      sync: process.env.SYNC_API_KEY || '',
    },
    urls: {
      app: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3015',
      platformApi: process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3000',
      analytics: process.env.NEXT_PUBLIC_ANALYTICS_API_URL || 'http://localhost:3005',
      agents: process.env.AGENTS_BASE_URL || 'http://localhost:3001',
      production: process.env.UNIT_TALK_PRODUCTION_URL || 'http://localhost:3000',
      nextAuth: process.env.NEXTAUTH_URL || 'http://localhost:3015',
    },
    performance: {
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      cacheEnabled: process.env.CACHE_ENABLED === 'true',
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      securityHeadersEnabled: process.env.SECURITY_HEADERS_ENABLED !== 'false',
    },
    security: {
      nextAuthSecret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-dev',
    },
    features: {
      analyticsEnabled: process.env.ANALYTICS_ENABLED !== 'false',
      capperTrackingEnabled: process.env.CAPPER_TRACKING_ENABLED !== 'false',
    },
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isStaging: false,
  };
}

// =============================================================================
// COMMAND CENTER-SPECIFIC CONFIGURATION INTERFACE
// =============================================================================

export interface CommandCenterConfiguration {
  // Server Configuration
  port: number;
  nodeEnv: string;
  logLevel: string;
  debugMode: boolean;

  // Next.js Configuration
  nextjs: {
    appUrl: string;
    nextAuthUrl: string;
    nextAuthSecret: string;
  };

  // Database Configuration (v3.0.0 Unified Schema)
  database: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
    publicSupabaseUrl: string;
    publicSupabaseAnonKey: string;
  };

  // External API Keys (CRITICAL FOR MONITORING)
  apiKeys: {
    optimal: string;
    odds: string;
    sync: string;
  };

  // Platform Integration URLs
  urls: {
    platformApi: string;
    analyticsApi: string;
    agentsBase: string;
    production: string;
  };

  // Redis & Caching
  redis: {
    url: string;
    enabled: boolean;
  };

  // Feature Flags
  features: {
    analyticsEnabled: boolean;
    capperTrackingEnabled: boolean;
    performanceMonitoring: boolean;
    realTimeUpdates: boolean;
  };

  // Performance Settings
  performance: {
    rateLimitEnabled: boolean;
    cacheEnabled: boolean;
    securityHeadersEnabled: boolean;
  };
}

// =============================================================================
// COMMAND CENTER CONFIGURATION IMPLEMENTATION
// =============================================================================

class CommandCenterConfig implements CommandCenterConfiguration {
  // Lazy getter for env - evaluated at access time, not module load time
  private get env() {
    return getEnvConfig();
  }

  // Server Configuration
  get port(): number {
    return this.env.ports.commandCenter;
  }

  get nodeEnv(): string {
    return this.env.environment;
  }

  get logLevel(): string {
    return this.env.logLevel;
  }

  get debugMode(): boolean {
    return this.env.debugMode;
  }

  // Next.js Configuration
  get nextjs() {
    return {
      appUrl: this.env.urls.app,
      nextAuthUrl: this.env.urls.nextAuth,
      nextAuthSecret: this.env.security.nextAuthSecret,
    };
  }

  // Database Configuration (v3.0.0 Unified Schema)
  get database() {
    return {
      supabaseUrl: this.env.database.supabaseUrl,
      supabaseAnonKey: this.env.database.supabaseAnonKey,
      supabaseServiceRoleKey: this.env.database.supabaseServiceRoleKey,
      publicSupabaseUrl: this.env.database.publicSupabaseUrl,
      publicSupabaseAnonKey: this.env.database.publicSupabaseAnonKey,
    };
  }

  // External API Keys (CRITICAL FOR MONITORING)
  get apiKeys() {
    return {
      optimal: this.env.apiKeys.optimal,
      odds: this.env.apiKeys.odds,
      sync: this.env.apiKeys.sync,
    };
  }

  // Platform Integration URLs
  get urls() {
    return {
      platformApi: this.env.urls.platformApi,
      analyticsApi: this.env.urls.analytics,
      agentsBase: this.env.urls.agents,
      production: this.env.urls.production,
    };
  }

  // Redis & Caching
  get redis() {
    return {
      url: this.env.performance.redis.url,
      enabled: this.env.performance.cacheEnabled,
    };
  }

  // Feature Flags
  get features() {
    return {
      analyticsEnabled: this.env.features.analyticsEnabled,
      capperTrackingEnabled: this.env.features.capperTrackingEnabled,
      performanceMonitoring: true, // Always enabled for Command Center
      realTimeUpdates: true, // Always enabled for Command Center
    };
  }

  // Performance Settings
  get performance() {
    return {
      rateLimitEnabled: this.env.performance.rateLimitEnabled,
      cacheEnabled: this.env.performance.cacheEnabled,
      securityHeadersEnabled: this.env.performance.securityHeadersEnabled,
    };
  }

  // Convenience Methods
  get isProduction(): boolean {
    return this.env.isProduction;
  }

  get isDevelopment(): boolean {
    return this.env.isDevelopment;
  }

  get isStaging(): boolean {
    return this.env.isStaging;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const commandCenterConfig = new CommandCenterConfig();
export default commandCenterConfig;

// =============================================================================
// ENVIRONMENT VARIABLES FOR NEXT.JS (CLIENT-SIDE ACCESS)
// =============================================================================

/**
 * Environment variables that need to be available in the browser
 * These are prefixed with NEXT_PUBLIC_ and sourced from the centralized config
 * SPRINT-ARCHITECTURE-HARDENING-002A: Use function getter for lazy access
 */
export function getPublicEnvVars() {
  const env = getEnvConfig();
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.database.publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.database.publicSupabaseAnonKey,
    NEXT_PUBLIC_PLATFORM_API_URL: env.urls.platformApi,
    NEXT_PUBLIC_ANALYTICS_API_URL: env.urls.analytics,
    NEXT_PUBLIC_APP_URL: env.urls.app,
  };
}

// Backward compat - lazy proxy
export const publicEnvVars = new Proxy({} as ReturnType<typeof getPublicEnvVars>, {
  get(_, prop: string) {
    return getPublicEnvVars()[prop as keyof ReturnType<typeof getPublicEnvVars>];
  },
});

// =============================================================================
// LEGACY SUPPORT (for existing .env.local usage)
// =============================================================================

/**
 * Legacy environment variable mapping for gradual migration
 * SPRINT-ARCHITECTURE-HARDENING-002A: Use lazy proxy for backward compat
 * @deprecated Use commandCenterConfig instead
 */
export function getLegacyConfig() {
  return {
    // Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL: commandCenterConfig.database.publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: commandCenterConfig.database.publicSupabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: commandCenterConfig.database.supabaseServiceRoleKey,

    // Platform APIs
    NEXT_PUBLIC_PLATFORM_API_URL: commandCenterConfig.urls.platformApi,
    UNIT_TALK_PRODUCTION_URL: commandCenterConfig.urls.production,
    SYNC_API_KEY: commandCenterConfig.apiKeys.sync,

    // Analytics
    NEXT_PUBLIC_ANALYTICS_API_URL: commandCenterConfig.urls.analyticsApi,

    // Command Center Configuration
    NEXT_PUBLIC_APP_URL: commandCenterConfig.nextjs.appUrl,
    NEXTAUTH_SECRET: commandCenterConfig.nextjs.nextAuthSecret,
    NEXTAUTH_URL: commandCenterConfig.nextjs.nextAuthUrl,

    // Redis
    REDIS_URL: commandCenterConfig.redis.url,

    // Data Provider API Keys
    OPTIMAL_API_KEY: commandCenterConfig.apiKeys.optimal,
    ODDS_API_KEY: commandCenterConfig.apiKeys.odds,

    // Environment
    NODE_ENV: commandCenterConfig.nodeEnv,
    DEBUG: commandCenterConfig.debugMode,
  };
}

// Backward compat - lazy proxy
export const legacyConfig = new Proxy({} as ReturnType<typeof getLegacyConfig>, {
  get(_, prop: string) {
    return getLegacyConfig()[prop as keyof ReturnType<typeof getLegacyConfig>];
  },
});
