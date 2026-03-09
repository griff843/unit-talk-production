/**
 * Promotion Band Calibration — SPRINT-036
 *
 * Deterministic promotion band assignment pipeline.
 * Converts selected picks into governed publication tiers.
 *
 * Usage:
 *   import { assignPromotionBand } from '../analysis/promotion';
 *   const result = assignPromotionBand(input);
 */

export type {
  BandTier,
  BandInput,
  BandOutput,
  LiquidityTier,
  RiskDecision,
  SelectionDecision,
} from './types';
export { BAND_ORDER } from './types';

export { initialBandAssignment } from './band-assignment';
export { applyBandDowngrades } from './band-downgrade-rules';
export {
  THRESHOLD_VERSION,
  EDGE_THRESHOLDS,
  SELECTION_SCORE_THRESHOLDS,
  UNCERTAINTY_CAPS,
  UNCERTAINTY_SUPPRESS_THRESHOLD,
  CLV_THRESHOLDS,
  LIQUIDITY_BAND_CAPS,
  MARKET_RESISTANCE_DOWNGRADE_THRESHOLD,
  MARKET_RESISTANCE_SUPPRESS_THRESHOLD,
  compareBands,
  lowerBand,
  downgradeOneStep,
} from './band-thresholds';

import { initialBandAssignment } from './band-assignment';
import { applyBandDowngrades } from './band-downgrade-rules';

import type { BandInput, BandOutput } from './types';

/**
 * Full promotion band assignment pipeline.
 * Takes a band input and returns the final band with full audit trail.
 *
 * This is the primary entry point for the promotion band system.
 * Deterministic: same input always produces same output.
 */
export function assignPromotionBand(input: BandInput): BandOutput {
  const { band: initial, thresholdVersion } = initialBandAssignment(input);
  const result = applyBandDowngrades(input, initial);

  // Ensure threshold version consistency
  return {
    ...result,
    thresholdVersion,
  };
}
