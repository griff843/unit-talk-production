/**
 * Environment Variable Schema
 * Sprint: SPRINT-SYNDICATE-FOUNDATION-REALIGN-114A
 *
 * Comprehensive Zod schema for all environment variables.
 * See docs/ENV_CONTRACT.md for documentation.
 */

import { z } from 'zod';

// =============================================================================
// PROFILE DEFINITIONS
// =============================================================================

export const EnvProfile = z.enum(['local', 'docker', 'ci', 'production']);
export type EnvProfile = z.infer<typeof EnvProfile>;

// =============================================================================
// CORE SCHEMAS
// =============================================================================

/**
 * Core application environment variables.
 * Required in ALL profiles.
 */
export const CoreEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  PORT: z.coerce.number().optional(),
});

/**
 * Database environment variables.
 * Required in cloud mode runtime.
 */
export const DatabaseEnvSchema = z.object({
  DB_MODE: z.enum(['cloud', 'local']).default('cloud'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
});

/**
 * Next.js public environment variables.
 * Required at BUILD TIME for frontend apps.
 */
export const NextPublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENV: z.string().optional(),
});

/**
 * Temporal workflow environment variables.
 * Required for API and workers.
 */
export const TemporalEnvSchema = z.object({
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('unit-talk-main'),
  TEMPORAL_SERVER_URL: z.string().optional(),
  TEMPORAL_UI_URL: z.string().optional(),
});

/**
 * Redis environment variables.
 */
export const RedisEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
});

/**
 * Discord environment variables.
 * Required for discord-bot and posting workers.
 */
export const DiscordEnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1).optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  DISCORD_OPERATOR_WEBHOOK_URL: z.string().url().optional(),
  DEFAULT_DISCORD_TICKET_CHANNEL_ID: z.string().optional(),
  ENABLE_DISCORD_TICKET_WORKER: z.coerce.boolean().default(false),
  TICKET_DISCORD_POLL_INTERVAL: z.coerce.number().default(10000),
  TICKET_DISCORD_BATCH_SIZE: z.coerce.number().default(10),
});

/**
 * External API keys.
 */
