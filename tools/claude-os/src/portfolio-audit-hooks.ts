/**
 * SPOA — Sprint Portfolio Optimization Audit
 * Trigger hooks — stub only in v1.
 *
 * Auto-trigger integrations are OUT OF SCOPE for SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND.
 * This file is a placeholder for Phase 3 (Auto-Trigger Integration) of the
 * SPOA Implementation Roadmap.
 *
 * Do NOT implement auto-trigger logic here until Phase 3 is explicitly scoped.
 *
 * Future hooks (Phase 3):
 * - post-closeout trigger (run SPOA after sprint:close)
 * - queue-vacant trigger (run SPOA when no active next sprint)
 * - every-N-sprints trigger (recurring cadence)
 * - phase-transition trigger (run SPOA at layer/phase boundaries)
 *
 * Sprint: SPRINT-SPOA-FOUNDATION-MANUAL-COMMAND
 */

// ---------------------------------------------------------------------------
// Placeholder exports — do not implement in v1
// ---------------------------------------------------------------------------

export interface HookRegistration {
  hookType: 'post-closeout' | 'queue-vacant' | 'every-n' | 'phase-transition';
  enabled: false; // always false in v1
}

/** Returns an empty set of hooks — all disabled in v1 */
export function getRegisteredHooks(): HookRegistration[] {
  return [];
}

/** No-op in v1. Placeholder for Phase 3 integration. */
export function registerPostCloseoutHook(_sprintId: string): void {
  // Phase 3: not implemented
}

/** No-op in v1. Placeholder for Phase 3 integration. */
export function registerQueueVacantHook(): void {
  // Phase 3: not implemented
}
