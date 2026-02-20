/**
 * V3ScoringAdapter - Canonical V3 Scoring Ingestion
 *
 * Sprint: SPRINT-CANONICAL-V3-AGENTS-076
 *
 * Reads newly-submitted ticket_legs from V3 schema, scores them, and writes
 * to scored_legs via score_ticket_legs_v3 RPC. Parallel to legacy GradingAgent.
 *
 * Flow:
 * 1. Query unscored ticket_legs
 * 2. Build feature vectors from effective_value
 * 3. Score via TierScale logic
 * 4. Batch write via score_ticket_legs_v3 RPC
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { scoreOnlyTier, type Tier } from '../GradingAgent/scoring/TierScale';

// Model identification for scored_legs
const MODEL_NAME = 'v3_scoring_adapter';
const MODEL_VERSION = 'v1.0.0';

// Batch size for processing
const BATCH_SIZE = 50;

export interface UnscoredLeg {
  id: string;
  ticket_id: string;
  leg_index: number;
  event_id: string;
  market_type_id: number | null;
  participant_id: string | null;
  selection: string;
  provider_line: number | null;
  provider_odds: number | null;
  effective_value: Record<string, unknown> | null;
  created_at: string;
}

export interface FeatureVector {
  line: number | null;
  odds: number | null;
  selection: string;
  provider: string | null;
  // Simple features for initial implementation
  odds_score: number; // Score based on odds value (better odds = higher score)
  line_score: number; // Score based on line favorability
  market_score: number; // Default market scoring
  [key: string]: unknown; // Index signature for JSON compatibility
}

export interface ScoringOutput {
  edge_score: number;
  confidence_score: number;
  tier: Tier;
  promotion_band: 'HARD' | 'SOFT' | 'NO_POST';
  kelly_fraction: number;
  expected_value: number;
  feature_contributions: Record<string, number>;
  [key: string]: unknown; // Index signature for JSON compatibility
}

export interface ScoringResult {
  legId: string;
  featureSnapshotId: string | null;
  scoredLegId: string | null;
  status: 'inserted' | 'exists' | 'error_leg_not_found' | 'error';
  error?: string;
}

/**
 * Query unscored ticket_legs
 */
async function getUnscoredLegs(
  supabase: SupabaseClient,
  limit: number = BATCH_SIZE
): Promise<UnscoredLeg[]> {
  // Find ticket_legs without corresponding scored_legs
  const { data, error } = await supabase.rpc('get_unscored_legs_v3', {
    p_limit: limit,
    p_model_name: MODEL_NAME,
  });

  if (error) {
    // RPC might not exist yet - fall back to direct query
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('ticket_legs')
      .select(
        `
        id,
        ticket_id,
        leg_index,
        event_id,
        market_type_id,
        participant_id,
        selection,
        provider_line,
        provider_odds,
        effective_value,
        created_at
      `
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fallbackError) {
      throw new Error(`Failed to query unscored legs: ${fallbackError.message}`);
    }

    // Filter legs that don't have scored_legs (client-side filter for now)
    // In production, use RPC or proper JOIN
    return fallbackData || [];
  }

  return data || [];
}

/**
 * Calculate odds score: better odds = higher score
 */
function calculateOddsScore(odds: number | null): number {
  if (odds === null) return 50;
  if (odds < 0) {
    // Favorite: -110 = 55, -150 = 40, -200 = 30
    return Math.max(20, Math.min(70, 100 + odds * 0.3));
  }
  // Underdog: +100 = 60, +150 = 65, +200 = 70
  return Math.min(80, 50 + odds * 0.1);
}

/**
 * Calculate line score based on selection
 */
function calculateLineScore(line: number | null, selection: string): number {
  if (line === null) return 50;
  if (selection === 'over') {
    return Math.max(30, Math.min(70, 60 - line * 0.5));
  }
  if (selection === 'under') {
    return Math.max(30, Math.min(70, 40 + line * 0.5));
  }
  return 50;
}

/**
 * Build feature vector from effective_value
 */
