/**
 * UNCERTAINTY-TRUTH-RESTORATION-002
 * Replay V3 Scoring - MATCHED LEGS ONLY
 *
 * This version only processes ticket_legs that have matching provider_offers.
 * Uses PRODUCTION computeProbabilityLayer() for TRUE uncertainty computation.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const MODEL_NAME = 'v3_scoring_adapter';
const MODEL_VERSION = 'v1.0.0';

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

function calculateOddsScore(odds: number | null): number {
  if (odds === null) return 50;
  if (odds < 0) {
    return Math.max(20, Math.min(70, 100 + odds * 0.3));
  }
  return Math.min(80, 50 + odds * 0.1);
}

async function runReplay() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  UNCERTAINTY-TRUTH-RESTORATION-002');
  console.log('  REPLAY V3 - MATCHED LEGS ONLY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Started:', new Date().toISOString());
  console.log('');

  // Find event_ids that have provider_offers
  const { data: eventIds } = await supabase
    .from('provider_offers')
    .select('event_id')
    .not('event_id', 'is', null)
    .limit(100);

  const uniqueEventIds = [...new Set(eventIds?.map(e => e.event_id) || [])];
  console.log('Unique event_ids in provider_offers:', uniqueEventIds.length);
  console.log('Sample:', uniqueEventIds.slice(0, 3));

  // Query ticket_legs that have matching event_ids
  const { data: legs, error } = await supabase
    .from('ticket_legs')
    .select(
      'id, ticket_id, event_id, market_type_id, participant_id, selection, provider_line, provider_odds, effective_value'
    )
    .in('event_id', uniqueEventIds)
    .not('market_type_id', 'is', null)
    .limit(50);

  if (error) {
    throw new Error(`Query error: ${error.message}`);
  }

  console.log(`Found ${legs?.length || 0} ticket_legs with matching event_ids`);

  if (!legs || legs.length === 0) {
    console.log('\nNo matching legs - will query ALL provider_offers for one event');

    // Get the actual event_id from provider_offers
    const eventId = uniqueEventIds[0];
    console.log(`\nChecking provider_offers for event_id: ${eventId}`);

    // Directly check what fetchBookOffers returns
    const bookOffers = await fetchBookOffers(supabase, {
      eventId: eventId,
      marketTypeId: 1, // Common market type
      participantId: null,
      maxAgeHours: 24 * 30, // Last 30 days
    });

    console.log(`fetchBookOffers returned: ${bookOffers.length} offers`);
    if (bookOffers.length > 0) {
      console.log('Sample book offers:', JSON.stringify(bookOffers.slice(0, 2), null, 2));
    }

    // Create a synthetic leg to test production probability computation
    if (bookOffers.length >= MIN_BOOKS_FOR_CONSENSUS) {
      console.log('\n--- Testing PRODUCTION computeProbabilityLayer ---');

      const probInput: ProbabilityInput = {
        confidenceScore: 5.0, // Neutral
        bookOffers,
        side: 'over',
        entryOdds: -110,
        sport: 'TEST',
        marketType: 'test',
        hoursToStart: null,
        featureCompleteness: 0.8,
      };

      const probOutput = computeProbabilityLayer(probInput);
      console.log('\nProbability output:');
      console.log(JSON.stringify(probOutput, null, 2));

      if (probOutput.ok) {
        console.log(
          '\n✅ PRODUCTION UNCERTAINTY:',
          probOutput.uncertaintyFinal.toFixed(4),
          `(${(probOutput.uncertaintyFinal * 100).toFixed(1)}%)`
        );
        console.log('   This is MULTI-FACTOR uncertainty (not 1/sqrt(n))');
      }
    }

    return { processed: 0, withProbability: 0, uncertaintySample: [] };
  }

  // Process matched legs
  const results: Array<{ legId: string; probability: ProbabilityResult }> = [];
  const uncertaintyValues: number[] = [];

  for (const leg of legs) {
    const bookOffers = await fetchBookOffers(supabase, {
      eventId: leg.event_id,
      marketTypeId: leg.market_type_id,
      participantId: leg.participant_id,
      maxAgeHours: 24 * 30,
    });

    if (bookOffers.length < MIN_BOOKS_FOR_CONSENSUS) {
      console.log(`Leg ${leg.id.substring(0, 8)}... - ${bookOffers.length} books (skip)`);
      continue;
    }

    // Map selection to side
    const side: 'over' | 'under' | 'yes' | 'no' =
      leg.selection === 'over' || leg.selection === 'yes'
        ? leg.selection
        : leg.selection === 'under' || leg.selection === 'no'
          ? leg.selection
          : 'over';

    const oddsScore = calculateOddsScore(leg.provider_odds);
    const confidenceScore = Math.min(10, Math.max(0, (oddsScore / 100) * 10));

    const probInput: ProbabilityInput = {
      confidenceScore,
      bookOffers,
      side,
      entryOdds: leg.provider_odds ?? -110,
      sport: 'TEST',
      marketType: 'moneyline',
      hoursToStart: null,
      featureCompleteness: 0.8,
    };

    const probOutput = computeProbabilityLayer(probInput);

    if (probOutput.ok) {
      const prob = probOutput as ProbabilityOutputOk;
      console.log(`\n--- Leg ${leg.id.substring(0, 8)}... ---`);
      console.log(`   books_used: ${prob.booksUsed}`);
      console.log(`   p_final: ${prob.pFinal.toFixed(4)}`);
      console.log(
        `   uncertainty_final: ${prob.uncertaintyFinal.toFixed(4)} (${(prob.uncertaintyFinal * 100).toFixed(1)}%) - PRODUCTION`
      );
      console.log(`   edge_final: ${prob.edgeFinal.toFixed(4)}`);

      uncertaintyValues.push(prob.uncertaintyFinal);

      results.push({
        legId: leg.id,
        probability: {
          p_final: prob.pFinal,
          uncertainty_final: prob.uncertaintyFinal,
          edge_final: prob.edgeFinal,
          clv_forecast: prob.clvForecast,
          p_market_devig: prob.pMarketDevig,
          devig_method: prob.devigMethod,
          consensus_weights_json: prob.consensusWeightsJson,
          probability_model_version: prob.probabilityModelVersion,
          books_used: prob.booksUsed,
          probability_fail_reason: null,
        },
      });
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  UNCERTAINTY DISTRIBUTION (PRODUCTION)');
  console.log('═══════════════════════════════════════════════════════════════');

  if (uncertaintyValues.length > 0) {
    const min = Math.min(...uncertaintyValues);
    const max = Math.max(...uncertaintyValues);
    const avg = uncertaintyValues.reduce((a, b) => a + b, 0) / uncertaintyValues.length;
    console.log(`Count: ${uncertaintyValues.length}`);
    console.log(`Min: ${min.toFixed(4)} (${(min * 100).toFixed(1)}%)`);
    console.log(`Max: ${max.toFixed(4)} (${(max * 100).toFixed(1)}%)`);
    console.log(`Avg: ${avg.toFixed(4)} (${(avg * 100).toFixed(1)}%)`);

    const U_MAX = 0.2;
    const passingGate = uncertaintyValues.filter(u => u <= U_MAX).length;
    const failingGate = uncertaintyValues.filter(u => u > U_MAX).length;
    console.log(`\nCCC Gate (U_MAX = ${(U_MAX * 100).toFixed(0)}%):`);
    console.log(`  Passing: ${passingGate}/${uncertaintyValues.length}`);
    console.log(`  Failing: ${failingGate}/${uncertaintyValues.length}`);
    console.log(
      `  Elimination rate: ${((failingGate / uncertaintyValues.length) * 100).toFixed(1)}%`
    );
  }

  return {
    processed: legs.length,
    withProbability: results.length,
    uncertaintySample: uncertaintyValues,
  };
}

runReplay()
  .then(result => {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('Final result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
