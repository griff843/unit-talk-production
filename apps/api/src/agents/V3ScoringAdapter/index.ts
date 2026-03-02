/* eslint-disable max-lines */
/**
 * V3ScoringAdapter - Canonical V3 Scoring Ingestion
 *
 * Sprint: SPRINT-CANONICAL-V3-AGENTS-076
 * Updated: DATA-MOAT-V3-INTEGRATION-001 (2026-02-28) - Added feature hash
 * Updated: INTELLIGENCE-PROBABILITY-INTEGRATION-002 (2026-03-01) - Added probability layer
 *
 * Reads newly-submitted ticket_legs from V3 schema, scores them, and writes
 * to scored_legs via score_ticket_legs_v3 RPC. Parallel to legacy GradingAgent.
 *
 * Flow:
 * 1. Query unscored ticket_legs
 * 2. Build feature vectors from effective_value
 * 3. Compute feature_vector_hash for reproducibility (DATA-MOAT)
 * 4. Score via TierScale logic
 * 5. Compute probability primitives (P_final, uncertainty, edge, CLV forecast)
 * 6. Batch write via score_ticket_legs_v3 RPC
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { computeFeatureVectorHash } from '../../lib/featureHash';
import {
  computeProbabilityLayer,
  fetchBookOffers,
  MIN_BOOKS_FOR_CONSENSUS,
  type ProbabilityInput,
  type ProbabilityOutputOk as _ProbabilityOutputOk,
  type ProbabilityOutputFail,
} from '../../lib/probability';
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
  // INTELLIGENCE-PROBABILITY-INTEGRATION-002: Additional fields for probability
  sport?: string;
  market_key?: string;
  event_start_time?: string | null;
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
  // DATA-MOAT-V3-INTEGRATION-001: Feature vector hash for reproducibility
  feature_vector_hash?: string;
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
  // INTELLIGENCE-PROBABILITY-INTEGRATION-002: Probability primitives
  p_final: number | null;
  uncertainty_final: number | null;
  edge_final: number | null;
  clv_forecast: number | null;
  p_market_devig: number | null;
  devig_method: string | null;
  consensus_weights_json: Record<string, unknown> | null;
  probability_model_version: string | null;
  books_used: number | null;
  probability_fail_reason: string | null;
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
 * Query unscored ticket_legs with joined event/market data for probability
 * INTELLIGENCE-PROBABILITY-INTEGRATION-002: Enhanced to fetch sport, market_key, event_start_time
 */
