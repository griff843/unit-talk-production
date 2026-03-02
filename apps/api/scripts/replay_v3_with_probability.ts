/**
 * UNCERTAINTY-TRUTH-RESTORATION-002
 * Replay V3 Scoring with Production Probability Layer
 *
 * This script replaces the .mjs version that used a simplistic uncertainty formula.
 * It now uses the production computeProbabilityLayer() function for TRUE uncertainty computation.
 *
 * KEY CHANGES from .mjs version:
 * - REMOVED: `const uncertainty = 1 / Math.sqrt(consensus.books_used)` (simplistic)
 * - ADDED: Production `computeProbabilityLayer()` with multi-factor uncertainty
 *
 * Production uncertainty factors:
 * - booksAvailable (weight 0.30)
 * - bookSpread (weight 0.25)
 * - dataQualityScore (weight 0.20)
 * - hoursToStart (weight 0.15)
 * - featureCompleteness (weight 0.10)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../../.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  computeProbabilityLayer,
  fetchBookOffers,
  MIN_BOOKS_FOR_CONSENSUS,
  type ProbabilityInput,
  type ProbabilityOutputOk,
  type ProbabilityOutputFail,
} from '../src/lib/probability';

// Model identification
const MODEL_NAME = 'v3_scoring_adapter';
const MODEL_VERSION = 'v1.0.0';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface TicketLeg {
  id: string;
  ticket_id: string;
  event_id: string | null;
  market_type_id: number | null;
  participant_id: string | null;
  selection: string;
  provider_line: number | null;
  provider_odds: number | null;
  effective_value: Record<string, unknown> | null;
  created_at: string;
  sport?: string;
  market_key?: string;
  event_start_time?: string | null;
}

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

interface FeatureVector {
  line: number | null;
  odds: number | null;
  selection: string;
  provider: string | null;
  feature_vector_hash?: string;
}

interface ScoringOutput {
  edge_score: number;
  confidence_score: number;
  tier: string;
  promotion_band: string;
  kelly_fraction: number;
  expected_value: number;
  feature_contributions: Record<string, number>;
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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
 * Compute feature hash (deterministic)
 */
