/**
 * PROMOTION MODE
 * Sprint: SPRINT-PROMOTION-MODE-SPLIT
 *
 * Controls environment-aware promotion behavior for system-generated picks.
 *
 * PRODUCTION (PROMOTION_MODE=manual):
 *   pending_review → operator approval in Command Center → approved → Discord
 *
 * DEV/CANARY (PROMOTION_MODE=auto):
 *   pending_review → auto-approve → approved → Discord
 *
 * FAIL-CLOSED: Any value other than 'auto' is treated as 'manual'.
 * This guarantees production safety even if env var is missing or misconfigured.
 */

export type PromotionMode = 'manual' | 'auto';

/**
 * Returns the current promotion mode.
 * Reads directly from process.env (not the cached env module) so tests can override it.
 * Fail-closed: returns 'manual' for any value other than exactly 'auto'.
 */
export function getPromotionMode(): PromotionMode {
  const raw = process.env['PROMOTION_MODE'];
  if (raw === 'auto') return 'auto';
  // Fail-closed: undefined, 'manual', or any other value → 'manual'
  return 'manual';
}

/**
 * Returns true ONLY when PROMOTION_MODE=auto is explicitly set.
 * Safe to call in any environment — will never return true in production unless configured.
 */
export function isAutoPromotionMode(): boolean {
  return getPromotionMode() === 'auto';
}