export const ExternalApiEnvSchema = z.object({
  ODDS_API_KEY: z.string().optional(),
  OPTIMAL_API_KEY: z.string().optional(),
  SGO_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

/**
 * Professional scoring configuration.
 */
export const ScoringEnvSchema = z.object({
  USE_PRO_SCORER: z.coerce.boolean().default(false),
  SCORING_DEBUG: z.coerce.boolean().default(false),
  SCORING_WEIGHTS_PATH: z.string().optional(),

  // Promotion gates
  INSTANT_S_TIER_MIN_EV: z.coerce.number().default(0.05),
  INSTANT_S_TIER_MIN_CONFIDENCE: z.coerce.number().default(0.75),
  INSTANT_S_TIER_MIN_PROFESSIONAL_SCORE: z.coerce.number().default(85),
  SCHEDULED_10AM_MIN_EV: z.coerce.number().default(0.03),
  SCHEDULED_10AM_MIN_CONFIDENCE: z.coerce.number().default(0.65),

  // S-tier enforcement
  S_TIER_MIN_CLV_BPS: z.coerce.number().default(15),
  S_TIER_MAX_NEGATIVE_CLV_BPS: z.coerce.number().default(-3),
  S_TIER_MIN_STEAM_STRENGTH: z.coerce.number().default(20),
  S_TIER_REQUIRE_POSITIVE_STEAM: z.coerce.boolean().default(true),
});

/**
 * Portfolio risk management.
 */
export const PortfolioEnvSchema = z.object({
  MAX_SINGLE_POSITION_SIZE: z.coerce.number().default(0.25),
  MAX_DAILY_PORTFOLIO_RISK: z.coerce.number().default(1.0),
  MAX_GAME_EXPOSURE: z.coerce.number().default(0.40),
  MAX_PLAYER_EXPOSURE: z.coerce.number().default(0.30),
  MAX_CORRELATION_THRESHOLD: z.coerce.number().default(0.70),
  MAX_CORRELATED_POSITIONS: z.coerce.number().default(3),
  MAX_SPORT_CONCENTRATION: z.coerce.number().default(0.60),
  MAX_TIER_CONCENTRATION: z.coerce.number().default(0.80),
  DAILY_VAR_LIMIT: z.coerce.number().default(0.15),
  WEEKLY_DRAWDOWN_LIMIT: z.coerce.number().default(0.25),
});

/**
 * Security configuration.
 */
export const SecurityEnvSchema = z.object({
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().length(32).optional(),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
});

/**
 * Shadow mode configuration.
 */
export const ShadowModeEnvSchema = z.object({
  SHADOW_MODE: z.coerce.boolean().default(false),
  SHADOW_PRIVATE_CHANNEL_ID: z.string().optional(),
  SHADOW_MAX_DAYS: z.coerce.number().default(7),
});

/**
 * Development/Debug configuration.
 */
export const DevEnvSchema = z.object({
  DEBUG_MODE: z.coerce.boolean().default(false),
  HOT_RELOAD: z.coerce.boolean().default(true),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
});

/**
 * CI/CD configuration.
 */
export const CiEnvSchema = z.object({
  CI: z.coerce.boolean().default(false),
  GIT_COMMIT: z.string().optional(),
  GIT_COMMIT_SHORT: z.string().optional(),
  GIT_BRANCH: z.string().optional(),
});

// =============================================================================
// COMBINED SCHEMAS
// =============================================================================

/**
 * Complete environment schema for API service.
 */
export const ApiEnvSchema = CoreEnvSchema.merge(DatabaseEnvSchema)
  .merge(TemporalEnvSchema)
  .merge(RedisEnvSchema)
  .merge(DiscordEnvSchema)
  .merge(ExternalApiEnvSchema)
  .merge(ScoringEnvSchema)
  .merge(PortfolioEnvSchema)
  .merge(SecurityEnvSchema)
  .merge(ShadowModeEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Complete environment schema for Next.js frontend apps.
 */
export const FrontendEnvSchema = CoreEnvSchema.merge(DatabaseEnvSchema)
  .merge(NextPublicEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type FrontendEnv = z.infer<typeof FrontendEnvSchema>;

/**
 * Complete environment schema for Discord bot.
 */
export const DiscordBotEnvSchema = CoreEnvSchema.merge(DatabaseEnvSchema)
  .merge(RedisEnvSchema)
  .merge(DiscordEnvSchema)
  .merge(DevEnvSchema)
  .merge(CiEnvSchema);

export type DiscordBotEnv = z.infer<typeof DiscordBotEnvSchema>;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates environment variables against a schema.
 * Exits process on failure (fail-closed).
 */
export function validateEnv<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv = process.env
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    console.error('Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

/**
 * Validates environment without exiting.
 * Returns validation result for checking.
 */
export function checkEnv<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv = process.env
): { valid: boolean; data?: z.infer<T>; errors?: z.ZodError } {
  const result = schema.safeParse(env);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  return { valid: false, errors: result.error };
}

/**
 * Get environment profile from NODE_ENV and CI flag.
 */
export function getEnvProfile(env: NodeJS.ProcessEnv = process.env): EnvProfile {
  if (env['CI'] === 'true') return 'ci';
  if (env['NODE_ENV'] === 'production') return 'production';

  // Check if running in Docker
  const isDocker =
    env['DOCKER'] === 'true' ||
    env['HOSTNAME']?.includes('unit-talk') ||
    env['container'] === 'docker';

  return isDocker ? 'docker' : 'local';
}

// =============================================================================
// ENV GETTER HELPERS
// =============================================================================

/**
 * Public environment variables (safe for client-side).
 * These are NEXT_PUBLIC_* vars that are embedded at build time.
 */
export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL: string | undefined;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string | undefined;
  NEXT_PUBLIC_API_URL: string | undefined;
  NEXT_PUBLIC_ENV: string | undefined;
}

/**
 * Server environment variables (runtime, no secrets).
 * Safe for server-side logging.
 */
export interface ServerEnv {
  NODE_ENV: string;
  LOG_LEVEL: string;
  PORT: number | undefined;
  DB_MODE: string;
  REDIS_URL: string;
  TEMPORAL_ADDRESS: string;
  TEMPORAL_NAMESPACE: string;
}

/**
 * Service environment variables (secrets, never log).
 * Requires SUPABASE_SERVICE_ROLE_KEY for privileged operations.
 */
export interface ServiceEnv {
  SUPABASE_URL: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  SUPABASE_ANON_KEY: string | undefined;
  DISCORD_TOKEN: string | undefined;
  JWT_SECRET: string | undefined;
  ENCRYPTION_KEY: string | undefined;
  OPENAI_API_KEY: string | undefined;
  ODDS_API_KEY: string | undefined;
  OPTIMAL_API_KEY: string | undefined;
}

/**
 * Get public environment variables (safe for client-side).
 * NEVER includes secrets.
 */
export function getPublicEnv(env: NodeJS.ProcessEnv = process.env): PublicEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    NEXT_PUBLIC_API_URL: env['NEXT_PUBLIC_API_URL'],
    NEXT_PUBLIC_ENV: env['NEXT_PUBLIC_ENV'],
  };
}

/**
 * Get server environment variables (runtime, no secrets).
 * Safe for logging.
 */
export function getServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return {
    NODE_ENV: env['NODE_ENV'] || 'development',
    LOG_LEVEL: env['LOG_LEVEL'] || 'info',
    PORT: env['PORT'] ? parseInt(env['PORT'], 10) : undefined,
    DB_MODE: env['DB_MODE'] || 'cloud',
    REDIS_URL: env['REDIS_URL'] || 'redis://localhost:6379',
    TEMPORAL_ADDRESS: env['TEMPORAL_ADDRESS'] || 'localhost:7233',
    TEMPORAL_NAMESPACE: env['TEMPORAL_NAMESPACE'] || 'default',
  };
}

