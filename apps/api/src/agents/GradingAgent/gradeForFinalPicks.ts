import { logger } from '../../services/logging';
import { supabase } from '../../services/supabaseClient';

import { gradePick } from './scoring/edgeScore';

/**
 * SINGLE-WRITER-SEAL-011: Helper to insert unified_picks via authoritative RPC
 * All inserts MUST go through create_unified_pick_idempotent
 */
async function insertUnifiedPickViaRPC(pickData: Record<string, unknown>): Promise<{ success: boolean; pick_id?: string; idempotent?: boolean; error?: string }> {
  // Ensure bet_slip_id exists (required by RPC)
  const betSlipId = pickData.bet_slip_id || `grading-${pickData.id || Date.now()}-${Math.random().toString(36).substring(7)}`;

  const payload = {
    ...pickData,
    bet_slip_id: betSlipId,
    trace_id: `grading-agent-${betSlipId}`,
  };

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('create_unified_pick_idempotent', { p_payload: payload });

  if (rpcError) {
    logger.error({ bet_slip_id: betSlipId, error: rpcError.message }, 'RPC create_unified_pick_idempotent failed');
    return { success: false, error: rpcError.message };
  }

  if (rpcResult && rpcResult.success) {
    logger.info({
      pick_id: rpcResult.pick_id,
      bet_slip_id: betSlipId,
      idempotent: rpcResult.idempotent,
    }, 'Pick inserted via RPC');
    return { success: true, pick_id: rpcResult.pick_id, idempotent: rpcResult.idempotent };
  }

  return { success: false, error: rpcResult?.error || 'Unknown RPC error' };
}

export async function gradeAndPromoteUnifiedPicks() {
  // Fetch all eligible daily picks that have NOT been promoted
  const { data: picks, error } = await supabase
    .from('daily_picks')
    .select('*')
    .eq('promoted_to_final', false)
    .eq('is_valid', true);

  if (error) {
    logger.error(error, 'Error fetching daily_picks');
    throw error;
  }
  if (!picks || picks.length === 0) {
    logger.info('No eligible daily_picks found for final grading.');
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
            // SINGLE-WRITER-SEAL-011: Use RPC for unified_picks insert
            const rpcResult = await insertUnifiedPickViaRPC({
              ...pick,
              legs: pick.legs,
              leg_results: legResults,
              ticket_score: ticketScore,
              promoted_at: new Date().toISOString()
            });

            if (rpcResult.success) {
              await supabase.from('daily_picks').update({
                promoted_to_final: true,
                promoted_final_at: new Date().toISOString()
              }).eq('id', pick.id);

              promotedCount++;
              logger.info({ id: pick.id, type: pick.bet_type, idempotent: rpcResult.idempotent }, 'Multi-leg bet promoted via RPC');
            } else {
              logger.error({ id: pick.id, error: rpcResult.error }, 'Failed to promote multi-leg bet via RPC');
            }
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
        // SINGLE-WRITER-SEAL-011: Use RPC for unified_picks insert
        const rpcResult = await insertUnifiedPickViaRPC({
          ...pick,
          ...grade,
          promoted_at: new Date().toISOString()
        });

        if (rpcResult.success) {
          await supabase.from('daily_picks').update({
            promoted_to_final: true,
            promoted_final_at: new Date().toISOString()
          }).eq('id', pick.id);

          promotedCount++;
          logger.info({ id: pick.id, player: pick.player_name, tier: grade.tier, idempotent: rpcResult.idempotent }, 'Promoted via RPC');
        } else {
          logger.error({ id: pick.id, error: rpcResult.error }, 'Failed to promote single pick via RPC');
        }
      } else {
        logger.info({ id: pick.id, player: pick.player_name, tier: grade.tier }, 'Not promoted to unified_picks');
      }
    } catch (err) {
      logger.error({ id: pick.id }, 'Grading error: ', err);
    }
  }

  logger.info(`Final promotion complete: ${promotedCount} picks promoted to unified_picks.`);
}
