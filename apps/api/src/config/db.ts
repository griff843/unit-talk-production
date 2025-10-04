/**
 * Centralized Database Configuration
 *
 * Single source of truth for all database connections.
 * Enforces SaaS-only mode with Supabase Cloud.
 */

import { createClient } from '@supabase/supabase-js';
import { validateDbConfig } from './dbGuard';

export interface DbConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;
  databaseUrl?: string;
}

let _cachedConfig: DbConfig | null = null;

/**
 * Get validated database configuration
 * Validates on first call, then caches result
 */
export function getDbConfig(): DbConfig {
  if (_cachedConfig) {
    return _cachedConfig;
  }

  // Validate configuration
  const result = validateDbConfig();
  if (!result.valid) {
    throw new Error(result.error);
  }

  // Extract configuration from environment
  const config: DbConfig = {
    supabaseUrl: result.supabaseUrl,
    supabaseServiceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseAnonKey: getRequiredEnv('SUPABASE_ANON_KEY'),
    databaseUrl: result.databaseUrl
  };

  _cachedConfig = config;
  return config;
}

/**
 * Get a Supabase client with service role permissions
 * Uses cached configuration for performance
 */
export function getSupabaseClient() {
  const config = getDbConfig();
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Get a Supabase client with anon key (for client-side operations)
 */
export function getSupabaseAnonClient() {
  const config = getDbConfig();
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}

/**
 * Get the Postgres connection string
 * Returns undefined if only using Supabase REST API
 */
export function getDatabaseUrl(): string | undefined {
  const config = getDbConfig();
  return config.databaseUrl;
}

/**
 * Reset cached configuration (for testing)
 */
export function resetDbConfig() {
  _cachedConfig = null;
}

/**
 * Helper to get required environment variable
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Log current database configuration (without sensitive keys)
 */
export function logDbConfig() {
  const config = getDbConfig();
  const supabaseHost = new URL(config.supabaseUrl).hostname;

  console.log('✅ Database Configuration:');
  console.log(`   Supabase: ${supabaseHost}`);
  console.log(`   Service Role Key: ${config.supabaseServiceRoleKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Anon Key: ${config.supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);

  if (config.databaseUrl) {
    const dbMatch = config.databaseUrl.match(/@([^:/]+)/);
    const dbHost = dbMatch ? dbMatch[1] : 'unknown';
    console.log(`   Database URL: ${dbHost}`);
  }
}
