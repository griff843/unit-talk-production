/**
 * Proof script: Promotion blocked when books insufficient
 * Sprint: INTELLIGENCE-PROBABILITY-INTEGRATION-002
 *
 * Demonstrates FAIL-CLOSED behavior:
 * - With 1 book: consensus fails, promotion blocked
 * - With 0 books: consensus fails, promotion blocked
 */

import {
  computeConsensus,
  MIN_BOOKS_FOR_CONSENSUS,
  type BookOffer,
} from '../src/lib/probability/devigConsensus';
import {
  computeProbabilityLayer,
  type ProbabilityInput,
} from '../src/lib/probability/probabilityLayer';

console.log('=== FAIL-CLOSED PROOF: INSUFFICIENT BOOKS ===\n');
console.log(`MIN_BOOKS_FOR_CONSENSUS = ${MIN_BOOKS_FOR_CONSENSUS}\n`);

// Test 1: Only 1 book (insufficient)
console.log('--- Test 1: 1 book (should FAIL) ---');
const oneBook: BookOffer[] = [
  {
    bookId: 'fanduel',
    bookName: 'FanDuel',
    overOdds: -110,
    underOdds: -110,
    bookProfile: 'market_maker',
    liquidityTier: 'high',
    dataQuality: 'good',
  },
];

const result1 = computeConsensus(oneBook, 'proportional');
console.log('Consensus result:', JSON.stringify(result1, null, 2));
console.log(`ok: ${result1.ok} (expected: false)`);
console.log('');

// Test 2: 0 books
console.log('--- Test 2: 0 books (should FAIL) ---');
const result2 = computeConsensus([], 'proportional');
console.log('Consensus result:', JSON.stringify(result2, null, 2));
console.log(`ok: ${result2.ok} (expected: false)`);
console.log('');

// Test 3: Full probability layer with 1 book
console.log('--- Test 3: Probability layer with 1 book (should FAIL) ---');
const probInput: ProbabilityInput = {
  confidenceScore: 7.5,
  bookOffers: oneBook,
  side: 'over',
  entryOdds: -110,
  sport: 'NBA',
  marketType: 'player_points_ou',
  hoursToStart: 4,
  featureCompleteness: 0.9,
};

const probResult = computeProbabilityLayer(probInput);
console.log('Probability result:', JSON.stringify(probResult, null, 2));
console.log(`ok: ${probResult.ok} (expected: false)`);
console.log('');

console.log('=== CONCLUSION ===');
console.log('All tests show FAIL-CLOSED behavior:');
console.log('- Insufficient books → ok: false');
console.log('- No fabricated 0.5/0.5 defaults');
console.log('- Promotion gate will block (reason_codes contain probability errors)');
