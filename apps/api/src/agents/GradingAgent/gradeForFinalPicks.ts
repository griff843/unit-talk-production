import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';

import { gradePick } from './scoring/edgeScore';

export async function gradeAndPromoteUnifiedPicks() {
  // Fetch all eligible daily picks that have NOT been promoted
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('promoted_to_final', false)
    .eq('is_valid', true);

  if (error) {
    logger.error(error, 'Error fetching unified_picks');
    throw error;
  }
  if (!picks || picks.length === 0) {
    logger.info('No eligible unified_picks found for final grading.');
    return;
  }

  let promotedCount = 0;

  for (const pick of picks) {
    try {
      // --- Multi-leg logic for Parlay, Teaser, Round Robin ---
      if (
        pick.is_parlay || pick.is_teaser || pick.is_rr ||
        ['parlay', 'teaser', 'roundrobin', 'sgp'].includes((pick.bet_type || '').toLowerCase())
      ) {
        if (Array.isArray(pick.legs) && pick.legs.length > 1) {
          const legResults: any[] = pick.legs.map((leg: any) => gradePick(leg));
          const allLegsQualified = legResults.every((result) => ['S', 'A'].includes(result.tier));
          const ticketScore = Math.round(
            legResults.reduce((acc, cur) => acc + (cur.professional_score ?? 0), 0) / legResults.length
          );

          if (allLegsQualified) {
            await supabase.from('unified_picks').insert([{
              ...pick,
              legs: pick.legs,
              legResults,
              ticketScore,
              promoted_at: new Date().toISOString(),
            }]);
            await supabase.from('unified_picks').update({
              promoted_to_final: true,
              promoted_final_at: new Date().toISOString()
            }).eq('id', pick.id);

            promotedCount++;
            logger.info({ id: pick.id, type: pick.bet_type }, 'Multi-leg bet promoted to unified_picks');
          } else {
            logger.info({ id: pick.id, type: pick.bet_type }, 'Multi-leg bet not promoted (one or more legs below threshold)');
          }
          continue;
        }
        logger.warn({ id: pick.id, type: pick.bet_type }, 'Multi-leg bet missing legs array, skipping');
        continue;
      }

      // --- Single bet logic ---
      const grade = await gradePick(pick);
      if (['S', 'A'].includes(grade.tier)) {
        await supabase.from('unified_picks').insert([{
          ...pick,
          ...grade,
          promoted_at: new Date().toISOString(),
        }]);
        await supabase.from('unified_picks').update({
          promoted_to_final: true,
          promoted_final_at: new Date().toISOString()
        }).eq('id', pick.id);

        promotedCount++;
        logger.info({ id: pick.id, player: pick.player_name, tier: grade.tier }, 'Promoted to unified_picks');
      } else {
        logger.info({ id: pick.id, player: pick.player_name, tier: grade.tier }, 'Not promoted to unified_picks');
      }
    } catch (err) {
      logger.error({ id: pick.id }, 'Grading error: ', err);
    }
  }

  logger.info(`Final promotion complete: ${promotedCount} picks promoted to unified_picks.`);
}
