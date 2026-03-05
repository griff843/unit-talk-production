/**
 * Liquidity Filter
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Markets with insufficient book coverage are excluded.
 * Requires book_count >= 4.
 */

import type { PickEngineInput, PickEngineConfig, FilterResult } from './pick-engine';

export function applyLiquidityFilter(
  input: PickEngineInput,
  config: PickEngineConfig
): FilterResult {
  const passed = input.book_count >= config.liquidity_threshold;
  return {
    filter_name: 'liquidity',
    passed,
    value: input.book_count,
    threshold: config.liquidity_threshold,
    reason: passed
      ? `book_count ${input.book_count} >= ${config.liquidity_threshold}`
      : `book_count ${input.book_count} < ${config.liquidity_threshold}`,
  };
}
