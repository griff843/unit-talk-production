// src/agents/GradingAgent/gradeAndPromoteUnifiedPicks.ts

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

/** P-03: Claim the daily_picks row via flag-first UPDATE */
async function claimDailyPick(pickId: string): Promise<boolean> {
  const { data: claimed, error: claimErr } = await supabase
    .from('daily_picks')
    .update({ promoted_to_final: true, promoted_final_at: new Date().toISOString() })
    .eq('id', pickId)
    .eq('promoted_to_final', false)
    .select('id');

  if (claimErr || !claimed || claimed.length === 0) {
    logger.info(
      { id: pickId },
      'Pick already claimed for final or claim failed — skipping (idempotent)'
    );
    return false;
  }
  return true;
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
  await supabase.from('unified_picks').insert([
    {
      ...pick,
      legs: pick.legs,
      leg_results: legResults,
      ticket_score: ticketScore,
      promoted_at: new Date().toISOString(),
    },
  ]);

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

  await supabase.from('unified_picks').insert([
    {
      ...pick,
      score: grade.score,
      tier,
      score_breakdown: grade.breakdown || null,
      promoted_at: new Date().toISOString(),
    },
  ]);

  logger.info({ id: pick.id, tier: grade.tier }, 'Promoted single pick');
  return true;
}

export async function gradeAndPromoteUnifiedPicks() {
  // P-01: Deterministic ordering by id
  const { data: picks, error } = await supabase
    .from('daily_picks')
    .select('*')
    .eq('promoted_to_final', false)
    .eq('is_valid', true)
    .order('id', { ascending: true });

  if (error) {
    logger.error(error, 'Error fetching daily_picks');
    return;
  }
  if (!picks || picks.length === 0) {
    logger.info('No eligible daily_picks found for final grading.');
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
