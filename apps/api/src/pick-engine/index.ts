/**
 * Pick Engine — Barrel Export
 * Sprint: SPRINT-035
 */

// Types
export type {
  PickEngineInput,
  FilterResult,
  PromotionLogEntry,
  PromotionPipelineResult,
  PickEngineConfig,
  FilterCascadeEntry,
} from './pick-engine';
export { DEFAULT_CONFIG } from './pick-engine';

// Filters
export { applyEdgeFilter } from './edge-filter';
export { applyLiquidityFilter } from './liquidity-filter';
export {
  computeLineMovePct,
  detectSharpFade,
  applyMarketResistanceFilter,
} from './market-resistance';
export { applyProbabilitySanity, computeKellyFraction } from './risk-sizing';
export type { KellyResult } from './risk-sizing';
export { applyPolicyFilter, loadMarketPolicies } from './pick-policy';
export type { MarketPolicy } from './pick-policy';

// Pipeline
export { runPromotionPipeline } from './promotion-pipeline';
