/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This module is DEPRECATED. BridgeWorker is now the canonical ingest path:
 * bridge_outbox → BridgeWorker → lifecycleInsert → unified_picks
 *
 * Do NOT use promoteToDailyPicks(). The daily_picks table has been eliminated.
 * Picks should flow through BridgeWorker for canonical processing.
 */

import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';
import { applyScoringLogic } from '../GradingAgent/scoring/applyScoringLogic';

import { runPreScoreGuardrails, runPostScoreGuardrails, hasRejection } from './PromotionGuardrails';

const REQUIRED_PROMOTION_FIELDS = ['player_name', 'sport', 'stat_type', 'line', 'odds'] as const;

function validatePromotionFields(prop: any): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_PROMOTION_FIELDS.filter(
    // eslint-disable-next-line security/detect-object-injection
    f => prop[f] === undefined || prop[f] === null || prop[f] === ''
  );
  return { valid: missing.length === 0, missing };
}

/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This function is DEPRECATED. daily_picks table has been eliminated.
 * Use BridgeWorker for canonical ingest: bridge_outbox → unified_picks
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function claimAndInsert(_prop: any, _scored: any): Promise<boolean> {
  // SPRINT-007: daily_picks eliminated - this function is deprecated
  throw new Error('DEPRECATED: claimAndInsert() - daily_picks eliminated (SPRINT-007)');
}

/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This function is DEPRECATED and will throw if called.
 * Use BridgeWorker for canonical pick ingest.
 */
export async function promoteToDailyPicks() {
  // SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Fail-closed
  logger.warn('DEPRECATED: promoteToDailyPicks() called - this function is no longer supported');
  logger.warn('Use BridgeWorker for canonical ingest: bridge_outbox → unified_picks');
  throw new Error('DEPRECATED: promoteToDailyPicks() - Use BridgeWorker instead (SPRINT-007)');

  // Legacy code preserved for reference but unreachable:
  // 1. Fetch eligible raw_props (deterministic order by id — P-01)
  const { data: rawProps, error } = await supabase
    .from('raw_props')
    .select('*')
    .eq('promoted', false)
    .eq('is_valid', true)
    .order('id', { ascending: true });

  if (error) {
    logger.error(error, 'Error fetching raw_props');
    throw error;
  }

  if (!rawProps || rawProps.length === 0) {
    logger.info('No eligible raw_props found for promotion.');
    return;
  }

  let promotedCount = 0;

  for (const prop of rawProps) {
    // P-05: Validate required fields before scoring
    const validation = validatePromotionFields(prop);
    if (!validation.valid) {
      logger.warn(
        { id: prop.id, player: prop.player_name, missing: validation.missing },
        'Skipped promotion: missing required fields'
      );
      continue;
    }

    // Stage 5 — Pre-score guardrails (G-01 through G-05)
    const preGuardrails = runPreScoreGuardrails(prop);
    if (hasRejection(preGuardrails)) {
      logger.warn(
        { id: prop.id, player: prop.player_name, guardrails: preGuardrails.filter(g => !g.passed) },
        'Blocked by pre-score guardrail'
      );
      continue;
    }

    const scored = applyScoringLogic(prop);

    // Stage 5 — Post-score guardrails (G-06: minimum edge)
    const postGuardrails = runPostScoreGuardrails(scored);
    if (hasRejection(postGuardrails)) {
      logger.warn(
        {
          id: prop.id,
          player: prop.player_name,
          tier: scored.tier,
          guardrails: postGuardrails.filter(g => !g.passed),
        },
        'Blocked by post-score guardrail'
      );
      continue;
    }

    if (['S', 'A', 'B'].includes(scored.tier)) {
      const ok = await claimAndInsert(prop, scored);
      if (ok) promotedCount++;
    } else {
      logger.info(
        { id: prop.id, player: prop.player_name, tier: scored.tier },
        'Not promoted (Tier C)'
      );
    }
  }

  logger.info(`Promotion complete: ${promotedCount} props promoted to daily_picks.`);
}
