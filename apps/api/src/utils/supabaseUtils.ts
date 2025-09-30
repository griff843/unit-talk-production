/**
 * Supabase utilities for handling null safety
 */

import { supabase, supabaseClient } from '../services/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database-override';

// Re-export for compatibility
export { supabase, supabaseClient };

/**
 * Ensures supabase client is available, throws if not configured
 * Returns a client with bypassed type checking to prevent 'never' type issues
 */
export function requireSupabase(): any {
  if (!supabase) {
    throw new Error('Supabase client is not configured - check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  // Return the client with full type bypass to prevent 'never' type issues
  return supabase as any;
}

/**
 * Alias for requireSupabase for compatibility with files using supabaseClient
 */
export function requireSupabaseClient(): any {
  if (!supabaseClient) {
    throw new Error('Supabase client is not configured - check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return supabaseClient as any;
}

/**
 * Safe getter for supabase client that returns null if not configured
 */
export function getSupabase(): SupabaseClient<Database> | null {
  return supabase;
}

/**
 * Safe getter for supabase client that returns null if not configured
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  return supabaseClient;
}