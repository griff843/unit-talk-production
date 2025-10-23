"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoteToDailyPicks = promoteToDailyPicks;
const logging_1 = require("../../services/logging");
const supabaseClient_1 = require("../../services/supabaseClient");
const applyScoringLogic_1 = require("../ScoringAgent/scoring/applyScoringLogic");
async function promoteToDailyPicks() {
    // 1. Fetch eligible raw_props
    const { data: rawProps, error } = await supabaseClient_1.supabase
        .from('raw_props')
        .select('*')
        .eq('promoted', false)
        .eq('is_valid', true);
    if (error) {
        logging_1.logger.error(error, 'Error fetching raw_props');
        throw error;
    }
    if (!rawProps || rawProps.length === 0) {
        logging_1.logger.info('No eligible raw_props found for promotion.');
        return;
    }
    let promotedCount = 0;
    for (const prop of rawProps) {
        // 2. Score the prop
        const scored = (0, applyScoringLogic_1.applyScoringLogic)(prop);
        // 3. Decide if it qualifies (e.g. S, A, B only; skip C)
        if (['S', 'A', 'B'].includes(scored.tier)) {
            // 4. Insert into unified_picks (replaces daily_picks)
            const { error: insertErr } = await supabaseClient_1.supabase
                .from('unified_picks')
                .insert([scored]);
            if (insertErr) {
                logging_1.logger.error(insertErr, `Insert to daily_picks failed for prop_id=${prop.id}`);
                continue;
            }
            promotedCount++;
            // 5. Mark as promoted in raw_props
            await supabaseClient_1.supabase
                .from('raw_props')
                .update({ promoted: true, promoted_at: new Date().toISOString() })
                .eq('id', prop.id);
            logging_1.logger.info({ id: prop.id, player: prop.player_name, tier: scored.tier }, 'Promoted to unified_picks');
        }
        else {
            logging_1.logger.info({ id: prop.id, player: prop.player_name, tier: scored.tier }, 'Not promoted (Tier C)');
        }
    }
    logging_1.logger.info(`Promotion complete: ${promotedCount} props promoted to unified_picks.`);
}
