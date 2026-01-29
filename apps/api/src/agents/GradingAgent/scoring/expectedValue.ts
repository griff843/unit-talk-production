/**
 * expectedValue.ts — Expected Value calculation.
 *
 * Tranche 2, Stage 2 (2026-01-29): Fixed the -4.5% EV default bug.
 *
 * BEFORE: winProb defaulted to 0.5 when projected_win_prob was missing.
 *   At -110 odds: EV = (0.5 × 0.909) - 0.5 = -4.5% → punitive false negative.
 *
 * AFTER: winProb is derived from the market's own odds via devigging.
 *   1. If over_odds + under_odds exist → devig two-way market → trueProb.
 *   2. If only odds exists → americanToImpliedProb (biased, but much better than 0.5).
 *   3. Last resort → 0.5 (unchanged fallback).
 *
 * Uses DeviggingService for odds conversion (no duplicate implementations).
 */
import { deviggingService } from '../../../services/devigging/DeviggingService';

/**
 * Convert American odds to implied probability.
 * Thin wrapper around DeviggingService for inline use.
 */
function americanToImpliedProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  }
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

/**
 * Derive win probability from market odds via devigging.
 * Returns the fair (vig-removed) probability for the "over" side.
 */
// eslint-disable-next-line complexity
function deriveWinProbFromOdds(prop: any): number | null {
  const overOdds = prop.over_odds ?? null;
  const underOdds = prop.under_odds ?? null;

  // Best case: Both sides available → devig two-way market
  if (
    typeof overOdds === 'number' &&
    typeof underOdds === 'number' &&
    overOdds !== 0 &&
    underOdds !== 0
  ) {
    try {
      const devigged = deviggingService.devigTwoWay({
        odds1: overOdds,
        odds2: underOdds,
      });
      return devigged.outcome1.trueProb;
    } catch {
      // Fall through to single-side method
    }
  }

  // Fallback: Single side available → implied prob (includes vig, but better than 0.5)
  const singleOdds = overOdds ?? underOdds ?? prop.odds ?? null;
  if (typeof singleOdds === 'number' && singleOdds !== 0) {
    return americanToImpliedProb(singleOdds);
  }

  // No odds data at all
  return null;
}

const USE_V2 = process.env.SCORING_ENGINE_V2 === 'true';

export function calculateExpectedValue(prop: any): number {
  let winProb: number;

  if (USE_V2) {
    // V2 path: derive from devigged odds when projected_win_prob is missing
    winProb = prop.projected_win_prob ?? deriveWinProbFromOdds(prop) ?? 0.5;
  } else {
    // Legacy path: default to 0.5 (preserves old behavior)
    winProb = prop.projected_win_prob ?? 0.5;
  }

  const odds = prop.odds ?? -110;
  const payout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);

  // EV = (winProb × payout) - (1 - winProb)
  const devigged_edge = winProb * payout - (1 - winProb);
  return Math.round(devigged_edge * 100); // percent, so 5 = +5%
}
