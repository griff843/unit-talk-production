// src/agents/GradingAgent/gradeAndPromoteFinalPicks.ts

import { supabase } from '../../services/supabaseClient';
import { gradePick } from './scoring/edgeScore';
import { logger } from '../../services/logging';

export async function gradeAndPromoteFinalPicks() {
  const { data: picks, error } = await supabase
    .from('daily_picks')
    .select('*')
    .eq('promoted_to_final', false)
    .eq('is_valid', true);

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
      // Multi-leg support
      if (['parlay', 'teaser', 'roundrobin', 'sgp'].includes((pick.bet_type || '').toLowerCase())) {
        if (Array.isArray(pick.legs) && pick.legs.length > 1) {
          const legResults = pick.legs.map(gradePick);
          const allQualified = legResults.every(r => ['S', 'A'].includes(r.tier));
          const ticketScore = Math.round(legResults.reduce((sum, r) => sum + r.score, 0) / legResults.length);

          if (allQualified) {
            await supabase.from('final_picks').insert([{
              ...pick,
              legs: pick.legs,
              leg_results: legResults,
              ticket_score: ticketScore,
              promoted_at: new Date().toISOString()
            }]);
            await supabase.from('daily_picks').update({
              promoted_to_final: true,
              promoted_final_at: new Date().toISOString()
            }).eq('id', pick.id);

            promotedCount++;
            logger.info({ id: pick.id, type: pick.bet_type }, 'Promoted multi-leg ticket');
          }
          continue;
        }
        logger.warn({ id: pick.id }, 'Multi-leg ticket missing legs array');
        continue;
      }

      // Single-leg grading
      const grade = gradePick(pick);

      const overrideTier = pick.admin_override_tier || null;
      const shouldPromote = overrideTier ? ['S', 'A'].includes(overrideTier) : ['S', 'A'].includes(grade.tier);

      if (shouldPromote) {
        await supabase.from('final_picks').insert([{
          ...pick,
          score: grade.score,
          tier: overrideTier || grade.tier,
          tags: grade.tags,
          score_breakdown: grade.breakdown || null,
          promoted_at: new Date().toISOString()
        }]);
        await supabase.from('daily_picks').update({
          promoted_to_final: true,
          promoted_final_at: new Date().toISOString()
        }).eq('id', pick.id);

        promotedCount++;
        logger.info({ id: pick.id, tier: grade.tier }, 'Promoted single pick');
      } else {
        logger.info({ id: pick.id, tier: grade.tier }, 'Not promoted');
      }

    } catch (err) {
      logger.error({ id: pick.id }, 'Grading error:', err);
    }
  }

  logger.info(`✅ Final promotion complete: ${promotedCount} picks promoted to final_picks`);
}
