/**
 * Environment Helper Functions
 * Sprint: SPRINT-B1-ENV-HARDENING-001B
 */

import type { ProcessEnvType } from './env-profiles';

// =============================================================================
// ENV TYPE INTERFACES
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

// =============================================================================
// ENV GETTER FUNCTIONS
// =============================================================================

/**
 * Get public environment variables (safe for client-side).
 * NEVER includes secrets.
 */
export function getPublicEnv(env: ProcessEnvType = process.env): PublicEnv {
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
export function getServerEnv(env: ProcessEnvType = process.env): ServerEnv {
  return {
    NODE_ENV: env['NODE_ENV'] ?? 'development',
    LOG_LEVEL: env['LOG_LEVEL'] ?? 'info',
    PORT: env['PORT'] ? parseInt(env['PORT'], 10) : undefined,
    DB_MODE: env['DB_MODE'] ?? 'cloud',
    REDIS_URL: env['REDIS_URL'] ?? 'redis://localhost:6379',
    TEMPORAL_ADDRESS: env['TEMPORAL_ADDRESS'] ?? 'localhost:7233',
    TEMPORAL_NAMESPACE: env['TEMPORAL_NAMESPACE'] ?? 'default',
  };
}

/**
 * Get service environment variables (secrets).
 * NEVER log these values.
 */
export function getServiceEnv(env: ProcessEnvType = process.env): ServiceEnv {
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