// eslint-disable-next-line max-lines-per-function
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
    // RPC might not exist yet - fall back to direct query with joins
    // Note: Supabase client supports nested selects for joins
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
        created_at,
        canonical_events:event_id (
          sport,
          start_time
        ),
        market_types:market_type_id (
          market_key
        )
      `
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fallbackError) {
      throw new Error(`Failed to query unscored legs: ${fallbackError.message}`);
    }

    // Map fallback data to include sport, market_key, event_start_time
    return (fallbackData || []).map((row: Record<string, unknown>) => {
      const event = row.canonical_events as { sport?: string; start_time?: string } | null;
      const marketType = row.market_types as { market_key?: string } | null;
      return {
        id: row.id as string,
        ticket_id: row.ticket_id as string,
        leg_index: row.leg_index as number,
        event_id: row.event_id as string,
        market_type_id: row.market_type_id as number | null,
        participant_id: row.participant_id as string | null,
        selection: row.selection as string,
        provider_line: row.provider_line as number | null,
        provider_odds: row.provider_odds as number | null,
        effective_value: row.effective_value as Record<string, unknown> | null,
        created_at: row.created_at as string,
        sport: event?.sport ?? undefined,
        market_key: marketType?.market_key ?? undefined,
        event_start_time: event?.start_time ?? null,
      };
    });
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

/** Probability result to merge with scoring output */
interface ProbabilityResult {
  p_final: number | null;
  uncertainty_final: number | null;
  edge_final: number | null;
  clv_forecast: number | null;
  p_market_devig: number | null;
  devig_method: string | null;
  consensus_weights_json: Record<string, unknown> | null;
  probability_model_version: string | null;
  books_used: number | null;
  probability_fail_reason: string | null;
}

/**
 * Score a leg based on feature vector
 * INTELLIGENCE-PROBABILITY-INTEGRATION-002: Now accepts optional probability result
 */
// eslint-disable-next-line complexity
function scoreLeg(features: FeatureVector, probability?: ProbabilityResult): ScoringOutput {
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
    // INTELLIGENCE-PROBABILITY-INTEGRATION-002: Include probability primitives
    p_final: probability?.p_final ?? null,
    uncertainty_final: probability?.uncertainty_final ?? null,
    edge_final: probability?.edge_final ?? null,
    clv_forecast: probability?.clv_forecast ?? null,
    p_market_devig: probability?.p_market_devig ?? null,
    devig_method: probability?.devig_method ?? null,
    consensus_weights_json: probability?.consensus_weights_json ?? null,
    probability_model_version: probability?.probability_model_version ?? null,
    books_used: probability?.books_used ?? null,
    probability_fail_reason: probability?.probability_fail_reason ?? null,
  };
}

/**
 * Compute hours until event start (null if unknown)
 */
function computeHoursToStart(eventStartTime: string | null | undefined): number | null {
  if (!eventStartTime) return null;
  try {
    const startTime = new Date(eventStartTime).getTime();
    const now = Date.now();
    if (startTime <= now) return 0;
    return Math.max(0, (startTime - now) / (1000 * 60 * 60));
  } catch {
    return null;
  }
}

/**
 * Compute probability primitives for a leg
 * FAIL-CLOSED: Returns null probability result if cannot compute
 */
// eslint-disable-next-line max-lines-per-function, complexity
async function computeProbabilityForLeg(
  supabase: SupabaseClient,
  leg: UnscoredLeg,
  confidenceScore: number
): Promise<ProbabilityResult> {
  // Validate required fields for probability computation
  if (!leg.market_type_id) {
    return {
      p_final: null,
      uncertainty_final: null,
      edge_final: null,
      clv_forecast: null,
      p_market_devig: null,
      devig_method: null,
      consensus_weights_json: null,
      probability_model_version: null,
      books_used: null,
      probability_fail_reason: 'MISSING_MARKET_TYPE_ID',
    };
  }

  // Fetch book offers from DB
  const bookOffers = await fetchBookOffers(supabase, {
    eventId: leg.event_id,
    marketTypeId: leg.market_type_id,
    participantId: leg.participant_id,
    maxAgeHours: 24,
  });

  // FAIL-CLOSED: Check minimum books requirement
  if (bookOffers.length < MIN_BOOKS_FOR_CONSENSUS) {
    return {
      p_final: null,
      uncertainty_final: null,
      edge_final: null,
      clv_forecast: null,
      p_market_devig: null,
      devig_method: null,
      consensus_weights_json: null,
      probability_model_version: null,
      books_used: bookOffers.length,
      probability_fail_reason: `INSUFFICIENT_BOOKS:${bookOffers.length}<${MIN_BOOKS_FOR_CONSENSUS}`,
    };
  }

  // Map selection to side
  const side: 'over' | 'under' | 'yes' | 'no' =
    leg.selection === 'over' || leg.selection === 'yes'
      ? leg.selection
      : leg.selection === 'under' || leg.selection === 'no'
        ? leg.selection
        : 'over'; // Default to over for spread/other selections

  // Build probability input
  const probInput: ProbabilityInput = {
    confidenceScore: confidenceScore * 10, // Convert 0-1 to 0-10 scale
    bookOffers,
    side,
    entryOdds: leg.provider_odds ?? -110, // Default to -110 if no odds
    sport: leg.sport || 'UNKNOWN',
    marketType: leg.market_key || 'unknown',
    hoursToStart: computeHoursToStart(leg.event_start_time),
    featureCompleteness: 0.8, // Default feature completeness
  };

  // Compute probability layer
  const probOutput = computeProbabilityLayer(probInput);

  // Handle fail-closed result
  if (!probOutput.ok) {
    // TypeScript narrow: probOutput is ProbabilityOutputFail
    const probFail = probOutput as ProbabilityOutputFail;
    return {
      p_final: null,
      uncertainty_final: null,
      edge_final: null,
      clv_forecast: null,
      p_market_devig: null,
      devig_method: null,
      consensus_weights_json: null,
      probability_model_version: null,
      books_used: bookOffers.length,
      probability_fail_reason: `${probFail.reason}:${probFail.reasonDetail}`,
    };
  }

  // TypeScript narrow: probOutput is ProbabilityOutputOk
  const probOk = probOutput;
  return {
    p_final: probOk.pFinal,
    uncertainty_final: probOk.uncertaintyFinal,
    edge_final: probOk.edgeFinal,
    clv_forecast: probOk.clvForecast,
    p_market_devig: probOk.pMarketDevig,
    devig_method: probOk.devigMethod,
    consensus_weights_json: probOk.consensusWeightsJson,
    probability_model_version: probOk.probabilityModelVersion,
    books_used: probOk.booksUsed,
    probability_fail_reason: null,
  };
}

/**
 * Score ticket_legs via score_ticket_legs_v3 RPC
 * INTELLIGENCE-PROBABILITY-INTEGRATION-002: Now includes probability computation
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

    // Compute base confidence score for probability layer input
    const compositeScore = (features.odds_score + features.line_score + features.market_score) / 3;
    const confidence = Math.min(0.95, Math.max(0.3, compositeScore / 100));

    // INTELLIGENCE-PROBABILITY-INTEGRATION-002: Compute probability primitives
    const probability = await computeProbabilityForLeg(supabase, leg, confidence);

    // Score with probability
    const score = scoreLeg(features, probability);

    // DATA-MOAT-V3-INTEGRATION-001: Compute deterministic hash for reproducibility
    const featureHash = computeFeatureVectorHash(features as Record<string, unknown>);
    const featuresWithHash = { ...features, feature_vector_hash: featureHash };

    legIds.push(leg.id);
    featureVectors.push(featuresWithHash);
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
