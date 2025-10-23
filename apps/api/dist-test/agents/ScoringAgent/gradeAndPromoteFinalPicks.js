"use strict";
// src/agents/ScoringAgent/scoreAndPromoteUnifiedPicks.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreAndPromoteUnifiedPicks = scoreAndPromoteUnifiedPicks;
const logging_1 = require("../../services/logging");
const supabaseClient_1 = require("../../services/supabaseClient");
const edgeScore_1 = require("./scoring/edgeScore");
async function scoreAndPromoteUnifiedPicks() {
    const { data: picks, error } = await supabaseClient_1.supabase
        .from('daily_picks')
        .select('*')
        .eq('promoted_to_final', false)
        .eq('is_valid', true);
    if (error) {
        logging_1.logger.error(error, 'Error fetching daily_picks');
        return;
    }
    if (!picks || picks.length === 0) {
        logging_1.logger.info('No eligible daily_picks found for final scoring.');
        return;
    }
    let promotedCount = 0;
    for (const pick of picks) {
        try {
            // Multi-leg support
            if (['parlay', 'teaser', 'roundrobin', 'sgp'].includes((pick.bet_type || '').toLowerCase())) {
                if (Array.isArray(pick.legs) && pick.legs.length > 1) {
                    const legResults = pick.legs.map(edgeScore_1.scorePick);
                    const allQualified = legResults.every((r) => ['S', 'A'].includes(r.tier));
                    const ticketScore = Math.round(legResults.reduce((sum, r) => sum + r.professional_score, 0) / legResults.length);
                    if (allQualified) {
                        await supabaseClient_1.supabase.from('unified_picks').insert([{
                                ...pick,
                                legs: pick.legs,
                                leg_results: legResults,
                                ticket_score: ticketScore,
                                promoted_at: new Date().toISOString()
                            }]);
                        await supabaseClient_1.supabase.from('daily_picks').update({
                            promoted_to_final: true,
                            promoted_final_at: new Date().toISOString()
                        }).eq('id', pick.id);
                        promotedCount++;
                        logging_1.logger.info({ id: pick.id, type: pick.bet_type }, 'Promoted multi-leg ticket');
                    }
                    continue;
                }
                logging_1.logger.warn({ id: pick.id }, 'Multi-leg ticket missing legs array');
                continue;
            }
            // Single-leg scoring
            const score = (0, edgeScore_1.scorePick)(pick);
            const overrideTier = pick.admin_override_tier || null;
            const shouldPromote = overrideTier ? ['S', 'A'].includes(overrideTier) : ['S', 'A'].includes(score.tier);
            if (shouldPromote) {
                await supabaseClient_1.supabase.from('unified_picks').insert([{
                        ...pick,
                        score: score.score,
                        tier: overrideTier || score.tier,
                        score_breakdown: score.breakdown || null,
                        promoted_at: new Date().toISOString()
                    }]);
                await supabaseClient_1.supabase.from('daily_picks').update({
                    promoted_to_final: true,
                    promoted_final_at: new Date().toISOString()
                }).eq('id', pick.id);
                promotedCount++;
                logging_1.logger.info({ id: pick.id, tier: score.tier }, 'Promoted single pick');
            }
            else {
                logging_1.logger.info({ id: pick.id, tier: score.tier }, 'Not promoted');
            }
        }
        catch (err) {
            logging_1.logger.error({ id: pick.id }, 'Scoring error:', err);
        }
    }
    logging_1.logger.info(`✅ Final promotion complete: ${promotedCount} picks promoted to unified_picks`);
}
