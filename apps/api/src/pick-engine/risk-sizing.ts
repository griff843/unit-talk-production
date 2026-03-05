/**
 * Risk Sizing — Probability Sanity + Kelly
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Filter: reject predictions where p_final < 0.52.
 * Informational: Kelly fraction for sizing context (not a filter).
 */

import type { PickEngineInput, PickEngineConfig, FilterResult } from './pick-engine';

export function applyProbabilitySanity(
  input: PickEngineInput,
  config: PickEngineConfig
): FilterResult {
  const passed = input.p_final >= config.p_final_min;
  return {
    filter_name: 'probability_sanity',
    passed,
    value: input.p_final,
    threshold: config.p_final_min,
    reason: passed
      ? `p_final ${input.p_final.toFixed(4)} >= ${config.p_final_min}`
      : `p_final ${input.p_final.toFixed(4)} < ${config.p_final_min}`,
  };
}

export interface KellyResult {
  fraction: number;
  halfKelly: number;
  quarterKelly: number;
}

export function computeKellyFraction(input: PickEngineInput): KellyResult | null {
  if (input.p_market_devig <= 0 || input.p_market_devig >= 1) return null;
  if (input.p_final <= 0 || input.p_final >= 1) return null;

  // Standard Kelly: f* = (b*p - q) / b
  // b = net decimal odds from market probability
  const b = 1 / input.p_market_devig - 1;
  const p = input.p_final;
  const q = 1 - p;
  const fraction = (b * p - q) / b;

  // Clamp to [0, 0.25]
  const clamped = Math.max(0, Math.min(0.25, fraction));

  return {
    fraction: clamped,
    halfKelly: clamped / 2,
    quarterKelly: clamped / 4,
  };
}
