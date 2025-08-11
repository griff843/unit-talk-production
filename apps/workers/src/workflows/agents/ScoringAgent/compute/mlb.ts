/**
 * MLB Settlement Computation Logic
 * 
 * Determines WIN/LOSS/PUSH outcomes for MLB betting markets
 * Handles various market types with proper tolerance and edge case handling
 */

import { logger } from '../../../../utils/logger';

export type SettlementResult = 'WIN' | 'LOSS' | 'PUSH';
export type BetDirection = 'OVER' | 'UNDER' | 'EXACT';

export interface MarketSettlement {
  result: SettlementResult;
  actualValue: number;
  line: number;
  direction: BetDirection;
  confidence: number;
  notes?: string;
}

export interface SettlementInput {
  market: string;
  line: number;
  actualValue: number;
  direction?: string;
  book?: string;
}

// Tolerance for floating point comparisons
const FLOAT_TOLERANCE = 1e-9;

// Markets that commonly use half-lines (no push possible)
const HALF_LINE_MARKETS = new Set([
  'RUNS', 'HITS', 'RBI', 'HOME_RUNS', 'STRIKEOUTS', 'WALKS', 'TOTAL_BASES'
]);

// Markets that can have whole number lines with push possibilities
const WHOLE_LINE_MARKETS = new Set([
  'OUTS', 'INNINGS_PITCHED', 'EARNED_RUNS', 'HITS_ALLOWED'
]);

/**
 * Main settlement computation function
 * Takes bet parameters and actual result, returns settlement outcome
 */
export function computeMLBSettlement(input: SettlementInput): MarketSettlement {
  const { market, line, actualValue, direction = 'OVER', book } = input;
  
  const marketUpper = market.toUpperCase();
  const betDirection = normalizeDirection(direction);

  logger.debug('Computing MLB settlement', {
    market: marketUpper,
    line,
    actualValue,
    direction: betDirection,
    book
  });

  // Validate inputs
  if (typeof actualValue !== 'number' || isNaN(actualValue)) {
    throw new Error(`Invalid actual value: ${actualValue}`);
  }

  if (typeof line !== 'number' || isNaN(line)) {
    throw new Error(`Invalid line value: ${line}`);
  }

  // Determine if push is possible for this market/line combination
  const pushPossible = isPushPossible(marketUpper, line);

  // Calculate settlement result
  const result = determineSettlementResult(
    actualValue,
    line,
    betDirection,
    pushPossible
  );

  // Calculate confidence based on margin and market type
  const confidence = calculateConfidence(
    actualValue,
    line,
    result,
    marketUpper
  );

  // Add any special notes
  const notes = generateSettlementNotes(
    marketUpper,
    line,
    actualValue,
    result,
    betDirection
  );

  const settlement: MarketSettlement = {
    result,
    actualValue,
    line,
    direction: betDirection,
    confidence,
    notes
  };

  logger.debug('MLB settlement computed', settlement);

  return settlement;
}

/**
 * Normalize bet direction from various string formats
 */
function normalizeDirection(direction: string): BetDirection {
  const dirUpper = direction.toUpperCase().trim();
  
  if (dirUpper.includes('OVER') || dirUpper === 'O' || dirUpper === '+') {
    return 'OVER';
  }
  
  if (dirUpper.includes('UNDER') || dirUpper === 'U' || dirUpper === '-') {
    return 'UNDER';
  }
  
  if (dirUpper === 'EXACT' || dirUpper === '=') {
    return 'EXACT';
  }

  // Default to OVER if unclear
  logger.warn('Unclear bet direction, defaulting to OVER', { direction });
  return 'OVER';
}

/**
 * Determine if a push is possible for this market and line
 */
function isPushPossible(market: string, line: number): boolean {
  // Half-lines (.5) never allow pushes
  if (Math.abs(line % 1 - 0.5) < FLOAT_TOLERANCE) {
    return false;
  }

  // Whole lines on certain markets can push
  if (Math.abs(line % 1) < FLOAT_TOLERANCE) {
    return WHOLE_LINE_MARKETS.has(market) || 
           !HALF_LINE_MARKETS.has(market);
  }

  // Other fractional lines (e.g., .25, .75) typically don't push in MLB
  return false;
}

/**
 * Core settlement logic
 */