/**
 * Get service environment variables (secrets).
 * NEVER log these values.
 */
export function getServiceEnv(env: NodeJS.ProcessEnv = process.env): ServiceEnv {
  return {
    SUPABASE_URL: env['SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: env['SUPABASE_SERVICE_ROLE_KEY'],
    SUPABASE_ANON_KEY: env['SUPABASE_ANON_KEY'],
    DISCORD_TOKEN: env['DISCORD_TOKEN'],
    JWT_SECRET: env['JWT_SECRET'],
    ENCRYPTION_KEY: env['ENCRYPTION_KEY'],
    OPENAI_API_KEY: env['OPENAI_API_KEY'],
    ODDS_API_KEY: env['ODDS_API_KEY'],
    OPTIMAL_API_KEY: env['OPTIMAL_API_KEY'],
  };
}

// =============================================================================
// APP-SPECIFIC VALIDATORS
// =============================================================================

/**
 * Validates API service environment.
 * Throws on missing required vars.
 */
export function validateApiServiceEnv(env: NodeJS.ProcessEnv = process.env): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const profile = getEnvProfile(env);

  // Core vars always required
  if (!env['NODE_ENV']) errors.push('NODE_ENV is required');

  // Database vars required except CI
  if (profile !== 'ci') {
    const dbMode = env['DB_MODE'] || 'cloud';
    if (dbMode === 'cloud') {
      if (!env['SUPABASE_URL']) errors.push('SUPABASE_URL is required for cloud mode');
      if (!env['SUPABASE_SERVICE_ROLE_KEY'])
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required for cloud mode');
    } else {
      if (!env['DATABASE_URL']) errors.push('DATABASE_URL is required for local mode');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates frontend (Next.js) environment.
 * Build-time vars (NEXT_PUBLIC_*) checked separately.
 */
export function validateFrontendEnv(env: NodeJS.ProcessEnv = process.env): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const profile = getEnvProfile(env);

  // Build-time vars
  if (!env['NEXT_PUBLIC_SUPABASE_URL']) {
    if (profile === 'production') {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required for production build');
    } else {
      warnings.push('NEXT_PUBLIC_SUPABASE_URL not set (OK for dev if using env.local)');
    }
  }

  if (!env['NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (profile === 'production') {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for production build');
    } else {
      warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY not set (OK for dev if using env.local)');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates Discord bot environment.
 */
export function validateDiscordBotEnv(env: NodeJS.ProcessEnv = process.env): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const profile = getEnvProfile(env);

  if (profile !== 'ci') {
    if (!env['DISCORD_TOKEN']) errors.push('DISCORD_TOKEN is required');
    if (!env['DISCORD_CLIENT_ID']) errors.push('DISCORD_CLIENT_ID is required');

    const dbMode = env['DB_MODE'] || 'cloud';
    if (dbMode === 'cloud') {
      if (!env['SUPABASE_URL']) errors.push('SUPABASE_URL is required for cloud mode');
      if (!env['SUPABASE_SERVICE_ROLE_KEY'])
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required for cloud mode');
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// ENV CHECK REPORT
// =============================================================================

export interface EnvCheckResult {
  app: string;
  profile: EnvProfile;
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingVars: string[];
  presentVars: string[];
}

/**
 * Comprehensive env check for an app.
 * Returns detailed report suitable for ops scripts.
 */
export function checkAppEnv(
  app: 'api' | 'command-center' | 'smart-form' | 'dashboard' | 'discord-bot',
  env: NodeJS.ProcessEnv = process.env
): EnvCheckResult {
  const profile = getEnvProfile(env);
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingVars: string[] = [];
  const presentVars: string[] = [];

  // Common vars to check
  const commonVars = ['NODE_ENV', 'LOG_LEVEL'];
  const dbVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'DB_MODE'];
  const nextPublicVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_API_URL',
  ];
  const discordVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];

  // Check common vars
  for (const v of commonVars) {
    if (env[v]) presentVars.push(v);
    else missingVars.push(v);
  }

  // App-specific checks
  switch (app) {
    case 'api':
      for (const v of dbVars) {
        if (env[v]) presentVars.push(v);
        else missingVars.push(v);
      }
      const apiResult = validateApiServiceEnv(env);
      errors.push(...apiResult.errors);
      break;

    case 'command-center':
    case 'smart-form':
    case 'dashboard':
      for (const v of nextPublicVars) {
        if (env[v]) presentVars.push(v);
        else missingVars.push(v);
      }
      const feResult = validateFrontendEnv(env);
      errors.push(...feResult.errors);
      warnings.push(...feResult.warnings);
      break;

    case 'discord-bot':
      for (const v of discordVars) {
        if (env[v]) presentVars.push(v);
        else missingVars.push(v);
      }
      for (const v of dbVars) {
        if (env[v]) presentVars.push(v);
        else missingVars.push(v);
      }
      const botResult = validateDiscordBotEnv(env);
      errors.push(...botResult.errors);
      break;
  }

  // Validate Supabase host if URL present
  const supabaseUrl = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'];
  if (supabaseUrl) {
    const hostResult = validateSupabaseHost(supabaseUrl);
    if (!hostResult.valid && hostResult.error) {
      errors.push(hostResult.error);
    }
  }

  return {
    app,
    profile,
    valid: errors.length === 0,
    errors,
    warnings,
    missingVars,
    presentVars,
  };
}

// =============================================================================
// CANONICAL SUPABASE HOST VALIDATION
// =============================================================================

/**
 * Canonical Supabase host (SPRINT-110A).
 */
export const CANONICAL_SUPABASE_HOST = 'cqfnsozknjzvyiziwicl.supabase.co';

/**
 * Validates that Supabase URL matches canonical host.
 */
export function validateSupabaseHost(
  url: string | undefined
): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: 'SUPABASE_URL not set' };
  }

  try {
    const hostname = new URL(url).hostname;
    if (hostname !== CANONICAL_SUPABASE_HOST) {
      return {
        valid: false,
        error: `Invalid Supabase host. Expected: ${CANONICAL_SUPABASE_HOST}, Got: ${hostname}`,
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `Invalid URL format: ${url}` };
  }
}