function computeFeatureHash(features: Record<string, unknown>): string {
  const json = JSON.stringify(features, Object.keys(features).sort());
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash << 5) - hash + json.charCodeAt(i);
    hash = hash & hash;
  }
  return `fv_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Calculate odds score: better odds = higher score
 */
function calculateOddsScore(odds: number | null): number {
  if (odds === null) return 50;
  if (odds < 0) {
    return Math.max(20, Math.min(70, 100 + odds * 0.3));
  }
  return Math.min(80, 50 + odds * 0.1);
}

// =============================================================================
// PROBABILITY COMPUTATION - PRODUCTION LAYER
// =============================================================================

/**
 * Compute probability primitives for a leg using PRODUCTION computeProbabilityLayer()
 *
 * CRITICAL: This replaces the simplistic `1 / Math.sqrt(books_used)` formula.
 * Now uses multi-factor uncertainty computation from probabilityLayer.ts
 */
async function computeProbabilityForLeg(leg: TicketLeg): Promise<ProbabilityResult> {
  // Validate required fields
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

  if (!leg.event_id) {
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
      probability_fail_reason: 'MISSING_EVENT_ID',
    };
  }

  // Fetch book offers from DB using PRODUCTION fetchBookOffers()
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
        : 'over'; // Default for spread/other

  // Build confidence score from odds (0-10 scale for probability layer)
  const oddsScore = calculateOddsScore(leg.provider_odds);
  const confidenceScore = Math.min(10, Math.max(0, (oddsScore / 100) * 10));

  // Build PRODUCTION probability input
  const probInput: ProbabilityInput = {
    confidenceScore,
    bookOffers,
    side,
    entryOdds: leg.provider_odds ?? -110,
    sport: leg.sport || 'UNKNOWN',
    marketType: leg.market_key || 'unknown',
    hoursToStart: computeHoursToStart(leg.event_start_time),
    featureCompleteness: 0.8, // Default feature completeness
  };

  // Call PRODUCTION computeProbabilityLayer() - multi-factor uncertainty!
  const probOutput = computeProbabilityLayer(probInput);

  // Handle fail-closed result
  if (!probOutput.ok) {
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

  // SUCCESS: Extract production-computed values
  const probOk = probOutput as ProbabilityOutputOk;
  return {
    p_final: probOk.pFinal,
    uncertainty_final: probOk.uncertaintyFinal, // TRUE multi-factor uncertainty!
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

// =============================================================================
// FEATURE & SCORING FUNCTIONS
// =============================================================================

/**
 * Build feature vector from leg
 */
function buildFeatureVector(leg: TicketLeg): FeatureVector {
  const effective = leg.effective_value || {};
  const line = leg.provider_line ?? (effective.line as number) ?? null;
  const odds = leg.provider_odds ?? (effective.odds as number) ?? null;

  return {
    line,
    odds,
    selection: leg.selection,
    provider: (effective.provider as string) ?? null,
  };
}

/**
 * Score leg based on features and probability
 */
function scoreLeg(features: FeatureVector, probability: ProbabilityResult): ScoringOutput {
  const odds = features.odds ?? -110;
  const oddsScore = calculateOddsScore(odds);
  const compositeScore = oddsScore;

  let tier: string;
  if (compositeScore >= 75) tier = 'S';
  else if (compositeScore >= 60) tier = 'A';
  else if (compositeScore >= 45) tier = 'B';
  else if (compositeScore >= 30) tier = 'C';
  else tier = 'D';

  const confidence = Math.min(0.95, Math.max(0.3, compositeScore / 100));
  const promotionBand = tier === 'S' || tier === 'A' ? 'HARD' : tier === 'B' ? 'SOFT' : 'NO_POST';

  return {
    edge_score: compositeScore,
    confidence_score: confidence,
    tier,
    promotion_band: promotionBand,
    kelly_fraction: Math.max(0, (compositeScore / 100 - 0.5) * 0.5),
    expected_value: (compositeScore / 100 - 0.5) * 100,
    feature_contributions: { odds_score: oddsScore },
    // Probability primitives from PRODUCTION layer
    p_final: probability.p_final,
    uncertainty_final: probability.uncertainty_final,
    edge_final: probability.edge_final,
    clv_forecast: probability.clv_forecast,
    p_market_devig: probability.p_market_devig,
    devig_method: probability.devig_method,
    consensus_weights_json: probability.consensus_weights_json,
    probability_model_version: probability.probability_model_version,
    books_used: probability.books_used,
    probability_fail_reason: probability.probability_fail_reason,
  };
}

// =============================================================================
// MAIN REPLAY FUNCTION
// =============================================================================

async function runReplay(): Promise<{
  processed: number;
  withProbability: number;
  uncertaintySample: number[];
}> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  UNCERTAINTY-TRUTH-RESTORATION-002');
  console.log('  REPLAY V3 SCORING WITH PRODUCTION PROBABILITY LAYER');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Started:', new Date().toISOString());
  console.log('');
  console.log('Using PRODUCTION computeProbabilityLayer()');
  console.log(
    'Uncertainty factors: booksAvailable, bookSpread, dataQualityScore, hoursToStart, featureCompleteness'
  );
  console.log('');

  // Query legs with event_id and market_type_id
  // Note: We don't join canonical_events for start_time since it defaults to null
  // (uncertainty computation uses 0.1 weight for unknown time)
  const { data: rawLegs, error } = await supabase
    .from('ticket_legs')
    .select(
      `
      id,
      ticket_id,
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
    .not('event_id', 'is', null)
    .not('market_type_id', 'is', null)
    .limit(50);

  if (error) {
    throw new Error(`Failed to query ticket_legs: ${error.message}`);
  }

  // Map to TicketLeg type
  const legs: TicketLeg[] = (rawLegs || []).map((row: Record<string, unknown>) => {
    return {
      id: row.id as string,
      ticket_id: row.ticket_id as string,
      event_id: row.event_id as string,
      market_type_id: row.market_type_id as number | null,
      participant_id: row.participant_id as string | null,
      selection: row.selection as string,
      provider_line: row.provider_line as number | null,
      provider_odds: row.provider_odds as number | null,
      effective_value: row.effective_value as Record<string, unknown> | null,
      created_at: row.created_at as string,
      sport: undefined, // Not critical for uncertainty
      market_key: undefined, // Not critical for uncertainty
      event_start_time: null, // Uses default uncertainty weight (0.1)
    };
  });

  console.log(`Found ${legs.length} ticket_legs with event_id`);

  if (legs.length === 0) {
    console.log('No legs to process');
    return { processed: 0, withProbability: 0, uncertaintySample: [] };
  }

  // Process each leg
  const results: Array<{ legId: string; features: FeatureVector; score: ScoringOutput }> = [];
  let withProbability = 0;
  const uncertaintyValues: number[] = [];

  for (const leg of legs) {
    // Compute probability using PRODUCTION layer
    const probability = await computeProbabilityForLeg(leg);
    const features = buildFeatureVector(leg);
    const featureHash = computeFeatureHash(features as Record<string, unknown>);
    const score = scoreLeg(features, probability);

    console.log(`\n--- Leg ${leg.id.substring(0, 8)}... ---`);
    console.log(`   event_id: ${leg.event_id?.substring(0, 8) ?? 'null'}...`);
    console.log(`   market_type_id: ${leg.market_type_id}`);
    console.log(`   selection: ${leg.selection}`);
    console.log(`   books_used: ${probability.books_used ?? 0}`);
    console.log(`   p_final: ${probability.p_final?.toFixed(4) ?? 'null'}`);
    console.log(
      `   uncertainty_final: ${probability.uncertainty_final?.toFixed(4) ?? 'null'} (PRODUCTION)`
    );
    console.log(`   edge_final: ${probability.edge_final?.toFixed(4) ?? 'null'}`);
    console.log(`   fail_reason: ${probability.probability_fail_reason || 'none'}`);

    if (probability.p_final !== null) {
      withProbability++;
    }
    if (probability.uncertainty_final !== null) {
      uncertaintyValues.push(probability.uncertainty_final);
    }

    results.push({
      legId: leg.id,
      features: { ...features, feature_vector_hash: featureHash },
      score,
    });
  }

  // Update scored_legs via direct upsert
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  UPDATING SCORED_LEGS');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const r of results) {
    const { error: upsertErr } = await supabase.from('scored_legs').upsert(
      {
        leg_id: r.legId,
        model_name: MODEL_NAME,
        model_version: MODEL_VERSION,
        feature_vector: r.features,
        computed_at: new Date().toISOString(),
        edge_score: r.score.edge_score,
        confidence_score: r.score.confidence_score,
        tier: r.score.tier,
        promotion_band: r.score.promotion_band,
        kelly_fraction: r.score.kelly_fraction,
        expected_value: r.score.expected_value,
        p_final: r.score.p_final,
        p_market_devig: r.score.p_market_devig,
        uncertainty_final: r.score.uncertainty_final,
        edge_final: r.score.edge_final,
        clv_forecast: r.score.clv_forecast,
        devig_method: r.score.devig_method,
        books_used: r.score.books_used,
        probability_fail_reason: r.score.probability_fail_reason,
      },
      { onConflict: 'leg_id,model_name' }
    );

    if (upsertErr) {
      console.log(`   ⚠ Upsert error for ${r.legId.substring(0, 8)}: ${upsertErr.message}`);
    }
  }

  // Verification
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');

  const { count: scoredCount } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true });
  const { count: withProbCount } = await supabase
    .from('scored_legs')
    .select('*', { count: 'exact', head: true })
    .not('p_final', 'is', null);

  console.log(`\nTotal scored_legs: ${scoredCount}`);
  console.log(`With p_final (non-null): ${withProbCount}`);

  // Uncertainty distribution analysis
  console.log('\n--- UNCERTAINTY DISTRIBUTION (PRODUCTION) ---');
  if (uncertaintyValues.length > 0) {
    const min = Math.min(...uncertaintyValues);
    const max = Math.max(...uncertaintyValues);
    const avg = uncertaintyValues.reduce((a, b) => a + b, 0) / uncertaintyValues.length;
    console.log(`   Count: ${uncertaintyValues.length}`);
    console.log(`   Min: ${min.toFixed(4)} (${(min * 100).toFixed(1)}%)`);
    console.log(`   Max: ${max.toFixed(4)} (${(max * 100).toFixed(1)}%)`);
    console.log(`   Avg: ${avg.toFixed(4)} (${(avg * 100).toFixed(1)}%)`);

    // Check CCC gate compliance
    const U_MAX = 0.2;
    const passingGate = uncertaintyValues.filter(u => u <= U_MAX).length;
    const failingGate = uncertaintyValues.filter(u => u > U_MAX).length;
    console.log(`\n--- CCC GATE ANALYSIS (U_MAX = ${(U_MAX * 100).toFixed(0)}%) ---`);
    console.log(`   Passing HIGH_UNCERTAINTY gate: ${passingGate}/${uncertaintyValues.length}`);
    console.log(`   Failing HIGH_UNCERTAINTY gate: ${failingGate}/${uncertaintyValues.length}`);
    console.log(
      `   Elimination rate: ${((failingGate / uncertaintyValues.length) * 100).toFixed(1)}%`
    );
  } else {
    console.log('   No uncertainty values computed (all fail-closed)');
  }

  // Sample scored_legs
  const { data: sample } = await supabase
    .from('scored_legs')
    .select(
      'leg_id, tier, p_final, edge_final, uncertainty_final, clv_forecast, books_used, probability_fail_reason'
    )
    .not('p_final', 'is', null)
    .limit(10);

  console.log(`\nSample scored_legs with probability:`);
  console.log(JSON.stringify(sample, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  REPLAY COMPLETE');
  console.log('  Using PRODUCTION computeProbabilityLayer() - TRUE UNCERTAINTY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  return { processed: legs.length, withProbability, uncertaintySample: uncertaintyValues };
}

// Run replay
runReplay()
  .then(result => {
    console.log('Final result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