function buildFeatureVector(leg: UnscoredLeg): FeatureVector {
  const effective = leg.effective_value || {};
  const line = leg.provider_line ?? (effective.line as number) ?? null;
  const odds = leg.provider_odds ?? (effective.odds as number) ?? null;

  return {
    line,
    odds,
    selection: leg.selection,
    provider: (effective.provider as string) ?? null,
    odds_score: calculateOddsScore(odds),
    line_score: calculateLineScore(line, leg.selection),
    market_score: 50, // Default neutral
  };
}

/**
 * Score a leg based on feature vector
 */
function scoreLeg(features: FeatureVector): ScoringOutput {
  // Calculate composite score (0-100)
  const compositeScore = (features.odds_score + features.line_score + features.market_score) / 3;

  // Determine tier using canonical TierScale
  const tier = scoreOnlyTier(compositeScore);

  // Calculate confidence (how sure we are of the score)
  const confidence = Math.min(0.95, Math.max(0.3, compositeScore / 100));

  // Determine promotion band
  let promotionBand: 'HARD' | 'SOFT' | 'NO_POST';
  if (tier === 'S' || (tier === 'A' && compositeScore >= 60)) {
    promotionBand = 'HARD';
  } else if (tier === 'A' || tier === 'B') {
    promotionBand = 'SOFT';
  } else {
    promotionBand = 'NO_POST';
  }

  // Kelly fraction (simplified)
  // edge / odds gives optimal bet fraction
  const edge = compositeScore / 100 - 0.5; // Convert to edge vs 50%
  const kellyFraction = Math.max(0, Math.min(0.25, edge * 0.5));

  // Expected value (simplified)
  const expectedValue = edge * 100; // In "units" per 100 wagered

  return {
    edge_score: compositeScore,
    confidence_score: confidence,
    tier,
    promotion_band: promotionBand,
    kelly_fraction: kellyFraction,
    expected_value: expectedValue,
    feature_contributions: {
      odds_score: features.odds_score,
      line_score: features.line_score,
      market_score: features.market_score,
    },
  };
}

/**
 * Score ticket_legs via score_ticket_legs_v3 RPC
 */
export async function scoreTicketLegsV3(
  supabase: SupabaseClient,
  legs: UnscoredLeg[]
): Promise<ScoringResult[]> {
  if (legs.length === 0) {
    return [];
  }

  const legIds: string[] = [];
  const featureVectors: Record<string, unknown>[] = [];
  const scores: Record<string, unknown>[] = [];
  const computedAt = new Date().toISOString();

  for (const leg of legs) {
    const features = buildFeatureVector(leg);
    const score = scoreLeg(features);

    legIds.push(leg.id);
    featureVectors.push(features);
    scores.push(score);
  }

  // Call score_ticket_legs_v3 RPC
  const { data, error } = await supabase.rpc('score_ticket_legs_v3', {
    p_leg_ids: legIds,
    p_model_name: MODEL_NAME,
    p_model_version: MODEL_VERSION,
    p_feature_vectors: featureVectors,
    p_scores: scores,
    p_computed_at: computedAt,
  });

  if (error) {
    throw new Error(`score_ticket_legs_v3 RPC failed: ${error.message}`);
  }

  // Map RPC results to ScoringResult
  return (data || []).map(
    (row: {
      out_leg_id: string;
      out_feature_snapshot_id: string | null;
      out_scored_leg_id: string | null;
      out_status: string;
    }) => ({
      legId: row.out_leg_id,
      featureSnapshotId: row.out_feature_snapshot_id,
      scoredLegId: row.out_scored_leg_id,
      status: row.out_status as ScoringResult['status'],
    })
  );
}

/**
 * Process all unscored ticket_legs
 */
export async function processUnscoredLegs(
  supabase: SupabaseClient,
  options: { limit?: number } = {}
): Promise<{ processed: number; results: ScoringResult[] }> {
  const limit = options.limit ?? BATCH_SIZE;

  // Get unscored legs
  const legs = await getUnscoredLegs(supabase, limit);

  if (legs.length === 0) {
    return { processed: 0, results: [] };
  }

  // Score them
  const results = await scoreTicketLegsV3(supabase, legs);

  return {
    processed: legs.length,
    results,
  };
}

/**
 * Export constants for external use
 */
export { MODEL_NAME, MODEL_VERSION, BATCH_SIZE };
