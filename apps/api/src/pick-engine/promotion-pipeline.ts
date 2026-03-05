/**
 * Promotion Pipeline
 * Sprint: SPRINT-028-PRODUCTION-PICK-ENGINE
 *
 * Chains all filters sequentially. Tracks cascade statistics
 * showing how many records each filter eliminates.
 */

import { applyEdgeFilter } from './edge-filter';
import { applyLiquidityFilter } from './liquidity-filter';
import { applyMarketResistanceFilter, computeLineMovePct } from './market-resistance';
import { DEFAULT_CONFIG } from './pick-engine';
import { applyProbabilitySanity, computeKellyFraction } from './risk-sizing';

import type {
  PickEngineInput,
  PickEngineConfig,
  FilterResult,
  PromotionLogEntry,
  PromotionPipelineResult,
  FilterCascadeEntry,
} from './pick-engine';

const FILTER_ORDER = [
  'probability_sanity',
  'liquidity',
  'edge',
  'confidence',
  'market_resistance',
] as const;

export function runPromotionPipeline(
  inputs: PickEngineInput[],
  config: PickEngineConfig = DEFAULT_CONFIG
): PromotionPipelineResult {
  const promoted: PromotionLogEntry[] = [];
  const rejected: PromotionLogEntry[] = [];

  // Initialize cascade counters
  const cascade: Record<string, FilterCascadeEntry> = {};
  for (const name of FILTER_ORDER) {
    if (name === 'confidence' && config.skip_confidence) continue;
    cascade[name] = { input_count: 0, pass_count: 0, reject_count: 0, pass_rate_pct: 0 };
  }

  for (const input of inputs) {
    const filterResults: FilterResult[] = [];
    let firstReject: string | null = null;
    let stillPassing = true;

    // 1. Probability sanity
    const probResult = applyProbabilitySanity(input, config);
    filterResults.push(probResult);
    cascade['probability_sanity']!.input_count++;
    if (!probResult.passed) {
      stillPassing = false;
      firstReject = 'probability_sanity';
      cascade['probability_sanity']!.reject_count++;
    } else {
      cascade['probability_sanity']!.pass_count++;
    }

    // 2. Liquidity
    const liqResult = applyLiquidityFilter(input, config);
    filterResults.push(liqResult);
    if (stillPassing) {
      cascade['liquidity']!.input_count++;
      if (!liqResult.passed) {
        stillPassing = false;
        firstReject = 'liquidity';
        cascade['liquidity']!.reject_count++;
      } else {
        cascade['liquidity']!.pass_count++;
      }
    }

    // 3. Edge
    const edgeResult = applyEdgeFilter(input, config);
    filterResults.push(edgeResult);
    if (stillPassing) {
      cascade['edge']!.input_count++;
      if (!edgeResult.passed) {
        stillPassing = false;
        firstReject = 'edge';
        cascade['edge']!.reject_count++;
      } else {
        cascade['edge']!.pass_count++;
      }
    }

    // 4. Confidence (skippable)
    if (!config.skip_confidence) {
      const confPassed = input.score >= config.confidence_threshold;
      const confResult: FilterResult = {
        filter_name: 'confidence',
        passed: confPassed,
        value: input.score,
        threshold: config.confidence_threshold,
        reason: confPassed
          ? `score ${input.score.toFixed(1)} >= ${config.confidence_threshold}`
          : `score ${input.score.toFixed(1)} < ${config.confidence_threshold}`,
      };
      filterResults.push(confResult);
      if (stillPassing) {
        cascade['confidence']!.input_count++;
        if (!confPassed) {
          stillPassing = false;
          firstReject = 'confidence';
          cascade['confidence']!.reject_count++;
        } else {
          cascade['confidence']!.pass_count++;
        }
      }
    }

    // 5. Market resistance
    const mrResult = applyMarketResistanceFilter(input, config);
    filterResults.push(mrResult);
    if (stillPassing) {
      cascade['market_resistance']!.input_count++;
      if (!mrResult.passed) {
        stillPassing = false;
        firstReject = 'market_resistance';
        cascade['market_resistance']!.reject_count++;
      } else {
        cascade['market_resistance']!.pass_count++;
      }
    }

    // Build log entry
    const kelly = computeKellyFraction(input);
    const lineMovePct = computeLineMovePct(input);

    const entry: PromotionLogEntry = {
      market_key: input.market_key,
      event_id: input.event_id,
      market_type_id: input.market_type_id,
      participant_id: input.participant_id,
      accepted: stillPassing,
      filter_results: filterResults,
      first_reject_filter: firstReject,
      p_final: input.p_final,
      edge_final: input.edge_final,
      score: input.score,
      book_count: input.book_count,
      line_move_pct: lineMovePct,
      kelly_fraction: kelly?.halfKelly ?? null,
    };

    if (stillPassing) {
      promoted.push(entry);
    } else {
      rejected.push(entry);
    }
  }

  // Compute pass rates
  for (const key of Object.keys(cascade)) {
    const c = cascade[key]!;
    c.pass_rate_pct = c.input_count > 0 ? round((c.pass_count / c.input_count) * 100, 2) : 0;
  }

  return {
    promoted,
    rejected,
    filter_cascade: cascade,
    total_input: inputs.length,
    pass_rate_pct: inputs.length > 0 ? round((promoted.length / inputs.length) * 100, 3) : 0,
  };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
