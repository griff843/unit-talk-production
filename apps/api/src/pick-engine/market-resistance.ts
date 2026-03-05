/**
 * Market Resistance Filter
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Detects market disagreement with model.
 * Rejects if sharp_fade detected OR line_move_pct < -5%.
 */

import type { PickEngineInput, PickEngineConfig, FilterResult } from './pick-engine';

export function computeLineMovePct(input: PickEngineInput): number | null {
  if (input.p_open_devig <= 0 || input.p_open_devig >= 1) return null;
  if (input.p_close_devig <= 0 || input.p_close_devig >= 1) return null;
  return ((input.p_close_devig - input.p_open_devig) / input.p_open_devig) * 100;
}

export function detectSharpFade(input: PickEngineInput): boolean {
  // Sharp fade: model sees positive edge but closing line moved against model direction.
  // -0.01 threshold filters noise from tiny CLV fluctuations.
  return input.edge_final > 0 && input.clv_prob < -0.01;
}

export function applyMarketResistanceFilter(
  input: PickEngineInput,
  config: PickEngineConfig
): FilterResult {
  const lineMovePct = computeLineMovePct(input);
  const sharpFade = detectSharpFade(input);

  const lineReject = lineMovePct !== null && lineMovePct < config.line_move_reject_pct;
  const rejected = sharpFade || lineReject;

  let reason: string;
  if (sharpFade && lineReject) {
    reason = `sharp_fade AND line_move ${lineMovePct?.toFixed(2)}% < ${config.line_move_reject_pct}%`;
  } else if (sharpFade) {
    reason = `sharp_fade: edge=${input.edge_final.toFixed(4)} > 0 but clv=${input.clv_prob.toFixed(4)} < -0.01`;
  } else if (lineReject) {
    reason = `line_move ${lineMovePct?.toFixed(2)}% < ${config.line_move_reject_pct}%`;
  } else {
    reason = `OK: line_move=${lineMovePct?.toFixed(2) ?? 'N/A'}%, no sharp fade`;
  }

  return {
    filter_name: 'market_resistance',
    passed: !rejected,
    value: lineMovePct ?? 0,
    threshold: config.line_move_reject_pct,
    reason,
  };
}
