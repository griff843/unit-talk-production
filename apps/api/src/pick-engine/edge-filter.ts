/**
 * Edge Filter
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Minimum edge requirement: edge_final >= 0.025 (2.5% EV).
 */

import type { PickEngineInput, PickEngineConfig, FilterResult } from './pick-engine';

export function applyEdgeFilter(input: PickEngineInput, config: PickEngineConfig): FilterResult {
  const passed = input.edge_final >= config.edge_threshold;
  return {
    filter_name: 'edge',
    passed,
    value: input.edge_final,
    threshold: config.edge_threshold,
    reason: passed
      ? `edge ${input.edge_final.toFixed(4)} >= ${config.edge_threshold}`
      : `edge ${input.edge_final.toFixed(4)} < ${config.edge_threshold}`,
  };
}
