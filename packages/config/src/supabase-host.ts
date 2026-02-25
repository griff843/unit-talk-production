/**
 * Supabase Host Validation
 * Sprint: SPRINT-B1-ENV-HARDENING-001B
 */

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
export function validateSupabaseHost(url: string | undefined): { valid: boolean; error?: string } {
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
