/**
 * Supabase utility functions
 *
 * Provides helper functions for Supabase client initialization
 * and common database operations.
 *
 * @module utils/supabaseUtils
 * @since Phase 4 - Compile Green Stabilization
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env';

/**
 * Creates and returns a Supabase client with service role privileges
 *
 * @returns Configured Supabase client
 * @throws Error if required environment variables are missing
 */
export function requireSupabase(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a Supabase client with anon key (for client-side operations)
 *
 * @returns Configured Supabase client with anon key
 */
export function createAnonClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/**
 * Singleton instance of the service role Supabase client
 */
let supabaseInstance: SupabaseClient | null = null;

/**
 * Gets or creates a singleton Supabase client instance
 *
 * @returns Singleton Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = requireSupabase();
  }
  return supabaseInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
