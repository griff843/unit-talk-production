/**
 * Proof script: Scored leg probability fields example
 * Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002
 *
 * Shows the full probability layer output that would be written to scored_legs
 */

import {
  computeProbabilityLayer,
  type ProbabilityInput,
  type ProbabilityOutputOk,
} from '../src/lib/probability/probabilityLayer';
import type { BookOffer } from '../src/lib/probability/devigConsensus';

// Realistic example with 3 books
const bookOffers: BookOffer[] = [
  {
    bookId: 'fanduel',
    bookName: 'FanDuel',
    overOdds: -115,
    underOdds: -105,
    bookProfile: 'market_maker',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
  {
    bookId: 'draftkings',
    bookName: 'DraftKings',
    overOdds: -112,
    underOdds: -108,
    bookProfile: 'market_maker',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
  {
    bookId: 'pinnacle',
    bookName: 'Pinnacle',
    overOdds: -110,
    underOdds: -110,
    bookProfile: 'sharp',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
];

// High confidence pick on the OVER
const probInput: ProbabilityInput = {
  confidenceScore: 8.5, // High confidence → positive delta
  bookOffers,
  side: 'over',
  entryOdds: -115,
  sport: 'NBA',
  marketType: 'player_points_ou',
  hoursToStart: 6,
  featureCompleteness: 0.92,
};

const result = computeProbabilityLayer(probInput);

if (result.ok) {
  const probOk = result as ProbabilityOutputOk;

  // Format as scored_legs row would look
  const scoredLegFields = {
    _comment: 'Fields that would be written to scored_legs table',
    p_final: probOk.pFinal,
    uncertainty_final: probOk.uncertaintyFinal,
    edge_final: probOk.edgeFinal,
    clv_forecast: probOk.clvForecast,
    p_market_devig: probOk.pMarketDevig,
    devig_method: probOk.devigMethod,
    consensus_weights_json: probOk.consensusWeightsJson,
    probability_model_version: probOk.probabilityModelVersion,
    books_used: probOk.booksUsed,

    _analysis: {
      market_anchored_explanation: `P_final (${probOk.pFinal.toFixed(4)}) = P_market_devig (${probOk.pMarketDevig.toFixed(4)}) + delta`,
      confidence_to_delta: 'Confidence 8.5 → delta = +0.028 (70% of MAX_DELTA 0.04)',
      uncertainty_impact: `Uncertainty (${probOk.uncertaintyFinal.toFixed(4)}) shrinks delta toward 0`,
      edge_calculation: `Edge = P_final - P_market_devig = ${probOk.edgeFinal.toFixed(4)}`,
    },
  };

  console.log(JSON.stringify(scoredLegFields, null, 2));
} else {
  console.log('ERROR:', JSON.stringify(result, null, 2));
}
