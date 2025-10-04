/**
 * Professional Odds Value Calculator
 * Calculates TRUE expected value and filters unprofessional picks
 */

/**
 * Convert American odds to implied probability
 */
export function oddsToImpliedProbability(odds: number): number {
  if (odds > 0) {
    // Underdog: odds / (odds + 100)
    return 100 / (odds + 100);
  } else {
    // Favorite: |odds| / (|odds| + 100)
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Devig two-way market to get true probabilities
 * Uses multiplicative method (industry standard)
 */
export function devigTwoWayMarket(odds1: number, odds2: number): {
  trueProb1: number;
  trueProb2: number;
  vig: number;
} {
  const impliedProb1 = oddsToImpliedProbability(odds1);
  const impliedProb2 = oddsToImpliedProbability(odds2);
  const totalProb = impliedProb1 + impliedProb2;
  const vig = totalProb - 1.0;

  // Devig using multiplicative method
  const trueProb1 = impliedProb1 / totalProb;
  const trueProb2 = impliedProb2 / totalProb;

  return { trueProb1, trueProb2, vig };
}

/**
 * Calculate TRUE expected value for a bet
 * Returns value in range -100 to +100
 */
export function calculateTrueExpectedValue(
  odds: number,
  trueProbability: number
): number {
  const impliedProb = oddsToImpliedProbability(odds);

  // Expected Value = (True Win Prob × Payout) - (True Lose Prob × Stake)
  let payout: number;
  if (odds > 0) {
    payout = odds / 100;
  } else {
    payout = 100 / Math.abs(odds);
  }

  const ev = (trueProbability * payout) - ((1 - trueProbability) * 1);

  // Convert to percentage
  return ev * 100;
}

/**
 * Professional Odds Filter
 * Returns true if odds pass professional standards
 */
export interface OddsFilterResult {
  passes: boolean;
  reason?: string;
  severity: 'reject' | 'warn' | 'pass';
}

export function applyProfessionalOddsFilter(odds: number): OddsFilterResult {
  // HARD REJECT: Anything worse than -300
  if (odds <= -300) {
    return {
      passes: false,
      reason: `Heavy favorite (${odds}) - No value, extremely high risk`,
      severity: 'reject'
    };
  }

  // HARD REJECT: Extreme underdogs (worse than +600)
  if (odds >= 600) {
    return {
      passes: false,
      reason: `Extreme longshot (${odds}) - Too volatile, low hit rate`,
      severity: 'reject'
    };
  }

  // WARNING: Moderate favorites (-200 to -299)
  if (odds <= -200 && odds > -300) {
    return {
      passes: true,
      reason: `Moderate favorite (${odds}) - Requires strong edge to justify`,
      severity: 'warn'
    };
  }

  // WARNING: High underdogs (+300 to +599)
  if (odds >= 300 && odds < 600) {
    return {
      passes: true,
      reason: `High underdog (${odds}) - Requires edge validation`,
      severity: 'warn'
    };
  }

  // PASS: Professional odds range
  return {
    passes: true,
    reason: 'Within professional odds range',
    severity: 'pass'
  };
}

/**
 * Calculate score penalty based on odds quality
 * Returns multiplier (0.0 to 1.0)
 */
export function calculateOddsPenalty(odds: number): number {
  // No penalty for -110 to +200 (sweet spot)
  if (odds >= -110 && odds <= 200) {
    return 1.0;
  }

  // Light penalty for -111 to -199
  if (odds < -110 && odds >= -200) {
    const penalty = (Math.abs(odds) - 110) / 900; // 0 to 0.1
    return Math.max(0.9, 1.0 - penalty);
  }

  // Heavy penalty for -200 to -299
  if (odds < -200 && odds > -300) {
    const penalty = (Math.abs(odds) - 200) / 200; // 0.5 to 1.0
    return Math.max(0.3, 0.5 - penalty);
  }

  // Moderate penalty for +201 to +299
  if (odds > 200 && odds < 300) {
    const penalty = (odds - 200) / 500; // 0 to 0.2
    return Math.max(0.8, 1.0 - penalty);
  }

  // Heavy penalty for +300 to +599
  if (odds >= 300 && odds < 600) {
    const penalty = (odds - 300) / 600; // 0.5 to 1.0
    return Math.max(0.2, 0.5 - penalty);
  }

  // Maximum penalty for out of range
  return 0.0;
}

/**
 * Calculate minimum required edge based on odds
 * Worse odds require higher edge to be profitable
 */
export function calculateMinimumRequiredEdge(odds: number): number {
  // -110 to +150: 2% edge minimum
  if (odds >= -110 && odds <= 150) {
    return 0.02;
  }

  // -200 to -111: 5% edge minimum
  if (odds < -110 && odds >= -200) {
    return 0.05;
  }

  // -299 to -201: 10% edge minimum
  if (odds < -200 && odds > -300) {
    return 0.10;
  }

  // +151 to +250: 3% edge minimum
  if (odds > 150 && odds <= 250) {
    return 0.03;
  }

  // +251 to +500: 5% edge minimum
  if (odds > 250 && odds < 600) {
    return 0.05;
  }

  // Out of range: 15% edge minimum
  return 0.15;
}
