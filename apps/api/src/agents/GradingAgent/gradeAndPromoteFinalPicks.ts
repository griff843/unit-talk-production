// src/agents/GradingAgent/gradeAndPromoteUnifiedPicks.ts

/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This module is DEPRECATED. BridgeWorker now handles grading directly.
 * The daily_picks table has been eliminated.
 */

import { lifecycleInsert } from '../../lib/lifecycle';
import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';

import { gradePick } from './scoring/edgeScore';

const REQUIRED_FINAL_FIELDS = ['player_name', 'stat_type', 'line'] as const;

function validateFinalFields(pick: any): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_FINAL_FIELDS.filter(
    // eslint-disable-next-line security/detect-object-injection
    f => pick[f] === undefined || pick[f] === null || pick[f] === ''
  );
  return { valid: missing.length === 0, missing };
}

/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This function is no longer needed - unified_picks is already the target table.
 */
async function claimDailyPick(pickId: string): Promise<boolean> {
  // SPRINT-007: Skip claim - picks are already in unified_picks
  logger.warn({ id: pickId }, 'DEPRECATED: claimDailyPick() - daily_picks eliminated');
  return true; // Allow processing to continue but no actual claim needed
}

/** Process a multi-leg ticket (parlay, teaser, roundrobin, sgp) */
async function processMultiLeg(pick: any): Promise<boolean> {
  if (!Array.isArray(pick.legs) || pick.legs.length <= 1) {
    logger.warn({ id: pick.id }, 'Multi-leg ticket missing legs array');
    return false;
  }

  const legResults = pick.legs.map(gradePick);
  const allQualified = legResults.every((r: any) => ['S', 'A'].includes(r.tier));
  if (!allQualified) return false;
  if (!(await claimDailyPick(pick.id))) return false;

  const ticketScore = Math.round(
    legResults.reduce((sum: number, r: any) => sum + r.professional_score, 0) / legResults.length
  );
  // POSTING-AUTHORITY-001: System-generated picks tagged with pick_origin='system'
  // LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle adapter for insert
  const multiLegPick = {
    id: pick.id,
    ...pick,
    legs: pick.legs,
    leg_results: legResults,
    ticket_score: ticketScore,
    promoted_at: new Date().toISOString(),
    meta: {
      ...(pick.meta || {}),
      pick_origin: 'system',
    },
  };
  const multiResult = await lifecycleInsert(supabase, multiLegPick, {
    writerRole: 'promoter',
    traceId: `grading-multi-${pick.id}`,
  });
  if (!multiResult.success) {
    logger.error({ id: pick.id, error: multiResult.error }, 'Failed to insert multi-leg pick');
    return false;
  }

  logger.info({ id: pick.id, type: pick.bet_type }, 'Promoted multi-leg ticket');
  return true;
}

/** Process a single-leg pick */
async function processSingleLeg(pick: any): Promise<boolean> {
  const grade = gradePick(pick);
  const overrideTier = pick.admin_override_tier || null;
  const tier = overrideTier || grade.tier;

  if (!['S', 'A'].includes(tier)) {
    logger.info({ id: pick.id, tier: grade.tier }, 'Not promoted');
    return false;
  }
  if (!(await claimDailyPick(pick.id))) return false;

  // POSTING-AUTHORITY-001: System-generated picks tagged with pick_origin='system'
  // LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle adapter for insert
  const singleLegPick = {
    id: pick.id,
    ...pick,
    score: grade.score,
    tier,
    score_breakdown: grade.breakdown || null,
    promoted_at: new Date().toISOString(),
    meta: {
      ...(pick.meta || {}),
      pick_origin: 'system',
    },
  };
  const singleResult = await lifecycleInsert(supabase, singleLegPick, {
    writerRole: 'promoter',
    traceId: `grading-single-${pick.id}`,
  });
  if (!singleResult.success) {
    logger.error({ id: pick.id, error: singleResult.error }, 'Failed to insert single pick');
    return false;
  }

  logger.info({ id: pick.id, tier: grade.tier }, 'Promoted single pick');
  return true;
}

/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This function is DEPRECATED. BridgeWorker handles grading via SyndicateGradingEngine.
 */
export async function gradeAndPromoteUnifiedPicks() {
  // SPRINT-007: Read from unified_picks instead of daily_picks
  // Only process picks that haven't been graded yet
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .is('tier', null)
    .order('id', { ascending: true });

  if (error) {
    logger.error(error, 'Error fetching unified_picks for grading');
    return;
  }
  if (!picks || picks.length === 0) {
    logger.info('No ungraded unified_picks found.');
    return;
  }

  let promotedCount = 0;

  for (const pick of picks) {
    try {
      // P-05: Validate required fields
      const validation = validateFinalFields(pick);
      if (!validation.valid) {
        logger.warn(
          { id: pick.id, missing: validation.missing },
          'Skipped final promotion: missing required fields'
        );
        continue;
      }

      const isMultiLeg = ['parlay', 'teaser', 'roundrobin', 'sgp'].includes(
        (pick.bet_type || '').toLowerCase()
      );
      const promoted = isMultiLeg ? await processMultiLeg(pick) : await processSingleLeg(pick);

      if (promoted) promotedCount++;
    } catch (err) {
      logger.error({ id: pick.id }, 'Grading error:', err);
    }
  }

  logger.info(`Final promotion complete: ${promotedCount} picks promoted to unified_picks`);
}