function determineSettlementResult(
  actual: number,
  line: number,
  direction: BetDirection,
  pushPossible: boolean
): SettlementResult {
  const diff = actual - line;
  
  // Check for exact push first (within tolerance)
  if (pushPossible && Math.abs(diff) < FLOAT_TOLERANCE) {
    return 'PUSH';
  }

  // OVER bets
  if (direction === 'OVER') {
    if (diff > FLOAT_TOLERANCE) {
      return 'WIN';
    } else {
      return 'LOSS';
    }
  }

  // UNDER bets  
  if (direction === 'UNDER') {
    if (diff < -FLOAT_TOLERANCE) {
      return 'WIN';
    } else {
      return 'LOSS';
    }
  }

  // EXACT bets (rare in MLB)
  if (direction === 'EXACT') {
    if (Math.abs(diff) < FLOAT_TOLERANCE) {
      return 'WIN';
    } else {
      return 'LOSS';
    }
  }

  throw new Error(`Unknown direction: ${direction}`);
}

/**
 * Calculate confidence score based on margin and market characteristics
 */
function calculateConfidence(
  actual: number,
  line: number,
  result: SettlementResult,
  market: string
): number {
  // Base confidence starts high for clear wins/losses
  let confidence = 0.95;

  // Pushes are always high confidence (exact match)
  if (result === 'PUSH') {
    return 0.99;
  }

  const margin = Math.abs(actual - line);

  // Reduce confidence for very close calls
  if (margin <= 0.5) {
    confidence = 0.85;
  } else if (margin <= 1.0) {
    confidence = 0.90;
  } else if (margin >= 5.0) {
    confidence = 0.99; // Very clear result
  }

  // Some markets have higher inherent uncertainty
  if (market.includes('TOTAL_BASES') || market.includes('RBI')) {
    confidence *= 0.95; // Slightly less confident on complex calculations
  }

  // Pitching stats can be more volatile
  if (market.includes('STRIKEOUTS') || market.includes('WALKS') || 
      market.includes('EARNED_RUNS')) {
    confidence *= 0.98;
  }

  return Math.max(0.1, Math.min(0.99, confidence));
}

/**
 * Generate human-readable notes about the settlement
 */
function generateSettlementNotes(
  market: string,
  line: number,
  actual: number,
  result: SettlementResult,
  direction: BetDirection
): string | undefined {
  const margin = Math.abs(actual - line);

  if (result === 'PUSH') {
    return `Exact match: ${actual} = ${line}`;
  }

  if (margin < 0.5) {
    return `Close call: ${actual} vs ${line} (margin: ${margin.toFixed(2)})`;
  }

  if (margin >= 10) {
    return `Decisive result: ${actual} vs ${line} (margin: ${margin.toFixed(0)})`;
  }

  // Special notes for specific markets
  if (market === 'TOTAL_BASES' && actual > 10) {
    return `Strong performance: ${actual} total bases`;
  }

  if (market.includes('HOME_RUNS') && actual >= 2) {
    return `Multi-homer game: ${actual} HR`;
  }

  if (market.includes('STRIKEOUTS') && actual >= 10) {
    return `Double-digit strikeouts: ${actual} K`;
  }

  return undefined;
}

/**
 * Validate market type and provide suggestions for unknown markets
 */
export function validateMLBMarket(market: string): {
  valid: boolean;
  suggestions?: string[];
  error?: string;
} {
  const marketUpper = market.toUpperCase();
  
  const knownMarkets = [
    'HITS', 'HOME_RUNS', 'HR', 'RBI', 'RUNS', 'TOTAL_BASES', 'TB',
    'DOUBLES', '2B', 'TRIPLES', '3B', 'STRIKEOUTS', 'K', 'SO', 
    'WALKS', 'BB', 'OUTS', 'INNINGS_PITCHED', 'EARNED_RUNS', 'ER',
    'HITS_ALLOWED', 'WINS', 'LOSSES'
  ];

  if (knownMarkets.includes(marketUpper)) {
    return { valid: true };
  }

  // Try to find similar markets
  const suggestions = knownMarkets.filter(known => 
    known.includes(marketUpper) || 
    marketUpper.includes(known) ||
    levenshteinDistance(marketUpper, known) <= 2
  ).slice(0, 3);

  return {
    valid: false,
    suggestions,
    error: `Unknown market: ${market}. Known markets: ${knownMarkets.join(', ')}`
  };
}

/**
 * Simple Levenshtein distance for market name suggestions
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len2][len1];
}