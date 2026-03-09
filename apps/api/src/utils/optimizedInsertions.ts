/**
 * Optimized Database Insertion Helpers
 * Handles schema cache issues with split insertion approach
 */

import { randomUUID } from 'crypto';

import { lifecycleInsert, lifecycleUpdate } from '../lib/lifecycle';

// Optimized Professional Pick Insertion
export async function insertProfessionalPick(supabase: any, pick: any) {
  // Split into base and professional data
  const id = pick.id || randomUUID();
  const baseData = {
    id,
    player_name: pick.player_name,
    stat_type: pick.stat_type,
    line: pick.line,
    sport: pick.sport,
    team: pick.team,
    opponent: pick.opponent,
    tier: pick.tier,
    created_at: pick.created_at || new Date().toISOString(),
  };

  // Insert base record first
  const insertResult = await lifecycleInsert(supabase, baseData, { writerRole: 'submitter' });

  if (!insertResult.success) {
    throw new Error(`Failed to insert base pick: ${insertResult.error}`);
  }

  const insertedId = insertResult.pickId!;

  // Update with professional data if available
  if (pick.professional_score !== undefined) {
    const professionalData: any = {};

    if (pick.professional_score !== undefined)
      professionalData.professional_score = pick.professional_score;
    if (pick.devigged_edge !== undefined) professionalData.devigged_edge = pick.devigged_edge;
    if (pick.clv_tracking_id !== undefined) professionalData.clv_tracking_id = pick.clv_tracking_id;
    if (pick.kelly_fraction !== undefined) professionalData.kelly_fraction = pick.kelly_fraction;
    if (pick.processing_time !== undefined) professionalData.processing_time = pick.processing_time;
    if (pick.published !== undefined) professionalData.published = pick.auto_approved;
    if (pick.feature_contributions !== undefined)
      professionalData.feature_contributions = pick.feature_contributions;

    const updateResult = await lifecycleUpdate(supabase, insertedId, professionalData, {
      writerRole: 'promoter',
      skipTransitionValidation: true,
    });

    if (!updateResult.success) {
      console.warn(`Professional data update warning: ${updateResult.error}`);
    }
  }

  return insertedId;
}

// Optimized CLV Tracking Insertion
export async function insertCLVTracking(supabase: any, clvData: any) {
  const baseData = {
    id: clvData.id || crypto.randomUUID(),
    propId: clvData.propId,
    sport: clvData.sport,
    market: clvData.market,
    book: clvData.book,
    openingLine: clvData.openingLine,
    openingOdds: clvData.openingOdds,
    created_at: clvData.created_at || new Date().toISOString(),
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
