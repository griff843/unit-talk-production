"use strict";
/**
 * Optimized Database Insertion Helpers
 * Handles schema cache issues with split insertion approach
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertProfessionalPick = insertProfessionalPick;
exports.insertCLVTracking = insertCLVTracking;
// Optimized Professional Pick Insertion
async function insertProfessionalPick(supabase, pick) {
    // Split into base and professional data
    const baseData = {
        player_name: pick.player_name,
        stat_type: pick.stat_type,
        line: pick.line,
        sport: pick.sport,
        team: pick.team,
        opponent: pick.opponent,
        tier: pick.tier,
        created_at: pick.created_at || new Date().toISOString()
    };
    // Insert base record first
    const { data: inserted, error: insertError } = await supabase
        .from('unified_picks')
        .insert([baseData])
        .select('id')
        .single();
    if (insertError) {
        throw new Error(`Failed to insert base pick: ${insertError.message}`);
    }
    // Update with professional data if available
    if (pick.professional_score !== undefined) {
        const professionalData = {};
        if (pick.professional_score !== undefined)
            professionalData.professional_score = pick.professional_score;
        if (pick.devigged_edge !== undefined)
            professionalData.devigged_edge = pick.devigged_edge;
        if (pick.clv_tracking_id !== undefined)
            professionalData.clv_tracking_id = pick.clv_tracking_id;
        if (pick.kelly_fraction !== undefined)
            professionalData.kelly_fraction = pick.kelly_fraction;
        if (pick.processing_time !== undefined)
            professionalData.processing_time = pick.processing_time;
        if (pick.published !== undefined)
            professionalData.published = pick.auto_approved;
        if (pick.feature_contributions !== undefined)
            professionalData.feature_contributions = pick.feature_contributions;
        const { error: updateError } = await supabase
            .from('unified_picks')
            .update(professionalData)
            .eq('id', inserted.id);
        if (updateError) {
            console.warn(`Professional data update warning: ${updateError.message}`);
        }
    }
    return inserted.id;
}
// Optimized CLV Tracking Insertion
async function insertCLVTracking(supabase, clvData) {
    const baseData = {
        id: clvData.id || crypto.randomUUID(),
        propId: clvData.propId,
        sport: clvData.sport,
        market: clvData.market,
        book: clvData.book,
        openingLine: clvData.openingLine,
        openingOdds: clvData.openingOdds,
        created_at: clvData.created_at || new Date().toISOString()
    };
    const { data, error } = await supabase
        .from('clv_tracking')
        .insert([baseData])
        .select('id')
        .single();
    if (error) {
        throw new Error(`Failed to insert CLV tracking: ${error.message}`);
    }
    return data.id;
}
