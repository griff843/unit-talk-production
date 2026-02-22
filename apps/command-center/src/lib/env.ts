/**
 * Environment Configuration & Validation
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Canonical Supabase configuration
 */

// This is the ONLY acceptable production Supabase host
export const CANONICAL_SUPABASE_HOST = 'cqfnsozknjzvyiziwicl.supabase.co';

export const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
