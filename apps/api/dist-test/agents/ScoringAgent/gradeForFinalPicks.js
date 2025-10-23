"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreAndPromoteUnifiedPicks = scoreAndPromoteUnifiedPicks;
const logging_1 = require("../../services/logging");
const supabaseClient_1 = require("../../services/supabaseClient");
const edgeScore_1 = require("./scoring/edgeScore");
async function scoreAndPromoteUnifiedPicks() {
    // Fetch all eligible daily picks that have NOT been promoted
    const { data: picks, error } = await supabaseClient_1.supabase
        .from('unified_picks')
        .select('*')
        .eq('promoted_to_final', false)
        .eq('is_valid', true);
    if (error) {
        logging_1.logger.error(error, 'Error fetching unified_picks');
        throw error;
    }
    if (!picks || picks.length === 0) {
        logging_1.logger.info('No eligible unified_picks found for final scoring.');
        return;
    }
    let promotedCount = 0;
    for (const pick of picks) {
        try {
            // --- Multi-leg logic for Parlay, Teaser, Round Robin ---
            if (pick.is_parlay || pick.is_teaser || pick.is_rr ||
                ['parlay', 'teaser', 'roundrobin', 'sgp'].includes((pick.bet_type || '').toLowerCase())) {
                if (Array.isArray(pick.legs) && pick.legs.length > 1) {
                    const legResults = pick.legs.map((leg) => (0, edgeScore_1.scorePick)(leg));
                    const allLegsQualified = legResults.every((result) => ['S', 'A'].includes(result.tier));
                    const ticketScore = Math.round(legResults.reduce((acc, cur) => acc + (cur.professional_score ?? 0), 0) / legResults.length);
                    if (allLegsQualified) {
                        await supabaseClient_1.supabase.from('unified_picks').insert([{
                                ...pick,
                                legs: pick.legs,
                                legResults,
                                ticketScore,
                                promoted_at: new Date().toISOString(),
                            }]);
                        await supabaseClient_1.supabase.from('unified_picks').update({
                            promoted_to_final: true,
                            promoted_final_at: new Date().toISOString()
                        }).eq('id', pick.id);
                        promotedCount++;
                        logging_1.logger.info({ id: pick.id, type: pick.bet_type }, 'Multi-leg bet promoted to unified_picks');
                    }
                    else {
                        logging_1.logger.info({ id: pick.id, type: pick.bet_type }, 'Multi-leg bet not promoted (one or more legs below threshold)');
                    }
                    continue;
                }
                logging_1.logger.warn({ id: pick.id, type: pick.bet_type }, 'Multi-leg bet missing legs array, skipping');
                continue;
            }
            // --- Single bet logic ---
            const score = await (0, edgeScore_1.scorePick)(pick);
            if (['S', 'A'].includes(score.tier)) {
                await supabaseClient_1.supabase.from('unified_picks').insert([{
                        ...pick,
                        ...score,
                        promoted_at: new Date().toISOString(),
                    }]);
                await supabaseClient_1.supabase.from('unified_picks').update({
                    promoted_to_final: true,
                    promoted_final_at: new Date().toISOString()
                }).eq('id', pick.id);
                promotedCount++;
                logging_1.logger.info({ id: pick.id, player: pick.player_name, tier: score.tier }, 'Promoted to unified_picks');
            }
            else {
                logging_1.logger.info({ id: pick.id, player: pick.player_name, tier: score.tier }, 'Not promoted to unified_picks');
            }
        }
        catch (err) {
            logging_1.logger.error({ id: pick.id }, 'Scoring error: ', err);
        }
    }
    logging_1.logger.info(`Final promotion complete: ${promotedCount} picks promoted to unified_picks.`);
}
