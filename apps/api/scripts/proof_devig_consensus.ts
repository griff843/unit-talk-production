/**
 * Proof script: Devig consensus computation example
 * Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002
 */

import { computeConsensus, type BookOffer } from '../src/lib/probability/devigConsensus';

// Example with 3 books - demonstrates weighted consensus
const bookOffers: BookOffer[] = [
  {
    bookId: 'fanduel',
    bookName: 'FanDuel',
    overOdds: -110,
    underOdds: -110,
    bookProfile: 'market_maker',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
  {
    bookId: 'draftkings',
    bookName: 'DraftKings',
    overOdds: -108,
    underOdds: -112,
    bookProfile: 'market_maker',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
  {
    bookId: 'pinnacle',
    bookName: 'Pinnacle',
    overOdds: -105,
    underOdds: -115,
    bookProfile: 'sharp',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
];

const result = computeConsensus(bookOffers, 'proportional');
console.log(JSON.stringify(result, null, 2));
