/**
 * Unit Talk Smart Form - Configuration Adapter
 * 
 * This adapter provides Smart Form-specific configuration by importing from the
 * centralized environment configuration. This follows SaaS-level monorepo
 * best practices by maintaining a single source of truth while providing
 * application-specific interfaces.
 */

import { env } from '../../../../config/environment';

// =============================================================================
// SMART FORM-SPECIFIC CONFIGURATION INTERFACE
// =============================================================================

export interface SmartFormConfiguration {
  // Server Configuration
  port: number;
  nodeEnv: string;
  logLevel: string;
  debugMode: boolean;

  // Next.js Configuration
  nextjs: {
    appUrl: string;
  };

  // Database Configuration (v3.0.0 Unified Schema)
  database: {
    publicSupabaseUrl: string;
    publicSupabaseAnonKey: string;
  };

  // External API Keys for real-time data
  apiKeys: {
    optimal: string;
  };

  // Form Configuration
  form: {
    pickLimits: {
      maxPicksPerDay: number;
      maxUnitsPerPick: number;
      minUnitsPerPick: number;
    };
    categories: string[];
    validation: {
      gradeConfirmationRequired: boolean;
      manualGradeOverride: boolean;
    };
  };

  // Feature Flags
  features: {
    analyticsEnabled: boolean;
    realTimeDataEnabled: boolean;
    smartSuggestionsEnabled: boolean;
    accessibilityMode: boolean;
  };

  // Performance Settings
  performance: {
    cacheEnabled: boolean;
    optimisticUpdates: boolean;
  };
}

// =============================================================================
// SMART FORM CONFIGURATION IMPLEMENTATION
// =============================================================================

class SmartFormConfig implements SmartFormConfiguration {
  // Server Configuration
  get port(): number {
    return env.ports.smartForm;
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

  // Next.js Configuration
  get nextjs() {
    return {
      appUrl: env.urls.app, // Smart form can use same base URL structure
    };
  }

  // Database Configuration (v3.0.0 Unified Schema)
  get database() {
    return {
      publicSupabaseUrl: env.database.publicSupabaseUrl,
      publicSupabaseAnonKey: env.database.publicSupabaseAnonKey,
    };
  }

  // External API Keys for real-time data
  get apiKeys() {
    return {
      optimal: env.apiKeys.optimal, // For real-time sports data
    };
  }

  // Form Configuration
  get form() {
    return {
      pickLimits: env.pickManagement.limits,
      categories: env.pickManagement.categories,
      validation: {
        gradeConfirmationRequired: env.pickManagement.grading.gradeConfirmationRequired,
        manualGradeOverride: env.pickManagement.grading.manualGradeOverride,
      },
    };
  }

  // Feature Flags
  get features() {
    return {
      analyticsEnabled: env.features.analyticsEnabled,
      realTimeDataEnabled: true, // Always enabled for smart form
      smartSuggestionsEnabled: true, // Always enabled for smart form
      accessibilityMode: true, // Always enabled for accessibility compliance
    };
  }

  // Performance Settings
  get performance() {
    return {
      cacheEnabled: env.performance.cacheEnabled,
      optimisticUpdates: true, // Always enabled for better UX
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

export const smartFormConfig = new SmartFormConfig();
export default smartFormConfig;

// =============================================================================
// LEGACY SUPPORT (for existing .env.local usage)
// =============================================================================

/**
 * Legacy environment variable mapping for gradual migration
 * @deprecated Use smartFormConfig instead
 */
export const legacyConfig = {
  // Next.js Public Variables
  NEXT_PUBLIC_SUPABASE_URL: smartFormConfig.database.publicSupabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: smartFormConfig.database.publicSupabaseAnonKey,

  // Optimal API for real-time sports data
  OPTIMAL_API_KEY: smartFormConfig.apiKeys.optimal,

  // Environment
  NODE_ENV: smartFormConfig.nodeEnv,
  DEBUG: smartFormConfig.debugMode,
};