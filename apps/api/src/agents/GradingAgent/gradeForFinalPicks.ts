/**
 * @deprecated SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007
 * This module is DEPRECATED. BridgeWorker now handles grading directly.
 * The daily_picks table has been eliminated.
 */

import { lifecycleInsert, lifecycleUpdate } from '../../lib/lifecycle';
import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';

import { gradePick } from './scoring/edgeScore';

/**
 * @deprecated Use BridgeWorker for canonical grading flow
 */
export async function gradeAndPromoteUnifiedPicks() {
  // SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Fail-closed
  logger.warn('DEPRECATED: gradeAndPromoteUnifiedPicks() called from gradeForFinalPicks.ts');
  logger.warn('BridgeWorker now handles grading: bridge_outbox → unified_picks');

  // Check if there are any ungraded picks in unified_picks that need processing
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .is('tier', null)
    .eq('workflow_stage', 'pending');

  if (error) {
    logger.error(error, 'Error fetching unified_picks for grading');
    throw error;
  }
  if (!picks || picks.length === 0) {
    logger.info('No ungraded unified_picks found.');
    return;
  }

  let promotedCount = 0;

  for (const pick of picks) {
    try {
      // --- Multi-leg logic for Parlay, Teaser, Round Robin ---
      if (
        pick.is_parlay ||
        pick.is_teaser ||
        pick.is_rr ||
        ['parlay', 'teaser', 'roundrobin', 'sgp'].includes((pick.bet_type || '').toLowerCase())
      ) {
        if (Array.isArray(pick.legs) && pick.legs.length > 1) {
          const legResults: any[] = pick.legs.map((leg: any) => gradePick(leg));
          const allLegsQualified = legResults.every(result => ['S', 'A'].includes(result.tier));
          const ticketScore = Math.round(
            legResults.reduce((acc, cur) => acc + (cur.professional_score ?? 0), 0) /
              legResults.length
          );

          if (allLegsQualified) {
            // LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle adapter for insert
            const multiLegPick = {
              id: pick.id,
              ...pick,
              legs: pick.legs,
              legResults,
              ticketScore,
              promoted_at: new Date().toISOString(),
            };
            const multiResult = await lifecycleInsert(supabase, multiLegPick, {
              writerRole: 'promoter',
              traceId: `gradefor-multi-${pick.id}`,
            });
            if (!multiResult.success) {
              logger.error({ id: pick.id, error: multiResult.error }, 'Failed to insert multi-leg');
              continue;
            }
            // SPRINT-007: No longer updating daily_picks - picks are already in unified_picks
            // SPRINT-RUNTIME-TRUTH-008: Use lifecycle adapter for updates
            await lifecycleUpdate(
              supabase,
              pick.id,
              {
                promoted_to_final: true,
                promoted_final_at: new Date().toISOString(),
              },
              { writerRole: 'promoter', traceId: `gradefor-promote-multi-${pick.id}` }
            );

            promotedCount++;
            logger.info(
              { id: pick.id, type: pick.bet_type },
              'Multi-leg bet promoted to unified_picks'
            );
          } else {
            logger.info(
              { id: pick.id, type: pick.bet_type },
              'Multi-leg bet not promoted (one or more legs below threshold)'
            );
          }
          continue;
        }
        logger.warn(
          { id: pick.id, type: pick.bet_type },
          'Multi-leg bet missing legs array, skipping'
        );
        continue;
      }

      // --- Single bet logic ---
      const grade = await gradePick(pick);
      if (['S', 'A'].includes(grade.tier)) {
        // LIFECYCLE-WRITE-SURFACE-MIGRATION-038: Use lifecycle adapter for insert
        const singlePick = {
          id: pick.id,
          ...pick,
          ...grade,
          promoted_at: new Date().toISOString(),
        };
        const singleResult = await lifecycleInsert(supabase, singlePick, {
          writerRole: 'promoter',
          traceId: `gradefor-single-${pick.id}`,
        });
        if (!singleResult.success) {
          logger.error({ id: pick.id, error: singleResult.error }, 'Failed to insert single pick');
          continue;
        }
        // SPRINT-007: No longer updating daily_picks - picks are already in unified_picks
        // SPRINT-RUNTIME-TRUTH-008: Use lifecycle adapter for updates
        await lifecycleUpdate(
          supabase,
          pick.id,
          {
            promoted_to_final: true,
            promoted_final_at: new Date().toISOString(),
          },
          { writerRole: 'promoter', traceId: `gradefor-promote-single-${pick.id}` }
        );

        promotedCount++;
        logger.info(
          { id: pick.id, player: pick.player_name, tier: grade.tier },
          'Promoted to unified_picks'
        );
      } else {
        logger.info(
          { id: pick.id, player: pick.player_name, tier: grade.tier },
          'Not promoted to unified_picks'
        );
      }
    } catch (err) {
      logger.error({ id: pick.id }, 'Grading error: ', err);
    }
  }

  logger.info(`Final promotion complete: ${promotedCount} picks promoted to unified_picks.`);
}
