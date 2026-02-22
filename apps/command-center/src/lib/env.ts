/**
 * Environment Configuration & Validation
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Canonical Supabase configuration
 * SPRINT-ARCHITECTURE-HARDENING-002A: Lazy env access (no module-scope evaluation)
 */

// This is the ONLY acceptable production Supabase host
export const CANONICAL_SUPABASE_HOST = 'cqfnsozknjzvyiziwicl.supabase.co';

/**
 * Get NEXT_PUBLIC_SUPABASE_URL lazily (runtime access, not build-time)
 * SPRINT-ARCHITECTURE-HARDENING-002A: Converted from module-scope const
 */
export function getNextPublicSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  return url;
}

/**
 * Get NEXT_PUBLIC_SUPABASE_ANON_KEY lazily (runtime access, not build-time)
 * SPRINT-ARCHITECTURE-HARDENING-002A: Converted from module-scope const
 */
export function getNextPublicSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  return key;
}

/**
 * @deprecated Use getNextPublicSupabaseUrl() instead - lazy access required
 * Kept for backward compatibility during migration
 */
export const NEXT_PUBLIC_SUPABASE_URL = '';

/**
 * @deprecated Use getNextPublicSupabaseAnonKey() instead - lazy access required
 * Kept for backward compatibility during migration
 */
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

/**
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A
 * Validates that the configured SUPABASE_URL matches the canonical production host.
 * Returns an error message if validation fails, null if valid.
 */
export function validateSupabaseEndpoint(): { valid: boolean; error?: string } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return {
      valid: false,
      error: 'SPRINT-110A: SUPABASE_URL environment variable is not set',
    };
  }

  // Extract hostname from URL
  let hostname: string;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    return {
      valid: false,
      error: `SPRINT-110A: Invalid SUPABASE_URL format: ${supabaseUrl}`,
    };
  }

  if (hostname !== CANONICAL_SUPABASE_HOST) {
    return {
      valid: false,
      error: `SPRINT-110A: Unauthorized Supabase host detected. Expected: ${CANONICAL_SUPABASE_HOST}, Got: ${hostname}`,
    };
  }

  return { valid: true };
}
