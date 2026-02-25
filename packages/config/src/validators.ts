/**
 * Environment Validation Functions
 * Sprint: SPRINT-B1-ENV-HARDENING-001B
 */

import { z } from 'zod';

import {
  type EnvProfile,
  type ProcessEnvType,
  getEnvProfile,
  isRuntimeProfile,
} from './env-profiles';
import {
  ApiEnvSchema,
  DiscordBotEnvSchema,
  RuntimeApiEnvSchema,
  RuntimeDiscordBotEnvSchema,
  type ApiEnv,
  type DiscordBotEnv,
  type RuntimeApiEnv,
  type RuntimeDiscordBotEnv,
} from './schemas';

// =============================================================================
// CORE VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates environment variables against a schema.
 * Exits process on failure (fail-closed).
 */
export function validateEnv<T extends z.ZodType>(
  schema: T,
  env: ProcessEnvType = process.env
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    // eslint-disable-next-line no-console -- FATAL: Must log validation errors before exit
    console.error('Environment validation failed:');
    for (const issue of result.error.issues) {
      // eslint-disable-next-line no-console -- FATAL: Must log validation errors before exit
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

/**
 * Validates runtime environment using parse (not safeParse).
 * FAIL-CLOSED: Throws immediately on validation failure.
 * SPRINT-B1-ENV-HARDENING-001
 */
export function validateRuntimeEnv<T extends z.ZodType>(
  schema: T,
  env: ProcessEnvType = process.env
): z.infer<T> {
  try {
    return schema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line no-console -- FATAL: Must log validation errors before exit
      console.error('FATAL: Runtime environment validation failed:');
      for (const issue of error.issues) {
        // eslint-disable-next-line no-console -- FATAL: Must log validation errors before exit
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      // eslint-disable-next-line no-console -- FATAL: Must log validation errors before exit
      console.error('FATAL: Unexpected error during environment validation:', error);
    }
    process.exit(1);
  }
}

/**
 * Validates environment without exiting.
 * Returns validation result for checking.
 */
export function checkEnv<T extends z.ZodType>(
  schema: T,
  env: ProcessEnvType = process.env
): { valid: boolean; data?: z.infer<T>; errors?: z.ZodError } {
  const result = schema.safeParse(env);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  return { valid: false, errors: result.error };
}

// =============================================================================
// PROFILE-AWARE VALIDATORS (SPRINT-B1-ENV-HARDENING-001)
// =============================================================================

/**
 * Validates API service environment with profile-aware schema selection.
 * Uses RuntimeApiEnvSchema for non-CI profiles (FAIL-CLOSED).
 */
export function validateApiEnv(env: ProcessEnvType = process.env): RuntimeApiEnv | ApiEnv {
  const profile = getEnvProfile(env);

  if (isRuntimeProfile(profile)) {
    return validateRuntimeEnv(RuntimeApiEnvSchema, env);
  }

  return validateEnv(ApiEnvSchema, env);
}

/**
 * Validates Discord bot environment with profile-aware schema selection.
 * Uses RuntimeDiscordBotEnvSchema for non-CI profiles (FAIL-CLOSED).
 */
export function validateDiscordEnv(
  env: ProcessEnvType = process.env
): RuntimeDiscordBotEnv | DiscordBotEnv {
  const profile = getEnvProfile(env);

  if (isRuntimeProfile(profile)) {
    return validateRuntimeEnv(RuntimeDiscordBotEnvSchema, env);
  }

  return validateEnv(DiscordBotEnvSchema, env);
}

// =============================================================================
// APP-SPECIFIC VALIDATORS
// =============================================================================

/**
 * Validates API service environment.
 * Returns validation result with errors.
 */
export function validateApiServiceEnv(env: ProcessEnvType = process.env): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const profile = getEnvProfile(env);

  if (!env['NODE_ENV']) {
    errors.push('NODE_ENV is required');
  }

  if (profile !== 'ci') {
    const dbMode = env['DB_MODE'] ?? 'cloud';
    if (dbMode === 'cloud') {
      if (!env['SUPABASE_URL']) {
        errors.push('SUPABASE_URL is required for cloud mode');
      }
      if (!env['SUPABASE_SERVICE_ROLE_KEY']) {
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required for cloud mode');
      }
    } else if (!env['DATABASE_URL']) {
      errors.push('DATABASE_URL is required for local mode');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates frontend (Next.js) environment.
 */
export function validateFrontendEnv(env: ProcessEnvType = process.env): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const profile = getEnvProfile(env);

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
export function validateDiscordBotEnv(env: ProcessEnvType = process.env): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const profile = getEnvProfile(env);

  if (profile !== 'ci') {
    if (!env['DISCORD_TOKEN']) {
      errors.push('DISCORD_TOKEN is required');
    }
    if (!env['DISCORD_CLIENT_ID']) {
      errors.push('DISCORD_CLIENT_ID is required');
    }

    const dbMode = env['DB_MODE'] ?? 'cloud';
    if (dbMode === 'cloud') {
      if (!env['SUPABASE_URL']) {
        errors.push('SUPABASE_URL is required for cloud mode');
      }
      if (!env['SUPABASE_SERVICE_ROLE_KEY']) {
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required for cloud mode');
      }
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

/** Known environment variable keys for type-safe access */
const ENV_KEYS = {
  common: ['NODE_ENV', 'LOG_LEVEL'] as const,
  database: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'DB_MODE'] as const,
  nextPublic: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_API_URL',
  ] as const,
  discord: ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'] as const,
};

/** Accumulator for env check results */
interface EnvCheckAccumulator {
  presentVars: string[];
  missingVars: string[];
  errors: string[];
  warnings: string[];
}

function checkVarsPresence(
  env: ProcessEnvType,
  keys: readonly string[]
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];

  for (const key of keys) {
    // eslint-disable-next-line security/detect-object-injection -- key is from typed constant array
    if (Object.prototype.hasOwnProperty.call(env, key) && env[key] !== undefined) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return { present, missing };
}

function checkApiEnvVars(env: ProcessEnvType, acc: EnvCheckAccumulator): void {
  const dbCheck = checkVarsPresence(env, ENV_KEYS.database);
  acc.presentVars.push(...dbCheck.present);
  acc.missingVars.push(...dbCheck.missing);

  const apiResult = validateApiServiceEnv(env);
  acc.errors.push(...apiResult.errors);
}

function checkFrontendEnvVars(env: ProcessEnvType, acc: EnvCheckAccumulator): void {
  const nextCheck = checkVarsPresence(env, ENV_KEYS.nextPublic);
  acc.presentVars.push(...nextCheck.present);
  acc.missingVars.push(...nextCheck.missing);

  const feResult = validateFrontendEnv(env);
  acc.errors.push(...feResult.errors);
  acc.warnings.push(...feResult.warnings);
}

function checkDiscordBotEnvVars(env: ProcessEnvType, acc: EnvCheckAccumulator): void {
  const discordCheck = checkVarsPresence(env, ENV_KEYS.discord);
  acc.presentVars.push(...discordCheck.present);
  acc.missingVars.push(...discordCheck.missing);

  const dbCheck = checkVarsPresence(env, ENV_KEYS.database);
  acc.presentVars.push(...dbCheck.present);
  acc.missingVars.push(...dbCheck.missing);

  const botResult = validateDiscordBotEnv(env);
  acc.errors.push(...botResult.errors);
}

/**
 * Comprehensive env check for an app.
 * Returns detailed report suitable for ops scripts.
 */
export function checkAppEnv(
  app: 'api' | 'command-center' | 'smart-form' | 'dashboard' | 'discord-bot',
  env: ProcessEnvType = process.env
): EnvCheckResult {
  const profile = getEnvProfile(env);
  const acc: EnvCheckAccumulator = {
    presentVars: [],
    missingVars: [],
    errors: [],
    warnings: [],
  };

  // Check common vars
  const commonCheck = checkVarsPresence(env, ENV_KEYS.common);
  acc.presentVars.push(...commonCheck.present);
  acc.missingVars.push(...commonCheck.missing);

  // App-specific checks
  switch (app) {
    case 'api':
      checkApiEnvVars(env, acc);
      break;
    case 'command-center':
    case 'smart-form':
    case 'dashboard':
      checkFrontendEnvVars(env, acc);
      break;
    case 'discord-bot':
      checkDiscordBotEnvVars(env, acc);
      break;
  }

  // Import dynamically to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateSupabaseHost } = require('./supabase-host') as {
    validateSupabaseHost: (url: string | undefined) => { valid: boolean; error?: string };
  };

  const supabaseUrl = env['SUPABASE_URL'] ?? env['NEXT_PUBLIC_SUPABASE_URL'];
  if (supabaseUrl) {
    const hostResult = validateSupabaseHost(supabaseUrl);
    if (!hostResult.valid && hostResult.error) {
      acc.errors.push(hostResult.error);
    }
  }

  return {
    app,
    profile,
    valid: acc.errors.length === 0,
    errors: acc.errors,
    warnings: acc.warnings,
    missingVars: acc.missingVars,
    presentVars: acc.presentVars,
  };
}
