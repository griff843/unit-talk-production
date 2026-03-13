/**
 * AUTO-APPROVAL ENGINE
 * Sprint: SPRINT-PROMOTION-MODE-SPLIT
 *
 * Transitions eligible system-generated picks from pending_review → approved
 * in dev/canary environments (PROMOTION_MODE=auto).
 *
 * In production (PROMOTION_MODE=manual), this module is a no-op.
 * All writes go through lifecycle adapters (single-writer discipline preserved).
 *
 * F-TIER EXCLUSION: Picks with tier='F' are excluded from auto-approval.
 * These represent stale backlog from the legacy scoring system predating
 * the current SyndicateGradingEngine. They must not be auto-promoted.
 *
 * SAFETY INVARIANTS:
 *  - Fail-closed: default mode is 'manual' if PROMOTION_MODE is unset
 *  - Uses lifecycleUpdate with writerRole='promoter' (single-writer compliant)
 *  - Idempotent: only processes picks without system_approved=true
 *  - Observable: all transitions logged with pick ID, tier, and outcome
 */

import { logger } from '../../services/logging';
import { lifecycleUpdate } from '../lifecycle';
import { getPromotionMode } from '../promotion-mode';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AutoApprovalResult {
  mode: 'manual' | 'auto';
  approved: number;
  skipped: number;
  errors: number;
  ftierExcluded: number;
}

/**
 * Run the auto-approval cycle for system-generated picks.
 *
 * In auto mode: transitions eligible system picks from pending_review to approved
 * by setting workflow_stage='approved' and meta.system_approved='true'.
 * DiscordPromotionAgent's processSystemPicks() then picks them up normally.
 *
 * In manual mode: returns immediately with approved=0 (no state changes).
 */
export async function runAutoApproval(supabase: SupabaseClient): Promise<AutoApprovalResult> {
  const mode = getPromotionMode();

  if (mode !== 'auto') {
    logger.debug(
      { mode },
      'PROMOTION-MODE-SPLIT: manual mode active — no auto-approval of system picks'
    );
    return { mode, approved: 0, skipped: 0, errors: 0, ftierExcluded: 0 };
  }

  logger.info('PROMOTION-MODE-SPLIT: auto mode active — scanning for eligible system picks');

  // Query system picks that have not yet been auto-approved or posted.
  // Intentionally queries without workflow_stage filter: we want all unapproved
  // system picks regardless of their current workflow_stage value.
  //
  // NOTE: JSONB path filters require .filter() not .eq() with the Supabase JS client.
  // NOTE: We do NOT filter out system_approved at the DB layer because SQL NULL semantics
  //       cause `meta->>system_approved neq 'true'` to return false when the key is absent
  //       (NULL != 'true' = NULL = not matched). Instead we skip already-approved picks
  //       in the loop below.
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('posted_to_discord', false)
    .filter('meta->>pick_origin', 'eq', 'system')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    logger.error(
      { error: error.message },
      'PROMOTION-MODE-SPLIT: Failed to fetch system picks for auto-approval'
    );
    return { mode, approved: 0, skipped: 0, errors: 1, ftierExcluded: 0 };
  }

  if (!picks?.length) {
    logger.info('PROMOTION-MODE-SPLIT: No eligible system picks found for auto-approval');
    return { mode, approved: 0, skipped: 0, errors: 0, ftierExcluded: 0 };
  }

  logger.info(
    { count: picks.length },
    'PROMOTION-MODE-SPLIT: Found system picks to evaluate for auto-approval'
  );

  let approved = 0;
  let skipped = 0;
  let errors = 0;
  let ftierExcluded = 0;

  for (const pick of picks) {
    // Skip picks already approved (system_approved='true' in meta)
    if ((pick.meta as Record<string, unknown> | null)?.['system_approved'] === 'true') {
      skipped++;
      continue;
    }

    // SPRINT-PROMOTION-MODE-SPLIT: Exclude F-tier picks (stale backlog from legacy scoring).
    // F-tier does not exist in the current SyndicateGradingEngine (D→C mapping eliminates it).
    // Any pick with tier='F' is a pre-existing historical record and must NOT be auto-approved.
    if (pick.tier === 'F') {
      logger.warn(
        { pickId: pick.id, tier: pick.tier, createdAt: pick.created_at },
        'PROMOTION-MODE-SPLIT: Excluding F-tier pick from auto-approval — stale backlog from legacy scoring system'
      );
      ftierExcluded++;
      continue;
    }

    // Transition: set workflow_stage='approved' and meta.system_approved='true'.
    // This makes the pick eligible for processSystemPicks() in DiscordPromotionAgent.
    const result = await lifecycleUpdate(
      supabase,
      pick.id,
      {
        workflow_stage: 'approved',
        meta: { ...(pick.meta || {}), system_approved: 'true' },
      },
      {
        writerRole: 'promoter',
        traceId: `auto-approval-${pick.id}`,
        // skipTransitionValidation: workflow_stage is not a lifecycle FSM field;
        // deriveLifecycleStage uses posted_to_discord/settlement_status, not workflow_stage.
        // No transition check needed — just updating the approval gate field.
        skipTransitionValidation: true,
      }
    );

    if (result.success) {
      logger.info(
        { pickId: pick.id, tier: pick.tier, previousWorkflowStage: pick.workflow_stage },
        'PROMOTION-MODE-SPLIT: Auto-approved system pick → workflow_stage=approved, system_approved=true'
      );
      approved++;
    } else {
      logger.error(
        { pickId: pick.id, tier: pick.tier, error: result.error },
        'PROMOTION-MODE-SPLIT: Failed to auto-approve pick'
      );
      errors++;
    }
  }

  logger.info(
    { mode, approved, skipped, errors, ftierExcluded, totalEvaluated: picks.length },
    'PROMOTION-MODE-SPLIT: Auto-approval cycle complete'
  );

  return { mode, approved, skipped, errors, ftierExcluded };
}
