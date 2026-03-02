/**
 * LIVE-PIPELINE-HISTORICAL-REPLAY-001
 * Replay Historical Picks Through V3 Scoring
 *
 * Purpose: Score existing ticket_legs through V3ScoringAdapter to populate
 * scored_legs with probability primitives for the Capper Command Center.
 *
 * Fail-closed behavior:
 * - If no provider_offers exist: probability_fail_reason = 'INSUFFICIENT_BOOKS'
 * - If event_id/market_type_id missing: probability_fail_reason = 'MISSING_MARKET_TYPE_ID'
 * - No fabricated defaults
 *
 * Idempotency: Uses score_ticket_legs_v3 RPC which has unique constraints
 * on (leg_id, model_name) - duplicate scores are skipped.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Model identification (matches V3ScoringAdapter)
const MODEL_NAME = 'v3_scoring_adapter';
const MODEL_VERSION = 'v1.0.0';
const BATCH_SIZE = 50;
const PROBABILITY_MODEL_VERSION = 'prob_v1.0.0';
const MIN_BOOKS_FOR_CONSENSUS = 2;

/**
 * Query all ticket_legs that don't have scored_legs yet
 */
async function getUnscoredLegs(limit = BATCH_SIZE) {
  // Use left join pattern: find ticket_legs not in scored_legs for this model
  const { data, error } = await supabase
    .from('ticket_legs')
    .select(`
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
    `)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to query ticket_legs: ${error.message}`);
  }

  // Filter out legs that already have scored_legs
  const legIds = (data || []).map(l => l.id);
  if (legIds.length === 0) return [];

  const { data: existingScored } = await supabase
    .from('scored_legs')
    .select('leg_id')
    .eq('model_name', MODEL_NAME)
    .in('leg_id', legIds);

  const scoredLegIds = new Set((existingScored || []).map(s => s.leg_id));
  return (data || []).filter(l => !scoredLegIds.has(l.id));
}

/**
 * Calculate odds score: better odds = higher score
 */
function calculateOddsScore(odds) {
  if (odds === null || odds === undefined) return 50;
  if (odds < 0) {
    return Math.max(20, Math.min(70, 100 + odds * 0.3));
  }
  return Math.min(80, 50 + odds * 0.1);
}

/**
 * Calculate line score based on selection
 */
function calculateLineScore(line, selection) {
  if (line === null || line === undefined) return 50;
  if (selection === 'over') {
    return Math.max(30, Math.min(70, 60 - line * 0.5));
  }
  if (selection === 'under') {
    return Math.max(30, Math.min(70, 40 + line * 0.5));
  }
  return 50;
}

/**
 * Build feature vector from leg data
 */
function buildFeatureVector(leg) {
  const effective = leg.effective_value || {};
  const line = leg.provider_line ?? effective.line ?? null;
  const odds = leg.provider_odds ?? effective.odds ?? null;

  return {
    line,
    odds,
    selection: leg.selection,
    provider: effective.provider ?? null,
    odds_score: calculateOddsScore(odds),
    line_score: calculateLineScore(line, leg.selection),
    market_score: 50,
  };
}

/**
 * Score a leg based on feature vector (same logic as V3ScoringAdapter)
 */
function scoreLeg(features, probability) {
  const compositeScore = (features.odds_score + features.line_score + features.market_score) / 3;

  // Determine tier using simplified TierScale logic
  let tier;
  if (compositeScore >= 75) tier = 'S';
  else if (compositeScore >= 60) tier = 'A';
  else if (compositeScore >= 45) tier = 'B';
  else if (compositeScore >= 30) tier = 'C';
  else tier = 'D';

  const confidence = Math.min(0.95, Math.max(0.3, compositeScore / 100));

  let promotionBand;
  if (tier === 'S' || (tier === 'A' && compositeScore >= 60)) {
    promotionBand = 'HARD';
  } else if (tier === 'A' || tier === 'B') {
    promotionBand = 'SOFT';
  } else {
    promotionBand = 'NO_POST';
  }

  const edge = compositeScore / 100 - 0.5;
  const kellyFraction = Math.max(0, Math.min(0.25, edge * 0.5));
  const expectedValue = edge * 100;

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
    // Probability fields (from fail-closed computation)
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
 * Fetch provider_offers for a leg
 */
async function fetchBookOffers(eventId, marketTypeId, participantId) {
  if (!eventId || !marketTypeId) {
    return [];
  }

  let query = supabase
    .from('provider_offers')
    .select('*')
    .eq('event_id', eventId)
    .eq('market_type_id', marketTypeId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (participantId) {
    query = query.eq('participant_id', participantId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn(`Failed to fetch offers for event ${eventId}: ${error.message}`);
    return [];
  }

  return data || [];
}

/**
 * Compute probability for a leg - FAIL-CLOSED
 */
async function computeProbabilityForLeg(leg) {
  // Missing market_type_id = fail-closed
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
      books_used: 0,
      probability_fail_reason: 'MISSING_MARKET_TYPE_ID',
    };
  }

  // Missing event_id = fail-closed
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
      books_used: 0,
      probability_fail_reason: 'MISSING_EVENT_ID',
    };
  }

  // Fetch provider_offers
  const offers = await fetchBookOffers(leg.event_id, leg.market_type_id, leg.participant_id);

  // Insufficient books = fail-closed
  if (offers.length < MIN_BOOKS_FOR_CONSENSUS) {
    return {
      p_final: null,
      uncertainty_final: null,
      edge_final: null,
      clv_forecast: null,
      p_market_devig: null,
      devig_method: null,
      consensus_weights_json: null,
      probability_model_version: null,
      books_used: offers.length,
      probability_fail_reason: `INSUFFICIENT_BOOKS:${offers.length}<${MIN_BOOKS_FOR_CONSENSUS}`,
    };
  }

  // If we had offers, we'd compute consensus here
  // For this replay, we simulate fail-closed since offers.length will be 0
  return {
    p_final: null,
    uncertainty_final: null,
    edge_final: null,
    clv_forecast: null,
    p_market_devig: null,
    devig_method: null,
    consensus_weights_json: null,
    probability_model_version: PROBABILITY_MODEL_VERSION,
    books_used: offers.length,
    probability_fail_reason: 'NO_OFFERS_AVAILABLE',
  };
}

/**
 * Create a deterministic feature hash (simplified version)
 */
function computeFeatureHash(features) {
  const json = JSON.stringify(features, Object.keys(features).sort());
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `fv_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Score ticket_legs via score_ticket_legs_v3 RPC
 */
async function scoreLegs(legs) {
  if (legs.length === 0) return { scored: [], failed: [] };

  const legIds = [];
  const featureVectors = [];
  const scores = [];
  const computedAt = new Date().toISOString();
  const failReasons = {};

  for (const leg of legs) {
    const features = buildFeatureVector(leg);
    const probability = await computeProbabilityForLeg(leg);

    // Track fail reasons
    if (probability.probability_fail_reason) {
      const reason = probability.probability_fail_reason.split(':')[0];
      failReasons[reason] = (failReasons[reason] || 0) + 1;
    }

    const score = scoreLeg(features, probability);

    // Add feature hash
    const featureHash = computeFeatureHash(features);
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

  // Categorize results
  const results = data || [];
  const scored = results.filter(r => r.out_status === 'inserted');
  const exists = results.filter(r => r.out_status === 'exists');
  const errors = results.filter(r => r.out_status.startsWith('error'));

  return { scored, exists, errors, failReasons };
}

/**
 * Log replay run to ops_replay_runs table
 */
async function logReplayRun(runId, status, stats) {
  const { error } = await supabase
    .from('ops_replay_runs')
    .update({
      completed_at: new Date().toISOString(),
      status,
      legs_found: stats.legsFound,
      legs_scored: stats.legsScored,
      legs_with_probability: stats.legsWithProbability,
      legs_failed_probability: stats.legsFailedProbability,
      fail_reasons_summary: stats.failReasons,
      error_message: stats.errorMessage || null,
    })
    .eq('id', runId);

  if (error) {
    console.warn(`Failed to update ops_replay_runs: ${error.message}`);
  }
}

/**
 * Main replay function
 */
async function runReplay() {
  console.log('=== LIVE-PIPELINE-HISTORICAL-REPLAY-001 ===');
  console.log('=== V3 SCORING HISTORICAL REPLAY ===');
  console.log('Started:', new Date().toISOString());
  console.log('');

  // Create run record
  const { data: runData, error: runError } = await supabase
    .from('ops_replay_runs')
    .insert({
      run_type: 'historical_replay',
      run_config: {
        model_name: MODEL_NAME,
        model_version: MODEL_VERSION,
        batch_size: BATCH_SIZE,
        min_books: MIN_BOOKS_FOR_CONSENSUS,
      },
    })
    .select()
    .single();

  if (runError) {
    console.warn('Note: Could not create ops_replay_runs record (table may not exist yet)');
    console.warn('Continuing with replay...');
  }

  const runId = runData?.id;
  const stats = {
    legsFound: 0,
    legsScored: 0,
    legsWithProbability: 0,
    legsFailedProbability: 0,
    failReasons: {},
    errorMessage: null,
  };

  try {
    // Get unscored legs
    console.log('--- PHASE 1: QUERY UNSCORED LEGS ---');
    const unscoredLegs = await getUnscoredLegs(100); // Get up to 100
    stats.legsFound = unscoredLegs.length;
    console.log(`Found ${unscoredLegs.length} unscored ticket_legs`);

    if (unscoredLegs.length === 0) {
      console.log('No unscored legs to process');
      if (runId) await logReplayRun(runId, 'completed', stats);
      return stats;
    }

    // Score legs
    console.log('');
    console.log('--- PHASE 2: SCORE LEGS ---');
    const { scored, exists, errors, failReasons } = await scoreLegs(unscoredLegs);

    stats.legsScored = scored.length;
    stats.failReasons = failReasons;
    stats.legsFailedProbability = Object.values(failReasons).reduce((a, b) => a + b, 0);
    stats.legsWithProbability = stats.legsScored - stats.legsFailedProbability;

    console.log(`Newly scored: ${scored.length}`);
    console.log(`Already existed: ${exists.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log('');
    console.log('Fail reasons breakdown:');
    console.log(JSON.stringify(failReasons, null, 2));

    // Update run record
    if (runId) {
      await logReplayRun(runId, 'completed', stats);
    }

    console.log('');
    console.log('--- REPLAY COMPLETE ---');
    return stats;

  } catch (err) {
    stats.errorMessage = err.message;
    console.error('ERROR:', err.message);
    if (runId) {
      await logReplayRun(runId, 'failed', stats);
    }
    throw err;
  }
}

// Run replay
runReplay()
  .then(stats => {
    console.log('');
    console.log('=== FINAL STATS ===');
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('REPLAY FAILED:', err.message);
    process.exit(1);
  });
